import { createHeaders } from "../../../shared/api/http.js"
import { getOrpcClient } from "../../../shared/api/orpc.js"
import { getApiBaseUrl } from "../../../shared/api/runtimeConfig.js"
import type { SearchScope } from "../../documents/types.js"
import type { ChatRequest, ChatResponse, ChatRunEvent, ChatRunStartResponse } from "../types-api.js"

export async function chat(input: {
  question: string
  clarificationContext?: {
    originalQuestion?: string
    selectedOptionId?: string
    selectedValue?: string
  }
  modelId: string
  embeddingModelId?: string
  clueModelId?: string
  topK?: number
  minScore?: number
  strictGrounded?: boolean
  useMemory?: boolean
  maxIterations?: number
  includeDebug?: boolean
  searchScope?: SearchScope
} & Pick<ChatRequest, "conversationHistory" | "memoryTopK">): Promise<ChatResponse> {
  return (await getOrpcClient()).chat.create(input)
}

export async function startChatRun(input: {
  question: string
  clarificationContext?: {
    originalQuestion?: string
    selectedOptionId?: string
    selectedValue?: string
  }
  modelId: string
  embeddingModelId?: string
  clueModelId?: string
  topK?: number
  minScore?: number
  strictGrounded?: boolean
  useMemory?: boolean
  maxIterations?: number
  includeDebug?: boolean
  searchScope?: SearchScope
} & Pick<ChatRequest, "conversationHistory" | "memoryTopK">): Promise<ChatRunStartResponse> {
  return (await getOrpcClient()).chat.startRun(input)
}

export async function streamChatRunEvents(
  runId: string,
  onEvent: (event: ChatRunEvent) => void,
  lastEventId?: number
): Promise<void> {
  const apiBaseUrl = await getApiBaseUrl()
  const headers = createHeaders()
  if (lastEventId !== undefined) {
    ;(headers as Record<string, string>)["Last-Event-ID"] = String(lastEventId)
  }

  const response = await fetch(`${apiBaseUrl}/chat-runs/${encodeURIComponent(runId)}/events`, {
    method: "GET",
    headers
  })
  if (!response.ok) throw new Error(await response.text())

  if (!response.body) {
    parseSseFrames(await response.text(), onEvent)
    return
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ""

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += value
    const frames = buffer.split("\n\n")
    buffer = frames.pop() ?? ""
    parseSseFrames(frames.join("\n\n"), onEvent)
  }

  if (buffer.trim()) parseSseFrames(buffer, onEvent)
}

function parseSseFrames(input: string, onEvent: (event: ChatRunEvent) => void) {
  for (const frame of input.split("\n\n").filter((value) => value.trim())) {
    const lines = frame.split("\n")
    const idLine = lines.find((line) => line.startsWith("id: "))
    const eventLine = lines.find((line) => line.startsWith("event: "))
    const dataLines = lines.filter((line) => line.startsWith("data: ")).map((line) => line.slice(6))
    const rawData = dataLines.join("\n")
    onEvent({
      id: idLine ? Number(idLine.slice(4)) : undefined,
      type: eventLine?.slice(7) ?? "message",
      data: rawData ? (JSON.parse(rawData) as Record<string, unknown>) : {}
    })
  }
}
