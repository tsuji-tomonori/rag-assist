import type { DocumentGroupStore } from "../adapters/document-group-store.js"
import type { FolderPolicyStore } from "../adapters/folder-policy-store.js"
import type { GroupMembershipStore } from "../adapters/group-membership-store.js"
import type { ObjectStore } from "../adapters/object-store.js"
import type { UserGroupStore } from "../adapters/user-group-store.js"
import type { ServerManagedIdentity, VerifiedIdentityProvider } from "../adapters/verified-identity-provider.js"
import type { AppUser } from "../auth.js"
import { hasPermission } from "../authorization.js"
import type { Dependencies } from "../dependencies.js"
import { FolderPermissionService } from "../folders/folder-permission-service.js"
import { tenantDocumentArtifactKey, tenantArtifactRoot } from "../rag/_shared/storage/tenant-artifacts.js"
import type { JsonValue } from "../types.js"
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

export type FolderMoveAuditResolverDeps = Readonly<{
  objects: ObjectStore
  groups: DocumentGroupStore
  policies: FolderPolicyStore
  userGroups: UserGroupStore
  memberships: GroupMembershipStore
  identities: Pick<VerifiedIdentityProvider, "getCurrentIdentityBySubject">
  artifactPolicy?: ArtifactPolicy
}>

const successStatuses = new Set(["projections_converged", "completed"])
const lifecycleStatuses = new Set([
  "initialized",
  "prepared",
  "documents_staging",
  "documents_staged",
  "subtree_committed",
  "reconciliation_pending",
  "projections_converged",
  "rollback_pending",
  "rolled_back",
  "completed"
])
const nonSuccessResults = new Set<SecurityMutationResult>(["denied", "failed", "conflict"])

/** Reconciles a folder move audit without repeating subtree or projection mutations. */
export class FolderMoveAuditAuthoritativeResolver implements SecurityMutationAuditAuthoritativeResolver {
  private readonly permissions: FolderPermissionService

  constructor(private readonly deps: FolderMoveAuditResolverDeps) {
    this.permissions = new FolderPermissionService({
      documentGroupStore: deps.groups,
      folderPolicyStore: deps.policies,
      userGroupStore: deps.userGroups,
      groupMembershipStore: deps.memberships
    })
  }

  supports(draft: SecurityMutationAuditDraft): boolean {
    return draft.targetType === "folder" && draft.operation === "move"
  }

  async resolve(intent: SecurityMutationAuditIntent): Promise<SecurityMutationAuditAuthoritativeResolution> {
    if (!this.supports(intent.draft)) throw new Error("Folder move audit resolver does not support this intent")
    const { tenantId, targetId } = intent.draft
    assertIdentifier(tenantId, "tenantId")
    assertIdentifier(targetId, "targetId")

    const marker = await this.readMarker(tenantId, targetId)
    if (!marker) {
      if (intent.requestedCompletion?.result === "success" || !intent.requestedCompletion) {
        throw new Error("Folder move lifecycle marker is unavailable")
      }
      return this.resolvePreflightFailure(intent)
    }
    const lifecycle = canonicalMarker(marker, intent)

    if (intent.requestedCompletion && intent.requestedCompletion.result !== "success") {
      return this.resolveRolledBackFailure(intent, lifecycle)
    }
    if (!successStatuses.has(lifecycle.status)) {
      throw new Error("Folder move lifecycle is not authoritatively converged")
    }

    const before = canonicalMoveAudit(intent.draft.before, tenantId, targetId, "before state")
    const proposed = canonicalMoveAudit(intent.draft.proposedAfter, tenantId, targetId, "proposed state")
    const markerBefore = markerAuditValue(lifecycle, "before")
    const markerAfter = markerAuditValue(lifecycle, "after")
    if (!sameJson(before, markerBefore) || !sameJson(proposed, markerAfter)) {
      throw new Error("Folder move lifecycle does not match its audit draft")
    }

    const current = await this.currentGroups(tenantId)
    assertCurrentSubtree(current, lifecycle, "after")
    await this.assertCurrentAuthorization(intent, lifecycle, current)

    if (intent.requestedCompletion) {
      const requested = canonicalMoveAudit(
        intent.requestedCompletion.after,
        tenantId,
        targetId,
        "requested completion"
      )
      if (!sameJson(requested, markerAfter)) {
        throw new Error("Authoritative folder move does not confirm the requested success")
      }
      return { result: "success", after: intent.requestedCompletion.after }
    }
    return { result: "success", after: intent.draft.proposedAfter }
  }

