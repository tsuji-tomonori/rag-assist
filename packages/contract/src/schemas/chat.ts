import { z } from "zod"
import { JsonValueSchema } from "../json.js"
import { RAG_CONTRACT_LIMITS } from "../limits.js"

export const ConversationCitationSchema = z.object({
  documentId: z.string().optional(),
  fileName: z.string().optional(),
  chunkId: z.string().optional(),
  pageStart: z.number().int().positive().optional(),
  pageEnd: z.number().int().positive().optional(),
  pageOrSheet: z.string().optional(),
  drawingNo: z.string().optional(),
  sheetTitle: z.string().optional(),
  scale: z.string().optional(),
  regionId: z.string().optional(),
  regionType: z.string().optional(),
  sourceType: z.string().optional(),
  bbox: JsonValueSchema.optional(),
  score: z.number().optional(),
  text: z.string().optional()
})

export const ConversationTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().min(1).max(4000),
  turnId: z.string().optional(),
  citations: z.array(ConversationCitationSchema).optional(),
  createdAt: z.string().optional()
})

export const ConversationHistoryTurnSchema = ConversationTurnSchema.pick({
  role: true,
  text: true,
  turnId: true
})

export const ChatOrchestrationModeSchema = z.enum([
  "rag_answer",
  "support_triage",
  "knowledge_admin_assist",
  "search_improvement_assist",
  "benchmark_assist",
  "debug_assist"
])

export const ChatToolCategorySchema = z.enum([
  "rag",
  "ingest",
  "document",
  "drawing",
  "support",
  "search_improvement",
  "benchmark",
  "debug",
  "admin",
  "external",
  "quality",
  "parse"
])

export const ChatToolResourcePermissionSchema = z.enum(["readOnly", "full"])
export const ChatToolImplementationStatusSchema = z.enum(["implemented", "delegated", "placeholder"])

export const ChatToolDefinitionSchema = z.object({
  toolId: z.string().min(1),
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().min(1),
  category: ChatToolCategorySchema,
  inputSchema: JsonValueSchema,
  outputSchema: JsonValueSchema,
  requiredFeaturePermission: z.string().min(1),
  requiredResourcePermission: ChatToolResourcePermissionSchema.optional(),
  approvalRequired: z.boolean(),
  auditRequired: z.boolean(),
  enabled: z.boolean(),
  disabledReason: z.string().optional(),
  implementationStatus: ChatToolImplementationStatusSchema,
  orchestrationModes: z.array(ChatOrchestrationModeSchema).default(() => []),
  graphNodeLabels: z.array(z.string()).default(() => []),
  traceLabels: z.array(z.string()).default(() => []),
  maxToolCalls: z.number().int().positive().optional()
})

export const ChatToolInvocationStatusSchema = z.enum([
  "queued",
  "waiting_for_approval",
  "running",
  "succeeded",
  "failed",
  "cancelled"
])

export const ChatToolInvocationSchema = z.object({
  invocationId: z.string().min(1),
  orchestrationRunId: z.string().min(1),
  toolId: z.string().min(1),
  requesterUserId: z.string().min(1),
  status: ChatToolInvocationStatusSchema,
  input: JsonValueSchema,
  inputSummary: JsonValueSchema.optional(),
  output: JsonValueSchema.optional(),
  outputSummary: JsonValueSchema.optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional()
})

export const ChatToolDefinitionListResponseSchema = z.object({
  registryVersion: z.string(),
  tools: z.array(ChatToolDefinitionSchema)
})

export const ChatToolInvocationListResponseSchema = z.object({
  invocations: z.array(ChatToolInvocationSchema)
})

export const ConversationDecontextualizedQuerySchema = z.object({
  originalQuestion: z.string(),
  standaloneQuestion: z.string(),
  retrievalQueries: z.array(z.string()).default(() => []),
  turnDependency: z.string().optional(),
  previousCitationCount: z.number().int().nonnegative().optional()
})

export const ConversationCitationMemoryItemSchema = z.object({
  citation: ConversationCitationSchema,
  turnId: z.string().optional(),
  answerExcerpt: z.string().optional(),
  rememberedAt: z.string().optional()
})

