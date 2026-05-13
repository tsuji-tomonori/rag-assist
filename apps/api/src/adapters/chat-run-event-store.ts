import type { ChatRunEvent } from "../types.js"

export type CreateChatRunEventInput = Omit<ChatRunEvent, "seq" | "createdAt"> & {
  seq?: number
  createdAt?: string
}

export interface ChatRunEventStore {
  append(input: CreateChatRunEventInput): Promise<ChatRunEvent>
  listAfter(runId: string, afterSeq: number, limit?: number): Promise<ChatRunEvent[]>
}
