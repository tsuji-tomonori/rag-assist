import type { DocumentGroup } from "../types.js"

export type CreateDocumentGroupInput = DocumentGroup
export type UpdateDocumentGroupInput = Partial<Pick<
  DocumentGroup,
  | "schemaVersion"
  | "itemType"
  | "tenantId"
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
  | "updatedAt"
>>

export type DocumentGroupPathLock = {
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
  list(): Promise<DocumentGroup[]>
  get(groupId: string): Promise<DocumentGroup | undefined>
  create(input: CreateDocumentGroupInput): Promise<DocumentGroup>
  createWithPathLock(input: CreateDocumentGroupInput): Promise<DocumentGroup>
  update(groupId: string, input: UpdateDocumentGroupInput): Promise<DocumentGroup>
  updateWithPathLocks(updates: DocumentGroupPathUpdate[]): Promise<DocumentGroup[]>
  findByCanonicalPath(adminPathPk: string, normalizedCanonicalPath: string): Promise<DocumentGroup | undefined>
  listByAdminPath(adminPathPk: string): Promise<DocumentGroup[]>
}
