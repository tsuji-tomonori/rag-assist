import type { HumanQuestion } from "../../questions/types.js"
import type { Message } from "../types.js"

export function getLinkedQuestion(message: Message, questions: HumanQuestion[]): HumanQuestion | undefined {
  if (message.questionTicket) {
    return questions.find((question) => question.questionId === message.questionTicket?.questionId) ?? message.questionTicket
  }
  if (message.messageId) {
    const exactMatches = questions.filter((question) => question.messageId === message.messageId)
    if (exactMatches.length === 1) return exactMatches[0]
  }
  if (!message.sourceQuestion) return undefined
  const legacyMatches = questions.filter((question) => question.sourceQuestion === message.sourceQuestion)
  return legacyMatches.length === 1 ? legacyMatches[0] : undefined
}
