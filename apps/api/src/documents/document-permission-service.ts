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

function tenantIdForManifest(manifest: DocumentManifest): string {
  return typeof manifest.metadata?.tenantId === "string" ? manifest.metadata.tenantId : "default"
}

const documentShareLegacyLedgerKey = "documents/share-grants.json"
const documentShareGrantPrefix = "documents/share-grants"
const documentShareAuditPrefix = "documents/share-audit"
const activeDocumentShareReplacements = new Set<string>()
const documentShareAuditQueues = new Map<string, Promise<void>>()

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
    const tenantId = tenantIdForManifest(manifest)
    const [directDocumentGrants, folderPermission] = await Promise.all([
      this.loadDocumentGrants(tenantId, manifest.documentId),
      this.resolveFolderPermission(user, manifest)
    ])
    const directPermission = await this.resolveDirectDocumentPermission(user, manifest.documentId, directDocumentGrants)
    return {
      inheritedFolderGrants: this.folderIds(manifest).map((folderId) => ({ folderId, permissionLevel: folderPermission })),
      directDocumentGrants,
      currentUserEffectivePermission: calculateEffectiveDocumentPermission(folderPermission, directPermission)
    }
  }

  async resolveEffectiveDocumentPermission(user: AppUser, manifest: DocumentManifest): Promise<EffectiveDocumentPermission> {
    if (user.cognitoGroups.includes("SYSTEM_ADMIN")) return "full"
    const folderPermission = await this.resolveFolderPermission(user, manifest)
    const tenantId = tenantIdForManifest(manifest)
    const directPermission = await this.resolveDirectDocumentPermission(
      user,
      manifest.documentId,
      await this.loadDocumentGrants(tenantId, manifest.documentId)
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
    const tenantId = tenantIdForManifest(manifest)
    return this.runDocumentShareReplacement(tenantId, manifest.documentId, async () => {
      const now = new Date().toISOString()
      const before = await this.loadDocumentGrants(tenantId, manifest.documentId)
      const normalized = normalizeGrantInputs(grants)
      const nextGrants: DocumentShareGrant[] = normalized.map((grant) => ({
        documentShareGrantId: `docshare_${randomUUID().slice(0, 12)}`,
        itemType: "documentShareGrant",
        tenantId,
        documentId: manifest.documentId,
        principalType: grant.principalType,
        principalId: grant.principalId,
        permissionLevel: grant.permissionLevel,
        createdBy: actor.userId,
        reason,
        createdAt: now,
        updatedAt: now
      }))
      await this.saveDocumentGrants(tenantId, manifest.documentId, nextGrants)
      await this.appendDocumentAudit(actor, "document:share", tenantId, manifest.documentId, before, nextGrants, reason, now)
      return this.getShareInfo(actor, manifest)
    })
  }

  async appendDocumentAudit(
    actor: AppUser,
    action: DocumentShareAuditAction,
    tenantId: string,
    documentId: string,
    before: unknown,
    after: unknown,
    reason: string,
    createdAt = new Date().toISOString()
  ): Promise<void> {
    await this.runDocumentAuditAppend(tenantId, documentId, async () => {
      const auditLog = await this.loadDocumentAudit(tenantId, documentId)
      auditLog.unshift(buildAuditEntry(actor, action, tenantId, documentId, before, after, reason, createdAt))
      await this.saveDocumentAudit(tenantId, documentId, auditLog.slice(0, 500))
    })
  }

  async listAuditLog(): Promise<DocumentShareAuditLogEntry[]> {
    const ledger = await this.loadLedger()
    return [...ledger.auditLog].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200)
  }

  async loadLedger(): Promise<DocumentShareLedger> {
    const [grants, auditLog] = await Promise.all([
      this.loadAllDocumentGrants(),
      this.loadAllDocumentAudit()
    ])
    try {
      const raw = JSON.parse(await this.deps.objectStore.getText(documentShareLegacyLedgerKey)) as Partial<DocumentShareLedger>
      return {
        schemaVersion: 1,
        grants: mergeGrants(grants, Array.isArray(raw.grants) ? raw.grants : []),
        auditLog: mergeAuditEntries(auditLog, Array.isArray(raw.auditLog) ? raw.auditLog : [])
      }
    } catch (err) {
      if (isMissingObjectError(err) || err instanceof SyntaxError) return { schemaVersion: 1, grants, auditLog }
      throw err
    }
  }

  private async loadDocumentGrants(tenantId: string, documentId: string): Promise<DocumentShareGrant[]> {
    const current = await this.loadDocumentGrantFile(tenantId, documentId)
    if (current.length > 0) return current
    return this.loadLegacyDocumentGrants(tenantId, documentId)
  }

  private async loadDocumentGrantFile(tenantId: string, documentId: string): Promise<DocumentShareGrant[]> {
    try {
      const raw = JSON.parse(await this.deps.objectStore.getText(documentShareGrantKey(tenantId, documentId))) as Partial<DocumentShareLedger>
      return sortGrants(Array.isArray(raw.grants) ? raw.grants.filter((grant) => grant.tenantId === tenantId && grant.documentId === documentId) : [])
    } catch (err) {
      if (isMissingObjectError(err) || err instanceof SyntaxError) return []
      throw err
    }
  }

  private async loadLegacyDocumentGrants(tenantId: string, documentId: string): Promise<DocumentShareGrant[]> {
    try {
      const raw = JSON.parse(await this.deps.objectStore.getText(documentShareLegacyLedgerKey)) as Partial<DocumentShareLedger>
      return sortGrants(Array.isArray(raw.grants) ? raw.grants.filter((grant) => grant.tenantId === tenantId && grant.documentId === documentId) : [])
    } catch (err) {
      if (isMissingObjectError(err) || err instanceof SyntaxError) return []
      throw err
    }
  }

  private async saveDocumentGrants(tenantId: string, documentId: string, grants: DocumentShareGrant[]): Promise<void> {
    await this.deps.objectStore.putText(documentShareGrantKey(tenantId, documentId), JSON.stringify({
      schemaVersion: 1,
      grants: sortGrants(grants)
    }, null, 2), "application/json")
  }

  private async loadDocumentAudit(tenantId: string, documentId: string): Promise<DocumentShareAuditLogEntry[]> {
    try {
      const raw = JSON.parse(await this.deps.objectStore.getText(documentShareAuditKey(tenantId, documentId))) as Partial<DocumentShareLedger>
      return Array.isArray(raw.auditLog) ? raw.auditLog : []
    } catch (err) {
      if (isMissingObjectError(err) || err instanceof SyntaxError) return []
      throw err
    }
  }

  private async saveDocumentAudit(tenantId: string, documentId: string, auditLog: DocumentShareAuditLogEntry[]): Promise<void> {
    await this.deps.objectStore.putText(documentShareAuditKey(tenantId, documentId), JSON.stringify({
      schemaVersion: 1,
      auditLog
    }, null, 2), "application/json")
  }

  private async runDocumentShareReplacement<T>(tenantId: string, documentId: string, task: () => Promise<T>): Promise<T> {
    const key = `${tenantId}:${documentId}`
    if (activeDocumentShareReplacements.has(key)) throw new DocumentShareConflictError("document share grants changed concurrently")
    activeDocumentShareReplacements.add(key)
    try {
      return await task()
    } finally {
      activeDocumentShareReplacements.delete(key)
    }
  }

  private async runDocumentAuditAppend(tenantId: string, documentId: string, task: () => Promise<void>): Promise<void> {
    const key = `${tenantId}:${documentId}`
    const previous = documentShareAuditQueues.get(key) ?? Promise.resolve()
    let release: () => void = () => undefined
    const current = new Promise<void>((resolve) => {
      release = resolve
    })
    const queued = previous.then(() => current, () => current)
    documentShareAuditQueues.set(key, queued)
    await previous.catch(() => undefined)
    try {
      await task()
    } finally {
      release()
      if (documentShareAuditQueues.get(key) === queued) documentShareAuditQueues.delete(key)
    }
  }

  private async loadAllDocumentGrants(): Promise<DocumentShareGrant[]> {
    const keys = await this.deps.objectStore.listKeys(`${documentShareGrantPrefix}/`)
    const entries = await Promise.all(keys.filter((key) => key.endsWith(".json")).map(async (key) => {
      try {
        const raw = JSON.parse(await this.deps.objectStore.getText(key)) as Partial<DocumentShareLedger>
        return Array.isArray(raw.grants) ? raw.grants : []
      } catch (err) {
        if (isMissingObjectError(err) || err instanceof SyntaxError) return []
        throw err
      }
    }))
    return sortGrants(entries.flat())
  }

  private async loadAllDocumentAudit(): Promise<DocumentShareAuditLogEntry[]> {
    const keys = await this.deps.objectStore.listKeys(`${documentShareAuditPrefix}/`)
    const entries = await Promise.all(keys.filter((key) => key.endsWith(".json")).map(async (key) => {
      try {
        const raw = JSON.parse(await this.deps.objectStore.getText(key)) as Partial<DocumentShareLedger>
        return Array.isArray(raw.auditLog) ? raw.auditLog : []
      } catch (err) {
        if (isMissingObjectError(err) || err instanceof SyntaxError) return []
        throw err
      }
    }))
    return entries.flat()
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
  if (!reason.trim()) throw new DocumentShareValidationError("reason is required")
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
    if (!grant.principalId) throw new DocumentShareValidationError("principalId is required")
    const key = `${grant.principalType}:${grant.principalId}`
    if (seen.has(key)) throw new DocumentShareValidationError(`duplicate grant: ${key}`)
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

function buildAuditEntry(
  actor: AppUser,
  action: DocumentShareAuditAction,
  tenantId: string,
  documentId: string,
  before: unknown,
  after: unknown,
  reason: string,
  createdAt: string
): DocumentShareAuditLogEntry {
  return {
    auditId: `audit_${randomUUID().slice(0, 12)}`,
    action,
    tenantId,
    actorUserId: actor.userId,
    documentId,
    before: toJsonValue(before),
    after: toJsonValue(after),
    reason,
    createdAt
  }
}

function sortGrants(grants: DocumentShareGrant[]): DocumentShareGrant[] {
  return [...grants].sort((a, b) => a.principalType.localeCompare(b.principalType) || a.principalId.localeCompare(b.principalId))
}

function mergeGrants(primary: DocumentShareGrant[], legacy: DocumentShareGrant[]): DocumentShareGrant[] {
  const byKey = new Map<string, DocumentShareGrant>()
  for (const grant of [...legacy, ...primary]) {
    byKey.set(`${grant.tenantId}:${grant.documentId}:${grant.principalType}:${grant.principalId}`, grant)
  }
  return sortGrants([...byKey.values()])
}

function mergeAuditEntries(primary: DocumentShareAuditLogEntry[], legacy: DocumentShareAuditLogEntry[]): DocumentShareAuditLogEntry[] {
  const byId = new Map<string, DocumentShareAuditLogEntry>()
  for (const entry of [...legacy, ...primary]) byId.set(entry.auditId, entry)
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function documentShareGrantKey(tenantId: string, documentId: string): string {
  return `${documentShareGrantPrefix}/${encodePathPart(tenantId)}/${encodePathPart(documentId)}.json`
}

function documentShareAuditKey(tenantId: string, documentId: string): string {
  return `${documentShareAuditPrefix}/${encodePathPart(tenantId)}/${encodePathPart(documentId)}.json`
}

function encodePathPart(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

export class DocumentShareValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DocumentShareValidationError"
  }
}

export class DocumentShareConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DocumentShareConflictError"
  }
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
