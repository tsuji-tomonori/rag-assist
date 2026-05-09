import { z } from "@hono/zod-openapi"
import { ragRuntimePolicy } from "./agent/runtime-policy.js"
import type { JsonValue } from "./types.js"

const MetadataValueSchema = z.custom<JsonValue>(isJsonValue)
const DebugStepOutputSchema = z.record(z.string(), z.unknown())

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true
  if (["string", "number", "boolean"].includes(typeof value)) return true
  if (Array.isArray(value)) return value.every(isJsonValue)
  if (typeof value !== "object") return false
  return Object.values(value as Record<string, unknown>).every(isJsonValue)
}

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  timestamp: z.string()
})

export const DocumentUploadRequestSchema = z.object({
  fileName: z.string().min(1).openapi({ example: "handbook.md" }),
  text: z.string().optional().openapi({ example: "経費精算は申請から30日以内に行う必要があります。" }),
  contentBase64: z.string().optional(),
  textractJson: z.string().optional(),
  mimeType: z.string().optional().openapi({ example: "text/markdown" }),
  metadata: z.record(MetadataValueSchema).optional(),
  scope: z.object({
    scopeType: z.enum(["personal", "group", "chat", "benchmark"]).optional(),
    groupIds: z.array(z.string().min(1)).max(20).optional(),
    temporaryScopeId: z.string().min(1).optional(),
    expiresAt: z.string().optional()
  }).optional(),
  embeddingModelId: z.string().optional().openapi({ example: "amazon.titan-embed-text-v2:0" }),
  memoryModelId: z.string().optional().openapi({ example: "amazon.nova-lite-v1:0" }),
  skipMemory: z.boolean().optional()
})

export const CreateDocumentUploadRequestSchema = z.object({
  fileName: z.string().min(1).openapi({ example: "handbook.pdf" }),
  mimeType: z.string().optional().openapi({ example: "application/pdf" }),
  purpose: z.enum(["document", "benchmarkSeed", "chatAttachment"]).optional().default("document")
})

export const CreateDocumentUploadResponseSchema = z.object({
  uploadId: z.string(),
  objectKey: z.string(),
  uploadUrl: z.string().url(),
  method: z.enum(["PUT", "POST"]),
  headers: z.record(z.string(), z.string()),
  expiresInSeconds: z.number().int().positive(),
  requiresAuth: z.boolean(),
  maxUploadBytes: z.number().int().positive()
})

export const IngestUploadedDocumentRequestSchema = z.object({
  fileName: z.string().min(1).openapi({ example: "handbook.pdf" }),
  mimeType: z.string().optional().openapi({ example: "application/pdf" }),
  metadata: z.record(MetadataValueSchema).optional(),
  scope: z.object({
    scopeType: z.enum(["personal", "group", "chat", "benchmark"]).optional(),
    groupIds: z.array(z.string().min(1)).max(20).optional(),
    temporaryScopeId: z.string().min(1).optional(),
    expiresAt: z.string().optional()
  }).optional(),
  embeddingModelId: z.string().optional().openapi({ example: "amazon.titan-embed-text-v2:0" }),
  memoryModelId: z.string().optional().openapi({ example: "amazon.nova-lite-v1:0" }),
  skipMemory: z.boolean().optional()
})

