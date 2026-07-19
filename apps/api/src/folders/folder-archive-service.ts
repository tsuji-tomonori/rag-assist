import type { AppUser } from "../auth.js"
import type { Dependencies } from "../dependencies.js"
import {
  ObjectStoreRevocationCleanupCoordinator,
  type RegisterRevocationCleanupInput
} from "../rag/_shared/security/revocation-cleanup-coordinator.js"
import {
  ObjectStoreRevocationCleanupRepairOutbox,
  type RevocationCleanupRepairIntent
} from "../rag/_shared/security/revocation-cleanup-repair-outbox.js"
import { tenantManifestPrefix } from "../rag/_shared/storage/tenant-artifacts.js"
import {
  enforceResolvedResourceOperation,
  resolvedResourceScope,
  ResourceOperationAuthorizationError
} from "../security/production-resource-operation-authorizer.js"
import {
  ObjectStoreSecurityMutationAuditOutbox,
  type SecurityMutationAuditOutboxPort,
  type SecurityMutationResult
} from "../security/security-mutation-audit-outbox.js"
import type { DocumentGroup, DocumentManifest, JsonValue } from "../types.js"
import { FolderPermissionService } from "./folder-permission-service.js"

export const FOLDER_ARCHIVE_POLICY_VERSION = "folder-archive-policy-v1" as const

type FolderArchiveDeps = Pick<Dependencies,
  | "objectStore"
  | "documentGroupStore"
  | "folderPolicyStore"
  | "userGroupStore"
  | "groupMembershipStore"
  | "resourceUserPrincipalDirectory"
  | "securityAuditOutbox"
  | "localTestIngestAdmissionContext"
  | "legacyGlobalDocumentArtifacts"
> & Readonly<{
  cleanupCoordinator?: Pick<ObjectStoreRevocationCleanupCoordinator, "register">
  cleanupRepairOutbox?: Pick<
    ObjectStoreRevocationCleanupRepairOutbox,
    "prepare" | "markDenyCommitted" | "markCleanupRegistered" | "markAbandoned"
  >
}>

export type ArchiveFolderInput = Readonly<{
  expectedVersion: string
  reason: string
}>

export class FolderArchiveError extends Error {
  constructor(
    message: string,
    readonly result: Exclude<SecurityMutationResult, "success">,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = "FolderArchiveError"
  }
}

/** Safe folder deletion is represented by a CAS archive of an empty folder. */
export class FolderArchiveService {
  private readonly permissions: FolderPermissionService
  private readonly auditOutbox: SecurityMutationAuditOutboxPort
  private readonly cleanupCoordinator: Pick<ObjectStoreRevocationCleanupCoordinator, "register">
  private readonly cleanupRepairOutbox: Pick<
    ObjectStoreRevocationCleanupRepairOutbox,
    "prepare" | "markDenyCommitted" | "markCleanupRegistered" | "markAbandoned"
  >

  constructor(
    private readonly deps: FolderArchiveDeps,
    private readonly now: () => Date = () => new Date()
  ) {
    this.permissions = new FolderPermissionService(deps)
    this.auditOutbox = deps.securityAuditOutbox ?? new ObjectStoreSecurityMutationAuditOutbox(deps.objectStore, now)
    this.cleanupCoordinator = deps.cleanupCoordinator ?? new ObjectStoreRevocationCleanupCoordinator(deps.objectStore, now)
    this.cleanupRepairOutbox = deps.cleanupRepairOutbox ?? new ObjectStoreRevocationCleanupRepairOutbox(deps.objectStore)
  }