  private async resolvePreflightFailure(
    intent: SecurityMutationAuditIntent
  ): Promise<SecurityMutationAuditAuthoritativeResolution> {
    const requested = intent.requestedCompletion!
    const { tenantId, targetId } = intent.draft
    const before = canonicalPreflightAudit(intent.draft.before, tenantId, targetId, "before state")
    const requestedAfter = canonicalPreflightAudit(requested.after, tenantId, targetId, "requested completion")
    if (!sameJson(before, requestedAfter)) {
      throw new Error("Folder move preflight failure does not preserve its before state")
    }
    const current = await this.deps.groups.get(tenantId, targetId)
    if (!current) throw new Error("Authoritative folder move preflight target is unavailable")
    const authoritative = preflightAuditValue(canonicalGroup(current, tenantId, targetId, "authoritative folder"))
    if (!sameJson(authoritative, before)) {
      throw new Error("Authoritative folder does not confirm the requested preflight failure")
    }
    return { result: requested.result, after: requested.after }
  }

  private async resolveRolledBackFailure(
    intent: SecurityMutationAuditIntent,
    lifecycle: FolderMoveMarker
  ): Promise<SecurityMutationAuditAuthoritativeResolution> {
    const requested = intent.requestedCompletion!
    if (
      lifecycle.status !== "rolled_back"
      || lifecycle.failureResult !== requested.result
      || !nonSuccessResults.has(requested.result)
    ) throw new Error("Folder move non-success lifecycle is not authoritatively rolled back")

    const { tenantId, targetId } = intent.draft
    const markerBefore = markerAuditValue(lifecycle, "before")
    const draftBefore = canonicalMoveAudit(intent.draft.before, tenantId, targetId, "before state")
    const proposed = canonicalMoveAudit(intent.draft.proposedAfter, tenantId, targetId, "proposed state")
    const requestedAfter = canonicalMoveAudit(requested.after, tenantId, targetId, "requested completion")
    if (
      !sameJson(draftBefore, markerBefore)
      || !sameJson(proposed, markerAuditValue(lifecycle, "after"))
      || !sameJson(requestedAfter, markerBefore)
    ) throw new Error("Folder move rollback evidence does not match its audit state")

    const current = await this.currentGroups(tenantId)
    assertCurrentSubtree(current, lifecycle, "before")
    return { result: requested.result, after: requested.after }
  }

  private async assertCurrentAuthorization(
    intent: SecurityMutationAuditIntent,
    lifecycle: FolderMoveMarker,
    current: ReadonlyMap<string, CanonicalGroup>
  ): Promise<void> {
    let identity: ServerManagedIdentity | undefined
    try {
      identity = await this.deps.identities.getCurrentIdentityBySubject(lifecycle.actorId)
    } catch (error) {
      throw new Error("Authoritative folder move actor is unavailable", { cause: error })
    }
    const actor = currentActor(identity, lifecycle.tenantId, lifecycle.actorId)
    if (intent.draft.actorId !== actor.userId || !hasPermission(actor, "folder.move")) {
      throw new Error("Current folder move actor is not authorized")
    }
    const source = current.get(lifecycle.folderId)
    if (!source || source.status !== "active") throw new Error("Current folder move source is unavailable")
    if ((await this.permissions.resolveEffectiveFolderPermissionDecision(actor, lifecycle.folderId)).permission !== "full") {
      throw new Error("Current folder move actor lacks full source permission")
    }
    if (lifecycle.destinationParentId !== null) {
      const destination = current.get(lifecycle.destinationParentId)
      if (!destination || destination.status !== "active" || destination.tenantId !== lifecycle.tenantId) {
        throw new Error("Current folder move destination is unavailable")
      }
      if ((await this.permissions.resolveEffectiveFolderPermissionDecision(actor, destination.groupId)).permission !== "full") {
        throw new Error("Current folder move actor lacks full destination permission")
      }
    }
  }

