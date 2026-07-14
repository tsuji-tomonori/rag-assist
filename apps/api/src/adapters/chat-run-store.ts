import type { ChatRun } from "../types.js"

export type CreateChatRunInput = ChatRun

export type ChatRunExecutionEnvelope = Pick<
  ChatRun,
  | "runId"
  | "tenantId"
  | "status"
  | "createdBy"
  | "userEmail"
  | "userGroups"
  | "securityResourceRefs"
  | "searchScope"
  | "createdAt"
  | "updatedAt"
  | "startedAt"
  | "completedAt"
  | "error"
  | "errorCode"
  | "ttl"
>

export type UpdateChatRunInput = Partial<Omit<ChatRun, "tenantId" | "runId" | "createdAt" | "createdBy">> & {
  /** Atomically removes any previously staged body-bearing success result. */
  clearResult?: boolean
}

export const chatRunResultFieldNames = [
  "responseType",
  "answer",
  "isAnswerable",
  "needsClarification",
  "clarification",
  "citations",
  "retrieved",
  "debugRunId"
] as const satisfies ReadonlyArray<keyof ChatRun>

export interface ChatRunStore {
  create(input: CreateChatRunInput): Promise<ChatRun>
  list?(tenantId: string, limit?: number): Promise<ChatRun[]>
  listAll?(tenantId: string): Promise<ChatRun[]>
  /** Strongly consistent primary-table enumeration used by deny cleanup; includes legacy rows pending backfill. */
  listAllAuthoritative?(tenantId: string): Promise<ChatRun[]>
  get(tenantId: string, runId: string): Promise<ChatRun | undefined>
  /** Production workers use this projection before authorization so body-bearing inputs are not read early. */
  getExecutionEnvelope?(tenantId: string, runId: string): Promise<ChatRunExecutionEnvelope | undefined>
  update(tenantId: string, runId: string, input: UpdateChatRunInput): Promise<ChatRun>
  /** Compare-and-set transition used to claim and finish a run exactly once. */
  updateIfStatus?(
    tenantId: string,
    runId: string,
    expectedStatus: ChatRun["status"],
    input: UpdateChatRunInput
  ): Promise<boolean>
}
