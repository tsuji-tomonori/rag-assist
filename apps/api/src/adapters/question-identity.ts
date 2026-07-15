import { createHash, randomUUID } from "node:crypto"
import type { HumanQuestion } from "../types.js"
import type { CreateQuestionInput } from "./question-store.js"

export function questionIdForCreate(input: CreateQuestionInput): string {
  const requesterUserId = input.requesterUserId?.trim()
  const messageId = input.messageId?.trim()
  if (!requesterUserId || !messageId) return randomUUID()
  const digest = createHash("sha256")
    .update(`${requesterUserId}\u0000${messageId}`)
    .digest("hex")
  return `question-${digest}`
}

export function isSameQuestionCreateIdentity(question: HumanQuestion, input: CreateQuestionInput): boolean {
  return Boolean(
    input.requesterUserId &&
    input.messageId &&
    question.requesterUserId?.trim() === input.requesterUserId.trim() &&
    question.messageId?.trim() === input.messageId.trim()
  )
}
