export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export type VectorKind = "chunk" | "memory"
export type ChunkKind = "text" | "table" | "list" | "code" | "figure"
export type DocumentLifecycleStatus = "active" | "staging" | "superseded"
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
}

export type ExtractionWarning = {
  code: string
  message: string
  severity: "info" | "warning" | "error"
  page?: number
  sourceBlockId?: string
  confidence?: number
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
  extractionMethod?: string
  lifecycleStatus?: DocumentLifecycleStatus
  tenantId?: string
  department?: string
  source?: string
  docType?: string
  benchmarkSuiteId?: string
  scopeType?: DocumentScopeType
  groupId?: string
  groupIds?: string[]
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
  fileName: string
  mimeType?: string
  metadata?: Record<string, JsonValue>
  qualityProfile?: DocumentQualityProfile
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
>

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
}

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
  startedAt: string
  completedAt: string
}

export const DEBUG_TRACE_SCHEMA_VERSION = 1

export type DebugTrace = {
  schemaVersion: typeof DEBUG_TRACE_SCHEMA_VERSION
  runId: string
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
  targetType?: WorkerTargetType
}

export type WorkerResult = {
  runId: string
  targetType?: WorkerTargetType
  status: string
  resultType: "succeeded" | "failed"
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
  provider: AgentRuntimeProvider
  modelId: string
  status: AsyncAgentRunStatus
  providerAvailability: AgentProviderAvailability
  failureReasonCode?: "not_configured" | "provider_unavailable" | "cancelled" | "execution_error"
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
  userEmail?: string
  userGroups?: string[]
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

export type DocumentIngestRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled"

export type DocumentIngestRun = {
  runId: string
  status: DocumentIngestRunStatus
  createdBy: string
  userEmail?: string
  userGroups?: string[]
  uploadId: string
  objectKey: string
  purpose: "document" | "benchmarkSeed" | "chatAttachment"
  fileName: string
  mimeType?: string
  metadata?: Record<string, JsonValue>
  embeddingModelId?: string
  memoryModelId?: string
  skipMemory?: boolean
  manifest?: DocumentManifestSummary
  documentId?: string
  error?: string
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
  retrievalRecallAt20?: number
  retrievalRecallAtK?: number
  p50LatencyMs?: number
  p95LatencyMs?: number
  averageLatencyMs?: number
  errorRate?: number
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
}

export type ManagedUserAuditAction = "user:create" | "role:assign" | "user:suspend" | "user:unsuspend" | "user:delete"

export type ManagedUserAuditLogEntry = {
  auditId: string
  action: ManagedUserAuditAction
  actorUserId: string
  actorEmail?: string
  targetUserId: string
  targetEmail: string
  beforeStatus?: ManagedUserStatus
  afterStatus?: ManagedUserStatus
  beforeGroups: string[]
  afterGroups: string[]
  createdAt: string
}

export type AccessRoleDefinition = {
  role: string
  permissions: string[]
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
  action: "create" | "update" | "review" | "disable" | "publish"
  actorUserId: string
  createdAt: string
  detail: string
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
}

export type UserUsageSummary = {
  userId: string
  email: string
  displayName?: string
  chatMessages: number
  conversationCount: number
  questionCount: number
  documentCount: number
  benchmarkRunCount: number
  debugRunCount: number
  lastActivityAt?: string
}

export type CostAuditItem = {
  service: string
  category: string
  usage: number
  unit: string
  unitCostUsd: number
  estimatedCostUsd: number
  confidence: "actual_usage" | "estimated_usage" | "manual_estimate"
}

export type UserCostSummary = {
  userId: string
  email: string
  estimatedCostUsd: number
}

export type CostAuditSummary = {
  periodStart: string
  periodEnd: string
  currency: "USD"
  totalEstimatedUsd: number
  items: CostAuditItem[]
  users: UserCostSummary[]
  pricingCatalogUpdatedAt: string
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