  async archive(actor: AppUser, folderId: string, input: ArchiveFolderInput): Promise<DocumentGroup> {
    validateInput(folderId, input)
    if (!canonical(actor.tenantId)) throw new FolderArchiveError("Forbidden", "denied")
    const actorTenantId = actor.tenantId
    let current: DocumentGroup | undefined
    let archived: DocumentGroup
    try {
      current = await this.deps.documentGroupStore.get(actorTenantId, folderId)
    } catch {
      await this.recordEarlyFailure(actor, folderId, input, "failed")
      throw new FolderArchiveError("Folder archive failed", "failed")
    }
    if (!current || current.status === "archived" || !canonical(current.tenantId)) {
      await this.recordEarlyFailure(actor, folderId, input, "denied")
      throw new FolderArchiveError("Forbidden", "denied")
    }
    const next: DocumentGroup = { ...current, status: "archived", updatedAt: this.now().toISOString() }
    const audit = await this.auditOutbox.prepare({
      actorId: actor.userId,
      tenantId: current.tenantId,
      targetType: "folder",
      targetId: folderId,
      operation: "delete",
      before: auditFolder(current),
      proposedAfter: auditFolder(next),
      reason: input.reason,
      policyVersion: FOLDER_ARCHIVE_POLICY_VERSION
    })
    let cleanupRepair: RevocationCleanupRepairIntent | undefined
    try {
      if (input.expectedVersion !== current.updatedAt) throw new FolderArchiveError("Folder version conflict", "conflict")
      const detail = await this.permissions.resolveEffectiveFolderPermissionDetail(actor, folderId)
      const groups = await this.deps.documentGroupStore.list(current.tenantId)
      const descendantIds = new Set(groups
        .filter((group) => group.status !== "archived" && (group.ancestorGroupIds ?? []).includes(folderId))
        .map((group) => group.groupId))
      if (descendantIds.size > 0) throw new FolderArchiveError("Folder has active descendants", "conflict")
      if (await this.hasActiveDocuments(current.tenantId, folderId)) {
        throw new FolderArchiveError("Folder has active documents", "conflict")
      }
      enforceResolvedResourceOperation(actor, {
        resourceType: "folder",
        operation: "delete",
        authorizationPath: "target",
        resourceScopes: {
          target: resolvedResourceScope({
            tenantId: current.tenantId,
            permission: detail.permission,
            administrativePrincipal: current.adminPrincipalType === "user" && current.adminPrincipalId === actor.userId
          })
        },
        satisfiedGuards: ["descendantImpactConfirmed", "denyFirstLifecycleApplied"]
      })
      const cleanupRegistration = folderArchiveCleanupRegistration(audit.intentId, next)
      cleanupRepair = await this.cleanupRepairOutbox.prepare({
        expectedBeforeDenyVersion: current.updatedAt,
        cleanupRegistration,
        preparedAt: next.updatedAt
      })
      const [committed] = await this.deps.documentGroupStore.updateWithPathLocks(current.tenantId, [{ current, next }])
      if (!committed) throw new Error("Folder archive returned no state")
      archived = committed
    } catch (error) {
      if (cleanupRepair) {
        await this.cleanupRepairOutbox.markAbandoned(cleanupRepair, this.now().toISOString()).catch(() => undefined)
      }
      const normalized = normalizeError(error)
      await this.auditOutbox.complete(audit.intentId, current.tenantId, normalized.result, auditFolder(current))
      throw normalized
    }
    try {
      if (!cleanupRepair) throw new Error("Folder archive cleanup repair was not prepared")
      if (cleanupRepair.cleanupRegistration.authoritativeDenyVersion !== folderArchiveDenyVersion(archived)) {
        throw new Error("Folder archive deny version does not match its cleanup repair intent")
      }
      const committedRepair = await this.cleanupRepairOutbox.markDenyCommitted(
        cleanupRepair,
        archived.updatedAt
      )
      await this.cleanupCoordinator.register(committedRepair.cleanupRegistration)
      await this.cleanupRepairOutbox.markCleanupRegistered(committedRepair, archived.updatedAt)
    } catch (error) {
      // The archived state and pre-CAS repair are durable. Keep the audit
      // pending so the cleanup worker can recreate the ledger before the
      // authoritative resolver finalizes the operation.
      throw new FolderArchiveError("Folder archive cleanup registration failed", "failed", { cause: error })
    }
    try {
      await this.auditOutbox.complete(audit.intentId, current.tenantId, "success", auditFolder(archived))
    } catch (error) {
      // The pending intent is the durable reconciliation record. Never write a
      // contradictory failed completion after the folder already changed.
      throw new FolderArchiveError("Folder archive audit completion failed", "failed", { cause: error })
    }
    return archived
  }

  private async recordEarlyFailure(
    actor: AppUser,
    folderId: string,
    input: ArchiveFolderInput,
    result: Extract<SecurityMutationResult, "denied" | "failed">
  ): Promise<void> {
    if (!canonical(actor.userId) || !canonical(actor.tenantId)) throw new FolderArchiveError("Forbidden", "denied")
    const audit = await this.auditOutbox.prepare({
      actorId: actor.userId,
      tenantId: actor.tenantId,
      targetType: "folder",
      targetId: folderId,
      operation: "delete",
      before: null,
      proposedAfter: { folderId, expectedVersion: input.expectedVersion, requestedStatus: "archived" },
      reason: input.reason,
      policyVersion: FOLDER_ARCHIVE_POLICY_VERSION
    })
    await this.auditOutbox.complete(audit.intentId, actor.tenantId, result, null)
  }

