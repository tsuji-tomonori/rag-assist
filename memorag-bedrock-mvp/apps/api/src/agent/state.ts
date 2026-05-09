import { z } from "zod"
import { ragRuntimePolicy } from "./runtime-policy.js"

export const NO_ANSWER = "資料からは回答できません。"

export const RetrievedChunkSchema = z.object({
  key: z.string(),
  score: z.number(),
  distance: z.number().optional(),
  metadata: z.object({
    kind: z.enum(["chunk", "memory"]),
    documentId: z.string(),
    fileName: z.string(),
    chunkId: z.string().optional(),
    memoryId: z.string().optional(),
    objectKey: z.string().optional(),
    sourceUri: z.string().optional(),
    text: z.string().optional(),
    sectionPath: z.array(z.string()).optional(),
    heading: z.string().optional(),
    parentSectionId: z.string().optional(),
    previousChunkId: z.string().optional(),
    nextChunkId: z.string().optional(),
    chunkHash: z.string().optional(),
    pageStart: z.number().int().min(1).optional(),
    pageEnd: z.number().int().min(1).optional(),
    chunkKind: z.enum(["text", "table", "list", "code", "figure"]).optional(),
    sourceBlockId: z.string().optional(),
    normalizedFrom: z.string().optional(),
    tableColumnCount: z.number().int().min(1).optional(),
    listDepth: z.number().int().min(1).optional(),
    codeLanguage: z.string().optional(),
    figureCaption: z.string().optional(),
    extractionMethod: z.string().optional(),
    lifecycleStatus: z.enum(["active", "staging", "superseded"]).optional(),
    sources: z.array(z.string()).optional(),
    rrfScore: z.number().optional(),
    lexicalRank: z.number().optional(),
    semanticRank: z.number().optional(),
    crossQueryRrfScore: z.number().optional(),
    crossQueryRank: z.number().optional(),
    expansionSource: z.enum(["hybrid", "context_window"]).optional(),
    createdAt: z.string()
  })
})

export const ReferenceTargetSchema = z.object({
  sourceChunkKey: z.string(),
  rawLabel: z.string(),
  normalizedLabel: z.string(),
  depth: z.number().int().min(0)
})

export const ReferenceResolutionSchema = z.object({
  target: ReferenceTargetSchema,
  matchedDocumentId: z.string().optional(),
  matchedFileName: z.string().optional(),
  matchedHeading: z.string().optional(),
  status: z.enum(["resolved", "unresolved", "skipped_depth", "skipped_visited"]),
  reason: z.string().optional()
})

export const CitationSchema = z.object({
  documentId: z.string(),
  fileName: z.string(),
  chunkId: z.string().optional(),
  score: z.number(),
  text: z.string()
})

const AnswerabilitySentenceAssessmentSchema = z.object({
  status: z.enum(["ok", "ng"]),
  sentence: z.string(),
  fileName: z.string().optional(),
  chunkId: z.string().optional(),
  score: z.number().optional(),
  checks: z.array(z.string()).default(() => []),
  reason: z.string()
})

export const AnswerabilitySchema = z.object({
  isAnswerable: z.boolean().default(false),
  reason: z
    .enum([
      "not_checked",
      "sufficient_evidence",
      "no_relevant_chunks",
      "low_similarity_score",
      "missing_required_fact",
      "conflicting_evidence",
      "calculation_unavailable",
      "structured_index_unavailable",
      "invalid_temporal_context",
      "citation_validation_failed",
      "unsupported_answer"
    ])
    .default("not_checked"),
  confidence: z.number().min(0).max(1).default(0),
  sentenceAssessments: z.array(AnswerabilitySentenceAssessmentSchema).optional()
})

export const SufficientContextJudgementSchema = z.object({
  label: z.enum(["ANSWERABLE", "PARTIAL", "UNANSWERABLE"]).default("UNANSWERABLE"),
  confidence: z.number().min(0).max(1).default(0),
  requiredFacts: z.array(z.string()).default(() => []),
  supportedFacts: z.array(z.string()).default(() => []),
  missingFacts: z.array(z.string()).default(() => []),
  conflictingFacts: z.array(z.string()).default(() => []),
  supportingChunkIds: z.array(z.string()).default(() => []),
  reason: z.string().default("")
})

