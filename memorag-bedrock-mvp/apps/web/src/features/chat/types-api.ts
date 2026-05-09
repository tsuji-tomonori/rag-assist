import type { ChatResponse as ContractChatResponse } from "@memorag-mvp/contract"
import type { Citation } from "../../shared/types/common.js"
import type { DebugTrace } from "../debug/types.js"

export type {
  ChatRequest,
  ChatRunStartResponse,
  ClarificationOption,
  Clarification,
} from "@memorag-mvp/contract"

export type ChatResponse = Omit<ContractChatResponse, "citations" | "retrieved" | "finalEvidence" | "debug"> & {
  citations: Citation[]
  retrieved: Citation[]
  finalEvidence?: Citation[]
  debug?: DebugTrace
}

export type ChatRunEvent = {
  id?: number
  type: "status" | "heartbeat" | "final" | "error" | "timeout" | string
  data: Record<string, unknown>
}