export const ConversationTaskStateSchema = z.object({
  status: z.enum(["none", "in_progress", "waiting_for_user", "completed", "blocked"]).default("none"),
  goal: z.string().optional(),
  pendingActions: z.array(z.string()).default(() => []),
  metadata: JsonValueSchema.optional()
})

export const ConversationInputSchema = z.object({
  conversationId: z.string(),
  turnId: z.string().optional(),
  turnIndex: z.number().int().nonnegative().optional(),
  turns: z.array(ConversationTurnSchema).default(() => []),
  turnDependency: z.string().optional(),
  state: z.object({
    activeEntities: z.array(z.string()).optional(),
    activeDocuments: z.array(z.string()).optional(),
    activeTopics: z.array(z.string()).optional(),
    constraints: z.array(z.string()).optional()
  }).optional()
})

export const ConversationStateSchema = z.object({
  conversationId: z.string().optional(),
  turnId: z.string().optional()
})

export const ClarificationContextSchema = z.object({
  originalQuestion: z.string().optional(),
  selectedOptionId: z.string().optional(),
  selectedValue: z.string().optional()
})

export const SearchScopeSchema = z.object({
  mode: z.enum(["all", "groups", "documents", "temporary"]).optional(),
  groupIds: z.array(z.string().min(1)).max(20).optional(),
  documentIds: z.array(z.string().min(1)).max(100).optional(),
  includeTemporary: z.boolean().optional(),
  temporaryScopeId: z.string().min(1).optional(),
  temporaryScopeIds: z.array(z.string().min(1)).max(20).optional()
})

export const ChatRequestSchema = z.object({
  question: z.string().min(1),
  conversationHistory: z.array(ConversationHistoryTurnSchema).max(20).optional(),
  clarificationContext: ClarificationContextSchema.optional(),
  conversation: ConversationInputSchema.optional(),
  modelId: z.string().optional(),
  embeddingModelId: z.string().optional(),
  clueModelId: z.string().optional(),
  topK: z.number().int().min(1).max(RAG_CONTRACT_LIMITS.maxTopK).optional(),
  memoryTopK: z.number().int().min(1).max(RAG_CONTRACT_LIMITS.maxMemoryTopK).optional(),
  minScore: z.number().min(-1).max(1).optional(),
  maxIterations: z.number().int().min(1).max(RAG_CONTRACT_LIMITS.maxIterations).optional(),
  strictGrounded: z.boolean().optional(),
  includeDebug: z.boolean().optional(),
  debug: z.boolean().optional(),
  useMemory: z.boolean().optional(),
  searchScope: SearchScopeSchema.optional()
})

export const CitationSchema = z.object({
  documentId: z.string(),
  documentVersion: z.string().optional(),
  fileName: z.string(),
  chunkId: z.string().optional(),
  pageStart: z.number().int().positive().optional(),
  pageEnd: z.number().int().positive().optional(),
  pageOrSheet: z.string().optional(),
  drawingNo: z.string().optional(),
  sheetTitle: z.string().optional(),
  scale: z.string().optional(),
  regionId: z.string().optional(),
  regionType: z.string().optional(),
  sourceType: z.string().optional(),
  bbox: JsonValueSchema.optional(),
  score: z.number(),
  text: z.string(),
  topic: z.string().optional(),
  evidenceRole: z.enum(["supporting", "conflicting", "outdated", "background"]).optional(),
  authorityStatus: z.enum(["authoritative", "secondary", "unknown"]).optional(),
  effectiveFrom: z.string().optional(),
  effectiveUntil: z.string().optional(),
  sourceLocator: z.object({
    page: z.number().int().positive().optional(),
    pageStart: z.number().int().positive().optional(),
    pageEnd: z.number().int().positive().optional(),
    bbox: JsonValueSchema.optional(),
    unit: z.enum(["normalized_page", "pdf_point", "pixel", "unknown"]).optional(),
    source: z.string().optional(),
    sectionPath: z.array(z.string()).optional(),
    startChar: z.number().int().nonnegative().optional(),
    endChar: z.number().int().nonnegative().optional(),
    sourceBlockId: z.string().optional(),
    sourceChunkIds: z.array(z.string()).optional()
  }).optional(),
  authorizationDecision: z.literal("allowed").optional(),
  authorizationEvaluatedAt: z.string().optional()
})

