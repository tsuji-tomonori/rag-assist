import type { HumanQuestion } from "../../questions/types.js"
import type { Message } from "../types.js"

export function getLinkedQuestion(message: Message, questions: HumanQuestion[]): HumanQuestion | undefined {
  if (message.questionTicket) {
    return questions.find((question) => question.questionId === message.questionTicket?.questionId) ?? message.questionTicket
  }
  return questions.find((question) => question.sourceQuestion && question.sourceQuestion === message.sourceQuestion)
}
