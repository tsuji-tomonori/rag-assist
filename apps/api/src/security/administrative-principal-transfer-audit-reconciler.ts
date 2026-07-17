import type { DocumentGroupStore } from "../adapters/document-group-store.js"
import type { ObjectStore } from "../adapters/object-store.js"
import type { UserGroupStore } from "../adapters/user-group-store.js"
import type { Dependencies } from "../dependencies.js"
import { tenantManifestKey } from "../rag/_shared/storage/tenant-artifacts.js"
import type { JsonValue } from "../types.js"
import { ADMINISTRATIVE_PRINCIPAL_TRANSFER_POLICY_VERSION } from "./administrative-principal-transfer-service.js"
import type {
  SecurityMutationAuditAuthoritativeResolution,
  SecurityMutationAuditAuthoritativeResolver
} from "./security-mutation-audit-reconciler.js"
import type {
  SecurityMutationAuditDraft,
  SecurityMutationAuditIntent,
  SecurityMutationResult
} from "./security-mutation-audit-outbox.js"

type ArtifactPolicy = Pick<Dependencies, "localTestIngestAdmissionContext" | "legacyGlobalDocumentArtifacts">

export type AdministrativePrincipalTransferAuditResolverDeps = ArtifactPolicy & Readonly<{
  objects: Pick<ObjectStore, "getText">
  folders: Pick<DocumentGroupStore, "get">
  resourceGroups: Pick<UserGroupStore, "get">
}>

type TransferEntry = Readonly<{ source: Record<string, unknown>; target: Record<string, unknown> }>
type DocumentTransferEntry = TransferEntry & Readonly<{ sourceVersion: string }>

type TransferState = Readonly<{
  operationId: string
  status: "prepared" | "transferring" | "rollback_pending" | "rolled_back" | "committed"
  actorId: string
  tenantId: string
  sourceUserId: string
  successorUserId: string
  reason: string
  folders: TransferEntry[]
  resourceGroups: TransferEntry[]
  documents: DocumentTransferEntry[]
  auditIntentId: string
  createdAt: string
  updatedAt: string
}>

const nonSuccessResults = new Set<SecurityMutationResult>(["denied", "conflict", "failed"])

/** Reconciles an ownership transfer audit without repeating any ownership mutation. */
export class AdministrativePrincipalTransferAuditAuthoritativeResolver implements SecurityMutationAuditAuthoritativeResolver {
  constructor(private readonly deps: AdministrativePrincipalTransferAuditResolverDeps) {}

  supports(draft: SecurityMutationAuditDraft): boolean {
    return draft.targetType === "administrativePrincipal" && draft.operation === "ownership.transfer"
  }

  async resolve(intent: SecurityMutationAuditIntent): Promise<SecurityMutationAuditAuthoritativeResolution> {
    if (!this.supports(intent.draft)) {
      throw new Error("Administrative-principal transfer audit resolver does not support this intent")
    }
    const { tenantId, targetId } = intent.draft
    assertIdentifier(tenantId, "tenantId")
    assertIdentifier(targetId, "targetId")
    if (intent.draft.policyVersion !== ADMINISTRATIVE_PRINCIPAL_TRANSFER_POLICY_VERSION) {
      throw new Error("Administrative-principal transfer audit policy version is invalid")
    }
    const before = canonicalInventory(intent.draft.before, targetId, "before state")
    const proposal = canonicalProposal(intent.draft.proposedAfter, before)

    const rawState = await this.readState(tenantId, targetId)
    const requested = intent.requestedCompletion
    const preserved = resolvePreservedCompletion(intent, before, rawState)
    if (preserved) return preserved
    if (rawState === undefined) {
      if (requested?.result === "success" && before.total === 0 && sameJson(requested.after, before)) {
        return { result: "success", after: requested.after }
      }
      throw new Error("Administrative-principal transfer authoritative state is unavailable")
    }
    const { state, originAuditIntent } = canonicalState(rawState, intent, proposal)
    if (!originAuditIntent && requested?.result !== "success") {
      throw new Error("Administrative-principal transfer state is not bound to this audit intent")
    }

    if (!requested) {
      if (state.status === "committed") {
        await this.assertCurrentState(state, "target")
        return { result: "success", after: successAuditValue(state) }
      }
      if (state.status === "rollback_pending" || state.status === "rolled_back") {
        await this.assertCurrentState(state, "source")
        return { result: "failed", after: inventoryFromState(state) }
      }
      throw new Error("Pending administrative-principal transfer audit is not in a converged state")
    }

    if (requested.result === "success") {
      if (state.status !== "transferring" && state.status !== "committed") {
        throw new Error("Administrative-principal transfer success is not in a converged state")
      }
      const expected = successAuditValue(state)
      if (!sameJson(requested.after, expected)) {
        throw new Error("Administrative-principal transfer state does not confirm the requested success")
      }
      await this.assertCurrentState(state, "target")
      return { result: "success", after: requested.after }
    }

    if (
      requested.result !== "failed"
      || (state.status !== "rollback_pending" && state.status !== "rolled_back")
    ) {
      throw new Error("Administrative-principal transfer non-success is not authoritatively converged")
    }
    const expected = inventoryFromState(state)
    if (!sameJson(requested.after, expected)) {
      throw new Error("Administrative-principal transfer rollback does not confirm the requested failure")
    }
    await this.assertCurrentState(state, "source")
    return { result: "failed", after: requested.after }
  }

