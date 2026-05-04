import type { Citation } from "../../shared/types/common.js"
import type { DebugTrace } from "../debug/types.js"

export type ChatResponse = {
  answer: string
  isAnswerable: boolean
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
