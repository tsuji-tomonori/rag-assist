export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export type VectorKind = "chunk" | "memory"

export type VectorMetadata = {
  kind: VectorKind
  documentId: string
  fileName: string
  chunkId?: string
  memoryId?: string
  objectKey?: string
  sourceUri?: string
  text?: string
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
  sourceObjectKey: string
  manifestObjectKey: string
  vectorKeys: string[]
  memoryVectorKeys?: string[]
  evidenceVectorKeys?: string[]
  chunkCount: number
  memoryCardCount: number
  createdAt: string
}

export type MemoryCard = {
  id: string
  summary: string
  keywords: string[]
  likelyQuestions: string[]
  constraints: string[]
  text: string
}

export type Chunk = {
  id: string
  text: string
  startChar: number
  endChar: number
}

export type Citation = {
  documentId: string
  fileName: string
  chunkId?: string
  score: number
  text: string
}

export type DebugStepStatus = "success" | "warning" | "error"

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
  question: string
  modelId: string
  embeddingModelId: string
  clueModelId: string
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
  steps: DebugStep[]
}

export type ChatResponsePayload = {
  answer: string
  isAnswerable: boolean
  citations: Citation[]
  retrieved: Citation[]
  debug?: DebugTrace
}

export type QuestionStatus = "open" | "answered" | "resolved"
export type QuestionPriority = "normal" | "high" | "urgent"

export type HumanQuestion = {
  questionId: string
  title: string
  question: string
  requesterName: string
  requesterDepartment: string
  assigneeDepartment: string
  category: string
  priority: QuestionPriority
  status: QuestionStatus
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

export const CONVERSATION_HISTORY_SCHEMA_VERSION = 1

export type ConversationHistoryItem = {
  schemaVersion: typeof CONVERSATION_HISTORY_SCHEMA_VERSION
  id: string
  title: string
  updatedAt: string
  messages: ConversationMessage[]
}