  private async currentGroups(tenantId: string): Promise<Map<string, CanonicalGroup>> {
    const groups = await this.deps.groups.list(tenantId)
    const current = new Map<string, CanonicalGroup>()
    for (const group of groups) {
      const canonical = canonicalGroup(group, tenantId, group.groupId, "authoritative folder")
      if (current.has(canonical.groupId)) throw new Error("Authoritative folder move state contains duplicate folders")
      current.set(canonical.groupId, canonical)
    }
    return current
  }

  private async readMarker(tenantId: string, folderId: string): Promise<unknown | undefined> {
    const key = tenantDocumentArtifactKey(
      this.deps.artifactPolicy ?? {},
      tenantId,
      `folder-mutations/move/${encodeURIComponent(folderId)}.json`
    )
    try {
      return JSON.parse(await this.deps.objects.getText(key)) as unknown
    } catch (error) {
      if (isMissingObjectError(error)) return undefined
      throw new Error("Folder move lifecycle marker is unreadable", { cause: error })
    }
  }
}

type Projection = Readonly<{
  folderId: string
  canonicalPath: string
  policySource: "explicit" | "inherited" | "ownerDefault"
  policyId: string
  policyVersion: string
  inheritedFromFolderId: string | null
}>

type CanonicalGroup = Readonly<{
  groupId: string
  schemaVersion: number | null
  itemType: string | null
  tenantId: string
  adminPrincipalType: "user" | "group"
  adminPrincipalId: string
  name: string
  normalizedName: string
  canonicalPath: string
  normalizedCanonicalPath: string
  adminPathPk: string
  parentPathPk: string
  description: string | null
  parentGroupId: string | null
  ancestorGroupIds: string[]
  ownerUserId: string
  visibility: "private" | "shared" | "org"
  sharedUserIds: string[]
  sharedGroups: string[]
  managerUserIds: string[]
  hasExplicitPolicy: boolean | null
  policyId: string | null
  status: "active" | "archived"
  createdBy: string
  policySource: "explicit" | "inherited" | "ownerDefault" | null
  inheritedFromFolderId: string | null
  inheritedPolicyId: string | null
  inheritedPolicyVersion: string | null
  folderLocalPolicyVersion: string | null
  folderProjectionVersion: string | null
  folderMoveOperationId: string | null
  createdAt: string
  updatedAt: string
}>

type FolderSnapshot = Readonly<{
  current: CanonicalGroup
  next: CanonicalGroup
  beforeProjection: Projection
  afterProjection: Projection
}>

type FolderMoveMarker = Readonly<{
  operationId: string
  status: string
  actorId: string
  tenantId: string
  folderId: string
  destinationParentId: string | null
  requestedName: string
  reason: string
  expectedVersion: string
  folderSnapshots: FolderSnapshot[]
  affectedDocumentIds: string[]
  failureResult?: Exclude<SecurityMutationResult, "success">
  createdAt: string
  updatedAt: string
}>

type MoveAudit = Readonly<{
  operationId: string
  folderId: string
  destinationParentId: string | null
  subtree: Array<Readonly<{ folderId: string; canonicalPath: string | null; policyRef: string }>>
  affectedDocumentIds: string[]
  directDocumentGrantsPreserved: true
  folderLocalPoliciesPreserved: true
  documentVersionsPreserved: true
}>

type PreflightAudit = Readonly<{
  folderId: string
  tenantId: string
  parentGroupId: string | null
  canonicalPath: string | null
  updatedAt: string
  status: "active" | "archived" | null
}>

