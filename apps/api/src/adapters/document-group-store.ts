import type { DocumentGroup } from "../types.js"

export type CreateDocumentGroupInput = DocumentGroup
export type UpdateDocumentGroupInput = Partial<Pick<
  DocumentGroup,
  | "name"
  | "description"
  | "parentGroupId"
  | "ancestorGroupIds"
  | "visibility"
  | "sharedUserIds"
  | "sharedGroups"
  | "managerUserIds"
  | "updatedAt"
>>

export interface DocumentGroupStore {
  list(): Promise<DocumentGroup[]>
  get(groupId: string): Promise<DocumentGroup | undefined>
  create(input: CreateDocumentGroupInput): Promise<DocumentGroup>
  update(groupId: string, input: UpdateDocumentGroupInput): Promise<DocumentGroup>
}