  private async hasActiveDocuments(tenantId: string, folderId: string): Promise<boolean> {
    const keys = await this.deps.objectStore.listKeys(tenantManifestPrefix(this.deps, tenantId))
    for (const key of keys.filter((candidate) => candidate.endsWith(".json"))) {
      try {
        const manifest = JSON.parse(await this.deps.objectStore.getText(key)) as DocumentManifest
        if ((manifest.lifecycleStatus ?? stringValue(manifest.metadata?.lifecycleStatus) ?? "active") !== "active") continue
        const folderIds = stringArray(
          manifest.metadata?.folderIds ?? manifest.metadata?.folderId ?? manifest.metadata?.groupIds ?? manifest.metadata?.groupId
        )
        if (folderIds.includes(folderId)) return true
      } catch (error) {
        if (isMissingObjectError(error)) continue
        // An unreadable manifest prevents a reliable descendant-impact preview.
        throw new FolderArchiveError("Folder document impact is unavailable", "failed")
      }
    }
    return false
  }
}

export function folderArchiveCleanupRegistration(
  auditIntentId: string,
  archived: DocumentGroup
): RegisterRevocationCleanupInput & { operationId: string } {
  if (
    !canonical(auditIntentId)
    || !canonical(archived.tenantId)
    || !canonical(archived.groupId)
    || archived.status !== "archived"
    || !isCanonicalTimestamp(archived.updatedAt)
  ) throw new Error("Folder archive cleanup identity is invalid")
  const reference = `folder:${archived.groupId}`
  return {
    operationId: `folder-archive:${auditIntentId}`,
    tenantId: archived.tenantId,
    resourceType: "folder",
    resourceId: archived.groupId,
    trigger: "archived",
    deniedPurposes: ["normal_rag", "external_model", "logging", "evaluation"],
    authoritativeDenyVersion: folderArchiveDenyVersion(archived),
    authoritativeDenyConfirmedAt: archived.updatedAt,
    knownTargets: [
      { scope: "grant", reference },
      { scope: "cache", reference },
      { scope: "session", reference: `${reference}/session` },
      { scope: "queued_run", reference },
      { scope: "evaluation_artifact", reference }
    ]
  }
}

function folderArchiveDenyVersion(archived: DocumentGroup): string {
  return `folder:${archived.updatedAt}`
}

function validateInput(folderId: string, input: ArchiveFolderInput): void {
  if (!canonical(folderId) || !canonical(input.expectedVersion)) throw new FolderArchiveError("Invalid folder archive request", "denied")
  if (!canonical(input.reason) || input.reason.length > 1000) throw new FolderArchiveError("Mutation reason is required", "denied")
}

function auditFolder(folder: DocumentGroup): JsonValue {
  return {
    groupId: folder.groupId,
    tenantId: folder.tenantId ?? null,
    parentGroupId: folder.parentGroupId ?? null,
    canonicalPath: folder.canonicalPath ?? null,
    status: folder.status ?? "active",
    updatedAt: folder.updatedAt
  }
}

function normalizeError(error: unknown): FolderArchiveError {
  if (error instanceof FolderArchiveError) return error
  if (error instanceof ResourceOperationAuthorizationError) return new FolderArchiveError("Forbidden", "denied")
  if (error instanceof Error && (
    (error as Error & { code?: string }).code === "PRECONDITION_FAILED" ||
    error.message.includes("changed before")
  )) return new FolderArchiveError("Folder version conflict", "conflict")
  return new FolderArchiveError("Folder archive failed", "failed")
}

function stringArray(value: JsonValue | undefined): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string")
  return typeof value === "string" ? [value] : []
}

function stringValue(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined
}

function canonical(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}

function isCanonicalTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}

function isMissingObjectError(error: unknown): boolean {
  return error instanceof Error && (
    (error as NodeJS.ErrnoException).code === "ENOENT" ||
    error.name === "NoSuchKey" ||
    error.name === "NotFound"
  )
}