export const PipelineVersionsSchema = z.object({
  chatOrchestrationWorkflowVersion: z.string(),
  agentWorkflowVersion: z.string(),
  chunkerVersion: z.string(),
  sourceExtractorVersion: z.string(),
  memoryPromptVersion: z.string(),
  promptVersion: z.string(),
  indexVersion: z.string(),
  embeddingModelId: z.string(),
  embeddingDimensions: z.number().int().positive()
})

export const RagProfileTraceSchema = z.object({
  id: z.string(),
  version: z.string(),
  retrievalProfileId: z.string(),
  retrievalProfileVersion: z.string(),
  answerPolicyId: z.string(),
  answerPolicyVersion: z.string()
})

export const ClarificationOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  resolvedQuery: z.string(),
  reason: z.string().optional(),
  source: z.enum(["memory", "evidence", "aspect", "history"]),
  grounding: z.array(z.object({
    documentId: z.string().optional(),
    fileName: z.string().optional(),
    chunkId: z.string().optional(),
    heading: z.string().optional()
  })).default(() => [])
})

export const ClarificationSchema = z.object({
  needsClarification: z.boolean(),
  reason: z.enum([
    "ambiguous_target",
    "missing_scope",
    "unresolved_reference",
    "multiple_candidate_intents",
    "conflicting_scope",
    "not_needed"
  ]),
  question: z.string(),
  options: z.array(ClarificationOptionSchema).max(RAG_CONTRACT_LIMITS.clarificationOptionLimit),
  missingSlots: z.array(z.string()).default(() => []),
  confidence: z.number().min(0).max(1),
  ambiguityScore: z.number().min(0).max(1).optional(),
  groundedOptionCount: z.number().int().nonnegative().optional()
})

export const DebugStepSchema = z.object({
  id: z.number(),
  label: z.string(),
  status: z.enum(["success", "warning", "error"]),
  latencyMs: z.number(),
  modelId: z.string().optional(),
  summary: z.string(),
  detail: z.string().optional(),
  output: z.record(z.string(), z.unknown()).optional(),
  hitCount: z.number().optional(),
  tokenCount: z.number().optional(),
  degradationDecision: JsonValueSchema.optional(),
  startedAt: z.string(),
  completedAt: z.string()
})

export const DEBUG_TRACE_TARGET_TYPES = ["rag_run", "ingest_run", "chat_orchestration_run", "async_agent_run", "tool_invocation"] as const
export const CHAT_ORCHESTRATION_TRACE_TARGET_TYPE = "chat_orchestration_run" as const
export const RAG_TRACE_TARGET_TYPE = "rag_run" as const
export const LEGACY_DEBUG_TRACE_TARGET_TYPE_DEFAULT = RAG_TRACE_TARGET_TYPE
export const DebugTraceTargetTypeSchema = z.enum(DEBUG_TRACE_TARGET_TYPES)

export const DebugTraceSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  runId: z.string(),
  requestTraceId: z.string().optional(),
  parentTraceIds: z.array(z.string()).optional(),
  tenantPartitionId: z.string().optional(),
  actorPartitionId: z.string().optional(),
  targetType: DebugTraceTargetTypeSchema.optional().default(LEGACY_DEBUG_TRACE_TARGET_TYPE_DEFAULT),
  question: z.string(),
  modelId: z.string(),
  embeddingModelId: z.string(),
  clueModelId: z.string(),
  conversationHistory: z.array(ConversationHistoryTurnSchema).optional(),
  clarificationContext: ClarificationContextSchema.optional(),
  conversation: z.unknown().optional(),
  conversationState: z.unknown().optional(),
  pipelineVersions: PipelineVersionsSchema.optional(),
  replayVersionManifest: JsonValueSchema.optional(),
  decision: z.object({
    candidateCount: z.number().int().nonnegative(),
    deniedCandidateCount: z.number().int().nonnegative(),
    finalEvidenceCount: z.number().int().nonnegative(),
    responseStatus: z.enum(["success", "warning", "error"]),
    decisionCode: z.enum(["completed", "refused", "rejected", "failed", "cancelled"]),
    reasonCodes: z.array(z.enum([
      "authorization_denied",
      "safety_interlock",
      "dependency_error",
      "admission_rejected",
      "publication_not_eligible",
      "permission_revoked",
      "execution_error",
      "insufficient_evidence",
      "clarification_required",
      "output_secret_detected",
      "cancelled"
    ])),
    totalLatencyMs: z.number().nonnegative()
  }).optional(),
  ragProfile: RagProfileTraceSchema.optional(),
  topK: z.number(),
  memoryTopK: z.number(),
  minScore: z.number(),
  startedAt: z.string(),
  completedAt: z.string(),
  totalLatencyMs: z.number(),
  status: z.enum(["success", "warning", "error"]),
  answerPreview: z.string(),
  isAnswerable: z.boolean(),
  citations: z.array(CitationSchema),
  retrieved: z.array(CitationSchema),
  finalEvidence: z.array(CitationSchema).optional(),
  toolInvocations: z.array(ChatToolInvocationSchema).optional(),
  steps: z.array(DebugStepSchema)
})