export const AnswerSupportJudgementSchema = z.object({
  supported: z.boolean().default(false),
  unsupportedSentences: z
    .array(
      z.object({
        sentence: z.string(),
        reason: z.string()
      })
    )
    .default(() => []),
  supportingChunkIds: z.array(z.string()).default(() => []),
  supportingComputedFactIds: z.array(z.string()).default(() => []),
  contradictionChunkIds: z.array(z.string()).default(() => []),
  confidence: z.number().min(0).max(1).default(0),
  totalSentences: z.number().int().min(0).default(0),
  reason: z.string().default("")
})

export const ClarificationOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  resolvedQuery: z.string(),
  reason: z.string().optional(),
  source: z.enum(["memory", "evidence", "aspect", "history"]),
  grounding: z
    .array(
      z.object({
        documentId: z.string().optional(),
        fileName: z.string().optional(),
        chunkId: z.string().optional(),
        heading: z.string().optional()
      })
    )
    .default(() => [])
})

export const ClarificationSchema = z.object({
  needsClarification: z.boolean().default(false),
  reason: z
    .enum([
      "ambiguous_target",
      "missing_scope",
      "unresolved_reference",
      "multiple_candidate_intents",
      "conflicting_scope",
      "not_needed"
    ])
    .default("not_needed"),
  question: z.string().default(""),
  options: z.array(ClarificationOptionSchema).max(ragRuntimePolicy.limits.clarificationOptionLimit).default(() => []),
  missingSlots: z.array(z.string()).default(() => []),
  confidence: z.number().min(0).max(1).default(0),
  ambiguityScore: z.number().min(0).max(1).optional(),
  groundedOptionCount: z.number().int().min(0).default(0),
  rejectedOptions: z.array(z.string()).default(() => [])
})

export const ClarificationContextSchema = z.object({
  originalQuestion: z.string().optional(),
  selectedOptionId: z.string().optional(),
  selectedValue: z.string().optional()
})

const ConversationCitationSchema = z.object({
  documentId: z.string().optional(),
  fileName: z.string().optional(),
  chunkId: z.string().optional(),
  score: z.number().optional(),
  text: z.string().optional()
})

export const ConversationTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  turnId: z.string().optional(),
  citations: z.array(ConversationCitationSchema).optional(),
  createdAt: z.string().optional()
})

const ConversationHistoryTurnSchema = ConversationTurnSchema.pick({
  role: true,
  text: true,
  turnId: true
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
  turnId: z.string().optional(),
  turnIndex: z.number().int().nonnegative().optional(),
  activeEntities: z.array(z.string()).default(() => []),
  activeDocuments: z.array(z.string()).default(() => []),
  activeTopics: z.array(z.string()).default(() => []),
  constraints: z.array(z.string()).default(() => []),
  previousCitationCount: z.number().int().nonnegative().default(0),
  turnDependency: z.string().default("standalone")
})

export const DecontextualizedQuerySchema = z.object({
  standaloneQuestion: z.string(),
  retrievalQueries: z.array(z.string()).default(() => []),
  carriedEntities: z.array(z.string()).default(() => []),
  carriedDocuments: z.array(z.string()).default(() => []),
  turnDependency: z.string().default("standalone"),
  shouldUsePreviousCitations: z.boolean().default(false)
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
  startedAt: z.string(),
  completedAt: z.string()
})

const QueryEmbeddingSchema = z.object({
  query: z.string(),
  vector: z.array(z.number())
})

const SearchFiltersSchema = z.object({
  tenantId: z.string().optional(),
  department: z.string().optional(),
  source: z.string().optional(),
  docType: z.string().optional(),
  benchmarkSuiteId: z.string().optional(),
  documentId: z.string().optional()
})

const SearchScopeSchema = z.object({
  mode: z.enum(["all", "groups", "documents", "temporary"]).optional(),
  groupIds: z.array(z.string()).optional(),
  documentIds: z.array(z.string()).optional(),
  includeTemporary: z.boolean().optional(),
  temporaryScopeId: z.string().optional()
})

const SearchBudgetSchema = z.object({
  maxReferenceDepth: z.number().int().min(0).default(ragRuntimePolicy.retrieval.referenceMaxDepth),
  remainingCalls: z.number().int().min(0).default(ragRuntimePolicy.retrieval.searchBudgetCalls)
})

