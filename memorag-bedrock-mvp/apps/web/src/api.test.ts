import { describe, expect, it, vi } from "vitest"
import {
  chat,
  answerQuestion,
  assignUserRoles,
  cancelBenchmarkRun,
  createAlias,
  createBenchmarkDownload,
  createQuestion,
  cutoverReindexMigration,
  deleteConversationHistory,
  deleteDocument,
  disableAlias,
  fileToBase64,
  getDebugRun,
  getMe,
  getRuntimeConfig,
  listAliasAuditLog,
  listAliases,
  listBenchmarkRuns,
  listBenchmarkSuites,
  listConversationHistory,
  listDebugRuns,
  listDocuments,
  listQuestions,
  listReindexMigrations,
  publishAliases,
  reviewAlias,
  rollbackReindexMigration,
  resolveQuestion,
  saveConversationHistory,
  setAuthTokenProvider,
  stageReindexMigration,
  startBenchmarkRun,
  updateAlias,
  uploadDocument
} from "./api.js"
import * as api from "./api.js"

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
  it("keeps legacy api.ts value exports available", () => {
    const expectedFunctions = [
      api.getRuntimeConfig,
      api.setAuthTokenProvider,
      api.fileToBase64,
      api.getMe,
      api.listDocuments,
      api.uploadDocument,
      api.deleteDocument,
      api.reindexDocument,
      api.stageReindexMigration,
      api.cutoverReindexMigration,
      api.rollbackReindexMigration,
      api.listReindexMigrations,
      api.chat,
      api.createQuestion,
      api.listQuestions,
      api.listConversationHistory,
      api.saveConversationHistory,
      api.listBenchmarkRuns,
      api.startBenchmarkRun,
      api.listManagedUsers,
      api.assignUserRoles,
      api.listAliases,
      api.createAlias,
      api.publishAliases
    ]

    for (const exported of expectedFunctions) {
      expect(exported).toBeTypeOf("function")
    }

    expect(getRuntimeConfig).toBe(api.getRuntimeConfig)
    expect(setAuthTokenProvider).toBe(api.setAuthTokenProvider)
    expect(getMe).toBe(api.getMe)
    expect(assignUserRoles).toBe(api.assignUserRoles)
  })

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

  it("calls benchmark run management APIs", async () => {
    mockFetch({ suites: [{ suiteId: "standard-agent-v1", label: "Agent standard" }] })
    await expect(listBenchmarkSuites()).resolves.toEqual([{ suiteId: "standard-agent-v1", label: "Agent standard" }])

    mockFetch({ benchmarkRuns: [{ runId: "bench-1", status: "queued" }] })
    await expect(listBenchmarkRuns()).resolves.toEqual([{ runId: "bench-1", status: "queued" }])

    const startFetchMock = mockFetch({ runId: "bench-2", status: "queued" })
    await expect(startBenchmarkRun({ suiteId: "standard-agent-v1", mode: "agent", runner: "codebuild", modelId: "model" })).resolves.toMatchObject({ runId: "bench-2" })
    expect(startFetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/benchmark-runs$/),
      expect.objectContaining({ method: "POST", body: JSON.stringify({ suiteId: "standard-agent-v1", mode: "agent", runner: "codebuild", modelId: "model" }) })
    )

    mockFetch({ runId: "bench-2", status: "cancelled" })
    await expect(cancelBenchmarkRun("bench-2")).resolves.toMatchObject({ status: "cancelled" })

    mockFetch({ url: "https://signed.example/report.md", expiresInSeconds: 900, objectKey: "runs/bench-2/report.md" })
    await expect(createBenchmarkDownload("bench-2", "report")).resolves.toMatchObject({ objectKey: "runs/bench-2/report.md" })
  })

  it("calls alias management APIs", async () => {
    mockFetch({ aliases: [{ aliasId: "alias-1", term: "pto" }] })
    await expect(listAliases()).resolves.toEqual([{ aliasId: "alias-1", term: "pto" }])

    mockFetch({ aliasId: "alias-2", term: "sl" })
    await expect(createAlias({ term: "sl", expansions: ["病気休暇"] })).resolves.toMatchObject({ aliasId: "alias-2" })

    mockFetch({ aliasId: "alias-2", term: "sick leave" })
    await expect(updateAlias("alias-2", { term: "sick leave" })).resolves.toMatchObject({ term: "sick leave" })

    mockFetch({ aliasId: "alias-2", status: "approved" })
    await expect(reviewAlias("alias-2", "approve")).resolves.toMatchObject({ status: "approved" })

    mockFetch({ aliasId: "alias-2", status: "disabled" })
    await expect(disableAlias("alias-2")).resolves.toMatchObject({ status: "disabled" })

    mockFetch({ version: "aliases-20260502T000000Z", aliasCount: 1 })
    await expect(publishAliases()).resolves.toMatchObject({ aliasCount: 1 })

    mockFetch({ auditLog: [{ auditId: "audit-1", action: "publish" }] })
    await expect(listAliasAuditLog()).resolves.toEqual([{ auditId: "audit-1", action: "publish" }])
  })

  it("calls reindex migration APIs", async () => {
    mockFetch({ migrations: [{ migrationId: "reindex-1", status: "staged" }] })
    await expect(listReindexMigrations()).resolves.toEqual([{ migrationId: "reindex-1", status: "staged" }])

    mockFetch({ migrationId: "reindex-1", status: "staged" })
    await expect(stageReindexMigration("doc-1")).resolves.toMatchObject({ migrationId: "reindex-1" })

    mockFetch({ migrationId: "reindex-1", status: "cutover" })
    await expect(cutoverReindexMigration("reindex-1")).resolves.toMatchObject({ status: "cutover" })

    mockFetch({ migrationId: "reindex-1", status: "rolled_back" })
    await expect(rollbackReindexMigration("reindex-1")).resolves.toMatchObject({ status: "rolled_back" })
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
      schemaVersion: 1 as const,
      id: "conversation-1",
      title: "分類について",
      updatedAt: "2026-05-02T00:00:00.000Z",
      messages: [{ role: "user" as const, text: "分類は？", createdAt: "2026-05-02T00:00:00.000Z" }]
    }

    const fetchMock = mockFetch({ history: [item] })
    await expect(listConversationHistory()).resolves.toEqual([item])

    const saveFetchMock = mockFetch(item)
    await expect(saveConversationHistory(item)).resolves.toEqual(item)
    expect(saveFetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/conversation-history$/),
      expect.objectContaining({ method: "POST", body: JSON.stringify(item) })
    )

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