export const PipelineVersionsSchema = z.object({
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

const ChunkMetadataSchema = z.object({
  id: z.string(),
  startChar: z.number().int().nonnegative(),
  endChar: z.number().int().nonnegative(),
  sectionPath: z.array(z.string()).optional(),
  heading: z.string().optional(),
  parentSectionId: z.string().optional(),
  previousChunkId: z.string().optional(),
  nextChunkId: z.string().optional(),
  chunkHash: z.string().optional(),
  pageStart: z.number().int().positive().optional(),
  pageEnd: z.number().int().positive().optional(),
  chunkKind: z.enum(["text", "table", "list", "code", "figure"]).optional(),
  sourceBlockId: z.string().optional(),
  normalizedFrom: z.string().optional(),
  tableColumnCount: z.number().int().positive().optional(),
  listDepth: z.number().int().positive().optional(),
  codeLanguage: z.string().optional(),
  figureCaption: z.string().optional(),
  extractionMethod: z.string().optional()
})

export const DocumentManifestSchema = z.object({
  documentId: z.string(),
  fileName: z.string(),
  mimeType: z.string().optional(),
  metadata: z.record(MetadataValueSchema).optional(),
  sourceObjectKey: z.string(),
  structuredBlocksObjectKey: z.string().optional(),
  memoryCardsObjectKey: z.string().optional(),
  manifestObjectKey: z.string(),
  vectorKeys: z.array(z.string()),
  memoryVectorKeys: z.array(z.string()).optional(),
  evidenceVectorKeys: z.array(z.string()).optional(),
  embeddingModelId: z.string().optional(),
  embeddingDimensions: z.number().int().positive().optional(),
  chunkerVersion: z.string().optional(),
  sourceExtractorVersion: z.string().optional(),
  memoryPromptVersion: z.string().optional(),
  indexVersion: z.string().optional(),
  pipelineVersions: PipelineVersionsSchema.optional(),
  chunks: z.array(ChunkMetadataSchema).optional(),
  lifecycleStatus: z.enum(["active", "staging", "superseded"]).optional(),
  activeDocumentId: z.string().optional(),
  stagedFromDocumentId: z.string().optional(),
  reindexMigrationId: z.string().optional(),
  chunkCount: z.number(),
  memoryCardCount: z.number(),
  createdAt: z.string()
})

export const DocumentGroupSchema = z.object({
  groupId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  ownerUserId: z.string(),
  visibility: z.enum(["private", "shared", "org"]),
  sharedUserIds: z.array(z.string()),
  sharedGroups: z.array(z.string()),
  managerUserIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const DocumentGroupListResponseSchema = z.object({
  groups: z.array(DocumentGroupSchema)
})

export const CreateDocumentGroupRequestSchema = z.object({
  name: z.string().min(1).max(120).openapi({ example: "社内規定" }),
  description: z.string().max(1000).optional(),
  visibility: z.enum(["private", "shared", "org"]).optional().default("private"),
  sharedUserIds: z.array(z.string().min(1)).max(50).optional(),
  sharedGroups: z.array(z.string().min(1)).max(50).optional(),
  managerUserIds: z.array(z.string().min(1)).max(50).optional()
})

export const ShareDocumentGroupRequestSchema = z.object({
  visibility: z.enum(["private", "shared", "org"]).optional(),
  sharedUserIds: z.array(z.string().min(1)).max(50).optional(),
  sharedGroups: z.array(z.string().min(1)).max(50).optional(),
  managerUserIds: z.array(z.string().min(1)).max(50).optional()
})

export const DocumentManifestSummarySchema = DocumentManifestSchema.pick({
  documentId: true,
  fileName: true,
  mimeType: true,
  chunkCount: true,
  memoryCardCount: true,
  createdAt: true,
  lifecycleStatus: true,
  activeDocumentId: true,
  stagedFromDocumentId: true,
  reindexMigrationId: true,
  chunkerVersion: true,
  sourceExtractorVersion: true
})

export const DocumentListItemSummarySchema = DocumentManifestSummarySchema.extend({
  metadata: z.record(MetadataValueSchema).optional(),
  embeddingModelId: z.string().optional(),
  embeddingDimensions: z.number().int().positive().optional()
})

export const DocumentListResponseSchema = z.object({
  documents: z.array(DocumentListItemSummarySchema)
})

export const StartDocumentIngestRunRequestSchema = IngestUploadedDocumentRequestSchema.extend({
  uploadId: z.string().min(1)
})

export const DocumentIngestRunSchema = z.object({
  runId: z.string(),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
  createdBy: z.string(),
  userEmail: z.string().optional(),
  userGroups: z.array(z.string()).optional(),
  uploadId: z.string(),
  objectKey: z.string(),
  purpose: z.enum(["document", "benchmarkSeed", "chatAttachment"]),
  fileName: z.string(),
  mimeType: z.string().optional(),
  metadata: z.record(MetadataValueSchema).optional(),
  embeddingModelId: z.string().optional(),
  memoryModelId: z.string().optional(),
  skipMemory: z.boolean().optional(),
  manifest: DocumentManifestSummarySchema.optional(),
  documentId: z.string().optional(),
  error: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional()
})

export const DocumentIngestRunStartResponseSchema = z.object({
  runId: z.string(),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
  eventsPath: z.string()
})

export const DeleteDocumentResponseSchema = z.object({
  documentId: z.string(),
  deletedVectorCount: z.number()
})

export const ReindexMigrationSchema = z.object({
  migrationId: z.string(),
  sourceDocumentId: z.string(),
  stagedDocumentId: z.string(),
  activeDocumentId: z.string().optional(),
  status: z.enum(["staged", "cutover", "rolled_back"]),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  cutoverAt: z.string().optional(),
  rolledBackAt: z.string().optional(),
  previousManifestObjectKey: z.string(),
  stagedManifestObjectKey: z.string()
})

export const ReindexMigrationListResponseSchema = z.object({
  migrations: z.array(ReindexMigrationSchema)
})

export const CurrentUserResponseSchema = z.object({
  user: z.object({
    userId: z.string(),
    email: z.string().optional(),
    groups: z.array(z.string()),
    permissions: z.array(z.string())
  })
})

export const ManagedUserStatusSchema = z.enum(["active", "suspended", "deleted"])

export const ManagedUserSchema = z.object({
  userId: z.string(),
  email: z.string(),
  displayName: z.string().optional(),
  status: ManagedUserStatusSchema,
  groups: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastLoginAt: z.string().optional()
})

export const ManagedUserListResponseSchema = z.object({
  users: z.array(ManagedUserSchema)
})

export const CreateManagedUserRequestSchema = z.object({
  email: z.string().email().openapi({ example: "new-user@example.com" }),
  displayName: z.string().min(1).max(120).optional().openapi({ example: "新規 利用者" }),
  groups: z.array(z.string().min(1)).min(1).max(12).optional().openapi({ example: ["CHAT_USER"] })
})

export const ManagedUserAuditActionSchema = z.enum(["user:create", "role:assign", "user:suspend", "user:unsuspend", "user:delete"])

export const ManagedUserAuditLogEntrySchema = z.object({
  auditId: z.string(),
  action: ManagedUserAuditActionSchema,
  actorUserId: z.string(),
  actorEmail: z.string().optional(),
  targetUserId: z.string(),
  targetEmail: z.string(),
  beforeStatus: ManagedUserStatusSchema.optional(),
  afterStatus: ManagedUserStatusSchema.optional(),
  beforeGroups: z.array(z.string()),
  afterGroups: z.array(z.string()),
  createdAt: z.string()
})

export const AdminAuditLogResponseSchema = z.object({
  auditLog: z.array(ManagedUserAuditLogEntrySchema)
})

export const AccessRoleDefinitionSchema = z.object({
  role: z.string(),
  permissions: z.array(z.string())
})

export const AccessRoleListResponseSchema = z.object({
  roles: z.array(AccessRoleDefinitionSchema)
})

export const AssignUserRolesRequestSchema = z.object({
  groups: z.array(z.string().min(1)).min(1).max(12)
})

export const AliasStatusSchema = z.enum(["draft", "approved", "disabled"])

export const AliasScopeSchema = z.object({
  tenantId: z.string().optional(),
  department: z.string().optional(),
  source: z.string().optional(),
  docType: z.string().optional(),
  benchmarkSuiteId: z.string().optional()
})

export const AliasDefinitionSchema = z.object({
  aliasId: z.string(),
  term: z.string(),
  expansions: z.array(z.string()),
  scope: AliasScopeSchema.optional(),
  status: AliasStatusSchema,
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
  reviewComment: z.string().optional(),
  publishedVersion: z.string().optional()
})

export const CreateAliasRequestSchema = z.object({
  term: z.string().min(1).max(120).openapi({ example: "pto" }),
  expansions: z.array(z.string().min(1).max(120)).min(1).max(20).openapi({ example: ["有給休暇", "休暇申請"] }),
  scope: AliasScopeSchema.optional()
})

export const UpdateAliasRequestSchema = CreateAliasRequestSchema.partial().refine(
  (value) => value.term !== undefined || value.expansions !== undefined || value.scope !== undefined,
  "At least one alias field must be provided"
)

export const ReviewAliasRequestSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  comment: z.string().max(1000).optional()
})

export const AliasListResponseSchema = z.object({
  aliases: z.array(AliasDefinitionSchema)
})

export const AliasAuditLogItemSchema = z.object({
  auditId: z.string(),
  aliasId: z.string().optional(),
  action: z.enum(["create", "update", "review", "disable", "publish"]),
  actorUserId: z.string(),
  createdAt: z.string(),
  detail: z.string()
})

export const AliasAuditLogResponseSchema = z.object({
  auditLog: z.array(AliasAuditLogItemSchema)
})

export const PublishAliasesResponseSchema = z.object({
  version: z.string(),
  publishedAt: z.string(),
  aliasCount: z.number().int().nonnegative()
})

export const UserUsageSummarySchema = z.object({
  userId: z.string(),
  email: z.string(),
  displayName: z.string().optional(),
  chatMessages: z.number().int().nonnegative(),
  conversationCount: z.number().int().nonnegative(),
  questionCount: z.number().int().nonnegative(),
  documentCount: z.number().int().nonnegative(),
  benchmarkRunCount: z.number().int().nonnegative(),
  debugRunCount: z.number().int().nonnegative(),
  lastActivityAt: z.string().optional()
})

export const UsageSummaryListResponseSchema = z.object({
  users: z.array(UserUsageSummarySchema)
})

export const CostAuditItemSchema = z.object({
  service: z.string(),
  category: z.string(),
  usage: z.number().nonnegative(),
  unit: z.string(),
  unitCostUsd: z.number().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  confidence: z.enum(["actual_usage", "estimated_usage", "manual_estimate"])
})

export const UserCostSummarySchema = z.object({
  userId: z.string(),
  email: z.string(),
  estimatedCostUsd: z.number().nonnegative()
})

export const CostAuditSummarySchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  currency: z.literal("USD"),
  totalEstimatedUsd: z.number().nonnegative(),
  items: z.array(CostAuditItemSchema),
  users: z.array(UserCostSummarySchema),
  pricingCatalogUpdatedAt: z.string()
})