export const RequiredFactSchema = z.object({
  id: z.string(),
  description: z.string(),
  factType: z.enum(["amount", "date", "duration", "count", "status", "version", "condition", "procedure", "person", "scope", "classification", "unknown"]).optional(),
  necessity: z.enum(["primary", "secondary", "inferred"]).optional(),
  subject: z.string().optional(),
  scope: z.string().optional(),
  expectedValueType: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  plannerSource: z.enum(["deterministic", "sufficient_context", "legacy_fallback"]).optional(),
  priority: z.number().int().min(1),
  status: z.enum(["missing", "partially_supported", "supported", "conflicting"]).default("missing"),
  supportingChunkKeys: z.array(z.string()).default(() => [])
})

export const ClaimSchema = z.object({
  subject: z.string(),
  predicate: z.string(),
  value: z.string(),
  valueType: z.enum(["date", "money", "duration", "count", "status", "version", "condition"]),
  unit: z.string().optional(),
  scope: z.string().optional(),
  effectiveDate: z.string().optional(),
  sourceChunkId: z.string(),
  sentence: z.string().optional()
})

export const ConflictCandidateSchema = z.object({
  factId: z.string().optional(),
  subject: z.string(),
  predicate: z.string(),
  scope: z.string().optional(),
  values: z.array(z.string()).default(() => []),
  chunkKeys: z.array(z.string()).default(() => []),
  reason: z.string()
})

export const SearchActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("evidence_search"), query: z.string(), topK: z.number().int().min(1) }),
  z.object({ type: z.literal("query_rewrite"), strategy: z.enum(["keyword", "hyde", "entity", "section"]), input: z.string() }),
  z.object({ type: z.literal("expand_context"), chunkKey: z.string(), window: z.number().int().min(1) }),
  z.object({ type: z.literal("rerank"), objective: z.string() }),
  z.object({ type: z.literal("finalize_refusal"), reason: z.string() })
])

const StopCriteriaSchema = z.object({
  maxIterations: z.number().int().min(1).max(ragRuntimePolicy.retrieval.maxIterations).default(ragRuntimePolicy.retrieval.defaultMaxIterations),
  minTopScore: z.number().min(-1).max(1).default(ragRuntimePolicy.retrieval.defaultMinScore),
  minEvidenceCount: z.number().int().min(1).default(ragRuntimePolicy.retrieval.minEvidenceCountMin),
  maxNoNewEvidenceStreak: z.number().int().min(1).default(ragRuntimePolicy.retrieval.maxNoNewEvidenceStreak)
})

export const SearchPlanSchema = z.object({
  complexity: z.enum(["simple", "multi_hop", "comparison", "procedure", "ambiguous", "out_of_scope"]).default("simple"),
  intent: z.string().default(""),
  requiredFacts: z.array(RequiredFactSchema).default(() => []),
  actions: z.array(SearchActionSchema).default(() => []),
  stopCriteria: StopCriteriaSchema.default({
    maxIterations: ragRuntimePolicy.retrieval.defaultMaxIterations,
    minTopScore: ragRuntimePolicy.retrieval.defaultMinScore,
    minEvidenceCount: ragRuntimePolicy.retrieval.minEvidenceCountMin,
    maxNoNewEvidenceStreak: ragRuntimePolicy.retrieval.maxNoNewEvidenceStreak
  })
})

export const ActionObservationSchema = z.object({
  action: SearchActionSchema,
  hitCount: z.number().int().min(0),
  newEvidenceCount: z.number().int().min(0),
  topScore: z.number().optional(),
  retrievalDiagnostics: z
    .object({
      queryCount: z.number().int().min(0),
      indexVersions: z.array(z.string()).default(() => []),
      aliasVersions: z.array(z.string()).default(() => []),
      lexicalCount: z.number().int().min(0),
      semanticCount: z.number().int().min(0),
      fusedCount: z.number().int().min(0),
      profileId: z.string().optional(),
      profileVersion: z.string().optional(),
      topGap: z.number().optional(),
      lexicalSemanticOverlap: z.number().optional(),
      sourceCounts: z.object({
        lexical: z.number().int().min(0),
        semantic: z.number().int().min(0),
        hybrid: z.number().int().min(0)
      })
    })
    .optional(),
  summary: z.string()
})

