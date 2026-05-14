import type { Citation } from "../../shared/types/common.js"

export type DebugStep = {
  id: number
  label: string
  status: "success" | "warning" | "error"
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

export type DebugTrace = {
  schemaVersion: 1
  runId: string
  targetType?: "rag_run" | "ingest_run" | "chat_orchestration_run" | "async_agent_run" | "tool_invocation"
  visibility?: "user_safe" | "support_sanitized" | "operator_sanitized" | "internal_restricted"
  sanitizePolicyVersion?: "debug-trace-sanitize-v1"
  exportRedaction?: {
    policyVersion: "debug-trace-sanitize-v1"
    visibility: "user_safe" | "support_sanitized" | "operator_sanitized" | "internal_restricted"
    redactedFields: string[]
    notes?: string[]
  }
  question: string
  modelId: string
  embeddingModelId: string
  clueModelId: string
  clarificationContext?: {
    originalQuestion?: string
    selectedOptionId?: string
    selectedValue?: string
  }
  pipelineVersions?: Record<string, unknown>
  topK: number
  memoryTopK: number
  minScore: number
  startedAt: string
  completedAt: string
  totalLatencyMs: number
  status: "success" | "warning" | "error"
  answerPreview: string
  isAnswerable: boolean
  citations: Citation[]
  retrieved: Citation[]
  steps: DebugStep[]
}

export type DebugDownloadResponse = {
  url: string
  expiresInSeconds: number
  objectKey: string
}