const ClarificationContextSchema = z.object({
  originalQuestion: z.string().optional(),
  selectedOptionId: z.string().optional(),
  selectedValue: z.string().optional()
})

const ConversationHistoryTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().min(1).max(4000),
  turnId: z.string().optional()
})

export const SearchScopeSchema = z.object({
  mode: z.enum(["all", "groups", "documents", "temporary"]).optional(),
  groupIds: z.array(z.string().min(1)).max(20).optional(),
  documentIds: z.array(z.string().min(1)).max(100).optional(),
  includeTemporary: z.boolean().optional(),
  temporaryScopeId: z.string().min(1).optional()
})

export const ChatRequestSchema = z.object({
  question: z.string().min(1).openapi({ example: "経費精算の期限は？" }),
  conversationHistory: z.array(ConversationHistoryTurnSchema).max(20).optional().openapi({
    example: [
      { role: "user", text: "経費精算の期限は？", turnId: "turn-1" },
      { role: "assistant", text: "申請から30日以内です。", turnId: "turn-1:assistant" }
    ]
  }),
  clarificationContext: ClarificationContextSchema.optional(),
  modelId: z.string().optional().openapi({ example: "amazon.nova-lite-v1:0" }),
  embeddingModelId: z.string().optional().openapi({ example: "amazon.titan-embed-text-v2:0" }),
  clueModelId: z.string().optional().openapi({ example: "amazon.nova-lite-v1:0" }),
  topK: z.number().int().min(1).max(ragRuntimePolicy.retrieval.maxTopK).optional().openapi({ example: 6 }),
  memoryTopK: z.number().int().min(1).max(ragRuntimePolicy.retrieval.maxMemoryTopK).optional().openapi({ example: 4 }),
  minScore: z.number().min(-1).max(1).optional().openapi({ example: 0.20 }),
  maxIterations: z.number().int().min(1).max(ragRuntimePolicy.retrieval.maxIterations).optional().openapi({ example: 3 }),
  strictGrounded: z.boolean().optional().openapi({ example: true }),
  includeDebug: z.boolean().optional().openapi({ example: false }),
  debug: z.boolean().optional().openapi({ example: false }),
  useMemory: z.boolean().optional().openapi({ example: true }),
  searchScope: SearchScopeSchema.optional()
})

