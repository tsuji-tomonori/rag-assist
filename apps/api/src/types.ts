import type { SafeDegradationDecision } from "./rag/_shared/security/safe-degradation-policy.js"

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export type VectorKind = "chunk" | "memory"
export type ChunkKind = "text" | "table" | "list" | "code" | "figure"
export type DocumentLifecycleStatus = "active" | "staging" | "superseded"
export type IngestProcessingStatus = "complete" | "partial" | "quarantined" | "rejected"
export type DocumentScopeType = "personal" | "group" | "chat" | "benchmark"
export type KnowledgeQualityStatus = "approved" | "warning" | "blocked"
export type VerificationStatus = "verified" | "unverified" | "rejected"
export type FreshnessStatus = "current" | "stale" | "expired"
export type SupersessionStatus = "current" | "superseded"
export type ExtractionQualityStatus = "high" | "medium" | "low" | "unusable"
export type RagEligibilityStatus = "eligible" | "eligible_with_warning" | "excluded"
export type QualityFlag =
  | "verification_required"
  | "freshness_review_required"
  | "superseded_by_newer_document"
  | "low_extraction_confidence"
  | "manual_rag_exclusion"

export type SourceAdmissionStatus = "approved" | "quarantined" | "rejected"
export type SourceInspectionStatus = "passed" | "failed" | "unknown"
export type SourceMalwareScanStatus = "clean" | "unknown" | "pending" | "infected" | "failed" | "timeout"

export type SourceMalwareScanEvidence = {
  status: SourceMalwareScanStatus
  profileVersion?: string
}

export type VersionedRecordReference = {
  id: string
  version: string
  hash: string
}

export type AuthoritativeAdmissionContext = {
  mode: "authoritative"
  tenantId: string
  ownerUserId: string
  authorizationRef?: VersionedRecordReference
  classificationRef?: VersionedRecordReference
  usagePolicyRef?: VersionedRecordReference
  qualityRef?: VersionedRecordReference
  lifecycleRef?: VersionedRecordReference
  provenanceRef?: VersionedRecordReference
  inspectionStatus?: SourceInspectionStatus
  malwareScan?: SourceMalwareScanEvidence
  qualityProfile?: DocumentQualityProfile
  lifecycleStatus?: Extract<DocumentLifecycleStatus, "active" | "staging" | "superseded">
  scope?: {
    scopeType: DocumentScopeType
    groupIds?: string[]
    folderIds?: string[]
    allowedUsers?: string[]
    temporaryScopeId?: string
    expiresAt?: string
  }
  lifecycleMetadata?: {
    activeDocumentId?: string
    stagedFromDocumentId?: string
    reindexMigrationId?: string
  }
}

export type LocalTestFixtureAdmissionContext = {
  mode: "local_test_fixture"
  fixtureId: string
  tenantId?: string
  ownerUserId?: string
}

export type IngestAdmissionContext = AuthoritativeAdmissionContext | LocalTestFixtureAdmissionContext

export type SourceAdmissionRecord = {
  schemaVersion: 1
  status: SourceAdmissionStatus
  tenantId?: string
  ownerUserId?: string
  authorizationRef?: VersionedRecordReference
  classificationRef?: VersionedRecordReference
  usagePolicyRef?: VersionedRecordReference
  qualityRef?: VersionedRecordReference
  lifecycleRef?: VersionedRecordReference
  provenanceRef?: VersionedRecordReference
  inspectionStatus: SourceInspectionStatus
  malwareScan?: SourceMalwareScanEvidence
  reasons: string[]
  rejectedProtectedMetadataKeys: string[]
  admittedAt: string
  degradationDecision?: SafeDegradationDecision
}

export type DerivedRecordSecurityEnvelope = {
  schemaVersion: 1
  documentId: string
  documentVersion: string
  tenantId: string
  authorizationRef: VersionedRecordReference
  classificationRef: VersionedRecordReference
  usagePolicyRef: VersionedRecordReference
  qualityRef: VersionedRecordReference
  lifecycleRef: VersionedRecordReference
  provenanceRef: VersionedRecordReference
  sourceLocator: SourceLocation
  envelopeHash: string
}

export type DerivedArtifactIntegrity = {
  schemaVersion: 1
  expectedChunkCount: number
  expectedMemoryCardCount: number
  evidenceRecordCount: number
  memoryRecordCount: number
  manifestHash: string
  recordSetHash: string
  objectHashes?: {
    source: string
    structuredBlocks?: string
    memoryCards?: string
  }
  verified: boolean
  reasons: string[]
}

export type ChunkingPolicySnapshot = {
  schemaVersion: 1
  policyId: string
  version: string
  strategy: "structure_aware"
  tokenizer: "unicode_code_point_v1"
  maxChars: number
  maxTokens: number
  overlapChars: number
  minTokens: number
  preserveAtomicBlocks: boolean
  stableIdAlgorithm: "sha256_locator_content_v1"
}

export type ChunkingViolation = {
  code: "invalid_policy" | "missing_locator" | "oversized_atomic_block" | "char_budget_exceeded" | "token_budget_exceeded" | "fragment_below_minimum"
  message: string
  sourceBlockId?: string
  chunkId?: string
}

export type PublicationPurpose = "ingest" | "reindex" | "rollback"

export type StagedPublicationFence = {
  schemaVersion: 1
  runId: string
  artifactId: string
  idempotencyKey: string
  sourceId: string
  purpose: PublicationPurpose
  stageNamespace: string
  generation: number
  fencingToken: string
}

export type PublicationControl = {
  schemaVersion: 1
  sourceId: string
  purpose: PublicationPurpose
  activePointerKey: string
  artifactId: string
  runId: string
  generation: number
  fencingToken: string
}

export type FolderStatus = "active" | "archived"
export type FolderPolicySource = "explicit" | "inherited" | "ownerDefault" | "none"
export type FolderPrincipalType = "user" | "group"
export type FolderPolicyPermissionLevel = "deny" | "readOnly" | "full"
export type GroupMembershipPermissionLevel = "readOnly" | "full"
export type DocumentPermissionLevel = "readOnly" | "full"
export type DocumentPolicyPermissionLevel = "deny" | DocumentPermissionLevel
export type EffectiveDocumentPermission = "none" | DocumentPermissionLevel
export type FolderPolicyEntry = {
  principalType: FolderPrincipalType
  principalId: string
  permissionLevel: FolderPolicyPermissionLevel
}

export type DocumentShareGrant = {
  documentShareGrantId: string
  itemType?: "documentShareGrant"
  tenantId: string
  documentId: string
  principalType: FolderPrincipalType
  principalId: string
  permissionLevel: DocumentPolicyPermissionLevel
  createdBy: string
  reason: string
  createdAt: string
  updatedAt: string
}

export type DocumentShareAuditAction = "document:share" | "document:move"

export type DocumentShareAuditLogEntry = {
  auditId: string
  action: DocumentShareAuditAction
  tenantId?: string
  actorUserId: string
  documentId: string
  before?: JsonValue
  after?: JsonValue
  reason: string
  createdAt: string
}

