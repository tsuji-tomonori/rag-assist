export type HumanQuestion = {
  questionId: string
  title: string
  question: string
  requesterName: string
  requesterUserId?: string
  requesterDepartment: string
  assigneeDepartment: string
  category: string
  priority: "normal" | "high" | "urgent"
  status: "open" | "answered" | "resolved"
  sourceQuestion?: string
  chatAnswer?: string
  chatRunId?: string
  references?: string
  answerTitle?: string
  answerBody?: string
  responderName?: string
  responderDepartment?: string
  internalMemo?: string
  notifyRequester?: boolean
  createdAt: string
  updatedAt: string
  answeredAt?: string
  resolvedAt?: string
}