  private async readState(tenantId: string, sourceUserId: string): Promise<unknown | undefined> {
    const key = `security/ownership-transfer/${encodeURIComponent(tenantId)}/${encodeURIComponent(sourceUserId)}.json`
    try {
      return JSON.parse(await this.deps.objects.getText(key)) as unknown
    } catch (error) {
      if (isMissingObjectError(error)) return undefined
      if (error instanceof SyntaxError) {
        throw new Error("Administrative-principal transfer state is not valid JSON", { cause: error })
      }
      throw new Error("Administrative-principal transfer state is unreadable", { cause: error })
    }
  }

  private async assertCurrentState(state: TransferState, side: "source" | "target"): Promise<void> {
    for (const entry of state.folders) {
      const expected = entry[side]
      const id = identifier(expected.groupId, "folder groupId")
      const current = await this.deps.folders.get(state.tenantId, id)
      if (!current || !sameJson(current, expected)) {
        throw new Error(`Authoritative administrative-principal transfer folder does not match ${side} state`)
      }
    }
    for (const entry of state.resourceGroups) {
      const expected = entry[side]
      const id = identifier(expected.groupId, "resource groupId")
      const current = await this.deps.resourceGroups.get(state.tenantId, id)
      if (!current || !sameJson(current, expected)) {
        throw new Error(`Authoritative administrative-principal transfer resource group does not match ${side} state`)
      }
    }
    for (const entry of state.documents) {
      const expected = entry[side]
      const documentId = identifier(expected.documentId, "documentId")
      const key = tenantManifestKey(this.deps, state.tenantId, documentId)
      if (expected.manifestObjectKey !== key) {
        throw new Error("Administrative-principal transfer document crossed its storage boundary")
      }
      let current: unknown
      try {
        current = JSON.parse(await this.deps.objects.getText(key)) as unknown
      } catch (error) {
        if (isMissingObjectError(error)) {
          throw new Error("Authoritative administrative-principal transfer document is unavailable", { cause: error })
        }
        throw new Error("Authoritative administrative-principal transfer document is unreadable", { cause: error })
      }
      if (!sameJson(current, expected)) {
        throw new Error(`Authoritative administrative-principal transfer document does not match ${side} state`)
      }
    }
  }
}

type InventoryAudit = Readonly<{
  sourceUserId: string
  folders: number
  resourceGroups: number
  documents: number
  total: number
}>

