import type { ChatRunEvent } from "../types.js"

export type CreateChatRunEventInput = Omit<ChatRunEvent, "seq" | "createdAt"> & {
  seq?: number
  createdAt?: string
}

export interface ChatRunEventStore {
  append(tenantId: string, input: CreateChatRunEventInput): Promise<ChatRunEvent>
  listAfter(tenantId: string, runId: string, afterSeq: number, limit?: number): Promise<ChatRunEvent[]>
}