export const RetrievalEvaluationSchema = z.object({
  retrievalQuality: z.enum(["sufficient", "partial", "irrelevant", "conflicting"]).default("irrelevant"),
  missingFactIds: z.array(z.string()).default(() => []),
  conflictingFactIds: z.array(z.string()).default(() => []),
  supportedFactIds: z.array(z.string()).default(() => []),
  riskSignals: z
    .array(
      z.object({
        type: z.enum(["value_mismatch", "date_mismatch", "explicit_conflict_cue", "temporal_status_cue", "typed_claim_conflict", "uncertain_scope_conflict"]),
        factId: z.string().optional(),
        chunkKeys: z.array(z.string()).default(() => []),
        values: z.array(z.string()).default(() => []),
        claims: z.array(ClaimSchema).optional(),
        conflictCandidate: ConflictCandidateSchema.optional(),
        reason: z.string().default("")
      })
    )
    .optional(),
  claims: z.array(ClaimSchema).default(() => []),
  conflictCandidates: z.array(ConflictCandidateSchema).default(() => []),
  llmJudge: z
    .object({
      label: z.enum(["CONFLICT", "NO_CONFLICT", "UNCLEAR"]),
      confidence: z.number().min(0).max(1).default(0),
      factIds: z.array(z.string()).default(() => []),
      supportingChunkIds: z.array(z.string()).default(() => []),
      contradictionChunkIds: z.array(z.string()).default(() => []),
      reason: z.string().default("")
    })
    .optional(),
  nextAction: SearchActionSchema.default({
    type: "evidence_search",
    query: "",
    topK: ragRuntimePolicy.retrieval.defaultTopK
  }),
  reason: z.string().default("")
})

export const TemporalContextSchema = z.object({
  nowIso: z.string(),
  today: z.string(),
  timezone: z.string(),
  source: z.enum(["server", "question", "benchmark", "test"]).default("server")
})

export const ToolIntentSchema = z.object({
  needsSearch: z.boolean().default(true),
  canAnswerFromQuestionOnly: z.boolean().default(false),
  needsArithmeticCalculation: z.boolean().default(false),
  needsAggregation: z.boolean().default(false),
  needsTemporalCalculation: z.boolean().default(false),
  needsTaskDeadlineIndex: z.boolean().default(false),
  needsExhaustiveEnumeration: z.boolean().default(false),
  temporalOperation: z.enum(["current_date", "days_until", "deadline_status", "add_days", "recurring_deadline", "business_day_calculation", "relative_policy_deadline"]).optional(),
  arithmeticOperation: z.enum(["sum", "difference", "percentage", "price", "average"]).optional(),
  confidence: z.number().min(0).max(1).default(0),
  reason: z.string().default("")
})

const ComputedFactBaseSchema = z.object({
  id: z.string(),
  inputFactIds: z.array(z.string()).default(() => []),
  sourceChunkId: z.string().optional()
})

export const ComputedFactSchema = z.discriminatedUnion("kind", [
  ComputedFactBaseSchema.extend({
    kind: z.literal("arithmetic"),
    expression: z.string(),
    result: z.string(),
    unit: z.string().optional(),
    explanation: z.string()
  }),
  ComputedFactBaseSchema.extend({
    kind: z.literal("threshold_comparison"),
    source: z.literal("llm_policy_extraction"),
    questionAmount: z.number(),
    thresholdAmount: z.number(),
    operator: z.enum(["gte", "gt", "lte", "lt", "eq"]),
    satisfiesCondition: z.boolean(),
    effect: z.enum(["required", "not_required", "allowed", "not_allowed", "eligible", "not_eligible"]),
    polarity: z.enum(["required", "not_required"]).optional(),
    subject: z.string(),
    requirement: z.string(),
    sourceText: z.string(),
    extractionConfidence: z.number().min(0).max(1),
    explanation: z.string()
  }),
  ComputedFactBaseSchema.extend({
    kind: z.literal("deadline_status"),
    today: z.string(),
    timezone: z.string(),
    dueDate: z.string(),
    daysRemaining: z.number().int().nonnegative(),
    overdueDays: z.number().int().nonnegative(),
    status: z.enum(["not_due", "due_today", "overdue"]),
    rule: z.object({
      dueTodayIsOverdue: z.boolean(),
      unit: z.enum(["calendar_day", "business_day"])
    }),
    explanation: z.string()
  }),
  ComputedFactBaseSchema.extend({
    kind: z.literal("days_until"),
    today: z.string(),
    timezone: z.string(),
    dueDate: z.string(),
    daysRemaining: z.number().int(),
    rule: z.object({
      inclusive: z.boolean(),
      unit: z.enum(["calendar_day", "business_day"])
    }),
    explanation: z.string()
  }),
  ComputedFactBaseSchema.extend({
    kind: z.literal("add_days"),
    today: z.string(),
    timezone: z.string(),
    baseDate: z.string(),
    amount: z.number().int(),
    unit: z.enum(["calendar_day", "business_day"]),
    resultDate: z.string(),
    explanation: z.string()
  }),
  ComputedFactBaseSchema.extend({
    kind: z.literal("relative_policy_deadline"),
    today: z.string(),
    timezone: z.string(),
    baseDate: z.string(),
    resultDate: z.string(),
    amount: z.number().int(),
    unit: z.enum(["month"]),
    direction: z.enum(["before"]),
    ruleText: z.string(),
    explanation: z.string()
  }),
  ComputedFactBaseSchema.extend({
    kind: z.literal("current_date"),
    today: z.string(),
    timezone: z.string(),
    explanation: z.string()
  }),
  ComputedFactBaseSchema.extend({
    kind: z.literal("calculation_unavailable"),
    computationType: z.enum(["arithmetic", "temporal", "aggregation"]),
    reason: z.string(),
    missingInputs: z.array(z.string()).default(() => []),
    unsupportedCapabilities: z.array(z.string()).default(() => [])
  }),
  ComputedFactBaseSchema.extend({
    kind: z.literal("task_deadline_query_unavailable"),
    today: z.string(),
    timezone: z.string(),
    condition: z.enum(["overdue", "due_today", "due_this_week", "unknown"]),
    reason: z.string()
  })
])