function canonicalMarker(value: unknown, intent: SecurityMutationAuditIntent): FolderMoveMarker {
  if (!isRecord(value)) throw new Error("Folder move lifecycle marker is invalid")
  const { tenantId, targetId, actorId } = intent.draft
  if (
    value.schemaVersion !== 1
    || !isIdentifier(value.operationId)
    || !isIdentifier(value.fingerprint)
    || typeof value.status !== "string"
    || !lifecycleStatuses.has(value.status)
    || value.actorId !== actorId
    || value.tenantId !== tenantId
    || value.folderId !== targetId
    || (value.destinationParentId !== null && !isIdentifier(value.destinationParentId))
    || !isIdentifier(value.requestedName)
    || value.reason !== intent.draft.reason
    || !isIdentifier(value.expectedVersion)
    || value.auditIntentId !== intent.intentId
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.updatedAt)
    || !Array.isArray(value.folderSnapshots)
    || value.folderSnapshots.length === 0
    || value.folderSnapshots.length > 8
    || !Array.isArray(value.localPolicySnapshots)
    || !Array.isArray(value.documentSnapshots)
  ) throw new Error("Folder move lifecycle marker crossed its identity boundary")

  const snapshots = value.folderSnapshots.map((entry, index) => canonicalSnapshot(
    entry,
    tenantId,
    value.operationId as string,
    value.createdAt as string,
    index === 0,
    value.destinationParentId as string | null
  ))
  const ids = snapshots.map((snapshot) => snapshot.current.groupId)
  if (new Set(ids).size !== ids.length || snapshots[0]?.current.groupId !== targetId) {
    throw new Error("Folder move lifecycle subtree identity is invalid")
  }
  const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.current.groupId, snapshot]))
  for (const snapshot of snapshots.slice(1)) {
    const parentId = snapshot.current.parentGroupId
    if (!parentId || !snapshotById.has(parentId) || snapshot.next.parentGroupId !== parentId) {
      throw new Error("Folder move lifecycle descendant hierarchy is invalid")
    }
  }

  const localPolicyIds = new Set<string>()
  for (const raw of value.localPolicySnapshots) {
    if (!isRecord(raw)
      || !isIdentifier(raw.folderId)
      || !snapshotById.has(raw.folderId)
      || (raw.kind !== "versioned" && raw.kind !== "legacy")
      || !isIdentifier(raw.policyId)
      || !isIdentifier(raw.version)
      || localPolicyIds.has(raw.folderId)) {
      throw new Error("Folder move lifecycle local policy snapshot is invalid")
    }
    localPolicyIds.add(raw.folderId)
  }

  const affectedDocumentIds = value.documentSnapshots.map((raw) => canonicalDocumentSnapshot(
    raw,
    tenantId,
    value.operationId as string,
    value.createdAt as string
  ))
  if (new Set(affectedDocumentIds).size !== affectedDocumentIds.length) {
    throw new Error("Folder move lifecycle contains duplicate documents")
  }
  const failureResult = value.failureResult
  if (failureResult !== undefined && !nonSuccessResults.has(failureResult as SecurityMutationResult)) {
    throw new Error("Folder move lifecycle failure result is invalid")
  }
  if (value.status === "rolled_back" && failureResult === undefined) {
    throw new Error("Folder move rollback result is missing")
  }

  return {
    operationId: value.operationId as string,
    status: value.status,
    actorId,
    tenantId,
    folderId: targetId,
    destinationParentId: value.destinationParentId as string | null,
    requestedName: value.requestedName as string,
    reason: value.reason as string,
    expectedVersion: value.expectedVersion as string,
    folderSnapshots: snapshots,
    affectedDocumentIds,
    ...(failureResult === undefined ? {} : { failureResult: failureResult as Exclude<SecurityMutationResult, "success"> }),
    createdAt: value.createdAt as string,
    updatedAt: value.updatedAt as string
  }
}

function canonicalSnapshot(
  value: unknown,
  tenantId: string,
  operationId: string,
  createdAt: string,
  root: boolean,
  destinationParentId: string | null
): FolderSnapshot {
  if (!isRecord(value)) throw new Error("Folder move lifecycle folder snapshot is invalid")
  const current = canonicalGroup(value.current, tenantId, undefined, "lifecycle before folder")
  const next = canonicalGroup(value.next, tenantId, current.groupId, "lifecycle after folder")
  const beforeProjection = canonicalProjection(value.beforeProjection, current.groupId, current.canonicalPath, "before")
  const afterProjection = canonicalProjection(value.afterProjection, next.groupId, next.canonicalPath, "after")
  if (!sameJson(immutableGroupIdentity(current, root), immutableGroupIdentity(next, root))) {
    throw new Error("Folder move lifecycle changed folder ownership or local identity")
  }
  if (
    next.status !== "active"
    || next.updatedAt !== createdAt
    || next.folderMoveOperationId !== operationId
    || next.folderProjectionVersion !== operationId
    || (root && next.parentGroupId !== destinationParentId)
    || (!root && next.parentGroupId !== current.parentGroupId)
    || next.policySource !== afterProjection.policySource
    || next.inheritedFromFolderId !== afterProjection.inheritedFromFolderId
  ) throw new Error("Folder move lifecycle folder transition is invalid")
  if (
    (afterProjection.policySource === "inherited"
      && (next.inheritedPolicyId !== afterProjection.policyId || next.inheritedPolicyVersion !== afterProjection.policyVersion))
    || (afterProjection.policySource === "explicit" && next.folderLocalPolicyVersion !== afterProjection.policyVersion)
  ) throw new Error("Folder move lifecycle projection transition is invalid")
  return { current, next, beforeProjection, afterProjection }
}

