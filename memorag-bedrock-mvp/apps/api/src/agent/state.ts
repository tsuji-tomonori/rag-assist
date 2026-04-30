import { ReducedValue, StateSchema } from "@langchain/langgraph"
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

export const CitationSchema = z.object({
  documentId: z.string(),
  fileName: z.string(),
  chunkId: z.string().optional(),
  score: z.number(),
  text: z.string()
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
      "citation_validation_failed"
    ])
    .default("not_checked"),
  confidence: z.number().min(0).max(1).default(0)
})

export const DebugStepSchema = z.object({
  id: z.number(),
  label: z.string(),
  status: z.enum(["success", "warning", "error"]),
  latencyMs: z.number(),
  modelId: z.string().optional(),
  summary: z.string(),
  detail: z.string().optional(),
  hitCount: z.number().optional(),
  tokenCount: z.number().optional(),
  startedAt: z.string(),
  completedAt: z.string()
})

const QueryEmbeddingSchema = z.object({
  query: z.string(),
  vector: z.array(z.number())
})

export const AgentState = new StateSchema({
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

  normalizedQuery: z.string().optional(),
  memoryCards: z.array(RetrievedChunkSchema).default(() => []),
  clues: z.array(z.string()).default(() => []),
  expandedQueries: z.array(z.string()).default(() => []),
  queryEmbeddings: z.array(QueryEmbeddingSchema).default(() => []),

  retrievedChunks: z.array(RetrievedChunkSchema).default(() => []),
  selectedChunks: z.array(RetrievedChunkSchema).default(() => []),

  answerability: AnswerabilitySchema.default({
    isAnswerable: false,
    reason: "not_checked",
    confidence: 0
  }),
  rawAnswer: z.string().optional(),
  answer: z.string().optional(),
  citations: z.array(CitationSchema).default(() => []),

  trace: new ReducedValue(z.array(DebugStepSchema).default(() => []), {
    inputSchema: DebugStepSchema,
    reducer: (current, next) => [...current, next]
  })
})

export type QaAgentState = typeof AgentState.State
export type QaAgentUpdate = typeof AgentState.Update
export type AnswerabilityReason = QaAgentState["answerability"]["reason"]
