import { randomUUID } from "node:crypto"
import type { AppUser } from "../auth.js"
import { folderPermissionSatisfies, hasPermission, type EffectiveFolderPermission } from "../authorization.js"
import type { GroupMembershipStore } from "../adapters/group-membership-store.js"
import type { ObjectStore } from "../adapters/object-store.js"
import type { UserGroupStore } from "../adapters/user-group-store.js"
import type { DocumentGroupStore } from "../adapters/document-group-store.js"
import type { FolderPolicyStore } from "../adapters/folder-policy-store.js"
import { FolderPermissionService } from "../folders/folder-permission-service.js"
import type {
  DocumentManifest,
  DocumentPermissionLevel,
  DocumentShareAuditAction,
  DocumentShareAuditLogEntry,
  DocumentShareGrant,
  DocumentShareLedger,
  EffectiveDocumentPermission,
  FolderPrincipalType
} from "../types.js"

export type DocumentPermissionServiceDeps = {
  objectStore: ObjectStore
  documentGroupStore: DocumentGroupStore
  folderPolicyStore: FolderPolicyStore
  userGroupStore: UserGroupStore
  groupMembershipStore: GroupMembershipStore
}

export type DocumentShareGrantInput = {
  principalType: FolderPrincipalType
  principalId: string
  permissionLevel: DocumentPermissionLevel
}

export type DocumentShareInfo = {
  inheritedFolderGrants: Array<{
    folderId: string
    permissionLevel: EffectiveFolderPermission
  }>
  directDocumentGrants: DocumentShareGrant[]
  currentUserEffectivePermission: EffectiveDocumentPermission
}

const documentShareLedgerKey = "documents/share-grants.json"

const permissionRank: Record<EffectiveDocumentPermission, number> = {
  none: 0,
  readOnly: 1,
  full: 2
}

const permissionByRank = ["none", "readOnly", "full"] as const

export class DocumentPermissionService {
  private readonly folderPermissionService: FolderPermissionService

  constructor(private readonly deps: DocumentPermissionServiceDeps) {
    this.folderPermissionService = new FolderPermissionService(deps)
  }

  async getShareInfo(user: AppUser, manifest: DocumentManifest): Promise<DocumentShareInfo> {
    const [ledger, folderPermission] = await Promise.all([
      this.loadLedger(),
      this.resolveFolderPermission(user, manifest)
    ])
    const directDocumentGrants = ledger.grants
      .filter((grant) => grant.documentId === manifest.documentId)
      .sort((a, b) => a.principalType.localeCompare(b.principalType) || a.principalId.localeCompare(b.principalId))
    const directPermission = await this.resolveDirectDocumentPermission(user, manifest.documentId, directDocumentGrants)
    return {
      inheritedFolderGrants: this.folderIds(manifest).map((folderId) => ({ folderId, permissionLevel: folderPermission })),
      directDocumentGrants,
      currentUserEffectivePermission: calculateEffectiveDocumentPermission(folderPermission, directPermission)
    }
  }

  async resolveEffectiveDocumentPermission(user: AppUser, manifest: DocumentManifest): Promise<EffectiveDocumentPermission> {
    if (user.cognitoGroups.includes("SYSTEM_ADMIN")) return "full"
    const ledger = await this.loadLedger()
    const folderPermission = await this.resolveFolderPermission(user, manifest)
    const directPermission = await this.resolveDirectDocumentPermission(
      user,
      manifest.documentId,
      ledger.grants.filter((grant) => grant.documentId === manifest.documentId)
    )
    return calculateEffectiveDocumentPermission(folderPermission, directPermission)
  }