export const SearchRequestSchema = z.object({
  query: z.string().min(1).openapi({ example: "経費精算 承認条件" }),
  topK: z.number().int().min(1).max(ragRuntimePolicy.retrieval.searchRagMaxTopK).optional().openapi({ example: 10 }),
  lexicalTopK: z.number().int().min(0).max(ragRuntimePolicy.retrieval.searchRagMaxSourceTopK).optional().openapi({ example: 80 }),
  semanticTopK: z.number().int().min(0).max(ragRuntimePolicy.retrieval.searchRagMaxSourceTopK).optional().openapi({ example: 80 }),
  embeddingModelId: z.string().optional().openapi({ example: "amazon.titan-embed-text-v2:0" }),
  filters: z.object({
    tenantId: z.string().optional(),
    department: z.string().optional(),
    source: z.string().optional(),
    docType: z.string().optional(),
    benchmarkSuiteId: z.string().optional(),
    documentId: z.string().optional()
  }).optional(),
  scope: SearchScopeSchema.optional()
})

const BenchmarkSearchForbiddenUserGroups = new Set([
  "SYSTEM_ADMIN",
  "RAG_GROUP_MANAGER",
  "BENCHMARK_OPERATOR",
  "BENCHMARK_RUNNER",
  "ANSWER_EDITOR",
  "USER_ADMIN",
  "ACCESS_ADMIN",
  "COST_AUDITOR"
])