export const AgentStateSchema = z.object({
  runId: z.string(),
  question: z.string(),
  conversationHistory: z.array(ConversationHistoryTurnSchema).default(() => []),
  modelId: z.string(),
  embeddingModelId: z.string(),
  clueModelId: z.string(),
  useMemory: z.boolean().default(true),
  debug: z.boolean().default(false),
  topK: z.number().int().min(1).max(ragRuntimePolicy.retrieval.maxTopK).default(ragRuntimePolicy.retrieval.defaultTopK),
  memoryTopK: z.number().int().min(1).max(ragRuntimePolicy.retrieval.maxMemoryTopK).default(ragRuntimePolicy.retrieval.defaultMemoryTopK),
  minScore: z.number().min(-1).max(1).default(ragRuntimePolicy.retrieval.defaultMinScore),
  strictGrounded: z.boolean().default(true),
  clarificationContext: ClarificationContextSchema.optional(),
  conversation: ConversationInputSchema.optional(),
  conversationState: ConversationStateSchema.optional(),
  decontextualizedQuery: DecontextualizedQuerySchema.optional(),
  searchFilters: SearchFiltersSchema.optional(),
  searchScope: SearchScopeSchema.optional(),

  iteration: z.number().int().min(0).default(0),
  referenceQueue: z.array(ReferenceTargetSchema).default(() => []),
  resolvedReferences: z.array(ReferenceResolutionSchema).default(() => []),
  unresolvedReferenceTargets: z.array(ReferenceTargetSchema).default(() => []),
  visitedDocumentIds: z.array(z.string()).default(() => []),
  searchBudget: SearchBudgetSchema.default({
    maxReferenceDepth: ragRuntimePolicy.retrieval.referenceMaxDepth,
    remainingCalls: ragRuntimePolicy.retrieval.searchBudgetCalls
  }),

  normalizedQuery: z.string().optional(),
  memoryCards: z.array(RetrievedChunkSchema).default(() => []),
  clues: z.array(z.string()).default(() => []),
  expandedQueries: z.array(z.string()).default(() => []),
  queryEmbeddings: z.array(QueryEmbeddingSchema).default(() => []),
  searchPlan: SearchPlanSchema.default({
    complexity: "simple",
    intent: "",
    requiredFacts: [],
    actions: [],
    stopCriteria: {
      maxIterations: ragRuntimePolicy.retrieval.defaultMaxIterations,
      minTopScore: ragRuntimePolicy.retrieval.defaultMinScore,
      minEvidenceCount: ragRuntimePolicy.retrieval.minEvidenceCountMin,
      maxNoNewEvidenceStreak: ragRuntimePolicy.retrieval.maxNoNewEvidenceStreak
    }
  }),
  actionHistory: z.array(ActionObservationSchema).default(() => []),
  retrievalEvaluation: RetrievalEvaluationSchema.default({
    retrievalQuality: "irrelevant",
    missingFactIds: [],
    conflictingFactIds: [],
    supportedFactIds: [],
    claims: [],
    conflictCandidates: [],
    nextAction: {
      type: "evidence_search",
      query: "",
      topK: ragRuntimePolicy.retrieval.defaultTopK
    },
    reason: ""
  }),

  temporalContext: TemporalContextSchema.optional(),
  asOfDate: z.string().optional(),
  asOfDateSource: z.enum(["benchmark", "test"]).optional(),
  toolIntent: ToolIntentSchema.optional(),
  computedFacts: z.array(ComputedFactSchema).default(() => []),
  usedComputedFactIds: z.array(z.string()).default(() => []),

  maxIterations: z.number().int().min(1).max(ragRuntimePolicy.retrieval.maxIterations).default(ragRuntimePolicy.retrieval.defaultMaxIterations),
  newEvidenceCount: z.number().int().min(0).default(0),
  noNewEvidenceStreak: z.number().int().min(0).default(0),
  searchDecision: z.enum(["continue_search", "done"]).default("continue_search"),

  retrievedChunks: z.array(RetrievedChunkSchema).default(() => []),
  retrievalDiagnostics: ActionObservationSchema.shape.retrievalDiagnostics,
  selectedChunks: z.array(RetrievedChunkSchema).default(() => []),

  answerability: AnswerabilitySchema.default({
    isAnswerable: false,
    reason: "not_checked",
    confidence: 0
  }),
  sufficientContext: SufficientContextJudgementSchema.default({
    label: "UNANSWERABLE",
    confidence: 0,
    requiredFacts: [],
    supportedFacts: [],
    missingFacts: [],
    conflictingFacts: [],
    supportingChunkIds: [],
    reason: ""
  }),
  rawAnswer: z.string().optional(),
  answer: z.string().optional(),
  answerSupport: AnswerSupportJudgementSchema.default({
    supported: false,
    unsupportedSentences: [],
    supportingChunkIds: [],
    supportingComputedFactIds: [],
    contradictionChunkIds: [],
    confidence: 0,
    totalSentences: 0,
    reason: ""
  }),
  clarification: ClarificationSchema.default({
    needsClarification: false,
    reason: "not_needed",
    question: "",
    options: [],
    missingSlots: [],
    confidence: 0,
    groundedOptionCount: 0,
    rejectedOptions: []
  }),
  citations: z.array(CitationSchema).default(() => []),

  trace: z.array(DebugStepSchema).default(() => [])
})