  async replaceDocumentShareGrants(
    actor: AppUser,
    manifest: DocumentManifest,
    grants: DocumentShareGrantInput[],
    reason: string
  ): Promise<DocumentShareInfo> {
    validateDocumentShareRequest(grants, reason)
    const now = new Date().toISOString()
    const ledger = await this.loadLedger()
    const before = ledger.grants.filter((grant) => grant.documentId === manifest.documentId)
    const normalized = normalizeGrantInputs(grants)
    const nextGrants: DocumentShareGrant[] = normalized.map((grant) => ({
      documentShareGrantId: `docshare_${randomUUID().slice(0, 12)}`,
      itemType: "documentShareGrant",
      tenantId: String(manifest.metadata?.tenantId ?? "default"),
      documentId: manifest.documentId,
      principalType: grant.principalType,
      principalId: grant.principalId,
      permissionLevel: grant.permissionLevel,
      createdBy: actor.userId,
      reason,
      createdAt: now,
      updatedAt: now
    }))
    ledger.grants = [
      ...ledger.grants.filter((grant) => grant.documentId !== manifest.documentId),
      ...nextGrants
    ]
    appendAudit(ledger, actor, "document:share", manifest.documentId, before, nextGrants, reason, now)
    await this.saveLedger(ledger)
    return this.getShareInfo(actor, manifest)
  }

  async appendDocumentAudit(
    actor: AppUser,
    action: DocumentShareAuditAction,
    documentId: string,
    before: unknown,
    after: unknown,
    reason: string
  ): Promise<void> {
    const ledger = await this.loadLedger()
    appendAudit(ledger, actor, action, documentId, before, after, reason, new Date().toISOString())
    await this.saveLedger(ledger)
  }

  async listAuditLog(): Promise<DocumentShareAuditLogEntry[]> {
    const ledger = await this.loadLedger()
    return [...ledger.auditLog].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200)
  }

  async loadLedger(): Promise<DocumentShareLedger> {
    try {
      const raw = JSON.parse(await this.deps.objectStore.getText(documentShareLedgerKey)) as Partial<DocumentShareLedger>
      return {
        schemaVersion: 1,
        grants: Array.isArray(raw.grants) ? raw.grants : [],
        auditLog: Array.isArray(raw.auditLog) ? raw.auditLog : []
      }
    } catch (err) {
      if (isMissingObjectError(err) || err instanceof SyntaxError) return { schemaVersion: 1, grants: [], auditLog: [] }
      throw err
    }
  }

  private async saveLedger(ledger: DocumentShareLedger): Promise<void> {
    await this.deps.objectStore.putText(documentShareLedgerKey, JSON.stringify({
      schemaVersion: 1,
      grants: ledger.grants,
      auditLog: ledger.auditLog.slice(0, 500)
    }, null, 2), "application/json")
  }

  private async resolveFolderPermission(user: AppUser, manifest: DocumentManifest): Promise<EffectiveFolderPermission> {
    const folderIds = this.folderIds(manifest)
    if (folderIds.length === 0) return "none"
    const permissions = await this.folderPermissionService.resolveEffectiveFolderPermissions(user, folderIds)
    return maxPermission(folderIds.map((folderId) => permissions[folderId] ?? "none"))
  }

  private async resolveDirectDocumentPermission(
    user: AppUser,
    documentId: string,
    grants: DocumentShareGrant[]
  ): Promise<EffectiveDocumentPermission> {
    const permissions = await Promise.all(grants.map((grant) => this.evaluateGrant(user, grant)))
    return maxPermission(permissions, documentId)
  }

  private async evaluateGrant(user: AppUser, grant: DocumentShareGrant): Promise<EffectiveDocumentPermission> {
    if (grant.principalType === "user") {
      return user.userId === grant.principalId || user.email === grant.principalId ? grant.permissionLevel : "none"
    }
    const membershipPermission = await this.resolveUserMembershipPermission(user, grant.principalId, new Set())
    return minPermission(grant.permissionLevel, membershipPermission)
  }

  private async resolveUserMembershipPermission(user: AppUser, groupId: string, visited: Set<string>): Promise<EffectiveDocumentPermission> {
    if (visited.has(groupId)) return "none"
    visited.add(groupId)
    const group = await this.deps.userGroupStore.get(groupId)
    if (group?.status === "archived") return "none"
    if (user.cognitoGroups.includes(groupId)) return "full"

    const memberships = await this.deps.groupMembershipStore.listByGroupId(groupId)
    const grants: EffectiveDocumentPermission[] = []
    for (const membership of memberships) {
      if (membership.memberType === "user") {
        if (membership.memberId === user.userId || membership.memberId === user.email) grants.push(membership.permissionLevel)
        continue
      }
      const childPermission = await this.resolveUserMembershipPermission(user, membership.memberId, new Set(visited))
      grants.push(minPermission(membership.permissionLevel, childPermission))
    }
    return maxPermission(grants, groupId)
  }

  private folderIds(manifest: DocumentManifest): string[] {
    return stringArray(manifest.metadata?.folderIds ?? manifest.metadata?.folderId ?? manifest.metadata?.groupIds ?? manifest.metadata?.groupId)
  }
}

