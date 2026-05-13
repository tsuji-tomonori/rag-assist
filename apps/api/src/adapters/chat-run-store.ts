import type { ChatRun } from "../types.js"

export type CreateChatRunInput = ChatRun

export type UpdateChatRunInput = Partial<Omit<ChatRun, "runId" | "createdAt" | "createdBy">>

export interface ChatRunStore {
  create(input: CreateChatRunInput): Promise<ChatRun>
  get(runId: string): Promise<ChatRun | undefined>
  update(runId: string, input: UpdateChatRunInput): Promise<ChatRun>
}
