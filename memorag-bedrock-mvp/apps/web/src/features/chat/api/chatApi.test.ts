import { describe, expect, it, vi } from "vitest"
import { streamChatRunEvents } from "./chatApi.js"

function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    }
  })
}

describe("chatApi streamChatRunEvents", () => {
  it("parses streamed SSE frames, multiline data, and default event type", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      body: streamFrom([
        'id: 1\ndata: {"stage":"search",',
        '"message":"検索中"}\n\n',
        'data: {"message":"完了"}\n\n'
      ])
    }))
    const events: unknown[] = []

    await streamChatRunEvents("run 1", (event) => events.push(event), 0)

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/chat-runs\/run%201\/events$/),
      expect.objectContaining({ method: "GET", headers: { "Last-Event-ID": "0" } })
    )
    expect(events).toEqual([
      { id: 1, type: "message", data: { stage: "search", message: "検索中" } },
      { id: undefined, type: "message", data: { message: "完了" } }
    ])
  })

  it("throws response text when streaming endpoint fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      text: vi.fn().mockResolvedValue("forbidden")
    }))

    await expect(streamChatRunEvents("run-1", vi.fn())).rejects.toThrow("forbidden")
  })
})
