import { get, post } from "../../../shared/api/http.js"
import type { HumanQuestion } from "../types.js"

export async function createQuestion(input: {
  title: string
  question: string
  requesterName?: string
  requesterDepartment?: string
  assigneeDepartment?: string
  category?: string
  priority?: HumanQuestion["priority"]
  source?: HumanQuestion["source"]
  messageId?: string
  ragRunId?: string
  answerUnavailableEventId?: string
  answerUnavailableReason?: string
  sanitizedDiagnostics?: HumanQuestion["sanitizedDiagnostics"]
  assigneeUserId?: string
  assigneeGroupId?: string
  slaDueAt?: string
  qualityCause?: HumanQuestion["qualityCause"]
  sourceQuestion?: string
  chatAnswer?: string
  chatRunId?: string
}): Promise<HumanQuestion> {
  return post<HumanQuestion>("/questions", input)
}

export async function listQuestions(): Promise<HumanQuestion[]> {
  const result = await get<{ questions?: HumanQuestion[] }>("/questions")
  return result.questions ?? []
}

export async function getQuestion(questionId: string): Promise<HumanQuestion> {
  return get<HumanQuestion>(`/questions/${encodeURIComponent(questionId)}`)
}

export async function answerQuestion(
  questionId: string,
  input: {
    answerTitle: string
    answerBody: string
    responderName?: string
    responderDepartment?: string
    references?: string
    internalMemo?: string
    notifyRequester?: boolean
  }
): Promise<HumanQuestion> {
  return post<HumanQuestion>(`/questions/${encodeURIComponent(questionId)}/answer`, input)
}

export async function resolveQuestion(questionId: string): Promise<HumanQuestion> {
  return post<HumanQuestion>(`/questions/${encodeURIComponent(questionId)}/resolve`, {})
}
