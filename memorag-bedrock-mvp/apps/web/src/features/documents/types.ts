export type DocumentManifest = {
  documentId: string
  fileName: string
  mimeType?: string
  metadata?: Record<string, unknown>
  chunkCount: number
  memoryCardCount: number
  createdAt: string
  lifecycleStatus?: "active" | "staging" | "superseded"
  activeDocumentId?: string
  stagedFromDocumentId?: string
  reindexMigrationId?: string
  chunkerVersion?: string
  sourceExtractorVersion?: string
}

export type DocumentGroup = {
  groupId: string
  name: string
  description?: string
  parentGroupId?: string
  ancestorGroupIds?: string[]
  ownerUserId: string
  visibility: "private" | "shared" | "org"
  sharedUserIds: string[]
  sharedGroups: string[]
  managerUserIds: string[]
  createdAt: string
  updatedAt: string
}

export type SearchScope = {
  mode?: "all" | "groups" | "documents" | "temporary"
  groupIds?: string[]
  documentIds?: string[]
  includeTemporary?: boolean
  temporaryScopeId?: string
}

export type ReindexMigration = {
  migrationId: string
  sourceDocumentId: string
  stagedDocumentId: string
  activeDocumentId?: string
  status: "staged" | "cutover" | "rolled_back"
  createdBy: string
  createdAt: string
  updatedAt: string
  cutoverAt?: string
  rolledBackAt?: string
  previousManifestObjectKey: string
  stagedManifestObjectKey: string
}