export function calculateEffectiveDocumentPermission(
  folderPermission: EffectiveFolderPermission,
  directDocumentPermission: EffectiveDocumentPermission
): EffectiveDocumentPermission {
  return maxPermission([folderPermission, directDocumentPermission])
}

export function canShareDocument(permission: EffectiveDocumentPermission, user: AppUser): boolean {
  return permission === "full" && hasPermission(user, "rag:doc:share")
}

export function canMoveDocument(
  documentPermission: EffectiveDocumentPermission,
  destinationFolderPermission: EffectiveFolderPermission,
  user: AppUser
): boolean {
  return documentPermission === "full" && folderPermissionSatisfies(destinationFolderPermission, "full") && hasPermission(user, "rag:doc:move")
}

export function validateDocumentShareRequest(grants: DocumentShareGrantInput[], reason: string): void {
  if (!reason.trim()) throw new Error("reason is required")
  normalizeGrantInputs(grants)
}

export function validateDocumentMoveRequest(input: { destinationFolderId?: string; reason?: string }): void {
  if (!input.destinationFolderId?.trim()) throw new Error("destinationFolderId is required")
  if (!input.reason?.trim()) throw new Error("reason is required")
}

function normalizeGrantInputs(grants: DocumentShareGrantInput[]): DocumentShareGrantInput[] {
  const seen = new Set<string>()
  return grants.map((grant) => ({
    principalType: grant.principalType,
    principalId: grant.principalId.trim(),
    permissionLevel: grant.permissionLevel
  })).filter((grant) => {
    if (!grant.principalId) throw new Error("principalId is required")
    const key = `${grant.principalType}:${grant.principalId}`
    if (seen.has(key)) throw new Error(`duplicate grant: ${key}`)
    seen.add(key)
    return true
  })
}

function minPermission(left: EffectiveDocumentPermission, right: EffectiveDocumentPermission): EffectiveDocumentPermission {
  return permissionByRank[Math.min(permissionRank[left], permissionRank[right])] ?? "none"
}

function maxPermission(values: EffectiveDocumentPermission[], _debugId?: string): EffectiveDocumentPermission {
  const rank = values.reduce((current, value) => Math.max(current, permissionRank[value]), 0)
  return permissionByRank[rank] ?? "none"
}

function stringArray(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string")
  return []
}

function appendAudit(
  ledger: DocumentShareLedger,
  actor: AppUser,
  action: DocumentShareAuditAction,
  documentId: string,
  before: unknown,
  after: unknown,
  reason: string,
  createdAt: string
) {
  ledger.auditLog.unshift({
    auditId: `audit_${randomUUID().slice(0, 12)}`,
    action,
    actorUserId: actor.userId,
    documentId,
    before: toJsonValue(before),
    after: toJsonValue(after),
    reason,
    createdAt
  })
  ledger.auditLog = ledger.auditLog.slice(0, 500)
}

function toJsonValue(value: unknown): DocumentShareAuditLogEntry["before"] {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value)) as DocumentShareAuditLogEntry["before"]
}

function isMissingObjectError(err: unknown): boolean {
  const candidate = err as { code?: string; name?: string; message?: string; $metadata?: { httpStatusCode?: number } }
  return candidate?.code === "ENOENT" ||
    candidate?.name === "NoSuchKey" ||
    candidate?.$metadata?.httpStatusCode === 404 ||
    (typeof candidate?.message === "string" && candidate.message.includes("NoSuchKey"))
}