export const BenchmarkSearchRequestSchema = SearchRequestSchema.extend({
  benchmarkSuiteId: z.string().optional(),
  user: z.object({
    userId: z.string().min(1).max(160).optional().openapi({ example: "benchmark-user-1" }),
    groups: z.array(z.string().min(1).max(160)).max(20).optional().openapi({ example: ["GROUP_A"] })
  }).optional()
}).superRefine((value, ctx) => {
  for (const group of value.user?.groups ?? []) {
    if (BenchmarkSearchForbiddenUserGroups.has(group)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["user", "groups"],
        message: `Benchmark search user cannot include privileged group ${group}`
      })
    }
  }
})

export const CitationSchema = z.object({
  documentId: z.string(),
  fileName: z.string(),
  chunkId: z.string().optional(),
  score: z.number(),
  text: z.string()
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
  options: z.array(ClarificationOptionSchema).max(ragRuntimePolicy.limits.clarificationOptionLimit),
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
  output: DebugStepOutputSchema.optional(),
  hitCount: z.number().optional(),
  tokenCount: z.number().optional(),
  startedAt: z.string(),
  completedAt: z.string()
})

export const DebugTraceSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  runId: z.string(),
  question: z.string(),
  modelId: z.string(),
  embeddingModelId: z.string(),
  clueModelId: z.string(),
  conversationHistory: z.array(ConversationHistoryTurnSchema).optional(),
  clarificationContext: ClarificationContextSchema.optional(),
  pipelineVersions: PipelineVersionsSchema.optional(),
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

