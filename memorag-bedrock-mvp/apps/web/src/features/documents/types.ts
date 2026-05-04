export type DocumentManifest = {
  documentId: string
  fileName: string
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
