import type { HumanQuestion } from "../types.js"

export type CreateQuestionInput = {
  title: string
  question: string
  requesterName?: string
  requesterDepartment?: string
  assigneeDepartment?: string
  category?: string
  priority?: HumanQuestion["priority"]
  sourceQuestion?: string
  chatAnswer?: string
  chatRunId?: string
}

export type AnswerQuestionInput = {
  answerTitle: string
  answerBody: string
  responderName?: string
  responderDepartment?: string
  references?: string
  internalMemo?: string
  notifyRequester?: boolean
}

export interface QuestionStore {
  create(input: CreateQuestionInput): Promise<HumanQuestion>
  list(): Promise<HumanQuestion[]>
  get(questionId: string): Promise<HumanQuestion | undefined>
  answer(questionId: string, input: AnswerQuestionInput): Promise<HumanQuestion>
  resolve(questionId: string): Promise<HumanQuestion>
}