export type QaAgentState = z.infer<typeof AgentStateSchema>
export type QaAgentUpdate = Partial<Omit<QaAgentState, "trace">> & {
  trace?: z.infer<typeof DebugStepSchema> | Array<z.infer<typeof DebugStepSchema>>
}
export type AnswerabilityReason = QaAgentState["answerability"]["reason"]
export type SufficientContextJudgement = z.infer<typeof SufficientContextJudgementSchema>
export type AnswerSupportJudgement = z.infer<typeof AnswerSupportJudgementSchema>
export type RequiredFact = z.infer<typeof RequiredFactSchema>
export type RequiredFactNecessity = NonNullable<RequiredFact["necessity"]>
export type SearchAction = z.infer<typeof SearchActionSchema>
export type ActionObservation = z.infer<typeof ActionObservationSchema>
export type RetrievalEvaluation = z.infer<typeof RetrievalEvaluationSchema>
export type RetrievalRiskSignal = NonNullable<RetrievalEvaluation["riskSignals"]>[number]
export type RetrievalLlmJudge = NonNullable<RetrievalEvaluation["llmJudge"]>
export type Claim = z.infer<typeof ClaimSchema>
export type ConflictCandidate = z.infer<typeof ConflictCandidateSchema>
export type ReferenceTarget = z.infer<typeof ReferenceTargetSchema>
export type ReferenceResolution = z.infer<typeof ReferenceResolutionSchema>
export type TemporalContext = z.infer<typeof TemporalContextSchema>
export type ToolIntent = z.infer<typeof ToolIntentSchema>
export type ComputedFact = z.infer<typeof ComputedFactSchema>
export type Clarification = z.infer<typeof ClarificationSchema>
export type ClarificationOption = z.infer<typeof ClarificationOptionSchema>
export type ClarificationContext = z.infer<typeof ClarificationContextSchema>
export type ConversationInputState = z.infer<typeof ConversationInputSchema>
export type ConversationState = z.infer<typeof ConversationStateSchema>
export type DecontextualizedQuery = z.infer<typeof DecontextualizedQuerySchema>

export function requiredFactNecessity(fact: RequiredFact): RequiredFactNecessity {
  return fact.necessity ?? "primary"
}

export function isPrimaryRequiredFact(fact: RequiredFact): boolean {
  return requiredFactNecessity(fact) === "primary"
}
