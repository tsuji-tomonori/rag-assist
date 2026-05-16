export type ExtractionWarning = {
  code: string
  message: string
  severity: "info" | "warning" | "error"
  page?: number
  sourceBlockId?: string
  confidence?: number
}

export type ParsedDocument = {
  schemaVersion: 2
  text: string
  sourceExtractorVersion: string
  fileProfile?: "digital_text" | "scanned_image" | "mixed" | "image_only" | "unknown"
  pages?: Array<Record<string, unknown>>
  blocks?: Array<Record<string, unknown>>
  tables?: Array<Record<string, unknown>>
  figures?: Array<Record<string, unknown>>
  warnings?: ExtractionWarning[]
  counters?: Record<string, number>
}

export type DocumentQualityProfile = {
  knowledgeQualityStatus?: "approved" | "warning" | "blocked"
  verificationStatus?: "verified" | "unverified" | "rejected"
  freshnessStatus?: "current" | "stale" | "expired"
  supersessionStatus?: "current" | "superseded"
  extractionQualityStatus?: "high" | "medium" | "low" | "unusable"
  ragEligibility?: "eligible" | "eligible_with_warning" | "excluded"
  confidence?: number
  flags?: Array<"verification_required" | "freshness_review_required" | "superseded_by_newer_document" | "low_extraction_confidence" | "manual_rag_exclusion">
  updatedAt?: string
  updatedBy?: string
}

export type DocumentManifest = {
  documentId: string
  fileName: string
  mimeType?: string
  metadata?: Record<string, unknown>
  parsedDocument?: ParsedDocument
  extractionWarnings?: ExtractionWarning[]
  extractionCounters?: Record<string, number>
  fileProfile?: "digital_text" | "scanned_image" | "mixed" | "image_only" | "unknown"
  qualityProfile?: DocumentQualityProfile
  chunkCount: number
  memoryCardCount: number
  createdAt: string
  updatedAt?: string
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