function canonicalState(
  value: unknown,
  intent: SecurityMutationAuditIntent,
  proposal: { successorUserId: string | null }
): { state: TransferState; originAuditIntent: boolean } {
  if (!isRecord(value)) throw new Error("Administrative-principal transfer state is invalid")
  const { tenantId, targetId } = intent.draft
  if (
    value.schemaVersion !== 1
    || !isIdentifier(value.operationId)
    || !["prepared", "transferring", "rollback_pending", "rolled_back", "committed"].includes(String(value.status))
    || !isIdentifier(value.actorId)
    || value.tenantId !== tenantId
    || value.sourceUserId !== targetId
    || !isIdentifier(value.successorUserId)
    || value.successorUserId === targetId
    || typeof value.reason !== "string"
    || !isIdentifier(value.auditIntentId)
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.updatedAt)
    || Date.parse(value.updatedAt) < Date.parse(value.createdAt)
    || !Array.isArray(value.folders)
    || !Array.isArray(value.resourceGroups)
    || !Array.isArray(value.documents)
  ) throw new Error("Administrative-principal transfer state crossed its audit or identity boundary")

  const originAuditIntent = value.auditIntentId === intent.intentId
  if (originAuditIntent && (
    value.actorId !== intent.draft.actorId
    || value.reason !== intent.draft.reason
  )) throw new Error("Administrative-principal transfer state crossed its actor or reason boundary")

  const state: TransferState = {
    operationId: value.operationId,
    status: value.status as TransferState["status"],
    actorId: value.actorId,
    tenantId,
    sourceUserId: targetId,
    successorUserId: value.successorUserId,
    reason: value.reason,
    folders: canonicalEntries(value.folders, tenantId, targetId, value.successorUserId, "folder"),
    resourceGroups: canonicalEntries(value.resourceGroups, tenantId, targetId, value.successorUserId, "resourceGroup"),
    documents: canonicalDocuments(value.documents, tenantId, targetId, value.successorUserId, value.operationId),
    auditIntentId: value.auditIntentId,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  }
  if (proposal.successorUserId !== state.successorUserId) {
    throw new Error("Administrative-principal transfer successor crossed its audit boundary")
  }
  return { state, originAuditIntent }
}

function canonicalEntries(
  values: unknown[], tenantId: string, sourceUserId: string, successorUserId: string,
  kind: "folder" | "resourceGroup"
): TransferEntry[] {
  const seen = new Set<string>()
  return values.map((value) => {
    if (!isRecord(value) || !isRecord(value.source) || !isRecord(value.target)) {
      throw new Error(`Administrative-principal transfer ${kind} entry is invalid`)
    }
    const id = identifier(value.source.groupId, `${kind} groupId`)
    if (seen.has(id) || value.target.groupId !== id) {
      throw new Error(`Administrative-principal transfer ${kind} identity is invalid`)
    }
    seen.add(id)
    if (value.source.tenantId !== tenantId || value.target.tenantId !== tenantId) {
      throw new Error(`Administrative-principal transfer ${kind} crossed its tenant boundary`)
    }
    if (kind === "folder") {
      const adminPrincipalType = value.source.adminPrincipalType ?? "user"
      if (
        value.source.ownerUserId !== sourceUserId
        && !(adminPrincipalType === "user" && value.source.adminPrincipalId === sourceUserId)
      ) throw new Error("Administrative-principal transfer folder is not owned by the source principal")
      assertTransferredField(value.source, value.target, "ownerUserId", sourceUserId, successorUserId)
      if (value.target.adminPrincipalType !== adminPrincipalType) {
        throw new Error("Administrative-principal transfer folder admin principal type changed")
      }
      const expectedAdminPrincipalId = adminPrincipalType === "user" && value.source.adminPrincipalId === sourceUserId
        ? successorUserId
        : value.source.adminPrincipalId ?? value.source.ownerUserId
      if (value.target.adminPrincipalId !== expectedAdminPrincipalId) {
        throw new Error("Administrative-principal transfer folder admin principal transition is invalid")
      }
    } else {
      if (value.source.createdBy !== sourceUserId) {
        throw new Error("Administrative-principal transfer resource group is not owned by the source principal")
      }
      assertTransferredField(value.source, value.target, "createdBy", sourceUserId, successorUserId)
    }
    return { source: value.source, target: value.target }
  })
}

