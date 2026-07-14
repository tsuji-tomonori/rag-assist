import type { DocumentGroup } from "../types.js"

export type CreateDocumentGroupInput = DocumentGroup
export type UpdateDocumentGroupInput = Partial<Pick<
  DocumentGroup,
  | "schemaVersion"
  | "itemType"
  | "adminPrincipalType"
  | "adminPrincipalId"
  | "name"
  | "normalizedName"
  | "canonicalPath"
  | "normalizedCanonicalPath"
  | "adminPathPk"
  | "parentPathPk"
  | "description"
  | "parentGroupId"
  | "ancestorGroupIds"
  | "visibility"
  | "sharedUserIds"
  | "sharedGroups"
  | "managerUserIds"
  | "hasExplicitPolicy"
  | "policyId"
  | "status"
  | "createdBy"
  | "effectivePermission"
  | "policySource"
  | "inheritedFromFolderId"
  | "inheritedPolicyId"
  | "inheritedPolicyVersion"
  | "folderLocalPolicyVersion"
  | "folderProjectionVersion"
  | "folderMoveOperationId"
  | "updatedAt"
>>

export type DocumentGroupPathLock = {
  tenantId: string
  groupId: string
  itemType: "documentGroupPathLock"
  adminPathPk: string
  normalizedCanonicalPath: string
  lockedGroupId: string
  createdAt: string
  updatedAt: string
}

export type DocumentGroupPathUpdate = {
  current: DocumentGroup
  next: DocumentGroup
}

export interface DocumentGroupStore {
  list(tenantId: string): Promise<DocumentGroup[]>
  get(tenantId: string, groupId: string): Promise<DocumentGroup | undefined>
  create(input: CreateDocumentGroupInput): Promise<DocumentGroup>
  createWithPathLock(input: CreateDocumentGroupInput): Promise<DocumentGroup>
  update(tenantId: string, groupId: string, input: UpdateDocumentGroupInput): Promise<DocumentGroup>
  updateWithPathLocks(tenantId: string, updates: DocumentGroupPathUpdate[]): Promise<DocumentGroup[]>
  findByCanonicalPath(tenantId: string, adminPathPk: string, normalizedCanonicalPath: string): Promise<DocumentGroup | undefined>
  listByAdminPath(tenantId: string, adminPathPk: string): Promise<DocumentGroup[]>
}
