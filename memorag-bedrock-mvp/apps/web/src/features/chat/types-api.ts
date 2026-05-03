import type { Citation } from "../../shared/types/common.js"
import type { DebugTrace } from "../debug/types.js"

export type ChatResponse = {
  answer: string
  isAnswerable: boolean
  citations: Citation[]
  retrieved: Citation[]
  debug?: DebugTrace
}
