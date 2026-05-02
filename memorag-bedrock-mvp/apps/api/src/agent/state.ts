import { z } from "zod"

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
  contradictionChunkIds: z.array(z.string()).default(() => []),
  confidence: z.number().min(0).max(1).default(0),
  totalSentences: z.number().int().min(0).default(0),
  reason: z.string().default("")
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

const SearchBudgetSchema = z.object({
  maxReferenceDepth: z.number().int().min(0).default(2),
  remainingCalls: z.number().int().min(0).default(3)
})

export const RequiredFactSchema = z.object({
  id: z.string(),
  description: z.string(),
  priority: z.number().int().min(1),
  status: z.enum(["missing", "partially_supported", "supported", "conflicting"]).default("missing"),
  supportingChunkKeys: z.array(z.string()).default(() => [])
})

export const SearchActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("evidence_search"), query: z.string(), topK: z.number().int().min(1) }),
  z.object({ type: z.literal("query_rewrite"), strategy: z.enum(["keyword", "hyde", "entity", "section"]), input: z.string() }),
  z.object({ type: z.literal("expand_context"), chunkKey: z.string(), window: z.number().int().min(1) }),
  z.object({ type: z.literal("rerank"), objective: z.string() }),
  z.object({ type: z.literal("finalize_refusal"), reason: z.string() })
])

const StopCriteriaSchema = z.object({
  maxIterations: z.number().int().min(1).default(3),
  minTopScore: z.number().min(-1).max(1).default(0.2),
  minEvidenceCount: z.number().int().min(1).default(2),
  maxNoNewEvidenceStreak: z.number().int().min(1).default(2)
})

export const SearchPlanSchema = z.object({
  complexity: z.enum(["simple", "multi_hop", "comparison", "procedure", "ambiguous", "out_of_scope"]).default("simple"),
  intent: z.string().default(""),
  requiredFacts: z.array(RequiredFactSchema).default(() => []),
  actions: z.array(SearchActionSchema).default(() => []),
  stopCriteria: StopCriteriaSchema.default({
    maxIterations: 3,
    minTopScore: 0.2,
    minEvidenceCount: 2,
    maxNoNewEvidenceStreak: 2
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
  nextAction: SearchActionSchema.default({
    type: "evidence_search",
    query: "",
    topK: 6
  }),
  reason: z.string().default("")
})

export const AgentStateSchema = z.object({
  runId: z.string(),
  question: z.string(),
  modelId: z.string(),
  embeddingModelId: z.string(),
  clueModelId: z.string(),
  useMemory: z.boolean().default(true),
  debug: z.boolean().default(false),
  topK: z.number().int().min(1).max(20).default(6),
  memoryTopK: z.number().int().min(1).max(10).default(4),
  minScore: z.number().min(-1).max(1).default(0.2),
  strictGrounded: z.boolean().default(true),

  iteration: z.number().int().min(0).default(0),
  referenceQueue: z.array(ReferenceTargetSchema).default(() => []),
  resolvedReferences: z.array(ReferenceResolutionSchema).default(() => []),
  unresolvedReferenceTargets: z.array(ReferenceTargetSchema).default(() => []),
  visitedDocumentIds: z.array(z.string()).default(() => []),
  searchBudget: SearchBudgetSchema.default({
    maxReferenceDepth: 2,
    remainingCalls: 3
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
      maxIterations: 3,
      minTopScore: 0.2,
      minEvidenceCount: 2,
      maxNoNewEvidenceStreak: 2
    }
  }),
  actionHistory: z.array(ActionObservationSchema).default(() => []),
  retrievalEvaluation: RetrievalEvaluationSchema.default({
    retrievalQuality: "irrelevant",
    missingFactIds: [],
    conflictingFactIds: [],
    supportedFactIds: [],
    nextAction: {
      type: "evidence_search",
      query: "",
      topK: 6
    },
    reason: ""
  }),

  maxIterations: z.number().int().min(1).max(8).default(3),
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
    contradictionChunkIds: [],
    confidence: 0,
    totalSentences: 0,
    reason: ""
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
export type SearchAction = z.infer<typeof SearchActionSchema>
export type ActionObservation = z.infer<typeof ActionObservationSchema>
export type RetrievalEvaluation = z.infer<typeof RetrievalEvaluationSchema>
export type ReferenceTarget = z.infer<typeof ReferenceTargetSchema>
export type ReferenceResolution = z.infer<typeof ReferenceResolutionSchema>