function canonicalDocuments(
  values: unknown[], tenantId: string, sourceUserId: string, successorUserId: string, operationId: string
): DocumentTransferEntry[] {
  const seen = new Set<string>()
  return values.map((value) => {
    if (!isRecord(value) || !isIdentifier(value.sourceVersion) || !isRecord(value.source) || !isRecord(value.target)) {
      throw new Error("Administrative-principal transfer document entry is invalid")
    }
    const id = identifier(value.source.documentId, "documentId")
    if (seen.has(id) || value.target.documentId !== id) {
      throw new Error("Administrative-principal transfer document identity is invalid")
    }
    seen.add(id)
    assertDocumentTenant(value.source, tenantId)
    assertDocumentTenant(value.target, tenantId)
    assertDocumentOwnerTransition(value.source, value.target, sourceUserId, successorUserId)
    const targetMetadata = isRecord(value.target.metadata) ? value.target.metadata : undefined
    if (targetMetadata?.administrativeTransferOperationId !== operationId) {
      throw new Error("Administrative-principal transfer document operation marker is invalid")
    }
    return { sourceVersion: value.sourceVersion, source: value.source, target: value.target }
  })
}

function canonicalInventory(value: JsonValue, sourceUserId: string, label: string): InventoryAudit {
  if (!isRecord(value)) throw new Error(`Administrative-principal transfer audit ${label} is invalid`)
  assertExactKeys(value, ["sourceUserId", "folders", "resourceGroups", "documents", "total"], label)
  const folders = count(value.folders, "folders")
  const resourceGroups = count(value.resourceGroups, "resourceGroups")
  const documents = count(value.documents, "documents")
  const total = count(value.total, "total")
  if (value.sourceUserId !== sourceUserId || total !== folders + resourceGroups + documents) {
    throw new Error(`Administrative-principal transfer audit ${label} crossed its identity boundary`)
  }
  return { sourceUserId, folders, resourceGroups, documents, total }
}

function canonicalProposal(value: JsonValue, before: InventoryAudit): { successorUserId: string | null } {
  if (!isRecord(value)) throw new Error("Administrative-principal transfer audit proposal is invalid")
  if (
    (value.successorUserId !== null && !isIdentifier(value.successorUserId))
    || value.folderCount !== before.folders
    || value.resourceGroupCount !== before.resourceGroups
    || value.documentCount !== before.documents
  ) throw new Error("Administrative-principal transfer audit proposal crossed its inventory boundary")
  return { successorUserId: value.successorUserId }
}

function resolvePreservedCompletion(
  intent: SecurityMutationAuditIntent,
  before: InventoryAudit,
  rawState: unknown | undefined
): SecurityMutationAuditAuthoritativeResolution | undefined {
  const requested = intent.requestedCompletion
  const stateIsAbsentOrReused = rawState === undefined || (
    isRecord(rawState)
    && isIdentifier(rawState.auditIntentId)
    && rawState.auditIntentId !== intent.intentId
  )
  if (stateIsAbsentOrReused && requested && nonSuccessResults.has(requested.result) && (
    isCanonicalInventory(requested.after, before.sourceUserId)
  )) {
    return { result: requested.result, after: requested.after }
  }
  if (
    requested?.result === "failed"
    && isRecord(rawState)
    && isIdentifier(rawState.auditIntentId)
    && rawState.auditIntentId !== intent.intentId
    && isCanonicalReconciliationInventory(requested.after, before.sourceUserId)
  ) return { result: "failed", after: requested.after }
  return undefined
}

function successAuditValue(state: TransferState): JsonValue {
  return {
    sourceUserId: state.sourceUserId,
    successorUserId: state.successorUserId,
    folderIds: state.folders.map((entry) => entry.source.groupId as string),
    resourceGroupIds: state.resourceGroups.map((entry) => entry.source.groupId as string),
    documentIds: state.documents.map((entry) => entry.source.documentId as string)
  }
}

function inventoryFromState(state: TransferState): JsonValue {
  const folders = state.folders.length
  const resourceGroups = state.resourceGroups.length
  const documents = state.documents.length
  return { sourceUserId: state.sourceUserId, folders, resourceGroups, documents, total: folders + resourceGroups + documents }
}

