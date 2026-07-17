import {
  CONVERSATION_HISTORY_LEGACY_SCHEMA_VERSION,
  CONVERSATION_HISTORY_SCHEMA_VERSION,
  type ConversationHistoryItem,
  type ConversationHistorySchemaVersion,
  type ConversationMessage
} from "../types.js"

export type SaveConversationHistoryInput =
  Omit<ConversationHistoryItem, "schemaVersion"> & Partial<Pick<ConversationHistoryItem, "schemaVersion">>

const CONVERSATION_HISTORY_MESSAGE_LIMIT = 100
const CONVERSATION_HISTORY_CITATION_MEMORY_LIMIT = 50
const CONVERSATION_HISTORY_TOOL_INVOCATION_LIMIT = 100
const CONVERSATION_HISTORY_SUMMARY_MAX_CHARS = 4000

export interface ConversationHistoryStore {
  save(userId: string, input: SaveConversationHistoryInput): Promise<ConversationHistoryItem>
  list(userId: string): Promise<ConversationHistoryItem[]>
  delete(userId: string, id: string): Promise<void>
}

export function normalizeConversationHistoryInput(input: SaveConversationHistoryInput): ConversationHistoryItem {
  assertSupportedConversationHistorySchemaVersion(input.schemaVersion)
  return {
    ...input,
    schemaVersion: CONVERSATION_HISTORY_SCHEMA_VERSION,
    updatedAt: input.updatedAt || new Date().toISOString(),
    isFavorite: input.isFavorite ?? false,
    messages: trimMessages(input.messages),
    rollingSummary: trimOptional(input.rollingSummary, CONVERSATION_HISTORY_SUMMARY_MAX_CHARS),
    queryFocusedSummary: trimOptional(input.queryFocusedSummary, CONVERSATION_HISTORY_SUMMARY_MAX_CHARS),
    decontextualizedQuery: input.decontextualizedQuery,
    citationMemory: input.citationMemory?.slice(0, CONVERSATION_HISTORY_CITATION_MEMORY_LIMIT),
    taskState: input.taskState,
    toolInvocations: input.toolInvocations?.slice(0, CONVERSATION_HISTORY_TOOL_INVOCATION_LIMIT)
  }
}

export function normalizeStoredConversationHistoryItem(
  input: Omit<ConversationHistoryItem, "schemaVersion"> & { schemaVersion?: unknown }
): ConversationHistoryItem {
  const schemaVersion = input.schemaVersion ?? CONVERSATION_HISTORY_LEGACY_SCHEMA_VERSION
  assertSupportedConversationHistorySchemaVersion(schemaVersion)
  return {
    ...input,
    schemaVersion
  }
}

function assertSupportedConversationHistorySchemaVersion(
  schemaVersion: unknown
): asserts schemaVersion is ConversationHistorySchemaVersion | undefined {
  if (
    schemaVersion !== undefined &&
    schemaVersion !== CONVERSATION_HISTORY_LEGACY_SCHEMA_VERSION &&
    schemaVersion !== CONVERSATION_HISTORY_SCHEMA_VERSION
  ) {
    throw new Error(`Unsupported conversation history schema version: ${String(schemaVersion)}`)
  }
}

function trimMessages(messages: ConversationMessage[]): ConversationMessage[] {
  return messages.slice(0, CONVERSATION_HISTORY_MESSAGE_LIMIT)
}

function trimOptional(value: string | undefined, maxChars: number): string | undefined {
  if (value === undefined) return undefined
  return value.slice(0, maxChars)
}