export const ChatRunSchema = z.object({
  runId: z.string(),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
  createdBy: z.string(),
  userEmail: z.string().optional(),
  userGroups: z.array(z.string()).optional(),
  question: z.string(),
  conversationHistory: z.array(ConversationHistoryTurnSchema).optional(),
  clarificationContext: ClarificationContextSchema.optional(),
  modelId: z.string(),
  embeddingModelId: z.string().optional(),
  clueModelId: z.string().optional(),
  topK: z.number().int().positive().optional(),
  memoryTopK: z.number().int().positive().optional(),
  minScore: z.number().optional(),
  strictGrounded: z.boolean().optional(),
  useMemory: z.boolean().optional(),
  maxIterations: z.number().int().positive().optional(),
  includeDebug: z.boolean().optional(),
  responseType: z.enum(["answer", "refusal", "clarification"]).optional(),
  answer: z.string().optional(),
  isAnswerable: z.boolean().optional(),
  needsClarification: z.boolean().optional(),
  clarification: ClarificationSchema.optional(),
  citations: z.array(CitationSchema).optional(),
  retrieved: z.array(CitationSchema).optional(),
  debugRunId: z.string().optional(),
  error: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional()
})

export const ChatRunStartResponseSchema = z.object({
  runId: z.string(),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
  eventsPath: z.string()
})

export const SearchResultSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  fileName: z.string(),
  chunkId: z.string().optional(),
  text: z.string(),
  score: z.number(),
  rrfScore: z.number(),
  lexicalScore: z.number().optional(),
  semanticScore: z.number().optional(),
  lexicalRank: z.number().optional(),
  semanticRank: z.number().optional(),
  matchedTerms: z.array(z.string()),
  sources: z.array(z.enum(["lexical", "semantic"])),
  createdAt: z.string().optional(),
  metadata: z.record(MetadataValueSchema).optional()
})

export const SearchResponseSchema = z.object({
  query: z.string(),
  results: z.array(SearchResultSchema),
  diagnostics: z.object({
    indexVersion: z.string(),
    aliasVersion: z.string(),
    lexicalCount: z.number().int(),
    semanticCount: z.number().int(),
    fusedCount: z.number().int(),
    latencyMs: z.number().int(),
    index: z.object({
      visibleManifestCount: z.number().int().nonnegative(),
      indexedChunkCount: z.number().int().nonnegative(),
      cache: z.enum(["memory", "artifact", "built"]),
      loadMs: z.number().int().nonnegative()
    }).optional()
  })
})

export const QuestionPrioritySchema = z.enum(["normal", "high", "urgent"])
export const QuestionStatusSchema = z.enum(["open", "answered", "resolved"])

export const QuestionSchema = z.object({
  questionId: z.string(),
  title: z.string(),
  question: z.string(),
  requesterName: z.string(),
  requesterUserId: z.string().optional(),
  requesterDepartment: z.string(),
  assigneeDepartment: z.string(),
  category: z.string(),
  priority: QuestionPrioritySchema,
  status: QuestionStatusSchema,
  sourceQuestion: z.string().optional(),
  chatAnswer: z.string().optional(),
  chatRunId: z.string().optional(),
  references: z.string().optional(),
  answerTitle: z.string().optional(),
  answerBody: z.string().optional(),
  responderName: z.string().optional(),
  responderDepartment: z.string().optional(),
  internalMemo: z.string().optional(),
  notifyRequester: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  answeredAt: z.string().optional(),
  resolvedAt: z.string().optional()
})