function assertTransferredField(
  source: Record<string, unknown>, target: Record<string, unknown>, field: string,
  sourceUserId: string, successorUserId: string
): void {
  const expected = source[field] === sourceUserId ? successorUserId : source[field]
  if (target[field] !== expected) throw new Error(`Administrative-principal transfer ${field} transition is invalid`)
}

function assertDocumentTenant(value: Record<string, unknown>, tenantId: string): void {
  const metadataTenant = nestedValue(value, "metadata", "tenantId")
  const admissionTenant = nestedValue(value, "admission", "tenantId")
  if (
    (metadataTenant !== undefined && metadataTenant !== tenantId)
    || (admissionTenant !== undefined && admissionTenant !== tenantId)
    || (metadataTenant === undefined && admissionTenant === undefined)
  ) throw new Error("Administrative-principal transfer document crossed its tenant boundary")
}

function assertDocumentOwnerTransition(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  sourceUserId: string,
  successorUserId: string
): void {
  const sourceMetadataOwner = nestedValue(source, "metadata", "ownerUserId")
  const sourceAdmissionOwner = nestedValue(source, "admission", "ownerUserId")
  const targetMetadataOwner = nestedValue(target, "metadata", "ownerUserId")
  const targetAdmissionOwner = nestedValue(target, "admission", "ownerUserId")
  if (sourceMetadataOwner !== sourceUserId && sourceAdmissionOwner !== sourceUserId) {
    throw new Error("Administrative-principal transfer document is not owned by the source principal")
  }
  const expectedMetadataOwner = sourceMetadataOwner === sourceUserId ? successorUserId : sourceMetadataOwner
  const expectedAdmissionOwner = sourceAdmissionOwner === sourceUserId ? successorUserId : sourceAdmissionOwner
  if (targetMetadataOwner !== expectedMetadataOwner || targetAdmissionOwner !== expectedAdmissionOwner) {
    throw new Error("Administrative-principal transfer document owner transition is invalid")
  }
}

function nestedValue(value: Record<string, unknown>, container: string, field: string): unknown {
  return isRecord(value[container]) ? value[container][field] : undefined
}

function isCanonicalInventory(value: JsonValue, sourceUserId: string): boolean {
  try {
    canonicalInventory(value, sourceUserId, "requested completion")
    return true
  } catch {
    return false
  }
}

function isCanonicalReconciliationInventory(value: JsonValue, sourceUserId: string): boolean {
  if (!isRecord(value) || value.reconciliationRequired !== true) return false
  try {
    assertExactKeys(
      value,
      ["sourceUserId", "folders", "resourceGroups", "documents", "total", "reconciliationRequired"],
      "reconciliation completion"
    )
    const { reconciliationRequired: _reconciliationRequired, ...inventory } = value
    canonicalInventory(inventory as JsonValue, sourceUserId, "reconciliation completion")
    return true
  } catch {
    return false
  }
}

function assertExactKeys(value: Record<string, unknown>, expected: string[], label: string): void {
  const actual = Object.keys(value).sort()
  const canonicalExpected = [...expected].sort()
  if (!sameJson(actual, canonicalExpected)) {
    throw new Error(`Administrative-principal transfer audit ${label} has unexpected fields`)
  }
}

function count(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`Administrative-principal transfer audit ${field} is invalid`)
  }
  return value as number
}

function identifier(value: unknown, field: string): string {
  if (!isIdentifier(value)) throw new Error(`Administrative-principal transfer ${field} is invalid`)
  return value
}

function assertIdentifier(value: string, field: string): void {
  if (!isIdentifier(value)) throw new Error(`Administrative-principal transfer audit ${field} is invalid`)
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right))
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson)
  if (!isRecord(value)) return value
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJson(entry)])
  )
}

function isMissingObjectError(error: unknown): boolean {
  return error instanceof Error && (
    (error as NodeJS.ErrnoException).code === "ENOENT" || error.name === "NoSuchKey" || error.name === "NotFound"
  )
}