function canonicalGroup(
  value: unknown,
  tenantId: string,
  expectedGroupId: string | undefined,
  label: string
): CanonicalGroup {
  if (!isRecord(value)) throw new Error(`Folder move ${label} is invalid`)
  const groupId = value.groupId
  if (
    !isIdentifier(groupId)
    || (expectedGroupId !== undefined && groupId !== expectedGroupId)
    || value.tenantId !== tenantId
    || (value.schemaVersion !== undefined && value.schemaVersion !== 2)
    || (value.itemType !== undefined && value.itemType !== "documentGroup")
    || (value.adminPrincipalType !== "user" && value.adminPrincipalType !== "group")
    || !isIdentifier(value.adminPrincipalId)
    || !isIdentifier(value.name)
    || !isIdentifier(value.normalizedName)
    || !isPath(value.canonicalPath)
    || !isPath(value.normalizedCanonicalPath)
    || !isIdentifier(value.adminPathPk)
    || !isIdentifier(value.parentPathPk)
    || (value.description !== undefined && typeof value.description !== "string")
    || (value.parentGroupId !== undefined && !isIdentifier(value.parentGroupId))
    || !isIdentifierArray(value.ancestorGroupIds)
    || !isIdentifier(value.ownerUserId)
    || (value.visibility !== "private" && value.visibility !== "shared" && value.visibility !== "org")
    || !isIdentifierSet(value.sharedUserIds)
    || !isIdentifierSet(value.sharedGroups)
    || !isIdentifierSet(value.managerUserIds)
    || (value.hasExplicitPolicy !== undefined && typeof value.hasExplicitPolicy !== "boolean")
    || (value.policyId !== undefined && !isIdentifier(value.policyId))
    || (value.status !== "active" && value.status !== "archived")
    || !isIdentifier(value.createdBy)
    || (value.policySource !== undefined && !["explicit", "inherited", "ownerDefault"].includes(String(value.policySource)))
    || !optionalIdentifier(value.inheritedFromFolderId)
    || !optionalIdentifier(value.inheritedPolicyId)
    || !optionalIdentifier(value.inheritedPolicyVersion)
    || !optionalIdentifier(value.folderLocalPolicyVersion)
    || !optionalIdentifier(value.folderProjectionVersion)
    || !optionalIdentifier(value.folderMoveOperationId)
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.updatedAt)
  ) throw new Error(`Folder move ${label} crossed its tenant, owner, or resource boundary`)
  return {
    groupId,
    schemaVersion: typeof value.schemaVersion === "number" ? value.schemaVersion : null,
    itemType: typeof value.itemType === "string" ? value.itemType : null,
    tenantId,
    adminPrincipalType: value.adminPrincipalType,
    adminPrincipalId: value.adminPrincipalId,
    name: value.name,
    normalizedName: value.normalizedName,
    canonicalPath: value.canonicalPath,
    normalizedCanonicalPath: value.normalizedCanonicalPath,
    adminPathPk: value.adminPathPk,
    parentPathPk: value.parentPathPk,
    description: typeof value.description === "string" ? value.description : null,
    parentGroupId: typeof value.parentGroupId === "string" ? value.parentGroupId : null,
    ancestorGroupIds: [...value.ancestorGroupIds] as string[],
    ownerUserId: value.ownerUserId,
    visibility: value.visibility,
    sharedUserIds: [...value.sharedUserIds].sort() as string[],
    sharedGroups: [...value.sharedGroups].sort() as string[],
    managerUserIds: [...value.managerUserIds].sort() as string[],
    hasExplicitPolicy: typeof value.hasExplicitPolicy === "boolean" ? value.hasExplicitPolicy : null,
    policyId: typeof value.policyId === "string" ? value.policyId : null,
    status: value.status,
    createdBy: value.createdBy,
    policySource: value.policySource as CanonicalGroup["policySource"] ?? null,
    inheritedFromFolderId: stringOrNull(value.inheritedFromFolderId),
    inheritedPolicyId: stringOrNull(value.inheritedPolicyId),
    inheritedPolicyVersion: stringOrNull(value.inheritedPolicyVersion),
    folderLocalPolicyVersion: stringOrNull(value.folderLocalPolicyVersion),
    folderProjectionVersion: stringOrNull(value.folderProjectionVersion),
    folderMoveOperationId: stringOrNull(value.folderMoveOperationId),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  }
}

