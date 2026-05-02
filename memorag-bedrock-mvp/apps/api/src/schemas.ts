import { z } from "@hono/zod-openapi"

const MetadataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  timestamp: z.string()
})

export const DocumentUploadRequestSchema = z.object({
  fileName: z.string().min(1).openapi({ example: "handbook.md" }),
  text: z.string().optional().openapi({ example: "経費精算は申請から30日以内に行う必要があります。" }),
  contentBase64: z.string().optional(),
  mimeType: z.string().optional().openapi({ example: "text/markdown" }),
  metadata: z.record(MetadataValueSchema).optional(),
  embeddingModelId: z.string().optional().openapi({ example: "amazon.titan-embed-text-v2:0" }),
  memoryModelId: z.string().optional().openapi({ example: "amazon.nova-lite-v1:0" }),
  skipMemory: z.boolean().optional()
})

export const DocumentManifestSchema = z.object({
  documentId: z.string(),
  fileName: z.string(),
  mimeType: z.string().optional(),
  metadata: z.record(MetadataValueSchema).optional(),
  sourceObjectKey: z.string(),
  manifestObjectKey: z.string(),
  vectorKeys: z.array(z.string()),
  memoryVectorKeys: z.array(z.string()).optional(),
  evidenceVectorKeys: z.array(z.string()).optional(),
  chunkCount: z.number(),
  memoryCardCount: z.number(),
  createdAt: z.string()
})

export const DocumentListResponseSchema = z.object({
  documents: z.array(DocumentManifestSchema)
})

export const DeleteDocumentResponseSchema = z.object({
  documentId: z.string(),
  deletedVectorCount: z.number()
})

export const ChatRequestSchema = z.object({
  question: z.string().min(1).openapi({ example: "経費精算の期限は？" }),
  modelId: z.string().optional().openapi({ example: "amazon.nova-lite-v1:0" }),
  embeddingModelId: z.string().optional().openapi({ example: "amazon.titan-embed-text-v2:0" }),
  clueModelId: z.string().optional().openapi({ example: "amazon.nova-lite-v1:0" }),
  topK: z.number().int().min(1).max(20).optional().openapi({ example: 6 }),
  memoryTopK: z.number().int().min(1).max(10).optional().openapi({ example: 4 }),
  minScore: z.number().min(-1).max(1).optional().openapi({ example: 0.20 }),
  strictGrounded: z.boolean().optional().openapi({ example: true }),
  includeDebug: z.boolean().optional().openapi({ example: false }),
  debug: z.boolean().optional().openapi({ example: false }),
  useMemory: z.boolean().optional().openapi({ example: true })
})

export const CitationSchema = z.object({
  documentId: z.string(),
  fileName: z.string(),
  chunkId: z.string().optional(),
  score: z.number(),
  text: z.string()
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

export const DebugTraceSchema = z.object({
  runId: z.string(),
  question: z.string(),
  modelId: z.string(),
  embeddingModelId: z.string(),
  clueModelId: z.string(),
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
  steps: z.array(DebugStepSchema)
})

export const ChatResponseSchema = z.object({
  answer: z.string(),
  isAnswerable: z.boolean(),
  citations: z.array(CitationSchema),
  retrieved: z.array(CitationSchema),
  debug: DebugTraceSchema.optional()
})

export const QuestionPrioritySchema = z.enum(["normal", "high", "urgent"])
export const QuestionStatusSchema = z.enum(["open", "answered", "resolved"])

export const QuestionSchema = z.object({
  questionId: z.string(),
  title: z.string(),
  question: z.string(),
  requesterName: z.string(),
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
  id: z.string().optional()
})

export const BenchmarkQueryResponseSchema = ChatResponseSchema.extend({
  id: z.string().optional()
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