export const QuestionListResponseSchema = z.object({
  questions: z.array(QuestionSchema)
})

export const ConversationMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  createdAt: z.string(),
  sourceQuestion: z.string().optional(),
  result: ChatResponseSchema.optional(),
  questionTicket: QuestionSchema.optional()
})

export const ConversationHistoryItemSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  updatedAt: z.string(),
  isFavorite: z.boolean().default(false),
  messages: z.array(ConversationMessageSchema).max(100)
})

export const ConversationHistoryListResponseSchema = z.object({
  history: z.array(ConversationHistoryItemSchema)
})

export const CreateQuestionRequestSchema = z.object({
  title: z.string().min(1).max(120).openapi({ example: "山田さんの昼食について確認したい" }),
  question: z.string().min(1).max(2000).openapi({ example: "今日山田さんは何を食べたか、担当者に確認してください。" }),
  requesterName: z.string().optional().openapi({ example: "山田 太郎" }),
  requesterDepartment: z.string().optional().openapi({ example: "総務部" }),
  assigneeDepartment: z.string().optional().openapi({ example: "総務部" }),
  category: z.string().optional().openapi({ example: "その他の質問" }),
  priority: QuestionPrioritySchema.optional(),
  sourceQuestion: z.string().optional(),
  chatAnswer: z.string().optional(),
  chatRunId: z.string().optional()
})

export const AnswerQuestionRequestSchema = z.object({
  answerTitle: z.string().min(1).max(120).openapi({ example: "山田さんの昼食についての回答" }),
  answerBody: z.string().min(1).max(4000).openapi({ example: "山田さんは本日、社内食堂でカレーを食べました。" }),
  responderName: z.string().optional().openapi({ example: "佐藤 花子" }),
  responderDepartment: z.string().optional().openapi({ example: "総務部" }),
  references: z.string().optional(),
  internalMemo: z.string().optional(),
  notifyRequester: z.boolean().optional()
})

export const DebugTraceListResponseSchema = z.object({
  debugRuns: z.array(DebugTraceSchema)
})

export const BenchmarkQueryRequestSchema = ChatRequestSchema.extend({
  id: z.string().optional(),
  benchmarkSuiteId: z.string().optional()
})

export const BenchmarkQueryResponseSchema = ChatResponseSchema.extend({
  id: z.string().optional()
})

export const BenchmarkModeSchema = z.enum(["agent", "search", "load"])
export const BenchmarkRunnerSchema = z.enum(["codebuild", "lambda"])
export const BenchmarkRunStatusSchema = z.enum(["queued", "running", "succeeded", "failed", "cancelled"])

export const BenchmarkRunThresholdsSchema = z.object({
  answerableAccuracy: z.number().min(0).max(1).optional().openapi({ example: 0.8 }),
  retrievalRecallAt20: z.number().min(0).max(1).optional().openapi({ example: 0.8 }),
  p95LatencyMs: z.number().int().positive().optional().openapi({ example: 15000 })
})