function immutableGroupIdentity(group: CanonicalGroup, root: boolean): JsonValue {
  return {
    groupId: group.groupId,
    tenantId: group.tenantId,
    adminPrincipalType: group.adminPrincipalType,
    adminPrincipalId: group.adminPrincipalId,
    ...(root ? {} : { name: group.name, normalizedName: group.normalizedName }),
    description: group.description,
    ownerUserId: group.ownerUserId,
    visibility: group.visibility,
    sharedUserIds: group.sharedUserIds,
    sharedGroups: group.sharedGroups,
    managerUserIds: group.managerUserIds,
    hasExplicitPolicy: group.hasExplicitPolicy,
    policyId: group.policyId,
    status: group.status,
    createdBy: group.createdBy,
    createdAt: group.createdAt
  }
}

function canonicalProjection(value: unknown, folderId: string, path: string, label: string): Projection {
  if (!isRecord(value)
    || value.folderId !== folderId
    || value.canonicalPath !== path
    || (value.policySource !== "explicit" && value.policySource !== "inherited" && value.policySource !== "ownerDefault")
    || !isIdentifier(value.policyId)
    || !isIdentifier(value.policyVersion)
    || !optionalIdentifier(value.inheritedFromFolderId)
    || (value.policySource === "inherited" && !isIdentifier(value.inheritedFromFolderId))
    || (value.policySource !== "inherited" && value.inheritedFromFolderId !== undefined)) {
    throw new Error(`Folder move lifecycle ${label} projection is invalid`)
  }
  return {
    folderId,
    canonicalPath: path,
    policySource: value.policySource,
    policyId: value.policyId,
    policyVersion: value.policyVersion,
    inheritedFromFolderId: stringOrNull(value.inheritedFromFolderId)
  }
}

function canonicalDocumentSnapshot(value: unknown, tenantId: string, operationId: string, createdAt: string): string {
  if (!isRecord(value)
    || !isIdentifier(value.manifestKey)
    || !value.manifestKey.startsWith(`${tenantArtifactRoot(tenantId)}/manifests/`)
    || !isIdentifier(value.sourceVersion)
    || !isRecord(value.sourceManifest)
    || !isRecord(value.stagedManifest)
    || !isRecord(value.targetManifest)
    || !Array.isArray(value.beforeProjection)
    || !Array.isArray(value.afterProjection)) {
    throw new Error("Folder move lifecycle document snapshot is invalid")
  }
  const documentId = value.sourceManifest.documentId
  const sourceTenant = isRecord(value.sourceManifest.metadata) ? value.sourceManifest.metadata.tenantId : undefined
  const stagedMetadata = isRecord(value.stagedManifest.metadata) ? value.stagedManifest.metadata : undefined
  const targetMetadata = isRecord(value.targetManifest.metadata) ? value.targetManifest.metadata : undefined
  const beforeProjection = canonicalDocumentProjections(value.beforeProjection, "before")
  const afterProjection = canonicalDocumentProjections(value.afterProjection, "after")
  const beforeIds = beforeProjection.map((projection) => projection.folderId)
  const afterIds = afterProjection.map((projection) => projection.folderId)
  const afterPaths = afterProjection.map((projection) => projection.canonicalPath)
  const afterRefs = afterProjection.map(projectionToken)
  if (
    !isIdentifier(documentId)
    || sourceTenant !== tenantId
    || stagedMetadata?.tenantId !== tenantId
    || targetMetadata?.tenantId !== tenantId
    || value.stagedManifest.documentId !== documentId
    || value.targetManifest.documentId !== documentId
    || value.sourceManifest.manifestObjectKey !== value.manifestKey
    || value.stagedManifest.manifestObjectKey !== value.manifestKey
    || value.targetManifest.manifestObjectKey !== value.manifestKey
    || value.stagedManifest.lifecycleStatus !== "staging"
    || value.targetManifest.lifecycleStatus !== "active"
    || value.stagedManifest.updatedAt !== createdAt
    || value.targetManifest.updatedAt !== createdAt
    || stagedMetadata?.folderMoveOperationId !== operationId
    || targetMetadata?.folderMoveOperationId !== operationId
    || stagedMetadata.folderProjectionVersion !== operationId
    || targetMetadata.folderProjectionVersion !== operationId
    || stagedMetadata.lifecycleStatus !== "staging"
    || targetMetadata.lifecycleStatus !== "active"
    || !sameJson(beforeIds, afterIds)
    || !sameJson(stagedMetadata.folderCanonicalPaths, afterPaths)
    || !sameJson(targetMetadata.folderCanonicalPaths, afterPaths)
    || !sameJson(stagedMetadata.folderPolicyRefs, afterRefs)
    || !sameJson(targetMetadata.folderPolicyRefs, afterRefs)
    || !sameJson(immutableManifest(value.sourceManifest), immutableManifest(value.stagedManifest))
    || !sameJson(immutableManifest(value.sourceManifest), immutableManifest(value.targetManifest))
  ) throw new Error("Folder move lifecycle document snapshot crossed its identity boundary")
  return documentId
}