export type DocumentShareLedger = {
  schemaVersion: 1
  grants: DocumentShareGrant[]
  auditLog: DocumentShareAuditLogEntry[]
}

export type FolderPolicy = {
  policyId: string
  itemType?: "folderPolicy"
  tenantId: string
  folderId: string
  entries: FolderPolicyEntry[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type UserGroupType = "department" | "project" | "team" | "admin" | "folderPolicy" | "system" | "custom"
export type UserGroup = {
  groupId: string
  itemType?: "userGroup"
  tenantId: string
  name: string
  type: UserGroupType
  parentGroupId?: string
  ancestorGroupIds: string[]
  status: FolderStatus
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type GroupMembershipSource = "manual" | "external" | "system"
export type GroupMembership = {
  membershipId?: string
  itemType?: "groupMembership"
  tenantId: string
  groupId: string
  memberType: FolderPrincipalType
  memberId: string
  permissionLevel: GroupMembershipPermissionLevel
  source: GroupMembershipSource
  createdAt: string
  updatedAt: string
}

export type DocumentQualityProfile = {
  knowledgeQualityStatus?: KnowledgeQualityStatus
  verificationStatus?: VerificationStatus
  freshnessStatus?: FreshnessStatus
  supersessionStatus?: SupersessionStatus
  extractionQualityStatus?: ExtractionQualityStatus
  ragEligibility?: RagEligibilityStatus
  confidence?: number
  flags?: QualityFlag[]
  updatedAt?: string
  updatedBy?: string
}

export type SearchScope = {
  mode?: "all" | "groups" | "documents" | "temporary"
  groupIds?: string[]
  documentIds?: string[]
  includeTemporary?: boolean
  temporaryScopeId?: string
}

export type DocumentGroup = {
  groupId: string
  schemaVersion?: number
  itemType?: "documentGroup"
  tenantId: string
  adminPrincipalType?: "user" | "group"
  adminPrincipalId?: string
  name: string
  normalizedName?: string
  canonicalPath?: string
  normalizedCanonicalPath?: string
  adminPathPk?: string
  parentPathPk?: string
  description?: string
  parentGroupId?: string
  ancestorGroupIds?: string[]
  ownerUserId: string
  visibility: "private" | "shared" | "org"
  sharedUserIds: string[]
  sharedGroups: string[]
  managerUserIds: string[]
  hasExplicitPolicy?: boolean
  policyId?: string
  status?: FolderStatus
  createdBy?: string
  effectivePermission?: "none" | "readOnly" | "full"
  policySource?: FolderPolicySource
  inheritedFromFolderId?: string
  /** Durable projection metadata maintained by the folder move coordinator. */
  inheritedPolicyId?: string
  inheritedPolicyVersion?: string
  folderLocalPolicyVersion?: string
  folderProjectionVersion?: string
  folderMoveOperationId?: string
  createdAt: string
  updatedAt: string
}

export type PipelineVersions = {
  chatOrchestrationWorkflowVersion: string
  /** @deprecated Use chatOrchestrationWorkflowVersion. */
  agentWorkflowVersion: string
  chunkerVersion: string
  sourceExtractorVersion: string
  memoryPromptVersion: string
  promptVersion: string
  indexVersion: string
  embeddingModelId: string
  embeddingDimensions: number
}

export type SourceLocation = {
  page?: number
  pageStart?: number
  pageEnd?: number
  bbox?: JsonValue
  unit?: "normalized_page" | "pdf_point" | "pixel" | "unknown"
  source?: string
  sectionPath?: string[]
  startChar?: number
  endChar?: number
  sourceBlockId?: string
  sourceChunkIds?: string[]
}

export type ExtractionWarning = {
  code: string
  message: string
  severity: "info" | "warning" | "error"
  page?: number
  pageStart?: number
  pageEnd?: number
  sectionPath?: string[]
  startChar?: number
  endChar?: number
  sourceBlockId?: string
  confidence?: number
  degradationDecision?: SafeDegradationDecision
}

export type PdfFileProfile = "digital_text" | "scanned_image" | "mixed" | "image_only" | "unknown"

export type ParsedPage = {
  pageNumber: number
  text?: string
  fileProfile?: PdfFileProfile
  confidence?: number
  warnings?: ExtractionWarning[]
}

export type ParsedBlock = {
  id: string
  kind: ChunkKind
  text: string
  pageStart?: number
  pageEnd?: number
  sourceBlockId?: string
  normalizedFrom?: string
  extractionMethod?: string
  bbox?: JsonValue
  confidence?: number
  readingOrder?: number
  sourceLocation?: SourceLocation
  tableId?: string
  figureId?: string
}

export type ExtractedTableCell = {
  rowIndex: number
  columnIndex: number
  text: string
  confidence?: number
  bbox?: JsonValue
  sourceBlockId?: string
}

export type ExtractedTable = {
  id: string
  pageStart?: number
  pageEnd?: number
  sourceBlockId?: string
  markdown: string
  rowCount: number
  columnCount: number
  confidence?: number
  bbox?: JsonValue
  cells: ExtractedTableCell[]
}

export type ExtractedFigure = {
  id: string
  pageStart?: number
  pageEnd?: number
  sourceBlockId?: string
  caption?: string
  confidence?: number
  bbox?: JsonValue
}

export type ParsedDocument = {
  schemaVersion: 2
  text: string
  sourceExtractorVersion: string
  fileProfile?: PdfFileProfile
  pages?: ParsedPage[]
  blocks?: ParsedBlock[]
  tables?: ExtractedTable[]
  figures?: ExtractedFigure[]
  warnings?: ExtractionWarning[]
  counters?: Record<string, number>
  extractionStatus?: "complete" | "partial"
  inputCharCount?: number
  outputCharCount?: number
  contentHash?: string
}

export type DocumentStatistics = {
  chunkCount: number
  sectionCount: number
  tableCount: number
  listCount: number
  codeCount: number
  figureCount: number
  averageChunkChars: number
  headingDensity: number
}

export type VectorMetadata = {
  kind: VectorKind
  documentId: string
  documentVersion?: string
  evidenceTopic?: string
  evidenceRole?: EvidenceRole
  authorityStatus?: EvidenceAuthorityStatus
  effectiveFrom?: string
  effectiveUntil?: string
  fileName: string
  chunkId?: string
  memoryId?: string
  objectKey?: string
  sourceUri?: string
  text?: string
  sectionPath?: string[]
  heading?: string
  parentSectionId?: string
  previousChunkId?: string
  nextChunkId?: string
  chunkHash?: string
  pageStart?: number
  pageEnd?: number
  pageOrSheet?: string
  drawingNo?: string
  sheetTitle?: string
  scale?: string
  regionId?: string
  regionType?: string
  sourceType?: string
  bbox?: JsonValue
  chunkKind?: ChunkKind
  sourceBlockId?: string
  normalizedFrom?: string
  tableColumnCount?: number
  tableId?: string
  tableRowCount?: number
  tableConfidence?: number
  listDepth?: number
  codeLanguage?: string
  figureCaption?: string
  figureId?: string
  confidence?: number
  readingOrder?: number
  sourceLocation?: SourceLocation
  securityEnvelope?: DerivedRecordSecurityEnvelope
  publicationFence?: StagedPublicationFence
  extractionMethod?: string
  lifecycleStatus?: DocumentLifecycleStatus
  tenantId?: string
  department?: string
  source?: string
  docType?: string
  benchmarkSuiteId?: string
  scopeType?: DocumentScopeType
  groupId?: string
  folderId?: string
  groupIds?: string[]
  folderIds?: string[]
  folderCanonicalPaths?: string[]
  folderPolicyRefs?: string[]
  folderProjectionVersion?: string
  folderMoveOperationId?: string
  ownerUserId?: string
  temporaryScopeId?: string
  expiresAt?: string
  domainPolicy?: string
  ragPolicy?: string
  answerPolicy?: string
  ragEligibility?: RagEligibilityStatus
  drawingSourceType?: "project_drawing" | "standard_detail" | "equipment_standard" | "benchmark_reference" | "external"
  drawingSheetMetadata?: JsonValue[]
  drawingRegionIndex?: JsonValue[]
  drawingReferenceGraph?: JsonValue
  drawingExtractionArtifacts?: JsonValue[]
  aclGroup?: string
  aclGroups?: string[]
  allowedUsers?: string[]
  sources?: string[]
  sourceChunkIds?: string[]
  rrfScore?: number
  lexicalRank?: number
  semanticRank?: number
  crossQueryRrfScore?: number
  crossQueryRank?: number
  expansionSource?: "hybrid" | "context_window" | "memory_source"
  createdAt: string
}

export type VectorRecord = {
  key: string
  vector: number[]
  metadata: VectorMetadata
}

export type RetrievedVector = {
  key: string
  score: number
  distance?: number
  metadata: VectorMetadata
}

export type DocumentManifest = {
  documentId: string
  documentVersion?: string
  traceId?: string
  replayVersionManifest?: ReplayVersionManifest
  fileName: string
  mimeType?: string
  metadata?: Record<string, JsonValue>
  qualityProfile?: DocumentQualityProfile
  admission?: SourceAdmissionRecord
  derivedIntegrity?: DerivedArtifactIntegrity
  securityEnvelope?: DerivedRecordSecurityEnvelope
  chunkingPolicy?: ChunkingPolicySnapshot
  chunkingViolations?: ChunkingViolation[]
  publicationEligible?: boolean
  processingStatus?: IngestProcessingStatus
  publicationFence?: StagedPublicationFence
  publicationControl?: PublicationControl
  sourceObjectKey: string
  structuredBlocksObjectKey?: string
  memoryCardsObjectKey?: string
  manifestObjectKey: string
  vectorKeys: string[]
  memoryVectorKeys?: string[]
  evidenceVectorKeys?: string[]
  embeddingModelId?: string
  embeddingDimensions?: number
  chunkerVersion?: string
  sourceExtractorVersion?: string
  memoryPromptVersion?: string
  indexVersion?: string
  pipelineVersions?: PipelineVersions
  documentStatistics?: DocumentStatistics
  chunks?: ChunkMetadata[]
  lifecycleStatus?: DocumentLifecycleStatus
  activeDocumentId?: string
  stagedFromDocumentId?: string
  reindexMigrationId?: string
  chunkCount: number
  memoryCardCount: number
  parsedDocument?: ParsedDocument
  extractionWarnings?: ExtractionWarning[]
  extractionCounters?: Record<string, number>
  fileProfile?: PdfFileProfile
  createdAt: string
  updatedAt?: string
  currentUserEffectivePermission?: EffectiveDocumentPermission
  capabilities?: DocumentCapabilities
}

export type DocumentManifestSummary = Pick<
  DocumentManifest,
  | "documentId"
  | "fileName"
  | "mimeType"
  | "chunkCount"
  | "memoryCardCount"
  | "createdAt"
  | "lifecycleStatus"
  | "activeDocumentId"
  | "stagedFromDocumentId"
  | "reindexMigrationId"
  | "chunkerVersion"
  | "sourceExtractorVersion"
>

export type DocumentListItemSummary = DocumentManifestSummary & Pick<
  DocumentManifest,
  | "metadata"
  | "embeddingModelId"
  | "embeddingDimensions"
> & {
  currentUserEffectivePermission?: EffectiveDocumentPermission
  capabilities?: DocumentCapabilities
}

export type DocumentCapabilities = {
  canRead: boolean
  canShare: boolean
  canMove: boolean
  canDelete: boolean
  canReindex: boolean
}

export type ParsedDocumentPreview = {
  documentId: string
  fileName: string
  sourceExtractorVersion?: string
  fileProfile?: PdfFileProfile
  textPreview?: string
  pageCount: number
  blockCount: number
  tableCount: number
  figureCount: number
  warnings: ExtractionWarning[]
  counters?: Record<string, number>
  pages?: ParsedPage[]
  blocks?: ParsedBlock[]
  tables?: ExtractedTable[]
  figures?: ExtractedFigure[]
  qualityProfile?: DocumentQualityProfile
  available: boolean
  unavailableReason?: string
}

export type MemoryCard = {
  id: string
  level?: "document" | "section" | "concept"
  summary: string
  keywords: string[]
  likelyQuestions: string[]
  constraints: string[]
  text: string
  sourceChunkIds?: string[]
  pageStart?: number
  pageEnd?: number
  sectionPath?: string[]
  securityEnvelope?: DerivedRecordSecurityEnvelope
}

export type Chunk = {
  id: string
  text: string
  startChar: number
  endChar: number
  sectionPath?: string[]
  heading?: string
  parentSectionId?: string
  previousChunkId?: string
  nextChunkId?: string
  chunkHash?: string
  pageStart?: number
  pageEnd?: number
  chunkKind?: ChunkKind
  sourceBlockId?: string
  normalizedFrom?: string
  tableColumnCount?: number
  tableId?: string
  tableRowCount?: number
  tableConfidence?: number
  listDepth?: number
  codeLanguage?: string
  figureCaption?: string
  figureId?: string
  confidence?: number
  readingOrder?: number
  bbox?: JsonValue
  sourceLocation?: SourceLocation
  extractionMethod?: string
  securityEnvelope?: DerivedRecordSecurityEnvelope
}

export type ChunkMetadata = Omit<Chunk, "text">

export type StructuredBlock = {
  id: string
  kind: ChunkKind
  text: string
  pageStart?: number
  pageEnd?: number
  heading?: string
  sectionPath?: string[]
  sourceBlockId?: string
  normalizedFrom?: string
  tableColumnCount?: number
  tableId?: string
  tableRowCount?: number
  tableConfidence?: number
  listDepth?: number
  codeLanguage?: string
  figureCaption?: string
  figureId?: string
  confidence?: number
  readingOrder?: number
  bbox?: JsonValue
  sourceLocation?: SourceLocation
  extractionMethod?: string
}

export type Citation = {
  documentId: string
  documentVersion?: string
  fileName: string
  chunkId?: string
  pageStart?: number
  pageEnd?: number
  pageOrSheet?: string
  drawingNo?: string
  sheetTitle?: string
  scale?: string
  regionId?: string
  regionType?: string
  sourceType?: string
  bbox?: JsonValue
  score: number
  text: string
  topic?: string
  evidenceRole?: EvidenceRole
  authorityStatus?: EvidenceAuthorityStatus
  effectiveFrom?: string
  effectiveUntil?: string
  sourceLocator?: SourceLocation
  authorizationDecision?: "allowed"
  authorizationEvaluatedAt?: string
}

export type EvidenceRole = "supporting" | "conflicting" | "outdated" | "background"
export type EvidenceAuthorityStatus = "authoritative" | "secondary" | "unknown"

export type ClarificationOption = {
  id: string
  label: string
  resolvedQuery: string
  reason?: string
  source: "memory" | "evidence" | "aspect" | "history"
  grounding: Array<{
    documentId?: string
    fileName?: string
    chunkId?: string
    heading?: string
  }>
}

export type Clarification = {
  needsClarification: boolean
  reason:
    | "ambiguous_target"
    | "missing_scope"
    | "unresolved_reference"
    | "multiple_candidate_intents"
    | "conflicting_scope"
    | "not_needed"
  question: string
  options: ClarificationOption[]
  missingSlots: string[]
  confidence: number
  ambiguityScore?: number
  groundedOptionCount?: number
}

export type ClarificationContext = {
  originalQuestion?: string
  selectedOptionId?: string
  selectedValue?: string
}

export type ConversationHistoryTurn = {
  role: "user" | "assistant"
  text: string
  turnId?: string
}

export type DebugStepStatus = "success" | "warning" | "error"
export type DebugTraceTargetType = "rag_run" | "ingest_run" | "chat_orchestration_run" | "async_agent_run" | "tool_invocation"
export type DebugTraceVisibility = "user_safe" | "support_sanitized" | "operator_sanitized" | "internal_restricted"

export const DEBUG_TRACE_SANITIZE_POLICY_VERSION = "debug-trace-sanitize-v1"

export type DebugTraceExportRedaction = {
  policyVersion: typeof DEBUG_TRACE_SANITIZE_POLICY_VERSION
  visibility: DebugTraceVisibility
  redactedFields: string[]
  notes?: string[]
}

export type DebugStep = {
  id: number
  label: string
  status: DebugStepStatus
  latencyMs: number
  modelId?: string
  summary: string
  detail?: string
  output?: Record<string, unknown>
  hitCount?: number
  tokenCount?: number
  degradationDecision?: SafeDegradationDecision
  startedAt: string
  completedAt: string
}

export const DEBUG_TRACE_SCHEMA_VERSION = 1

export type DebugTrace = {
  schemaVersion: typeof DEBUG_TRACE_SCHEMA_VERSION
  runId: string
  requestTraceId?: string
  parentTraceIds?: string[]
  tenantPartitionId?: string
  actorPartitionId?: string
  securityResourceRefs?: string[]
  targetType?: DebugTraceTargetType
  visibility?: DebugTraceVisibility
  sanitizePolicyVersion?: typeof DEBUG_TRACE_SANITIZE_POLICY_VERSION
  exportRedaction?: DebugTraceExportRedaction
  question: string
  modelId: string
  embeddingModelId: string
  clueModelId: string
  conversationHistory?: ConversationHistoryTurn[]
  clarificationContext?: ClarificationContext
  conversation?: unknown
  conversationState?: unknown
  decontextualizedQuery?: unknown
  pipelineVersions?: PipelineVersions
  replayVersionManifest?: ReplayVersionManifest
  decision?: ReplayDecisionSummary
  ragProfile?: {
    id: string
    version: string
    retrievalProfileId: string
    retrievalProfileVersion: string
    answerPolicyId: string
    answerPolicyVersion: string
  }
  topK: number
  memoryTopK: number
  minScore: number
  startedAt: string
  completedAt: string
  totalLatencyMs: number
  status: DebugStepStatus
  answerPreview: string
  isAnswerable: boolean
  citations: Citation[]
  retrieved: Citation[]
  finalEvidence?: Citation[]
  toolInvocations?: ChatToolInvocation[]
  steps: DebugStep[]
}

export type WorkerTargetType = "chat_run" | "document_ingest_run" | "benchmark_run" | "async_agent_run"
export type WorkerErrorCode = "validation_error" | "not_found" | "permission_revoked" | "execution_error"

export type WorkerEvent = {
  runId: string
  tenantId: string
  targetType?: WorkerTargetType
}

export type WorkerResult = {
  runId: string
  targetType?: WorkerTargetType
  status: string
  resultType: "succeeded" | "failed"
  traceId?: string
  replayVersionManifest?: ReplayVersionManifest
  responseProfileVersion?: "resource-non-enumeration-v1"
  error?: {
    code: WorkerErrorCode
    message: string
    retryable: boolean
  }
}

export type AgentRuntimeProvider = "claude_code" | "codex" | "opencode" | "custom"
export type AgentProviderAvailability = "disabled" | "not_configured" | "provider_unavailable" | "available"

export type AgentModelSelection = {
  provider: AgentRuntimeProvider
  modelId: string
  modelDisplayName?: string
  maxTokens?: number
  temperature?: number
}

export type AsyncAgentRunStatus =
  | "queued"
  | "preparing_workspace"
  | "running"
  | "waiting_for_approval"
  | "completed"
  | "failed"
  | "blocked"
  | "cancelled"
  | "expired"

export type AgentWorkspaceMount = {
  mountId: string
  workspaceId: string
  sourceType: "folder" | "document" | "temporaryUpload" | "artifact"
  sourceId: string
  originalFileName?: string
  mountedPath: string
  accessMode: "readOnly" | "writableCopy"
  permissionCheckedAt: string
}

export type AgentArtifact = {
  artifactId: string
  agentRunId: string
  artifactType: "file" | "patch" | "report" | "markdown" | "json" | "log"
  fileName: string
  mimeType: string
  size: number
  storageRef: string
  createdAt: string
  writebackStatus?: "not_requested" | "pending_approval" | "approved" | "rejected" | "applied"
  writebackTarget?: {
    sourceType: "folder" | "document"
    sourceId: string
    targetPath?: string
  }
  writebackRequestedBy?: string
  writebackRequestedAt?: string
  writebackReviewedBy?: string
  writebackReviewedAt?: string
  writebackAppliedBy?: string
  writebackAppliedAt?: string
  writebackDecisionReason?: string
}

export type AgentProviderSetting = {
  provider: AgentRuntimeProvider
  displayName: string
  availability: AgentProviderAvailability
  credentialMode: "environment" | "not_configured" | "disabled"
  configuredModelIds: string[]
  reason?: string
}

export type SkillDefinition = {
  skillId: string
  tenantId: string
  name: string
  description?: string
  folderId: string
  markdownDocumentId: string
  version: string
  status: "draft" | "active" | "archived"
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type AgentProfileDefinition = {
  agentProfileId: string
  tenantId: string
  name: string
  description?: string
  folderId: string
  markdownDocumentId: string
  defaultSkillIds: string[]
  recommendedProvider?: AgentRuntimeProvider
  recommendedModelId?: string
  version: string
  status: "draft" | "active" | "archived"
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type AgentExecutionPreset = {
  presetId: string
  ownerUserId: string
  name: string
  description?: string
  provider: AgentRuntimeProvider
  modelId: string
  defaultFolderIds: string[]
  defaultSkillIds: string[]
  defaultAgentProfileIds: string[]
  defaultBudget?: AgentRunBudget
  createdAt: string
  updatedAt: string
}

export type AgentRunBudget = {
  maxCost?: number
  maxDurationMinutes?: number
  maxToolCalls?: number
}

export type AsyncAgentRun = {
  agentRunId: string
  /** Worker contract alias. G1 keeps agentRunId and runId identical. */
  runId: string
  tenantId: string
  requesterUserId: string
  requesterEmail?: string
  requesterGroups?: string[]
  provider: AgentRuntimeProvider
  modelId: string
  status: AsyncAgentRunStatus
  providerAvailability: AgentProviderAvailability
  failureReasonCode?: "not_configured" | "provider_unavailable" | "cancelled" | "permission_revoked" | "execution_error"
  failureReason?: string
  instruction: string
  selectedFolderIds: string[]
  selectedDocumentIds: string[]
  selectedSkillIds: string[]
  selectedAgentProfileIds: string[]
  workspaceId: string
  workspaceMounts: AgentWorkspaceMount[]
  artifactIds: string[]
  artifacts: AgentArtifact[]
  budget?: AgentRunBudget
  createdBy: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  updatedAt: string
}

export type QualityActionCard = {
  actionId: string
  documentId: string
  fileName: string
  severity: "info" | "warning" | "blocked"
  reasonCodes: string[]
  suggestedAction: "review_extraction" | "reparse_document" | "verify_document" | "update_freshness" | "rag_exclusion_review"
  title: string
  description: string
  createdAt: string
}

export type AdminExportArtifact = {
  exportType: "audit_log" | "usage_summary" | "cost_summary"
  url: string
  expiresInSeconds: number
  objectKey: string
  generatedAt: string
  redaction: {
    policyVersion: string
    redactedFields: string[]
    notes: string[]
  }
}

export type DebugReplayPlan = {
  runId: string
  targetType: DebugTraceTargetType
  sourceTraceVisibility: DebugTraceVisibility
  createdAt: string
  replayable: boolean
  versionComplete: boolean
  blockedReason?: string
  versionManifest?: ReplayVersionManifest
  inputSummary: {
    question: string
    modelId: string
    embeddingModelId: string
    topK: number
    memoryTopK: number
    minScore: number
    citationCount: number
  }
  redaction: DebugTraceExportRedaction
}

export type ReplaySourceSnapshot = {
  documentId: string
  documentVersion: string | null
  ingestTraceId: string | null
  parserVersion: string | null
  ocrVersion: string | null
  chunkerVersion: string | null
  chunkingPolicyVersion: string | null
  embeddingModelId: string | null
  embeddingDimensions: number | null
  indexVersion: string | null
  promptVersion: string | null
  pipelineVersion: string | null
}

export type ReplayVersionManifest = {
  schemaVersion: 1
  sourceSnapshots: ReplaySourceSnapshot[]
  parserVersion: string | null
  ocrVersion: string | null
  chunkerVersion: string | null
  chunkingPolicyVersion: string | null
  embedding: { modelId: string | null; dimensions: number | null }
  policyVersions: {
    ragProfile: string | null
    retrieval: string | null
    answer: string | null
    authorization: string | null
    eligibility: string | null
    untrustedContent: string | null
    traceSanitization: string | null
  }
  indexVersion: string | null
  modelVersions: { answer: string | null; clue: string | null }
  promptVersion: string | null
  pipelineVersion: string | null
  datasetVersion: string | null
  queryTransformation: {
    originalQuestionHash: string
    normalizedQueryHash: string | null
    expandedQuerySetHash: string | null
  }
  decisions: ReplayDecisionSummary
  nondeterministicFactors: string[]
  missingVersions: string[]
}

export type ReplayDecisionCode = "completed" | "refused" | "rejected" | "failed" | "cancelled"

export type ReplayDecisionReasonCode =
  | "authorization_denied"
  | "safety_interlock"
  | "dependency_error"
  | "admission_rejected"
  | "publication_not_eligible"
  | "permission_revoked"
  | "execution_error"
  | "insufficient_evidence"
  | "clarification_required"
  | "output_secret_detected"
  | "cancelled"

export type ReplayDecisionSummary = {
  candidateCount: number
  deniedCandidateCount: number
  finalEvidenceCount: number
  responseStatus: "success" | "warning" | "error"
  decisionCode: ReplayDecisionCode
  reasonCodes: ReplayDecisionReasonCode[]
  totalLatencyMs: number
}

export type ChatResponsePayload = {
  responseType?: "answer" | "refusal" | "clarification"
  answer: string
  isAnswerable: boolean
  needsClarification?: boolean
  clarification?: Clarification
  citations: Citation[]
  retrieved: Citation[]
  finalEvidence?: Citation[]
  debug?: DebugTrace
}

export type ChatRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled"

export type ChatRun = {
  runId: string
  status: ChatRunStatus
  createdBy: string
  tenantId: string
  userEmail?: string
  userGroups?: string[]
  securityResourceRefs?: string[]
  question: string
  conversationHistory?: ConversationHistoryTurn[]
  clarificationContext?: ClarificationContext
  modelId: string
  embeddingModelId?: string
  clueModelId?: string
  topK?: number
  memoryTopK?: number
  minScore?: number
  strictGrounded?: boolean
  useMemory?: boolean
  maxIterations?: number
  searchScope?: SearchScope
  includeDebug?: boolean
  responseType?: "answer" | "refusal" | "clarification"
  answer?: string
  isAnswerable?: boolean
  needsClarification?: boolean
  clarification?: Clarification
  citations?: Citation[]
  retrieved?: Citation[]
  debugRunId?: string
  error?: string
  errorCode?: WorkerErrorCode
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  ttl?: number
}

export type ChatRunEventType = "status" | "heartbeat" | "final" | "error"

export type ChatRunEvent = {
  runId: string
  seq: number
  type: ChatRunEventType
  stage?: string
  message?: string
  data?: JsonValue
  createdAt: string
  ttl?: number
}

export type DocumentIngestRunStatus = "queued" | "running" | "succeeded" | "rejected" | "failed" | "cancelled"

export type DocumentIngestRun = {
  runId: string
  status: DocumentIngestRunStatus
  createdBy: string
  tenantId: string
  userEmail?: string
  userGroups?: string[]
  securityResourceRefs?: string[]
  uploadId: string
  objectKey: string
  purpose: "document" | "benchmarkSeed" | "chatAttachment"
  fileName: string
  mimeType?: string
  metadata?: Record<string, JsonValue>
  admissionContext?: IngestAdmissionContext
  embeddingModelId?: string
  memoryModelId?: string
  skipMemory?: boolean
  manifest?: DocumentManifestSummary
  documentId?: string
  traceId?: string
  replayVersionManifest?: ReplayVersionManifest
  error?: string
  errorCode?: WorkerErrorCode
  stage?: string
  counters?: Record<string, number>
  warnings?: ExtractionWarning[]
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  ttl?: number
}

export type DocumentIngestRunEventType = "status" | "heartbeat" | "final" | "error"

export type DocumentIngestRunEvent = {
  runId: string
  seq: number
  type: DocumentIngestRunEventType
  traceId?: string
  replayVersionManifest?: ReplayVersionManifest
  stage?: string
  message?: string
  data?: JsonValue
  createdAt: string
  ttl?: number
}

export type BenchmarkRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled"
export type BenchmarkMode = "agent" | "search" | "load"
export type BenchmarkRunner = "codebuild" | "lambda"

export type BenchmarkRunMetrics = {
  total: number
  succeeded: number
  failedHttp: number
  answerableAccuracy?: number
  turnAnswerCorrectRate?: number
  conversationSuccessRate?: number
  historyDependentAccuracy?: number
  clarificationNeedPrecision?: number
  clarificationNeedRecall?: number
  clarificationNeedF1?: number
  optionHitRate?: number
  missingSlotHitRate?: number
  corpusGroundedOptionRate?: number
  postClarificationAccuracy?: number
  overClarificationRate?: number
  clarificationLatencyOverheadMs?: number
  postClarificationTaskLatencyMs?: number
  abstentionRecall?: number
  abstentionAccuracy?: number
  citationHitRate?: number
  expectedFileHitRate?: number
  extractionAccuracy?: number
  admissionCorrectness?: number
  retrievalRecallAt20?: number
  retrievalRecallAtK?: number
  falseDenialRate?: number
  faithfulness?: number
  unsupportedClaimRate?: number
  unsupportedSentenceRate?: number
  unsupportedAnswerRate?: number
  citationPrecision?: number
  citationSupportPassRate?: number
  citationCompleteness?: number
  citationLocatorValidity?: number
  requiredClaimMissCount?: number
  falseAnswerRate?: number
  falseRefusalRate?: number
  taskCompletionRate?: number
  taskOutcomeAccuracy?: number
  criticalTaskFailureCount?: number
  criticalUnsupportedClaimCount?: number
  noAccessLeakCount?: number
  injectionSuccessCount?: number
  secretExposureCount?: number
  eligibilityPropagationP99Ms?: number
  eligibilityPropagationP50Ms?: number
  eligibilityPropagationP95Ms?: number
  eligibilityPropagationMaxMs?: number
  eligibilityProbeSampleCount?: number
  eligibilityMatrixCoverage?: number
  eligibilityUnreconciledResourceCount?: number
  mttrMs?: number
  recoveryP95Ms?: number
  recoveryWithoutLossRate?: number
  recoveryLossCount?: number
  recoveryScenarioCoverage?: number
  recoverySampleCount?: number
  backlogAgeP99Ms?: number
  backlogAgeSampleCount?: number
  timeoutRate?: number
  retryExhaustionCount?: number
  p50LatencyMs?: number
  p95LatencyMs?: number
  p99LatencyMs?: number
  averageLatencyMs?: number
  errorRate?: number
  datasetVersion?: string
  workloadProfileVersion?: string
  runtimeProfileVersion?: string
  priceCatalogVersion?: string
  indexVersion?: string
  promptVersion?: string
  pipelineVersion?: string
  parserVersion?: string
  chunkerVersion?: string
  corpusProfileVersion?: string
  aclDistributionVersion?: string
  workloadConcurrency?: number
  documentSizeProfileVersion?: string
  dependencyLatencyProfileVersion?: string
  qualitySliceMeasurements?: Array<{
    slice: string
    sampleCount: number
    measurements: Partial<Record<string, number>>
  }>
  eligibilityMatrixReport?: {
    schemaVersion: number
    triggerCount: number
    pathCount: number
    probeCount: number
    p50Ms?: number
    p95Ms?: number
    p99Ms?: number
    maxMs?: number
    unreflectedResourceIds: string[]
    probes: Array<{
      trigger: string
      path: string
      propagationMs?: number
      unreflectedResourceIds: string[]
    }>
  }
  modelCostPerUnit?: number
  embeddingCostPerUnit?: number
  storageCostPerUnit?: number
  workerCostPerUnit?: number
  egressCostPerUnit?: number
  totalCostPerUnit?: number
  costEvidenceSampleCount?: number
  chatCostEvidenceSampleCount?: number
  searchCostEvidenceSampleCount?: number
  ingestCostEvidenceSampleCount?: number
  unitCostKind?: "chat_request" | "search_request" | "ingest_document"
  chatCostPerRequest?: number
  searchCostPerRequest?: number
  ingestCostPerDocument?: number
  releaseAuditVersion?: string
  releaseAuditId?: string
  datasetSpecificBranchCount?: number
  artifactManifestMismatchCount?: number
}

export type BenchmarkRunThresholds = {
  answerableAccuracy?: number
  retrievalRecallAt20?: number
  p95LatencyMs?: number
}

export type BenchmarkRun = {
  runId: string
  status: BenchmarkRunStatus
  mode: BenchmarkMode
  runner: BenchmarkRunner
  suiteId: string
  datasetS3Key: string
  createdBy: string
  tenantId: string
  securityResourceRefs?: string[]
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  executionArn?: string
  codeBuildBuildId?: string
  codeBuildLogUrl?: string
  codeBuildLogGroupName?: string
  codeBuildLogStreamName?: string
  modelId?: string
  embeddingModelId?: string
  topK?: number
  memoryTopK?: number
  minScore?: number
  concurrency?: number
  thresholds?: BenchmarkRunThresholds
  summaryS3Key?: string
  reportS3Key?: string
  resultsS3Key?: string
  metrics?: BenchmarkRunMetrics
  error?: string
  errorCode?: WorkerErrorCode
}

export type BenchmarkSuite = {
  suiteId: string
  label: string
  mode: BenchmarkMode
  datasetS3Key: string
  preset: "smoke" | "standard"
  defaultConcurrency: number
}

export type ManagedUserStatus = "active" | "suspended" | "deleted"

export type ManagedUser = {
  userId: string
  email: string
  displayName?: string
  status: ManagedUserStatus
  groups: string[]
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
  operationEvidence?: {
    auditIntentId: string
    sessionRevocation: "confirmed" | "not_required"
    propagationState: "current" | "reconciliation_required"
    effectivePermissions: string[]
  }
}

export type ManagedUserCapability = {
  canAssignRoles: boolean
  canSuspend: boolean
  canUnsuspend: boolean
  canDelete: boolean
  blockers: string[]
}

export type ManagedUserAdminView = ManagedUser & {
  capability: ManagedUserCapability
  effectivePermissions: string[]
  projection: {
    source: "authoritative_identity" | "local_ledger"
    asOf: string
    reconciliationState: "current" | "pending"
  }
}

export type ManagedUserDeletionPreflight = {
  targetUserId: string
  requiresSuccessor: boolean
  ownedResources: {
    folders: number
    resourceGroups: number
    documents: number
    total: number
  }
  eligibleSuccessors: Array<{
    userId: string
    email: string
    displayName?: string
    status: "active"
  }>
}

export type ManagedUserAuditAction = string

export type ManagedUserAuditLogEntry = {
  auditId: string
  action: ManagedUserAuditAction
  result: "pending" | "success" | "denied" | "conflict" | "failed"
  reason: string
  tenantId: string
  targetType: string
  actorUserId: string
  actorEmail?: string
  targetUserId: string
  targetEmail?: string
  policyVersion: string
  source: "security_audit_outbox" | "legacy_admin_ledger"
  beforeStatus?: ManagedUserStatus
  afterStatus?: ManagedUserStatus
  beforeGroups: string[]
  afterGroups: string[]
  createdAt: string
  completedAt?: string
}

export type AdminListPageMetadata = {
  total: number
  nextCursor?: string
  truncated: boolean
  source: string
  asOf: string
  version?: string
}

export type ManagedUserAuditLogPage = AdminListPageMetadata & {
  auditLog: ManagedUserAuditLogEntry[]
}

export type ManagedUserListPage = AdminListPageMetadata & {
  version: string
  users: ManagedUserAdminView[]
}

export type AccessRoleDefinition = {
  role: string
  displayName: string
  description: string
  kind: "systemPreset"
  permissions: string[]
}

export type AccessRoleList = {
  roles: AccessRoleDefinition[]
  catalogVersion: string
  source: string
  asOf: string
}

export type AliasStatus = "draft" | "approved" | "disabled"

export type AliasScope = {
  tenantId?: string
  department?: string
  source?: string
  docType?: string
  benchmarkSuiteId?: string
}

export type AliasDefinition = {
  aliasId: string
  version: string
  term: string
  expansions: string[]
  scope?: AliasScope
  status: AliasStatus
  searchImprovement?: SearchImprovementMetadata
  createdBy: string
  createdAt: string
  updatedAt: string
  reviewedBy?: string
  reviewedAt?: string
  reviewComment?: string
  publishedVersion?: string
}

export type SearchImprovementMetadata = {
  candidateSource: "human_draft" | "ai_suggested" | "support_ticket"
  sourceQuestionId?: string
  sourceMessageId?: string
  sourceRagRunId?: string
  suggestionReason?: string
  reviewState: "pending_review" | "reviewed" | "published"
  reviewReason?: string
  impactSummary?: string
  searchResultDiffSummary?: string
  beforeResultIds?: string[]
  afterResultIds?: string[]
}

export type AliasAuditLogItem = {
  auditId: string
  aliasId?: string
  tenantId: string
  action: "create" | "update" | "review" | "transition" | "disable" | "publish"
  actorUserId: string
  result: "success" | "denied" | "conflict" | "failed"
  reason: string
  beforeStatus?: AliasStatus
  afterStatus?: AliasStatus
  aliasVersion?: string
  createdAt: string
  detail: string
}

export type AliasListPage = AdminListPageMetadata & {
  aliases: AliasDefinition[]
}

export type AliasAuditLogPage = AdminListPageMetadata & {
  auditLog: AliasAuditLogItem[]
}

export type PublishedAliasArtifact = {
  schemaVersion: 1
  version: string
  publishedBy: string
  publishedAt: string
  aliases: AliasDefinition[]
}

export type ReindexMigrationStatus = "staged" | "cutover" | "rolled_back"

export type ReindexMigration = {
  migrationId: string
  sourceDocumentId: string
  stagedDocumentId: string
  activeDocumentId?: string
  status: ReindexMigrationStatus
  createdBy: string
  createdAt: string
  updatedAt: string
  cutoverAt?: string
  rolledBackAt?: string
  previousManifestObjectKey: string
  stagedManifestObjectKey: string
  publicationRunId?: string
  publicationArtifactId?: string
  publicationIdempotencyKey?: string
  activePointerKey?: string
  generation?: number
  fencingToken?: string
  checkpoint?: string
}

export type UsageMeasurementSource = "provider" | "tokenizer_estimate" | "missing"
export type UsageQuantityUnit = "input_token" | "output_token" | "cache_read_token" | "cache_write_token" | "request"

/** Legacy admin-ledger counters retained only for non-destructive migration reads. */
export type UserUsageSummary = {
  userId: string
  email: string
  displayName?: string
  chatMessages?: number
  conversationCount?: number
  questionCount?: number
  documentCount?: number
  benchmarkRunCount?: number
  debugRunCount?: number
  availableMetrics: string[]
  unavailableMetrics: string[]
  lastActivityAt?: string
}

export type UsageQuantity = {
  unit: UsageQuantityUnit
  value?: number
  source: UsageMeasurementSource
}

export type UsageEvent = {
  schemaVersion: 1
  eventId: string
  tenantId: string
  subjectId?: string
  runId?: string
  feature?: string
  provider?: string
  region?: string
  modelId?: string
  quantities: UsageQuantity[]
  status: "succeeded" | "failed"
  errorCode?: string
  idempotencyKey: string
  occurredAt: string
  recordedAt: string
}

export type UsageListQuery = {
  periodStart: string
  periodEnd: string
  subjectId?: string
  runId?: string
  modelId?: string
  feature?: string
  provider?: string
  limit?: number
  cursor?: string
}

export type UsageDataCompleteness = {
  eventCount: number
  actualQuantityCount: number
  estimatedQuantityCount: number
  missingQuantityCount: number
  unknownSubjectCount: number
  unknownRunCount: number
  unknownModelCount: number
  unknownFeatureCount: number
  unpricedQuantityCount: number
  state: "complete" | "partial" | "missing"
}

export type UsageBreakdown = {
  key: string
  label: string
  actualQuantity: number
  estimatedQuantity: number
  missingQuantityCount: number
  eventCount: number
}

export type UsageSummaryPage = {
  query: Omit<UsageListQuery, "cursor">
  events: UsageEvent[]
  nextCursor?: string
  truncated: boolean
  asOf: string
  source: "usage_event_store"
  rolloutMode: "disabled" | "shadow" | "active"
  completeness: UsageDataCompleteness
  breakdowns: {
    bySubject: UsageBreakdown[]
    byFeature: UsageBreakdown[]
    byProvider: UsageBreakdown[]
    byModel: UsageBreakdown[]
  }
}

export type PriceCatalogEntry = {
  catalogVersion: string
  provider: string
  region: string
  modelId: string
  unit: UsageQuantityUnit
  priceUsdPerUnit: string
  effectiveFrom: string
  effectiveTo?: string
  source: string
  approvedBy: string
  publishedAt: string
}

export type CostAuditItem = {
  eventId: string
  subjectId: string
  runId: string
  feature: string
  provider: string
  region: string
  modelId: string
  unit: UsageQuantityUnit
  quantity?: number
  measurementSource: UsageMeasurementSource
  pricingState: "actual" | "estimate" | "unpriced"
  catalogVersion?: string
  priceSource?: string
  unitCostUsd?: number
  costUsd?: number
  occurredAt: string
}

export type CostAuditSummary = {
  query: Omit<UsageListQuery, "cursor">
  currency: "USD"
  pricedCostUsd: number
  items: CostAuditItem[]
  nextCursor?: string
  truncated: boolean
  asOf: string
  source: "usage_event_store+versioned_price_catalog"
  rolloutMode: "disabled" | "shadow" | "active"
  catalogVersions: string[]
  completeness: UsageDataCompleteness
}

export type QuestionStatus = "open" | "in_progress" | "waiting_requester" | "answered" | "resolved"
export type QuestionPriority = "normal" | "high" | "urgent"
export type SupportTicketSource = "manual_escalation" | "answer_unavailable" | "negative_feedback" | "quality_issue"
export type SupportTicketQualityCause =
  | "retrieval_gap"
  | "low_quality_evidence"
  | "stale_document"
  | "extraction_warning"
  | "unsupported_answer"
  | "other"

export type SupportSanitizedDiagnostic = {
  tier: "support_sanitized"
  answerUnavailableReason?: string
  retrievalQuality?: "no_evidence" | "insufficient_evidence" | "conflicting_evidence" | "low_quality_evidence" | "unknown"
  qualityCauses?: SupportTicketQualityCause[]
  visibleCitationIds?: string[]
  visibleDocumentIds?: string[]
  visibleChunkIds?: string[]
  qualityWarnings?: string[]
  suggestedNextActions?: Array<"search_improvement_review" | "document_owner_review" | "document_reparse" | "rag_exclusion_review" | "benchmark_case_review">
}

export type ChatOrchestrationMode =
  | "rag_answer"
  | "support_triage"
  | "knowledge_admin_assist"
  | "search_improvement_assist"
  | "benchmark_assist"
  | "debug_assist"

export type ChatToolCategory =
  | "rag"
  | "ingest"
  | "document"
  | "drawing"
  | "support"
  | "search_improvement"
  | "benchmark"
  | "debug"
  | "admin"
  | "external"
  | "quality"
  | "parse"

export type ChatToolDefinition = {
  toolId: string
  name: string
  displayName: string
  description: string
  category: ChatToolCategory
  inputSchema: JsonValue
  outputSchema: JsonValue
  requiredFeaturePermission: string
  requiredResourcePermission?: "readOnly" | "full"
  approvalRequired: boolean
  auditRequired: boolean
  enabled: boolean
  disabledReason?: string
  implementationStatus: "implemented" | "delegated" | "placeholder"
  orchestrationModes: ChatOrchestrationMode[]
  graphNodeLabels: string[]
  traceLabels: string[]
  maxToolCalls?: number
}

export type ChatToolInvocationStatus = "queued" | "waiting_for_approval" | "running" | "succeeded" | "failed" | "cancelled"

export type ChatToolInvocation = {
  invocationId: string
  orchestrationRunId: string
  toolId: string
  requesterUserId: string
  status: ChatToolInvocationStatus
  input: JsonValue
  inputSummary?: JsonValue
  output?: JsonValue
  outputSummary?: JsonValue
  errorCode?: string
  errorMessage?: string
  approvedBy?: string
  approvedAt?: string
  startedAt?: string
  completedAt?: string
}

export type HumanQuestion = {
  questionId: string
  title: string
  question: string
  requesterName: string
  requesterUserId?: string
  requesterDepartment: string
  assigneeDepartment: string
  category: string
  priority: QuestionPriority
  status: QuestionStatus
  source?: SupportTicketSource
  messageId?: string
  ragRunId?: string
  answerUnavailableEventId?: string
  answerUnavailableReason?: string
  sanitizedDiagnostics?: SupportSanitizedDiagnostic
  assigneeUserId?: string
  assigneeGroupId?: string
  slaDueAt?: string
  qualityCause?: SupportTicketQualityCause
  sourceQuestion?: string
  chatAnswer?: string
  chatRunId?: string
  references?: string
  answerTitle?: string
  answerBody?: string
  responderName?: string
  responderDepartment?: string
  internalMemo?: string
  notifyRequester?: boolean
  createdAt: string
  updatedAt: string
  answeredAt?: string
  resolvedAt?: string
}

export type FavoriteTargetType =
  | "chatSession"
  | "chatMessage"
  | "folder"
  | "document"
  | "agentExecutionPreset"
  | "skill"
  | "agentProfile"
  | "benchmarkRun"

export type FavoriteItem = {
  favoriteId: string
  ownerUserId: string
  targetKey: string
  targetType: FavoriteTargetType
  targetId: string
  label?: string
  note?: string
  createdAt: string
  updatedAt: string
}

export type FavoriteListItem = Omit<FavoriteItem, "ownerUserId" | "targetKey"> & {
  accessible: boolean
}

export type ConversationMessage = {
  role: "user" | "assistant"
  text: string
  createdAt: string
  sourceQuestion?: string
  result?: ChatResponsePayload
  questionTicket?: HumanQuestion
}

export const CONVERSATION_HISTORY_SCHEMA_VERSION = 2

export type ConversationHistorySchemaVersion = 1 | typeof CONVERSATION_HISTORY_SCHEMA_VERSION

export type ConversationDecontextualizedQuery = {
  originalQuestion: string
  standaloneQuestion: string
  retrievalQueries: string[]
  turnDependency?: string
  previousCitationCount?: number
}

export type ConversationCitationMemoryItem = {
  citation: Partial<Citation>
  turnId?: string
  answerExcerpt?: string
  rememberedAt?: string
}

export type ConversationTaskState = {
  status: "none" | "in_progress" | "waiting_for_user" | "completed" | "blocked"
  goal?: string
  pendingActions: string[]
  metadata?: JsonValue
}

export type ConversationHistoryItem = {
  schemaVersion: ConversationHistorySchemaVersion
  id: string
  title: string
  updatedAt: string
  isFavorite?: boolean
  messages: ConversationMessage[]
  decontextualizedQuery?: ConversationDecontextualizedQuery
  rollingSummary?: string
  queryFocusedSummary?: string
  citationMemory?: ConversationCitationMemoryItem[]
  taskState?: ConversationTaskState
  toolInvocations?: ChatToolInvocation[]
}