export const BenchmarkRunMetricsSchema = z.object({
  total: z.number().int().nonnegative(),
  succeeded: z.number().int().nonnegative(),
  failedHttp: z.number().int().nonnegative(),
  answerableAccuracy: z.number().nullable().optional(),
  turnAnswerCorrectRate: z.number().nullable().optional(),
  conversationSuccessRate: z.number().nullable().optional(),
  historyDependentAccuracy: z.number().nullable().optional(),
  clarificationNeedPrecision: z.number().nullable().optional(),
  clarificationNeedRecall: z.number().nullable().optional(),
  clarificationNeedF1: z.number().nullable().optional(),
  optionHitRate: z.number().nullable().optional(),
  missingSlotHitRate: z.number().nullable().optional(),
  corpusGroundedOptionRate: z.number().nullable().optional(),
  postClarificationAccuracy: z.number().nullable().optional(),
  overClarificationRate: z.number().nullable().optional(),
  clarificationLatencyOverheadMs: z.number().nullable().optional(),
  postClarificationTaskLatencyMs: z.number().nullable().optional(),
  abstentionRecall: z.number().nullable().optional(),
  abstentionAccuracy: z.number().nullable().optional(),
  citationHitRate: z.number().nullable().optional(),
  expectedFileHitRate: z.number().nullable().optional(),
  retrievalRecallAt20: z.number().nullable().optional(),
  retrievalRecallAtK: z.number().nullable().optional(),
  p50LatencyMs: z.number().nullable().optional(),
  p95LatencyMs: z.number().nullable().optional(),
  averageLatencyMs: z.number().nullable().optional(),
  errorRate: z.number().nullable().optional()
})

export const BenchmarkRunSchema = z.object({
  runId: z.string(),
  status: BenchmarkRunStatusSchema,
  mode: BenchmarkModeSchema,
  runner: BenchmarkRunnerSchema,
  suiteId: z.string(),
  datasetS3Key: z.string(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  executionArn: z.string().optional(),
  codeBuildBuildId: z.string().optional(),
  codeBuildLogUrl: z.string().url().optional(),
  codeBuildLogGroupName: z.string().optional(),
  codeBuildLogStreamName: z.string().optional(),
  modelId: z.string().optional(),
  embeddingModelId: z.string().optional(),
  topK: z.number().int().optional(),
  memoryTopK: z.number().int().optional(),
  minScore: z.number().optional(),
  concurrency: z.number().int().optional(),
  thresholds: BenchmarkRunThresholdsSchema.optional(),
  summaryS3Key: z.string().optional(),
  reportS3Key: z.string().optional(),
  resultsS3Key: z.string().optional(),
  metrics: BenchmarkRunMetricsSchema.optional(),
  error: z.string().optional()
})

export const CreateBenchmarkRunRequestSchema = z.object({
  suiteId: z.string().optional().openapi({ example: "standard-agent-v1" }),
  mode: BenchmarkModeSchema.optional().openapi({ example: "agent" }),
  runner: BenchmarkRunnerSchema.optional().openapi({ example: "codebuild" }),
  modelId: z.string().optional().openapi({ example: "amazon.nova-lite-v1:0" }),
  embeddingModelId: z.string().optional().openapi({ example: "amazon.titan-embed-text-v2:0" }),
  topK: z
    .number()
    .int()
    .min(1)
    .max(Math.max(ragRuntimePolicy.retrieval.maxTopK, ragRuntimePolicy.retrieval.searchRagMaxTopK))
    .optional()
    .openapi({ example: 6 }),
  memoryTopK: z.number().int().min(1).max(ragRuntimePolicy.retrieval.maxMemoryTopK).optional().openapi({ example: 4 }),
  minScore: z.number().min(-1).max(1).optional().openapi({ example: 0.2 }),
  concurrency: z.number().int().min(1).max(20).optional().openapi({ example: 1 }),
  thresholds: BenchmarkRunThresholdsSchema.optional()
})

export const BenchmarkRunListResponseSchema = z.object({
  benchmarkRuns: z.array(BenchmarkRunSchema)
})

export const BenchmarkSuiteSchema = z.object({
  suiteId: z.string(),
  label: z.string(),
  mode: BenchmarkModeSchema,
  datasetS3Key: z.string(),
  preset: z.enum(["smoke", "standard"]),
  defaultConcurrency: z.number().int().positive()
})

export const BenchmarkSuiteListResponseSchema = z.object({
  suites: z.array(BenchmarkSuiteSchema)
})

export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.record(z.array(z.string())).optional()
})


export const DebugDownloadResponseSchema = z.object({
  url: z.string().url(),
  expiresInSeconds: z.number().int().positive(),
  objectKey: z.string()
})