function canonicalDocumentProjections(value: unknown[], label: string): Projection[] {
  const projections = value.map((raw) => {
    if (!isRecord(raw) || !isIdentifier(raw.folderId) || !isPath(raw.canonicalPath)) {
      throw new Error(`Folder move lifecycle document ${label} projection is invalid`)
    }
    return canonicalProjection(raw, raw.folderId, raw.canonicalPath, `document ${label}`)
  })
  if (new Set(projections.map((projection) => projection.folderId)).size !== projections.length) {
    throw new Error(`Folder move lifecycle document ${label} projection contains duplicates`)
  }
  return projections
}

function immutableManifest(value: Record<string, unknown>): Record<string, unknown> {
  const result = { ...value }
  delete result.lifecycleStatus
  delete result.updatedAt
  if (isRecord(value.metadata)) {
    const metadata = { ...value.metadata }
    delete metadata.lifecycleStatus
    delete metadata.folderCanonicalPaths
    delete metadata.folderPolicyRefs
    delete metadata.folderProjectionVersion
    delete metadata.folderMoveOperationId
    result.metadata = metadata
  }
  return result
}

function markerAuditValue(marker: FolderMoveMarker, state: "before" | "after"): MoveAudit {
  return {
    operationId: marker.operationId,
    folderId: marker.folderId,
    destinationParentId: state === "before"
      ? marker.folderSnapshots[0]?.current.parentGroupId ?? null
      : marker.destinationParentId,
    subtree: marker.folderSnapshots.map((snapshot) => ({
      folderId: snapshot.current.groupId,
      canonicalPath: state === "before" ? snapshot.current.canonicalPath : snapshot.next.canonicalPath,
      policyRef: projectionToken(state === "before" ? snapshot.beforeProjection : snapshot.afterProjection)
    })),
    affectedDocumentIds: marker.affectedDocumentIds,
    directDocumentGrantsPreserved: true,
    folderLocalPoliciesPreserved: true,
    documentVersionsPreserved: true
  }
}

function canonicalMoveAudit(value: unknown, tenantId: string, folderId: string, label: string): MoveAudit {
  if (!isRecord(value)
    || !isIdentifier(value.operationId)
    || value.folderId !== folderId
    || (value.destinationParentId !== null && !isIdentifier(value.destinationParentId))
    || !Array.isArray(value.subtree)
    || value.subtree.length === 0
    || !Array.isArray(value.affectedDocumentIds)
    || !isIdentifierSet(value.affectedDocumentIds)
    || value.directDocumentGrantsPreserved !== true
    || value.folderLocalPoliciesPreserved !== true
    || value.documentVersionsPreserved !== true) {
    throw new Error(`Folder move audit ${label} is invalid for ${tenantId}`)
  }
  const subtree = value.subtree.map((raw) => {
    if (!isRecord(raw)
      || !isIdentifier(raw.folderId)
      || (raw.canonicalPath !== null && !isPath(raw.canonicalPath))
      || !isIdentifier(raw.policyRef)) throw new Error(`Folder move audit ${label} subtree is invalid`)
    return { folderId: raw.folderId, canonicalPath: raw.canonicalPath as string | null, policyRef: raw.policyRef }
  })
  if (new Set(subtree.map((item) => item.folderId)).size !== subtree.length || subtree[0]?.folderId !== folderId) {
    throw new Error(`Folder move audit ${label} subtree identity is invalid`)
  }
  return {
    operationId: value.operationId,
    folderId,
    destinationParentId: value.destinationParentId as string | null,
    subtree,
    affectedDocumentIds: [...value.affectedDocumentIds] as string[],
    directDocumentGrantsPreserved: true,
    folderLocalPoliciesPreserved: true,
    documentVersionsPreserved: true
  }
}