export const ChatResponseSchema = z.object({
  responseType: z.enum(["answer", "refusal", "clarification"]).optional(),
  answer: z.string(),
  isAnswerable: z.boolean(),
  needsClarification: z.boolean().optional(),
  clarification: ClarificationSchema.optional(),
  citations: z.array(CitationSchema),
  retrieved: z.array(CitationSchema),
  finalEvidence: z.array(CitationSchema).optional(),
  debug: DebugTraceSchema.optional()
})

export const ChatRunStartResponseSchema = z.object({
  runId: z.string(),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
  eventsPath: z.string()
})

export const ConversationMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  createdAt: z.string(),
  sourceQuestion: z.string().optional(),
  result: ChatResponseSchema.optional()
})

export const ConversationHistoryItemSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]).default(2),
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  updatedAt: z.string(),
  isFavorite: z.boolean().default(false),
  messages: z.array(ConversationMessageSchema).max(100),
  decontextualizedQuery: ConversationDecontextualizedQuerySchema.optional(),
  rollingSummary: z.string().max(4000).optional(),
  queryFocusedSummary: z.string().max(4000).optional(),
  citationMemory: z.array(ConversationCitationMemoryItemSchema).max(50).optional(),
  taskState: ConversationTaskStateSchema.optional(),
  toolInvocations: z.array(ChatToolInvocationSchema).max(100).optional()
})

export type ConversationHistoryTurn = z.output<typeof ConversationHistoryTurnSchema>
export type ConversationTurn = z.output<typeof ConversationTurnSchema>
export type ConversationInput = z.input<typeof ConversationInputSchema>
export type ChatOrchestrationMode = z.output<typeof ChatOrchestrationModeSchema>
export type ChatToolDefinition = z.output<typeof ChatToolDefinitionSchema>
export type ChatToolInvocation = z.output<typeof ChatToolInvocationSchema>
export type ChatToolDefinitionListResponse = z.output<typeof ChatToolDefinitionListResponseSchema>
export type ChatToolInvocationListResponse = z.output<typeof ChatToolInvocationListResponseSchema>
export type ConversationDecontextualizedQuery = z.output<typeof ConversationDecontextualizedQuerySchema>
export type ConversationCitationMemoryItem = z.output<typeof ConversationCitationMemoryItemSchema>
export type ConversationTaskState = z.output<typeof ConversationTaskStateSchema>
export type ClarificationContext = z.output<typeof ClarificationContextSchema>
export type SearchScope = z.output<typeof SearchScopeSchema>
export type ChatRequest = z.input<typeof ChatRequestSchema>
export type Citation = z.output<typeof CitationSchema>
export type ClarificationOption = z.output<typeof ClarificationOptionSchema>
export type Clarification = z.output<typeof ClarificationSchema>
export type DebugTraceTargetType = z.output<typeof DebugTraceTargetTypeSchema>
export type DebugTrace = z.output<typeof DebugTraceSchema>
export type ChatResponse = z.output<typeof ChatResponseSchema>
export type ChatRunStartResponse = z.output<typeof ChatRunStartResponseSchema>
export type ConversationMessage = z.output<typeof ConversationMessageSchema>
export type ConversationHistoryItem = z.output<typeof ConversationHistoryItemSchema>
