import type { ChatResponse, HumanQuestion } from "../../api.js"

export type Message = {
  role: "user" | "assistant"
  text: string
  createdAt: string
  sourceQuestion?: string
  result?: ChatResponse
  questionTicket?: HumanQuestion
}
