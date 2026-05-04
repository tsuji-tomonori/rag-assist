import type { Citation } from "../../shared/types/common.js"
import type { DebugTrace } from "../debug/types.js"

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

export type ChatResponse = {
  responseType?: "answer" | "refusal" | "clarification"
  answer: string
  isAnswerable: boolean
  needsClarification?: boolean
  clarification?: Clarification
  citations: Citation[]
  retrieved: Citation[]
  debug?: DebugTrace
}

export type ChatRunStartResponse = {
  runId: string
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled"
  eventsPath: string
}

export type ChatRunEvent = {
  id?: number
  type: "status" | "heartbeat" | "final" | "error" | "timeout" | string
  data: Record<string, unknown>
}
