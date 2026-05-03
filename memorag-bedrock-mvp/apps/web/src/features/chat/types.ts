import type { ChatResponse } from "./types-api.js"
import type { HumanQuestion } from "../questions/types.js"

export type Message = {
  role: "user" | "assistant"
  text: string
  createdAt: string
  sourceQuestion?: string
  result?: ChatResponse
  questionTicket?: HumanQuestion
}
