import { describe, expect, it, vi } from "vitest"
import {
  chat,
  answerQuestion,
  createQuestion,
  deleteConversationHistory,
  deleteDocument,
  fileToBase64,
  getDebugRun,
  listConversationHistory,
  listDebugRuns,
  listDocuments,
  listQuestions,
  resolveQuestion,
  saveConversationHistory,
  uploadDocument
} from "./api.js"

function mockFetch(response: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    json: vi.fn().mockResolvedValue(response),
    text: vi.fn().mockResolvedValue(typeof response === "string" ? response : JSON.stringify(response))
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

describe("API client", () => {
  it("loads runtime config once and calls document APIs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ apiBaseUrl: "http://api.example.test/" }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ documents: [{ documentId: "doc-1", fileName: "a.txt" }] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ documentId: "doc-2", fileName: "b.txt", chunkCount: 1, memoryCardCount: 1, createdAt: "now" })
      })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue("") })

    vi.stubGlobal("fetch", fetchMock)

    await expect(listDocuments()).resolves.toEqual([{ documentId: "doc-1", fileName: "a.txt" }])
    await expect(uploadDocument({ fileName: "b.txt", text: "body" })).resolves.toMatchObject({ documentId: "doc-2" })
    await expect(deleteDocument("doc-2")).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://api.example.test/documents", { headers: {} })
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://api.example.test/documents",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: "b.txt", text: "body" })
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(4, "http://api.example.test/documents/doc-2", { method: "DELETE", headers: {} })
  })

  it("calls chat and debug trace endpoints", async () => {
    const fetchMock = mockFetch({ answer: "ok", isAnswerable: true, citations: [], retrieved: [] })

    await expect(chat({ question: "期限は？", modelId: "model", includeDebug: true })).resolves.toMatchObject({ answer: "ok" })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/chat$/),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ question: "期限は？", modelId: "model", includeDebug: true })
      })
    )

    mockFetch({ debugRuns: [{ runId: "run-1" }] })
    await expect(listDebugRuns()).resolves.toEqual([{ runId: "run-1" }])

    mockFetch({ runId: "run-1" })
    await expect(getDebugRun("run-1")).resolves.toEqual({ runId: "run-1" })
  })

  it("raises response text on failed requests", async () => {
    mockFetch("boom", false)
    await expect(deleteDocument("missing")).rejects.toThrow("boom")
  })

  it("falls back to localhost when runtime config cannot be loaded", async () => {
    vi.resetModules()
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("missing config"))
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ documents: [] }) })
    vi.stubGlobal("fetch", fetchMock)

    const freshApi = await import("./api.js")
    await expect(freshApi.listDocuments()).resolves.toEqual([])

    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://localhost:8787/documents", expect.objectContaining({ headers: {} }))
  })

  it("falls back to localhost when runtime config is not ok", async () => {
    vi.resetModules()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: vi.fn().mockResolvedValue({}) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ questions: undefined }) })
    vi.stubGlobal("fetch", fetchMock)

    const freshApi = await import("./api.js")
    await expect(freshApi.listQuestions()).resolves.toEqual([])

    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://localhost:8787/questions", expect.objectContaining({ headers: {} }))
  })

  it("calls human question APIs", async () => {
    const fetchMock = mockFetch({ questionId: "question-1", status: "open" })
    await expect(createQuestion({ title: "確認", question: "質問" })).resolves.toMatchObject({ questionId: "question-1" })

    mockFetch({ questions: [{ questionId: "question-1" }] })
    await expect(listQuestions()).resolves.toEqual([{ questionId: "question-1" }])

    mockFetch({ questionId: "question-1", status: "answered" })
    await expect(answerQuestion("question-1", { answerTitle: "回答", answerBody: "本文" })).resolves.toMatchObject({ status: "answered" })

    mockFetch({ questionId: "question-1", status: "resolved" })
    await expect(resolveQuestion("question-1")).resolves.toMatchObject({ status: "resolved" })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/questions$/),
      expect.objectContaining({ method: "POST" })
    )
  })

  it("calls conversation history APIs", async () => {
    const item = {
      id: "conversation-1",
      title: "分類について",
      updatedAt: "2026-05-02T00:00:00.000Z",
      messages: [{ role: "user" as const, text: "分類は？", createdAt: "2026-05-02T00:00:00.000Z" }]
    }

    const fetchMock = mockFetch({ history: [item] })
    await expect(listConversationHistory()).resolves.toEqual([item])

    mockFetch(item)
    await expect(saveConversationHistory(item)).resolves.toEqual(item)

    mockFetch({ id: item.id })
    await expect(deleteConversationHistory(item.id)).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/conversation-history$/), expect.objectContaining({ headers: {} }))
  })

  it("uses Vite env API base URL and raises GET/POST errors", async () => {
    vi.resetModules()
    vi.stubEnv("VITE_API_BASE_URL", "http://env-api.test/")
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, text: vi.fn().mockResolvedValue("list failed") })
      .mockResolvedValueOnce({ ok: false, text: vi.fn().mockResolvedValue("post failed") })
    vi.stubGlobal("fetch", fetchMock)

    const freshApi = await import("./api.js")
    await expect(freshApi.listDocuments()).rejects.toThrow("list failed")
    await expect(freshApi.chat({ question: "q", modelId: "m" })).rejects.toThrow("post failed")

    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://env-api.test/documents", expect.objectContaining({ headers: {} }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://env-api.test/chat", expect.objectContaining({ method: "POST" }))
  })

  it("converts files to base64 payloads", async () => {
    const result = await fileToBase64(new File(["hello"], "hello.txt", { type: "text/plain" }))
    expect(atob(result)).toBe("hello")
  })

  it("supports FileReader results without data URL prefix and rejects read errors", async () => {
    const OriginalFileReader = FileReader

    class PlainFileReader {
      result: string | null = null
      error: Error | null = null
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsDataURL() {
        this.result = "plain-value"
        this.onload?.()
      }
    }

    vi.stubGlobal("FileReader", PlainFileReader)
    await expect(fileToBase64(new File(["ignored"], "plain.txt"))).resolves.toBe("plain-value")

    class ErrorFileReader extends PlainFileReader {
      override readAsDataURL() {
        this.error = new Error("read failed")
        this.onerror?.()
      }
    }

    vi.stubGlobal("FileReader", ErrorFileReader)
    await expect(fileToBase64(new File(["ignored"], "bad.txt"))).rejects.toThrow("read failed")
    vi.stubGlobal("FileReader", OriginalFileReader)
  })
})