function canonicalPreflightAudit(value: unknown, tenantId: string, folderId: string, label: string): PreflightAudit {
  if (!isRecord(value)
    || value.folderId !== folderId
    || value.tenantId !== tenantId
    || (value.parentGroupId !== null && !isIdentifier(value.parentGroupId))
    || (value.canonicalPath !== null && !isPath(value.canonicalPath))
    || !isTimestamp(value.updatedAt)
    || (value.status !== null && value.status !== "active" && value.status !== "archived")) {
    throw new Error(`Folder move audit ${label} preflight state crossed its identity boundary`)
  }
  return {
    folderId,
    tenantId,
    parentGroupId: value.parentGroupId as string | null,
    canonicalPath: value.canonicalPath as string | null,
    updatedAt: value.updatedAt,
    status: value.status as PreflightAudit["status"]
  }
}

function preflightAuditValue(group: CanonicalGroup): PreflightAudit {
  return {
    folderId: group.groupId,
    tenantId: group.tenantId,
    parentGroupId: group.parentGroupId,
    canonicalPath: group.canonicalPath,
    updatedAt: group.updatedAt,
    status: group.status
  }
}

function assertCurrentSubtree(
  current: ReadonlyMap<string, CanonicalGroup>,
  marker: FolderMoveMarker,
  state: "before" | "after"
): void {
  const expected = marker.folderSnapshots.map((snapshot) => state === "before" ? snapshot.current : snapshot.next)
  const results = expected.map((folder) => {
    const actual = current.get(folder.groupId)
    return actual ? sameJson(actual, folder) : false
  })
  if (!results.every(Boolean)) {
    if (results.every((result) => !result)) throw new Error(`Authoritative folder move subtree is not in the ${state} state`)
    throw new Error("Authoritative folder move subtree is partially applied or mixed")
  }
}

function currentActor(identity: ServerManagedIdentity | undefined, tenantId: string, actorId: string): AppUser {
  if (!identity
    || identity.userId !== actorId
    || identity.tenantId !== tenantId
    || identity.accountStatus !== "active"
    || !isIdentifier(identity.username)
    || !isIdentifier(identity.email)
    || !isIdentifierSet(identity.cognitoGroups)) {
    throw new Error("Current folder move actor crossed its identity or tenant boundary")
  }
  return {
    userId: identity.userId,
    identityUsername: identity.username,
    email: identity.email,
    cognitoGroups: [...identity.cognitoGroups],
    accountStatus: "active",
    tenantId
  }
}

function projectionToken(value: Projection): string {
  return JSON.stringify({
    folderId: value.folderId,
    policySource: value.policySource,
    policyId: value.policyId,
    policyVersion: value.policyVersion,
    inheritedFromFolderId: value.inheritedFromFolderId
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function assertIdentifier(value: string, field: string): void {
  if (!isIdentifier(value)) throw new Error(`Folder move audit ${field} is invalid`)
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}

function optionalIdentifier(value: unknown): boolean {
  return value === undefined || isIdentifier(value)
}

function isIdentifierArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isIdentifier)
}

function isIdentifierSet(value: unknown): value is string[] {
  return isIdentifierArray(value) && new Set(value).size === value.length
}

function isPath(value: unknown): value is string {
  return isIdentifier(value) && value.startsWith("/") && !value.includes("..")
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function isMissingObjectError(error: unknown): boolean {
  const candidate = error as { code?: string; name?: string; $metadata?: { httpStatusCode?: number } }
  return candidate.code === "ENOENT"
    || candidate.code === "NoSuchKey"
    || candidate.name === "NoSuchKey"
    || candidate.name === "NotFound"
    || candidate.$metadata?.httpStatusCode === 404
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
