import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import App from "./App.js"
import type { AliasAuditLogItem, AliasDefinition, ConversationHistoryItem, HumanQuestion, Permission } from "./api.js"

const documents = [
  { documentId: "doc-1", fileName: "requirements.md", chunkCount: 2, memoryCardCount: 1, createdAt: "2026-04-30T00:00:00.000Z" },
  { documentId: "doc-2", fileName: "policy.md", chunkCount: 1, memoryCardCount: 1, createdAt: "2026-04-29T00:00:00.000Z" }
]

const longFinalizeResponse = `ソフトウェア要求は製品要求とプロジェクト要求に分類されます。${"分類根拠。".repeat(220)}END_OF_FINALIZE_RESPONSE`

const debugTrace = {
  schemaVersion: 1 as const,
  runId: "run/with:unsafe*chars",
  question: "ソフトウェア要求の分類を洗い出して",
  modelId: "amazon.nova-lite-v1:0",
  embeddingModelId: "amazon.titan-embed-text-v2:0",
  clueModelId: "amazon.nova-lite-v1:0",
  topK: 6,
  memoryTopK: 4,
  minScore: 0.2,
  startedAt: "2026-04-30T00:00:00.000Z",
  completedAt: "2026-04-30T00:00:01.250Z",
  totalLatencyMs: 1250,
  status: "warning" as const,
  answerPreview: "",
  isAnswerable: false,
  citations: [],
  retrieved: [
    {
      documentId: "doc-1",
      fileName: "requirements.md",
      chunkId: "chunk-0001",
      score: 0.91,
      text: "ソフトウェア要求の分類"
    }
  ],
  steps: [
    {
      id: 1,
      label: "retrieve_memory",
      status: "success" as const,
      latencyMs: 25,
      modelId: "amazon.titan-embed-text-v2:0",
      summary: "memoryを検索しました。",
      hitCount: 2,
      startedAt: "2026-04-30T00:00:00.000Z",
      completedAt: "2026-04-30T00:00:00.025Z"
    },
    {
      id: 2,
      label: "answerability_gate",
      status: "warning" as const,
      latencyMs: 1225,
      summary: "根拠不足です。",
      detail: "low_similarity_score",
      output: {
        answerability: {
          reason: "low_similarity_score",
          confidence: 0.42
        }
      },
      tokenCount: 12,
      startedAt: "2026-04-30T00:00:00.025Z",
      completedAt: "2026-04-30T00:00:01.250Z"
    }
  ]
}

const answerableDebugTrace = {
  ...debugTrace,
  status: "success" as const,
  answerPreview: longFinalizeResponse,
  isAnswerable: true,
  steps: [
    ...debugTrace.steps,
    {
      id: 3,
      label: "finalize_response",
      status: "success" as const,
      latencyMs: 9,
      summary: "finalized",
      detail: longFinalizeResponse,
      tokenCount: 430,
      startedAt: "2026-04-30T00:00:01.250Z",
      completedAt: "2026-04-30T00:00:01.259Z"
    }
  ]
}

const humanQuestion: HumanQuestion = {
  questionId: "question-1",
  title: "山田さんの昼食について確認したい",
  question: "今日山田さんは何を食べたか、担当者に確認してください。",
  requesterName: "山田 太郎",
  requesterUserId: "user-1",
  requesterDepartment: "利用部門",
  assigneeDepartment: "総務部",
  category: "その他の質問",
  priority: "normal" as const,
  status: "open" as const,
  sourceQuestion: "今日山田さんは何を食べた?",
  chatAnswer: "資料からは回答できません。",
  createdAt: "2026-04-30T00:00:00.000Z",
  updatedAt: "2026-04-30T00:00:00.000Z"
}

const answeredHumanQuestion: HumanQuestion = {
  ...humanQuestion,
  status: "answered" as const,
  answerTitle: "山田さんの昼食についての回答",
  answerBody: "山田さんは本日、社内食堂でカレーを食べました。",
  responderName: "佐藤 花子",
  responderDepartment: "総務部",
  references: "社内食堂メニュー表",
  answeredAt: "2026-04-30T00:03:16.000Z",
  updatedAt: "2026-04-30T00:03:16.000Z"
}

function response(body: unknown, ok = true) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === "string" ? body : JSON.stringify(body))
  }
}

function isGet(init?: RequestInit) {
  return !init?.method || init.method === "GET"
}

function assertElement(value: Element | undefined): asserts value is Element {
  if (!value) throw new Error("Expected element")
}

function jwtWithGroups(groups: string[]) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url")
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ sub: "user-1", email: "tester@example.com", "cognito:groups": groups })}.signature`
}

const rolePermissions: Record<string, Permission[]> = {
  CHAT_USER: ["chat:create", "chat:read:own", "chat:read:shared", "chat:share:own", "chat:delete:own", "usage:read:own", "cost:read:own", "rag:doc:read"],
  ANSWER_EDITOR: ["answer:edit", "answer:publish"],
  RAG_GROUP_MANAGER: [
    "rag:doc:read", "rag:doc:write:group", "rag:doc:delete:group", "rag:index:rebuild:group",
    "rag:alias:read", "rag:alias:write:group", "rag:alias:review:group", "rag:alias:disable:group", "rag:alias:publish:group",
    "benchmark:read", "benchmark:run"
  ],
  BENCHMARK_RUNNER: ["benchmark:query"],
  USER_ADMIN: ["user:create", "user:read", "user:suspend", "user:unsuspend", "user:delete", "usage:read:all_users"],
  ACCESS_ADMIN: ["access:role:create", "access:role:update", "access:role:assign", "access:policy:read"],
  COST_AUDITOR: ["cost:read:all"],
  SYSTEM_ADMIN: [
    "chat:create", "chat:read:own", "chat:read:shared", "chat:share:own", "chat:delete:own", "chat:admin:read_all",
    "answer:edit", "answer:publish", "rag:group:create", "rag:group:assign_manager", "rag:doc:read", "rag:doc:write:group", "rag:doc:delete:group", "rag:index:rebuild:group",
    "rag:alias:read", "rag:alias:write:group", "rag:alias:review:group", "rag:alias:disable:group", "rag:alias:publish:group",
    "benchmark:read", "benchmark:query", "benchmark:run", "benchmark:cancel", "benchmark:download",
    "usage:read:own", "usage:read:all_users", "cost:read:own", "cost:read:all", "user:create", "user:read", "user:suspend", "user:unsuspend", "user:delete",
    "access:role:create", "access:role:update", "access:role:assign", "access:policy:read"
  ]
}

function currentUserResponse(groups = ["SYSTEM_ADMIN"]) {
  return {
    user: {
      userId: "local-dev",
      email: "tester@example.com",
      groups,
      permissions: [...new Set(groups.flatMap((group) => rolePermissions[group] ?? []))]
    }
  }
}

function mockAppFetch(groups = ["SYSTEM_ADMIN"]) {
  let storedHistory: ConversationHistoryItem[] = []
  let managedUsers = [
    {
      userId: "local-dev",
      email: "tester@example.com",
      displayName: "tester",
      status: "active",
      groups,
      createdAt: "2026-05-02T00:00:00.000Z",
      updatedAt: "2026-05-02T00:00:00.000Z",
      lastLoginAt: "2026-05-02T00:00:00.000Z"
    }
  ]
  let aliases: AliasDefinition[] = [
    {
      aliasId: "alias-1",
      term: "pto",
      expansions: ["有給休暇"],
      status: "draft" as const,
      createdBy: "local-dev",
      createdAt: "2026-05-02T00:00:00.000Z",
      updatedAt: "2026-05-02T00:00:00.000Z"
    }
  ]
  let aliasAuditLog: AliasAuditLogItem[] = [
    {
      auditId: "audit-1",
      aliasId: "alias-1",
      action: "create" as const,
      actorUserId: "local-dev",
      createdAt: "2026-05-02T00:00:00.000Z",
      detail: "created pto"
    }
  ]
  let reindexMigrations: unknown[] = []
  let adminAuditLog: unknown[] = []
  const roles = Object.entries(rolePermissions).map(([role, permissions]) => ({ role, permissions }))
  const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = String(url)
    if (requestUrl === "/config.json") return Promise.resolve(response({ apiBaseUrl: "http://api.test" }))
    if (requestUrl.endsWith("/me") && isGet(init)) return Promise.resolve(response(currentUserResponse(groups)))
    if (requestUrl.endsWith("/admin/users") && isGet(init)) return Promise.resolve(response({ users: managedUsers }))
    if (requestUrl.endsWith("/admin/audit-log") && isGet(init)) return Promise.resolve(response({ auditLog: adminAuditLog }))
    if (requestUrl.endsWith("/admin/roles") && isGet(init)) return Promise.resolve(response({ roles }))
    if (requestUrl.endsWith("/admin/usage") && isGet(init)) {
      return Promise.resolve(response({ users: [{ userId: "local-dev", email: "tester@example.com", chatMessages: 12, conversationCount: 3, questionCount: 1, documentCount: 2, benchmarkRunCount: 0, debugRunCount: 0, lastActivityAt: "2026-05-02T00:00:00.000Z" }] }))
    }
    if (requestUrl.endsWith("/admin/costs") && isGet(init)) {
      return Promise.resolve(response({ periodStart: "2026-05-01T00:00:00.000Z", periodEnd: "2026-05-02T00:00:00.000Z", currency: "USD", totalEstimatedUsd: 0.0123, pricingCatalogUpdatedAt: "2026-05-02T00:00:00.000Z", users: [{ userId: "local-dev", email: "tester@example.com", estimatedCostUsd: 0.0123 }], items: [{ service: "Bedrock", category: "chat completion", usage: 12, unit: "message", unitCostUsd: 0.0008, estimatedCostUsd: 0.0096, confidence: "estimated_usage" }] }))
    }
    if (requestUrl.endsWith("/admin/aliases") && isGet(init)) return Promise.resolve(response({ aliases }))
    if (requestUrl.endsWith("/admin/aliases/audit-log") && isGet(init)) return Promise.resolve(response({ auditLog: aliasAuditLog }))
    if (requestUrl.endsWith("/admin/aliases") && init?.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}"))
      const alias: AliasDefinition = { aliasId: "alias-2", ...body, status: "draft", createdBy: "local-dev", createdAt: "2026-05-02T00:01:00.000Z", updatedAt: "2026-05-02T00:01:00.000Z" }
      aliases = [alias, ...aliases]
      return Promise.resolve(response(alias))
    }
    if (requestUrl.endsWith("/admin/aliases/alias-1/review") && init?.method === "POST") {
      aliases = aliases.map((alias) => (alias.aliasId === "alias-1" ? { ...alias, status: "approved", reviewedBy: "local-dev", reviewedAt: "2026-05-02T00:02:00.000Z", updatedAt: "2026-05-02T00:02:00.000Z" } : alias))
      return Promise.resolve(response(aliases[0]))
    }
    if (requestUrl.endsWith("/admin/aliases/publish") && init?.method === "POST") {
      aliases = aliases.map((alias) => (alias.status === "approved" ? { ...alias, publishedVersion: "aliases-20260502T000300Z" } : alias))
      aliasAuditLog = [{ auditId: "audit-2", action: "publish", actorUserId: "local-dev", createdAt: "2026-05-02T00:03:00.000Z", detail: "published 1 aliases" }, ...aliasAuditLog]
      return Promise.resolve(response({ version: "aliases-20260502T000300Z", publishedAt: "2026-05-02T00:03:00.000Z", aliasCount: 1 }))
    }
    if (requestUrl.endsWith("/admin/users") && init?.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}"))
      const created = {
        userId: String(body.email).replace(/[^a-z0-9._-]/gi, "-").toLowerCase(),
        email: body.email,
        displayName: body.displayName || String(body.email).split("@")[0],
        status: "active",
        groups: body.groups ?? ["CHAT_USER"],
        createdAt: "2026-05-02T00:03:00.000Z",
        updatedAt: "2026-05-02T00:03:00.000Z",
        lastLoginAt: "2026-05-02T00:03:00.000Z"
      }
      managedUsers = [...managedUsers, created].sort((a, b) => a.email.localeCompare(b.email))
      adminAuditLog = [{ auditId: "audit-create", action: "user:create", actorUserId: "local-dev", actorEmail: "tester@example.com", targetUserId: created.userId, targetEmail: created.email, beforeGroups: [], afterGroups: created.groups, afterStatus: "active", createdAt: "2026-05-02T00:03:00.000Z" }, ...adminAuditLog]
      return Promise.resolve(response(created))
    }
    if (requestUrl.endsWith("/admin/users/local-dev/roles") && init?.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}"))
      managedUsers = managedUsers.map((user) => (user.userId === "local-dev" ? { ...user, groups: body.groups, updatedAt: "2026-05-02T00:01:00.000Z" } : user))
      adminAuditLog = [{ auditId: "audit-role", action: "role:assign", actorUserId: "local-dev", actorEmail: "tester@example.com", targetUserId: "local-dev", targetEmail: "tester@example.com", beforeGroups: groups, afterGroups: body.groups, createdAt: "2026-05-02T00:01:00.000Z" }, ...adminAuditLog]
      return Promise.resolve(response(managedUsers[0]))
    }
    if (requestUrl.endsWith("/admin/users/local-dev/suspend") && init?.method === "POST") {
      managedUsers = managedUsers.map((user) => (user.userId === "local-dev" ? { ...user, status: "suspended", updatedAt: "2026-05-02T00:01:00.000Z" } : user))
      adminAuditLog = [{ auditId: "audit-suspend", action: "user:suspend", actorUserId: "local-dev", actorEmail: "tester@example.com", targetUserId: "local-dev", targetEmail: "tester@example.com", beforeStatus: "active", afterStatus: "suspended", beforeGroups: groups, afterGroups: groups, createdAt: "2026-05-02T00:01:00.000Z" }, ...adminAuditLog]
      return Promise.resolve(response(managedUsers[0]))
    }
    if (requestUrl.endsWith("/admin/users/local-dev/unsuspend") && init?.method === "POST") {
      managedUsers = managedUsers.map((user) => (user.userId === "local-dev" ? { ...user, status: "active", updatedAt: "2026-05-02T00:02:00.000Z" } : user))
      adminAuditLog = [{ auditId: "audit-unsuspend", action: "user:unsuspend", actorUserId: "local-dev", actorEmail: "tester@example.com", targetUserId: "local-dev", targetEmail: "tester@example.com", beforeStatus: "suspended", afterStatus: "active", beforeGroups: groups, afterGroups: groups, createdAt: "2026-05-02T00:02:00.000Z" }, ...adminAuditLog]
      return Promise.resolve(response(managedUsers[0]))
    }
    if (requestUrl.endsWith("/admin/users/local-dev") && init?.method === "DELETE") {
      const deleted = { ...managedUsers.find((user) => user.userId === "local-dev")!, status: "deleted", updatedAt: "2026-05-02T00:04:00.000Z" }
      managedUsers = managedUsers.filter((user) => user.userId !== "local-dev")
      adminAuditLog = [{ auditId: "audit-delete", action: "user:delete", actorUserId: "local-dev", actorEmail: "tester@example.com", targetUserId: "local-dev", targetEmail: "tester@example.com", beforeStatus: "active", afterStatus: "deleted", beforeGroups: groups, afterGroups: groups, createdAt: "2026-05-02T00:04:00.000Z" }, ...adminAuditLog]
      return Promise.resolve(response(deleted))
    }
    if (requestUrl.endsWith("/documents") && isGet(init)) return Promise.resolve(response({ documents }))
    if (requestUrl.endsWith("/documents/reindex-migrations") && isGet(init)) return Promise.resolve(response({ migrations: reindexMigrations }))
    if (requestUrl.endsWith("/documents/doc-1/reindex/stage") && init?.method === "POST") {
      const migration = {
        migrationId: "reindex-1",
        sourceDocumentId: "doc-1",
        stagedDocumentId: "doc-stage-1",
        status: "staged",
        createdBy: "local-dev",
        createdAt: "2026-05-02T00:04:00.000Z",
        updatedAt: "2026-05-02T00:04:00.000Z",
        previousManifestObjectKey: "manifests/doc-1.json",
        stagedManifestObjectKey: "manifests/doc-stage-1.json"
      }
      reindexMigrations = [migration]
      return Promise.resolve(response(migration))
    }
    if (requestUrl.endsWith("/documents/reindex-migrations/reindex-1/cutover") && init?.method === "POST") {
      reindexMigrations = reindexMigrations.map((migration) => ({ ...(migration as Record<string, unknown>), status: "cutover", activeDocumentId: "doc-stage-1", updatedAt: "2026-05-02T00:05:00.000Z" }))
      return Promise.resolve(response(reindexMigrations[0]))
    }
    if (requestUrl.endsWith("/debug-runs") && isGet(init)) return Promise.resolve(response({ debugRuns: [] }))
    if (requestUrl.endsWith("/benchmark-suites") && isGet(init)) return Promise.resolve(response({ suites: [{ suiteId: "standard-agent-v1", label: "Agent standard", mode: "agent", datasetS3Key: "datasets/agent/standard-v1.jsonl", preset: "standard", defaultConcurrency: 1 }] }))
    if (requestUrl.endsWith("/benchmark-runs") && isGet(init)) return Promise.resolve(response({ benchmarkRuns: [] }))
    if (requestUrl.endsWith("/benchmark-runs") && init?.method === "POST") {
      return Promise.resolve(response({ runId: "bench-1", status: "queued", suiteId: "standard-agent-v1", mode: "agent", runner: "codebuild", datasetS3Key: "datasets/agent/standard-v1.jsonl", createdBy: "user-1", createdAt: "2026-05-02T00:00:00.000Z", updatedAt: "2026-05-02T00:00:00.000Z", reportS3Key: "runs/bench-1/report.md" }))
    }
    if (requestUrl.endsWith("/benchmark-runs/bench-1/download") && init?.method === "POST") return Promise.resolve(response({ url: "https://signed.example/report.md", expiresInSeconds: 900, objectKey: "runs/bench-1/report.md" }))
    if (requestUrl.endsWith("/conversation-history") && isGet(init)) return Promise.resolve(response({ history: storedHistory }))
    if (requestUrl.endsWith("/conversation-history") && init?.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}")) as ConversationHistoryItem
      storedHistory = [body, ...storedHistory.filter((item) => item.id !== body.id)]
      return Promise.resolve(response(body))
    }
    if (requestUrl.includes("/conversation-history/") && init?.method === "DELETE") {
      const id = decodeURIComponent(requestUrl.split("/conversation-history/")[1] ?? "")
      storedHistory = storedHistory.filter((item) => item.id !== id)
      return Promise.resolve(response({ id }))
    }
    if (requestUrl.endsWith("/documents/doc-1") && init?.method === "DELETE") return Promise.resolve(response({ documentId: "doc-1", deletedVectorCount: 3 }))
    if (requestUrl.endsWith("/documents") && init?.method === "POST") {
      return Promise.resolve(response({ documentId: "doc-3", fileName: "upload.txt", chunkCount: 1, memoryCardCount: 1, createdAt: "now" }))
    }
    if (requestUrl.endsWith("/debug-runs/run-1/download") && init?.method === "POST") return Promise.resolve(response({ url: "https://signed.example/debug.json", expiresInSeconds: 900, objectKey: "downloads/debug.json" }))
    if (requestUrl.endsWith("/chat") && init?.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}")) as { includeDebug?: boolean }
      return Promise.resolve(
        response({
          answer: "ソフトウェア要求は製品要求とプロジェクト要求に分類されます。",
          isAnswerable: true,
          citations: [
            {
              documentId: "doc-1",
              fileName: "requirements.md",
              chunkId: "chunk-0001",
              score: 0.91,
              text: "ソフトウェア要求の分類"
            }
          ],
          retrieved: [],
          debug: body.includeDebug ? answerableDebugTrace : undefined
        })
      )
    }
    return Promise.resolve(response({}))
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}


async function selectDocument(documentId: string) {
  await screen.findByRole("option", { name: "requirements.md" })
  await userEvent.selectOptions(screen.getByLabelText("ドキュメント"), documentId)
}

async function renderAuthenticatedApp() {
  vi.stubEnv("VITE_AUTH_MODE", "local")
  render(<App />)
  await userEvent.type(screen.getByPlaceholderText("メールアドレスを入力"), "tester@example.com")
  await userEvent.type(screen.getByPlaceholderText("パスワードを入力"), "Password123!")
  await userEvent.click(screen.getByRole("button", { name: "サインイン" }))
}

function findRequest(fetchMock: ReturnType<typeof vi.fn>, suffix: string, method = "GET") {
  return fetchMock.mock.calls.find(([url, init]) => {
    const requestMethod = (init as RequestInit | undefined)?.method ?? "GET"
    return String(url).endsWith(suffix) && requestMethod === method
  })
}

function requestBodies(fetchMock: ReturnType<typeof vi.fn>, suffix: string, method = "POST") {
  return fetchMock.mock.calls
    .filter(([url, init]) => String(url).endsWith(suffix) && ((init as RequestInit | undefined)?.method ?? "GET") === method)
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)))
}

function requestBody(call: unknown[] | undefined) {
  expect(call).toBeTruthy()
  return JSON.parse(String((call?.[1] as RequestInit).body))
}

describe("App document management", () => {
  it("shows copy buttons and copies prompt/answer text", async () => {
    mockAppFetch()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { clipboard: { writeText } })

    await renderAuthenticatedApp()

    await userEvent.type(screen.getByLabelText("質問"), "分類を教えて")
    await userEvent.click(screen.getByTitle("送信"))

    await screen.findByText("ソフトウェア要求は製品要求とプロジェクト要求に分類されます。")

    await userEvent.click(screen.getByTitle("プロンプトをコピー"))
    expect(writeText).toHaveBeenCalledWith("分類を教えて")
    const copiedPromptButton = await screen.findByTitle("プロンプトをコピー済み")
    expect(copiedPromptButton.querySelector(".icon-check")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "回答をコピー" }))
    expect(writeText).toHaveBeenCalledWith("ソフトウェア要求は製品要求とプロジェクト要求に分類されます。")
    const copiedAnswerButton = await screen.findByRole("button", { name: "回答をコピー済み" })
    expect(copiedAnswerButton.querySelector(".icon-check")).toBeInTheDocument()

    expect(screen.queryByTitle("高評価")).not.toBeInTheDocument()
    expect(screen.queryByTitle("低評価")).not.toBeInTheDocument()
    expect(screen.queryByTitle("共有")).not.toBeInTheDocument()
  })

  it("routes document operations to the documents workspace", async () => {
    mockAppFetch()
    await renderAuthenticatedApp()

    await screen.findByRole("option", { name: "requirements.md" })
    expect(screen.queryByTitle("requirements.mdを削除")).not.toBeInTheDocument()

    await userEvent.click(screen.getByTitle("ドキュメント"))
    expect(await screen.findByLabelText("ドキュメント管理")).toBeInTheDocument()
    expect(screen.getByText("登録文書")).toBeInTheDocument()
    expect(screen.getByTitle("requirements.mdを削除")).toBeEnabled()
  })

  it("deletes selected document only after confirmation and refreshes the list", async () => {
    const fetchMock = mockAppFetch()
    const confirmMock = vi.spyOn(window, "confirm").mockReturnValue(true)
    await renderAuthenticatedApp()

    await userEvent.click(await screen.findByTitle("ドキュメント"))
    await userEvent.click(screen.getByTitle("requirements.mdを削除"))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "http://api.test/documents/doc-1",
        expect.objectContaining({ method: "DELETE", headers: { Authorization: "Bearer local-dev-token" } })
      )
    )
    expect(confirmMock).toHaveBeenCalledWith("「requirements.md」を削除します。元資料、manifest、検索ベクトルが削除されます。")
  })

  it("does not call DELETE when deletion is cancelled", async () => {
    const fetchMock = mockAppFetch()
    vi.spyOn(window, "confirm").mockReturnValue(false)
    await renderAuthenticatedApp()

    await userEvent.click(await screen.findByTitle("ドキュメント"))
    await userEvent.click(screen.getByTitle("requirements.mdを削除"))

    expect(
      fetchMock.mock.calls.some(([url, init]) => String(url) === "http://api.test/documents/doc-1" && (init as RequestInit | undefined)?.method === "DELETE")
    ).toBe(false)
  })

  it("shows API errors during deletion", async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url)
      if (requestUrl === "/config.json") return Promise.resolve(response({ apiBaseUrl: "http://api.test" }))
      if (requestUrl.endsWith("/me") && isGet(init)) return Promise.resolve(response(currentUserResponse()))
      if (requestUrl.endsWith("/documents") && isGet(init)) return Promise.resolve(response({ documents }))
      if (requestUrl.endsWith("/debug-runs") && isGet(init)) return Promise.resolve(response({ debugRuns: [] }))
      if (requestUrl.endsWith("/documents/doc-1") && init?.method === "DELETE") return Promise.resolve(response("delete failed", false))
      return Promise.resolve(response({}))
    })
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(window, "confirm").mockReturnValue(true)
    await renderAuthenticatedApp()

    await userEvent.click(await screen.findByTitle("ドキュメント"))
    await userEvent.click(screen.getByTitle("requirements.mdを削除"))

    expect(await screen.findByText("delete failed")).toBeInTheDocument()
  })

  it("uploads documents from the documents workspace", async () => {
    const fetchMock = mockAppFetch()
    await renderAuthenticatedApp()

    await userEvent.click(await screen.findByTitle("ドキュメント"))
    const input = screen.getByLabelText("文書アップロード").querySelector<HTMLInputElement>('input[type="file"]')
    await userEvent.upload(input as HTMLInputElement, new File(["管理資料"], "admin-upload.txt", { type: "text/plain" }))
    await userEvent.click(screen.getByRole("button", { name: "アップロード" }))

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/documents") && (init as RequestInit | undefined)?.method === "POST")
      ).toBe(true)
    )
  })

  it("resets a selected document when refresh no longer returns it", async () => {
    let documentListCalls = 0
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url)
      if (requestUrl === "/config.json") return Promise.resolve(response({ apiBaseUrl: "http://api.test" }))
      if (requestUrl.endsWith("/me") && isGet(init)) return Promise.resolve(response(currentUserResponse()))
      if (requestUrl.endsWith("/documents") && isGet(init)) {
        documentListCalls += 1
        return Promise.resolve(response({ documents: documentListCalls === 1 ? documents : [documents[1]] }))
      }
      if (requestUrl.endsWith("/debug-runs") && isGet(init)) return Promise.resolve(response({ debugRuns: [] }))
      if (requestUrl.endsWith("/documents") && init?.method === "POST") {
        return Promise.resolve(response({ documentId: "doc-3", fileName: "upload.txt", chunkCount: 1, memoryCardCount: 1, createdAt: "now" }))
      }
      return Promise.resolve(response({}))
    })
    vi.stubGlobal("fetch", fetchMock)
    await renderAuthenticatedApp()

    await selectDocument("doc-1")
    const input = (await screen.findByTitle("資料を添付")).querySelector<HTMLInputElement>('input[type="file"]')
    await userEvent.upload(input as HTMLInputElement, new File(["資料"], "refresh.txt", { type: "text/plain" }))
    await userEvent.click(screen.getByTitle("送信"))

    await screen.findByText("資料を取り込みました。知りたいことを入力してください。")
    expect(screen.getByLabelText("ドキュメント")).toHaveValue("all")
  })
})

describe("App chat and upload flow", () => {
  it("starts with an empty composer and disabled send action", async () => {
    mockAppFetch()
    await renderAuthenticatedApp()

    expect(await screen.findByTitle("送信")).toBeDisabled()
    expect(screen.getByLabelText("質問")).toHaveValue("")
  })

  it("keeps the chat request payload unchanged", async () => {
    const fetchMock = mockAppFetch()
    await renderAuthenticatedApp()

    await userEvent.type(screen.getByLabelText("質問"), "ソフトウェア要求の分類を洗い出して")
    await userEvent.click(screen.getByTitle("送信"))

    await screen.findByText("ソフトウェア要求は製品要求とプロジェクト要求に分類されます。")

    expect(requestBody(findRequest(fetchMock, "/chat", "POST"))).toEqual({
      question: "ソフトウェア要求の分類を洗い出して",
      modelId: "amazon.nova-lite-v1:0",
      embeddingModelId: "amazon.titan-embed-text-v2:0",
      clueModelId: "amazon.nova-lite-v1:0",
      topK: 6,
      minScore: 0.2,
      includeDebug: false
    })
  })

  it("adds includeDebug to the chat request only when debug mode is enabled", async () => {
    const fetchMock = mockAppFetch()
    await renderAuthenticatedApp()

    await userEvent.click(await screen.findByRole("checkbox"))
    await userEvent.type(screen.getByLabelText("質問"), "分類を教えて")
    await userEvent.click(screen.getByTitle("送信"))

    await screen.findByText("ソフトウェア要求は製品要求とプロジェクト要求に分類されます。")

    expect(requestBody(findRequest(fetchMock, "/chat", "POST"))).toMatchObject({ includeDebug: true })
  })

  it("uploads an attached file and answers a question from citations", async () => {
    const fetchMock = mockAppFetch()
    await renderAuthenticatedApp()

    const input = (await screen.findByTitle("資料を添付")).querySelector<HTMLInputElement>('input[type="file"]')
    expect(input).toBeTruthy()
    await userEvent.upload(input as HTMLInputElement, new File(["要求分類"], "upload.txt", { type: "text/plain" }))
    await userEvent.type(screen.getByLabelText("質問"), "ソフトウェア要求の分類を洗い出して")
    await userEvent.click(screen.getByTitle("送信"))

    await screen.findByText("ソフトウェア要求は製品要求とプロジェクト要求に分類されます。")
    expect(screen.getAllByText("requirements.md").length).toBeGreaterThanOrEqual(2)

    const uploadCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/documents") && (init as RequestInit | undefined)?.method === "POST")
    const chatCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/chat") && (init as RequestInit | undefined)?.method === "POST")
    expect(uploadCall).toBeTruthy()
    expect(chatCall).toBeTruthy()

    const writeCalls = fetchMock.mock.calls
      .map(([url, init]) => ({
        url: String(url),
        method: (init as RequestInit | undefined)?.method ?? "GET"
      }))
      .filter((call) => call.method === "POST" && (call.url === "http://api.test/documents" || call.url === "http://api.test/chat"))
    expect(writeCalls).toEqual([
      { url: "http://api.test/documents", method: "POST" },
      { url: "http://api.test/chat", method: "POST" }
    ])
  })

  it("ingests an attached file without asking a question", async () => {
    const fetchMock = mockAppFetch()
    await renderAuthenticatedApp()

    const input = (await screen.findByTitle("資料を添付")).querySelector<HTMLInputElement>('input[type="file"]')
    await userEvent.upload(input as HTMLInputElement, new File(["資料"], "only-upload.txt", { type: "text/plain" }))
    await userEvent.click(screen.getByTitle("送信"))

    expect(await screen.findByText("資料を取り込みました。知りたいことを入力してください。")).toBeInTheDocument()
    expect(findRequest(fetchMock, "/chat", "POST")).toBeUndefined()
  })

  it("renders debug trace details, downloads JSON, and resets the conversation", async () => {
    const fetchMock = mockAppFetch()
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)
    await renderAuthenticatedApp()

    await userEvent.click(await screen.findByRole("checkbox"))
    expect(await screen.findByLabelText("デバッグパネル")).toBeInTheDocument()
    expect(screen.getByText("8 ステップ")).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText("質問"), "ソフトウェア要求の分類を洗い出して")
    await userEvent.click(screen.getByTitle("送信"))

    expect(await screen.findByText("answerability_gate")).toBeInTheDocument()
    expect(screen.getAllByText("1.25 秒").length).toBeGreaterThanOrEqual(2)
    expect(screen.getByLabelText("RAG実行フローチャート")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /answerability_gate/ }))
    expect(await screen.findByText(/low_similarity_score/)).toBeInTheDocument()

    await userEvent.click(screen.getByTitle("保存済みJSONをダウンロード"))
    expect(click).toHaveBeenCalled()
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => String(url).includes("/debug-runs/") && String(url).includes("/download") && (init as RequestInit | undefined)?.method === "POST"
      )
    ).toBe(true)

    await userEvent.click(screen.getByTitle("可視化JSONをダウンロード"))
    expect(click).toHaveBeenCalledTimes(2)

    await userEvent.click(screen.getByText("新しい会話"))
    expect(screen.queryByText("ソフトウェア要求は製品要求とプロジェクト要求に分類されます。")).not.toBeInTheDocument()
    expect(screen.getByLabelText("質問")).toHaveValue("")
  })

  it("uploads a debug JSON trace and replays it without calling the API", async () => {
    const fetchMock = mockAppFetch()
    await renderAuthenticatedApp()

    await userEvent.click(await screen.findByRole("checkbox"))
    const input = screen.getByTitle("JSONをアップロード").querySelector<HTMLInputElement>('input[type="file"]')
    await userEvent.upload(input as HTMLInputElement, new File([JSON.stringify(answerableDebugTrace)], "trace.json", { type: "application/json" }))

    expect(await screen.findByText("ローカルJSON")).toBeInTheDocument()
    expect(screen.getByText(answerableDebugTrace.runId)).toBeInTheDocument()
    expect(screen.getByLabelText("RAG実行フローチャート")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /finalize_response/ }))
    expect(await screen.findByText(/END_OF_FINALIZE_RESPONSE/)).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/download"))).toBe(false)
  })

  it("disables submission while a question is pending and selects the returned debug run", async () => {
    let resolveChat: ((value: ReturnType<typeof response>) => void) | undefined
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url)
      if (requestUrl === "/config.json") return Promise.resolve(response({ apiBaseUrl: "http://api.test" }))
      if (requestUrl.endsWith("/me") && isGet(init)) return Promise.resolve(response(currentUserResponse()))
      if (requestUrl.endsWith("/documents") && isGet(init)) return Promise.resolve(response({ documents }))
      if (requestUrl.endsWith("/debug-runs") && isGet(init)) return Promise.resolve(response({ debugRuns: [debugTrace] }))
      if (requestUrl.endsWith("/debug-runs/run-1/download") && init?.method === "POST") return Promise.resolve(response({ url: "https://signed.example/debug.json", expiresInSeconds: 900, objectKey: "downloads/debug.json" }))
      if (requestUrl.endsWith("/chat") && init?.method === "POST") {
        return new Promise((resolve) => {
          resolveChat = resolve
        })
      }
      return Promise.resolve(response({}))
    })
    vi.stubGlobal("fetch", fetchMock)
    await renderAuthenticatedApp()

    await userEvent.click(await screen.findByRole("checkbox"))
    await userEvent.selectOptions(await screen.findByLabelText("実行ID"), debugTrace.runId)
    expect(await screen.findByText("answerability_gate")).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText("質問"), "処理中の表示を確認したい")
    await userEvent.click(screen.getByTitle("送信"))

    expect(await screen.findByText("処理中の表示を確認したい")).toBeInTheDocument()
    expect(screen.getByTitle("送信")).toBeDisabled()
    await userEvent.click(screen.getByTitle("送信"))
    expect(requestBodies(fetchMock, "/chat")).toHaveLength(1)
    await waitFor(() => expect(screen.getAllByText("処理中").length).toBeGreaterThanOrEqual(1))
    expect(screen.getByLabelText("デバッグパネル")).toHaveAttribute("aria-busy", "true")

    resolveChat?.(
      response({
        answer: "処理中表示を確認しました。",
        isAnswerable: true,
        citations: [],
        retrieved: [],
        debug: { ...debugTrace, runId: "run-processing", question: "処理中の表示を確認したい", status: "success" as const, isAnswerable: true }
      })
    )
    expect(await screen.findByText("処理中表示を確認しました。")).toBeInTheDocument()
    expect(screen.getByLabelText("実行ID")).toHaveValue("run-processing")
    expect(screen.getAllByText("1.25 秒").length).toBeGreaterThanOrEqual(1)
  })

  it("selects a persisted debug run from history", async () => {
    const olderTrace = { ...debugTrace, runId: "run-old", status: "success" as const, isAnswerable: true, totalLatencyMs: 250 }
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url)
      if (requestUrl === "/config.json") return Promise.resolve(response({ apiBaseUrl: "http://api.test" }))
      if (requestUrl.endsWith("/me") && isGet(init)) return Promise.resolve(response(currentUserResponse()))
      if (requestUrl.endsWith("/documents") && isGet(init)) return Promise.resolve(response({ documents }))
      if (requestUrl.endsWith("/debug-runs") && isGet(init)) return Promise.resolve(response({ debugRuns: [debugTrace, olderTrace] }))
      return Promise.resolve(response({}))
    })
    vi.stubGlobal("fetch", fetchMock)
    await renderAuthenticatedApp()

    await screen.findByRole("option", { name: "run-old" })
    await userEvent.selectOptions(await screen.findByLabelText("実行ID"), "run-old")
    expect(screen.getByLabelText("実行ID")).toHaveValue("run-old")
  })

  it("starts a benchmark run from the performance test view", async () => {
    const fetchMock = mockAppFetch()
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)
    await renderAuthenticatedApp()

    await userEvent.click(await screen.findByTitle("性能テスト"))
    expect(await screen.findByText("ジョブ起動")).toBeInTheDocument()
    const benchmarkModelSelect = screen.getAllByLabelText("モデル")[1]
    expect(benchmarkModelSelect).toBeTruthy()
    await userEvent.selectOptions(benchmarkModelSelect as HTMLElement, "anthropic.claude-3-haiku-20240307-v1:0")
    await userEvent.click(screen.getByRole("button", { name: "性能テストを実行" }))

    expect(await screen.findByText("bench-1")).toBeInTheDocument()
    const startCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/benchmark-runs") && (init as RequestInit | undefined)?.method === "POST")
    expect(JSON.parse(String((startCall?.[1] as RequestInit).body))).toMatchObject({
      suiteId: "standard-agent-v1",
      mode: "agent",
      runner: "codebuild",
      modelId: "anthropic.claude-3-haiku-20240307-v1:0"
    })

    await userEvent.click(screen.getByTitle("レポートをダウンロード"))
    expect(click).toHaveBeenCalled()
  })

  it("submits with Enter and sends the selected model", async () => {
    const fetchMock = mockAppFetch()
    await renderAuthenticatedApp()

    await userEvent.selectOptions(screen.getByLabelText("モデル"), "anthropic.claude-3-haiku-20240307-v1:0")
    await userEvent.type(screen.getByLabelText("質問"), "分類は？{Enter}")

    await screen.findByText("ソフトウェア要求は製品要求とプロジェクト要求に分類されます。")
    const chatCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/chat") && (init as RequestInit | undefined)?.method === "POST")
    expect(JSON.parse(String((chatCall?.[1] as RequestInit).body))).toMatchObject({
      modelId: "anthropic.claude-3-haiku-20240307-v1:0"
    })
  })


  it("switches to Ctrl+Enter submission mode and keeps Enter as newline", async () => {
    const fetchMock = mockAppFetch()
    await renderAuthenticatedApp()

    await userEvent.selectOptions(screen.getByLabelText("送信キー"), "ctrlEnter")
    const textarea = screen.getByLabelText("質問")
    await userEvent.type(textarea, "分類は？{Enter}続き")
    expect(textarea).toHaveValue("分類は？\n続き")

    await userEvent.keyboard("{Control>}{Enter}{/Control}")

    await screen.findByText("ソフトウェア要求は製品要求とプロジェクト要求に分類されます。")
    const chatCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/chat") && (init as RequestInit | undefined)?.method === "POST")
    expect(chatCall).toBeTruthy()
  })

  it("searches, sorts, opens, and deletes conversation history", async () => {
    const fetchMock = mockAppFetch()
    await renderAuthenticatedApp()

    await userEvent.type(screen.getByLabelText("質問"), "分類一")
    await userEvent.click(screen.getByTitle("送信"))
    await screen.findByText("ソフトウェア要求は製品要求とプロジェクト要求に分類されます。")
    await waitFor(() => {
      const savedHistory = fetchMock.mock.calls.find(
        ([url, init]) => String(url).endsWith("/conversation-history") && (init as RequestInit | undefined)?.method === "POST"
      )
      expect(savedHistory).toBeTruthy()
      expect(JSON.parse(String((savedHistory?.[1] as RequestInit).body))).toMatchObject({ schemaVersion: 1 })
    })
    await userEvent.click(screen.getByText("新しい会話"))
    await userEvent.type(screen.getByLabelText("質問"), "分類二")
    await userEvent.click(screen.getByTitle("送信"))
    await screen.findByText("分類二")

    await userEvent.click(screen.getByTitle("履歴"))
    expect(await screen.findByText("会話一覧")).toBeInTheDocument()
    expect(screen.getByText(/2 件の会話/)).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText("履歴を検索"), "分類一")
    expect(screen.getByText("1 件を表示中")).toBeInTheDocument()
    await userEvent.click(screen.getByTitle("お気に入りに追加"))
    await waitFor(() => {
      const favoriteSave = fetchMock.mock.calls.find(([url, init]) => {
        if (!String(url).endsWith("/conversation-history") || (init as RequestInit | undefined)?.method !== "POST") return false
        return JSON.parse(String((init as RequestInit).body)).isFavorite === true
      })
      expect(favoriteSave).toBeTruthy()
    })
    expect(screen.getByText(/1 件のお気に入り/)).toBeInTheDocument()
    await userEvent.click(screen.getByTitle("お気に入り"))
    expect(await screen.findByRole("heading", { name: "お気に入り" })).toBeInTheDocument()
    expect(screen.getByText("1 件を表示中")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /分類一.*メッセージ/ })).toBeInTheDocument()

    await userEvent.click(screen.getByTitle("履歴"))
    await userEvent.selectOptions(screen.getByLabelText("履歴の並び順"), "messages")
    await userEvent.click(screen.getByRole("button", { name: /分類一.*メッセージ/ }))
    expect(screen.getByLabelText("質問")).toHaveValue("")
    expect(screen.getByText("分類一")).toBeInTheDocument()

    await userEvent.click(screen.getByTitle("履歴"))
    await userEvent.type(screen.getByLabelText("履歴を検索"), "分類一")
    await userEvent.click(screen.getByRole("button", { name: "削除" }))
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) => String(url).includes("/conversation-history/") && (init as RequestInit | undefined)?.method === "DELETE"
        )
      ).toBe(true)
    )
    expect(await screen.findByText("条件に一致する履歴はありません。")).toBeInTheDocument()
  })

  it("saves conversation history with the same message payload shape", async () => {
    const fetchMock = mockAppFetch()
    await renderAuthenticatedApp()

    await userEvent.type(screen.getByLabelText("質問"), "分類を教えて")
    await userEvent.click(screen.getByTitle("送信"))

    await screen.findByText("ソフトウェア要求は製品要求とプロジェクト要求に分類されます。")

    await waitFor(() => {
      const savedHistory = requestBodies(fetchMock, "/conversation-history").find((body) => body.messages?.length === 2)
      expect(savedHistory).toMatchObject({
        schemaVersion: 1,
        title: "分類を教えて",
        isFavorite: false,
        messages: [
          { role: "user", text: "分類を教えて" },
          {
            role: "assistant",
            text: "ソフトウェア要求は製品要求とプロジェクト要求に分類されます。",
            sourceQuestion: "分類を教えて"
          }
        ]
      })
      expect(savedHistory?.messages[1].result).toMatchObject({
        answer: "ソフトウェア要求は製品要求とプロジェクト要求に分類されます。",
        isAnswerable: true
      })
    })
  })

  it("keeps Shift+Enter as a newline and surfaces chat errors", async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url)
      if (requestUrl === "/config.json") return Promise.resolve(response({ apiBaseUrl: "http://api.test" }))
      if (requestUrl.endsWith("/me") && isGet(init)) return Promise.resolve(response(currentUserResponse()))
      if (requestUrl.endsWith("/documents") && isGet(init)) return Promise.resolve(response({ documents }))
      if (requestUrl.endsWith("/debug-runs") && isGet(init)) return Promise.resolve(response({ debugRuns: [] }))
      if (requestUrl.endsWith("/chat") && init?.method === "POST") return Promise.resolve(response("chat failed", false))
      return Promise.resolve(response({}))
    })
    vi.stubGlobal("fetch", fetchMock)
    await renderAuthenticatedApp()

    await userEvent.type(screen.getByLabelText("質問"), "分類は？{Shift>}{Enter}{/Shift}続き")
    expect(screen.getByLabelText("質問")).toHaveValue("分類は？\n続き")
    await userEvent.click(screen.getByTitle("送信"))

    expect(await screen.findByText("chat failed")).toBeInTheDocument()
  })

  it("escalates an unanswerable response, supports assignee answer, and resolves the ticket", async () => {
    let storedQuestions: typeof humanQuestion[] = []
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url)
      if (requestUrl === "/config.json") return Promise.resolve(response({ apiBaseUrl: "http://api.test" }))
      if (requestUrl.endsWith("/me") && isGet(init)) return Promise.resolve(response(currentUserResponse()))
      if (requestUrl.endsWith("/documents") && isGet(init)) return Promise.resolve(response({ documents }))
      if (requestUrl.endsWith("/debug-runs") && isGet(init)) return Promise.resolve(response({ debugRuns: [] }))
      if (requestUrl.endsWith("/questions") && isGet(init)) return Promise.resolve(response({ questions: storedQuestions }))
      if (requestUrl.endsWith("/questions/question-1") && isGet(init)) return Promise.resolve(response(storedQuestions[0] ?? humanQuestion))
      if (requestUrl.endsWith("/debug-runs/run-1/download") && init?.method === "POST") return Promise.resolve(response({ url: "https://signed.example/debug.json", expiresInSeconds: 900, objectKey: "downloads/debug.json" }))
      if (requestUrl.endsWith("/chat") && init?.method === "POST") {
        return Promise.resolve(response({ answer: "資料からは回答できません。", isAnswerable: false, citations: [], retrieved: [] }))
      }
      if (requestUrl.endsWith("/questions") && init?.method === "POST") {
        const body = JSON.parse(String(init.body ?? "{}"))
        storedQuestions = [{ ...humanQuestion, ...body }]
        return Promise.resolve(response(storedQuestions[0]))
      }
      if (requestUrl.endsWith("/questions/question-1/answer") && init?.method === "POST") {
        const body = JSON.parse(String(init.body ?? "{}"))
        const current = storedQuestions[0] ?? humanQuestion
        storedQuestions = [{ ...current, ...body, status: "answered", updatedAt: answeredHumanQuestion.updatedAt, answeredAt: answeredHumanQuestion.answeredAt }]
        return Promise.resolve(response(storedQuestions[0]))
      }
      if (requestUrl.endsWith("/questions/question-1/resolve") && init?.method === "POST") {
        const current = storedQuestions[0] ?? answeredHumanQuestion
        storedQuestions = [{ ...current, status: "resolved", resolvedAt: "2026-04-30T00:04:16.000Z" }]
        return Promise.resolve(response(storedQuestions[0]))
      }
      return Promise.resolve(response({}))
    })
    vi.stubGlobal("fetch", fetchMock)
    await renderAuthenticatedApp()

    await userEvent.type(screen.getByLabelText("質問"), "今日山田さんは何を食べた?")
    await userEvent.click(screen.getByTitle("送信"))

    expect(await screen.findByText("資料からは回答できません。")).toBeInTheDocument()
    expect(await screen.findByLabelText("担当者へ質問")).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText("優先度"), "high")
    await userEvent.selectOptions(screen.getByLabelText("カテゴリ"), "手続き")
    await userEvent.selectOptions(screen.getByLabelText("担当部署"), "人事部")
    await userEvent.click(screen.getByText("担当者へ送信"))

    await screen.findByText("担当者へ送信済み")
    const questionPayload = requestBodies(fetchMock, "/questions").find((body) => body.sourceQuestion === "今日山田さんは何を食べた?")
    expect(questionPayload).toMatchObject({
      title: "今日山田さんは何を食べた?について確認したい",
      question: "今日山田さんは何を食べた?\n\n資料を確認しましたが、該当する情報が見つかりませんでした。ご教示いただけますでしょうか。",
      requesterName: "山田 太郎",
      requesterDepartment: "利用部門",
      assigneeDepartment: "人事部",
      category: "手続き",
      priority: "high",
      sourceQuestion: "今日山田さんは何を食べた?",
      chatAnswer: "資料からは回答できません。"
    })

    await userEvent.click(screen.getByTitle("担当者対応"))
    expect(await screen.findByText("問い合わせ概要")).toBeInTheDocument()
    expect(screen.getByText(/件が対応待ち/)).toBeInTheDocument()
    expect(screen.getByText("下書きは未保存です")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "下書き保存" })).toBeDisabled()
    await userEvent.type(screen.getByLabelText("回答内容"), "山田さんは本日、社内食堂でカレーを食べました。")
    expect(screen.getByText("未保存の変更があります")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "下書き保存" }))
    expect(await screen.findByText(/下書きを保存済み/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText("参照資料 / 関連リンク"), "社内食堂メニュー表")
    await userEvent.type(screen.getByLabelText("内部メモ"), "確認済み")
    await userEvent.click(screen.getByLabelText("質問者へ通知する"))
    await userEvent.click(screen.getByText("回答を送信"))

    await userEvent.click(screen.getByTitle("チャットへ戻る"))
    expect(await screen.findByText("担当者からの回答")).toBeInTheDocument()
    expect(screen.getByText("山田さんは本日、社内食堂でカレーを食べました。")).toBeInTheDocument()
    await userEvent.click(screen.getByText("追加で質問する"))
    expect(screen.getByLabelText("質問")).toHaveValue("追加確認: 今日山田さんは何を食べた?について確認したい\n")
    await userEvent.click(screen.getByText("解決した"))
    expect(await screen.findByText("解決済み")).toBeInTheDocument()
  })

  it("does not fetch assignee or admin resources for chat users when escalating", async () => {
    window.sessionStorage.setItem(
      "memorag.auth.session",
      JSON.stringify({
        email: "tester@example.com",
        idToken: jwtWithGroups(["CHAT_USER"]),
        expiresAt: Date.now() + 3600_000
      })
    )

    let storedQuestion: HumanQuestion | undefined
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url)
      if (requestUrl === "/config.json") return Promise.resolve(response({ apiBaseUrl: "http://api.test" }))
      if (requestUrl.endsWith("/me") && isGet(init)) return Promise.resolve(response(currentUserResponse(["CHAT_USER"])))
      if (requestUrl.endsWith("/documents") && isGet(init)) return Promise.resolve(response({ documents }))
      if (requestUrl.endsWith("/conversation-history") && isGet(init)) return Promise.resolve(response({ history: [] }))
      if (requestUrl.endsWith("/chat") && init?.method === "POST") {
        return Promise.resolve(response({ answer: "資料からは回答できません。", isAnswerable: false, citations: [], retrieved: [] }))
      }
      if (requestUrl.endsWith("/questions") && init?.method === "POST") {
        const body = JSON.parse(String(init.body ?? "{}"))
        storedQuestion = { ...humanQuestion, ...body }
        return Promise.resolve(response(storedQuestion))
      }
      if (requestUrl.endsWith("/questions/question-1") && isGet(init)) return Promise.resolve(response(storedQuestion ?? humanQuestion))
      return Promise.resolve(response({}))
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<App />)

    expect(await screen.findByText("資料を添付して開始できます")).toBeInTheDocument()
    expect(screen.queryByTitle("担当者対応")).not.toBeInTheDocument()
    expect(screen.queryByTitle("管理者設定")).not.toBeInTheDocument()
    expect(screen.queryByText("デバッグモード")).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText("質問"), "今日山田さんは何を食べた?")
    await userEvent.click(screen.getByTitle("送信"))
    expect(await screen.findByText("資料からは回答できません。")).toBeInTheDocument()
    await userEvent.click(await screen.findByText("担当者へ送信"))
    expect(await screen.findByText("担当者へ送信済み")).toBeInTheDocument()

    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/questions") && isGet(init as RequestInit | undefined))).toBe(false)
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/questions/question-1") && isGet(init as RequestInit | undefined))).toBe(true)
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/debug-runs") && isGet(init as RequestInit | undefined))).toBe(false)
  })

  it("polls history question tickets and shows answered notifications for chat users", async () => {
    window.sessionStorage.setItem(
      "memorag.auth.session",
      JSON.stringify({
        email: "tester@example.com",
        idToken: jwtWithGroups(["CHAT_USER"]),
        expiresAt: Date.now() + 3600_000
      })
    )

    let storedHistory: ConversationHistoryItem[] = [
      {
        schemaVersion: 1,
        id: "conversation-question-1",
        title: "山田さんの昼食",
        updatedAt: "2026-04-30T00:01:00.000Z",
        isFavorite: false,
        messages: [
          { role: "user", text: "今日山田さんは何を食べた?", createdAt: "2026-04-30T00:00:00.000Z" },
          {
            role: "assistant",
            text: "資料からは回答できません。",
            createdAt: "2026-04-30T00:00:01.000Z",
            sourceQuestion: "今日山田さんは何を食べた?",
            questionTicket: humanQuestion
          }
        ]
      }
    ]

    let questionGetCount = 0
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url)
      if (requestUrl === "/config.json") return Promise.resolve(response({ apiBaseUrl: "http://api.test" }))
      if (requestUrl.endsWith("/me") && isGet(init)) return Promise.resolve(response(currentUserResponse(["CHAT_USER"])))
      if (requestUrl.endsWith("/documents") && isGet(init)) return Promise.resolve(response({ documents }))
      if (requestUrl.endsWith("/conversation-history") && isGet(init)) return Promise.resolve(response({ history: storedHistory }))
      if (requestUrl.endsWith("/conversation-history") && init?.method === "POST") {
        const body = JSON.parse(String(init.body ?? "{}")) as ConversationHistoryItem
        storedHistory = [body, ...storedHistory.filter((item) => item.id !== body.id)]
        return Promise.resolve(response(body))
      }
      if (requestUrl.endsWith("/questions/question-1") && isGet(init)) {
        questionGetCount += 1
        return Promise.resolve(response(questionGetCount === 1 ? humanQuestion : answeredHumanQuestion))
      }
      return Promise.resolve(response({}))
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<App />)

    await screen.findByTitle("履歴")
    vi.useFakeTimers()
    try {
      act(() => {
        fireEvent.click(screen.getByTitle("履歴"))
      })

      await act(async () => {
        await Promise.resolve()
      })
      expect(findRequest(fetchMock, "/questions/question-1")).toBeTruthy()
      expect(screen.getByText("確認待ち")).toBeInTheDocument()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20000)
      })

      expect(screen.getByText("返答あり")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /山田さんの昼食.*返答あり/ })).toBeInTheDocument()
      expect(questionGetCount).toBeGreaterThanOrEqual(2)
      expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/questions") && isGet(init as RequestInit | undefined))).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it.each([
    {
      groups: ["CHAT_USER"],
      visible: ["チャット", "履歴", "お気に入り"],
      hidden: ["担当者対応", "性能テスト", "ドキュメント", "管理者設定"],
      expectedGetSuffixes: ["/me", "/documents", "/conversation-history"],
      forbiddenGetSuffixes: ["/questions", "/debug-runs", "/benchmark-runs", "/admin/users", "/admin/roles", "/admin/usage", "/admin/costs"]
    },
    {
      groups: ["ANSWER_EDITOR"],
      visible: ["チャット", "担当者対応", "履歴", "お気に入り", "管理者設定"],
      hidden: ["性能テスト", "ドキュメント"],
      expectedGetSuffixes: ["/me", "/questions"],
      forbiddenGetSuffixes: ["/documents", "/debug-runs", "/benchmark-runs", "/admin/users", "/admin/roles", "/admin/usage", "/admin/costs"]
    },
    {
      groups: ["RAG_GROUP_MANAGER"],
      visible: ["チャット", "履歴", "性能テスト", "お気に入り", "ドキュメント", "管理者設定"],
      hidden: ["担当者対応"],
      expectedGetSuffixes: ["/me", "/documents", "/benchmark-runs", "/benchmark-suites"],
      forbiddenGetSuffixes: ["/questions", "/debug-runs", "/admin/users", "/admin/roles", "/admin/usage", "/admin/costs"]
    },
    {
      groups: ["USER_ADMIN"],
      visible: ["チャット", "履歴", "お気に入り", "管理者設定"],
      hidden: ["担当者対応", "性能テスト", "ドキュメント"],
      expectedGetSuffixes: ["/me", "/admin/users", "/admin/usage"],
      forbiddenGetSuffixes: ["/questions", "/debug-runs", "/benchmark-runs", "/documents", "/admin/roles", "/admin/costs"]
    },
    {
      groups: ["ACCESS_ADMIN"],
      visible: ["チャット", "履歴", "お気に入り", "管理者設定"],
      hidden: ["担当者対応", "性能テスト", "ドキュメント"],
      expectedGetSuffixes: ["/me", "/admin/roles", "/admin/audit-log"],
      forbiddenGetSuffixes: ["/questions", "/debug-runs", "/benchmark-runs", "/documents", "/admin/users", "/admin/usage", "/admin/costs"]
    },
    {
      groups: ["COST_AUDITOR"],
      visible: ["チャット", "履歴", "お気に入り", "管理者設定"],
      hidden: ["担当者対応", "性能テスト", "ドキュメント"],
      expectedGetSuffixes: ["/me", "/admin/costs"],
      forbiddenGetSuffixes: ["/questions", "/debug-runs", "/benchmark-runs", "/documents", "/admin/users", "/admin/roles", "/admin/usage"]
    }
  ])("keeps role based navigation and initial API loading unchanged for $groups", async ({ groups, visible, hidden, expectedGetSuffixes, forbiddenGetSuffixes }) => {
    window.sessionStorage.setItem(
      "memorag.auth.session",
      JSON.stringify({
        email: "tester@example.com",
        idToken: jwtWithGroups(groups),
        expiresAt: Date.now() + 3600_000
      })
    )
    const fetchMock = mockAppFetch(groups)
    render(<App />)

    await screen.findByTitle("チャット")

    for (const title of visible) {
      expect(screen.getByTitle(title)).toBeInTheDocument()
    }
    for (const title of hidden) {
      expect(screen.queryByTitle(title)).not.toBeInTheDocument()
    }
    await waitFor(() => {
      for (const suffix of expectedGetSuffixes) {
        expect(findRequest(fetchMock, suffix)).toBeTruthy()
      }
    })
    for (const suffix of forbiddenGetSuffixes) {
      expect(findRequest(fetchMock, suffix)).toBeUndefined()
    }
  })

  it("shows the admin settings icon only for access admins", async () => {
    window.sessionStorage.setItem(
      "memorag.auth.session",
      JSON.stringify({
        email: "access-admin@example.com",
        idToken: jwtWithGroups(["ACCESS_ADMIN"]),
        expiresAt: Date.now() + 3600_000
      })
    )

    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url)
      if (requestUrl === "/config.json") return Promise.resolve(response({ apiBaseUrl: "http://api.test" }))
      if (requestUrl.endsWith("/me") && isGet(init)) return Promise.resolve(response(currentUserResponse(["ACCESS_ADMIN"])))
      if (requestUrl.endsWith("/documents") && isGet(init)) return Promise.resolve(response({ documents }))
      if (requestUrl.endsWith("/conversation-history") && isGet(init)) return Promise.resolve(response({ history: [] }))
      return Promise.resolve(response({}))
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<App />)

    await userEvent.click(await screen.findByTitle("管理者設定"))
    expect(await screen.findByLabelText("管理者設定")).toBeInTheDocument()
    expect(screen.getByText("アクセス管理")).toBeInTheDocument()
    expect(screen.getByText("ロール定義")).toBeInTheDocument()
    expect(screen.queryByTitle("担当者対応")).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/questions") && isGet(init as RequestInit | undefined))).toBe(false)
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/debug-runs") && isGet(init as RequestInit | undefined))).toBe(false)
  })

  it("renders Phase 2 user, role, usage, and cost administration", async () => {
    const fetchMock = mockAppFetch(["SYSTEM_ADMIN"])
    await renderAuthenticatedApp()

    await userEvent.click(await screen.findByTitle("管理者設定"))
    const adminWorkspace = await screen.findByLabelText("管理者設定")
    expect(within(adminWorkspace).getByLabelText("ユーザー管理")).toBeInTheDocument()
    expect(await screen.findByLabelText("ユーザー管理一覧")).toBeInTheDocument()
    expect(screen.getByLabelText("管理対象ユーザー作成")).toBeInTheDocument()
    expect(screen.getByLabelText("ロール定義")).toBeInTheDocument()
    expect(screen.getByLabelText("利用状況一覧")).toBeInTheDocument()
    expect(screen.getByLabelText("コスト監査一覧")).toBeInTheDocument()
    expect(screen.getByLabelText("Alias管理一覧")).toBeInTheDocument()
    expect(screen.getByLabelText("管理操作履歴")).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByDisplayValue("SYSTEM_ADMIN"), "COST_AUDITOR")
    const assignButton = screen.getAllByRole("button", { name: "付与" }).find((button) => !button.hasAttribute("disabled"))
    expect(assignButton).toBeDefined()
    await userEvent.click(assignButton!)
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/admin/users/local-dev/roles") && (init as RequestInit | undefined)?.method === "POST")
      ).toBe(true)
    )

    await userEvent.click(screen.getByRole("button", { name: "停止" }))
    expect(await screen.findByText("停止中")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "再開" }))
    expect(await screen.findByText("有効")).toBeInTheDocument()

    await userEvent.type(within(screen.getByLabelText("Alias管理一覧")).getByPlaceholderText("pto"), "sl")
    await userEvent.type(screen.getByPlaceholderText("有給休暇, 休暇申請"), "病気休暇, sick leave")
    await userEvent.click(screen.getByRole("button", { name: "追加" }))
    expect(await screen.findByText("sl")).toBeInTheDocument()
    const approveButton = within(screen.getByLabelText("Alias管理一覧")).getAllByRole("button", { name: "承認" }).at(0)
    assertElement(approveButton)
    await userEvent.click(approveButton)
    await userEvent.click(screen.getByRole("button", { name: "公開" }))
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/admin/aliases/publish") && (init as RequestInit | undefined)?.method === "POST")).toBe(true)
    )

    const confirmMock = vi.spyOn(window, "confirm").mockReturnValue(true)
    await userEvent.click(screen.getByRole("button", { name: "削除" }))
    expect(confirmMock).toHaveBeenCalled()
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/admin/users/local-dev") && (init as RequestInit | undefined)?.method === "DELETE")
      ).toBe(true)
    )

    await userEvent.type(within(adminWorkspace).getByLabelText("メール"), "new-user@example.com")
    await userEvent.type(within(adminWorkspace).getByLabelText("表示名"), "新規 利用者")
    await userEvent.selectOptions(within(adminWorkspace).getByLabelText("初期ロール"), "CHAT_USER")
    await userEvent.click(within(adminWorkspace).getByRole("button", { name: "作成" }))
    expect((await screen.findAllByText("new-user@example.com")).length).toBeGreaterThan(0)
    expect(await screen.findByText("ユーザー作成")).toBeInTheDocument()
  })

  it("connects the admin overview to Phase 1 workspaces", async () => {
    mockAppFetch()
    await renderAuthenticatedApp()

    await userEvent.click(await screen.findByTitle("管理者設定"))
    const adminWorkspace = await screen.findByLabelText("管理者設定")
    expect(within(adminWorkspace).getByText("ドキュメント管理")).toBeInTheDocument()
    expect(within(adminWorkspace).getByRole("button", { name: /担当者対応/ })).toBeInTheDocument()
    expect(within(adminWorkspace).getByRole("button", { name: /デバッグ \/ 評価/ })).toBeInTheDocument()
    expect(within(adminWorkspace).getByRole("button", { name: /性能テスト/ })).toBeInTheDocument()

    await userEvent.click(within(adminWorkspace).getByRole("button", { name: /ドキュメント管理/ }))
    expect(await screen.findByLabelText("ドキュメント管理")).toBeInTheDocument()
    await userEvent.click(screen.getByTitle("requirements.mdの再インデックスをステージング"))
    expect(await screen.findByLabelText("再インデックス移行一覧")).toHaveTextContent("staged")
    await userEvent.click(screen.getByRole("button", { name: "切替" }))
    expect(await screen.findByLabelText("再インデックス移行一覧")).toHaveTextContent("cutover")

    await userEvent.click(screen.getByTitle("管理者設定へ戻る"))
    await userEvent.click(within(await screen.findByLabelText("管理者設定")).getByRole("button", { name: /担当者対応/ }))
    expect(await screen.findByLabelText("担当者対応")).toBeInTheDocument()

    await userEvent.click(screen.getByTitle("管理者設定"))
    await userEvent.click(within(await screen.findByLabelText("管理者設定")).getByRole("button", { name: /デバッグ \/ 評価/ }))
    expect(await screen.findByRole("checkbox")).toBeChecked()
    expect(await screen.findByLabelText("デバッグパネル")).toBeInTheDocument()

    await userEvent.click(screen.getByTitle("管理者設定"))
    await userEvent.click(within(await screen.findByLabelText("管理者設定")).getByRole("button", { name: /性能テスト/ }))
    expect(await screen.findByLabelText("性能テスト")).toBeInTheDocument()
  })

  it("renders empty and preloaded assignee workspaces", async () => {
    const resolvedQuestion = {
      ...answeredHumanQuestion,
      questionId: "question-2",
      title: "緊急確認",
      priority: "urgent" as const,
      status: "resolved" as const,
      resolvedAt: "2026-04-30T00:05:16.000Z"
    }
    const questions = [humanQuestion, answeredHumanQuestion, resolvedQuestion]
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url)
      if (requestUrl === "/config.json") return Promise.resolve(response({ apiBaseUrl: "http://api.test" }))
      if (requestUrl.endsWith("/me") && isGet(init)) return Promise.resolve(response(currentUserResponse()))
      if (requestUrl.endsWith("/documents") && isGet(init)) return Promise.resolve(response({ documents: [] }))
      if (requestUrl.endsWith("/debug-runs") && isGet(init)) return Promise.resolve(response({ debugRuns: [] }))
      if (requestUrl.endsWith("/questions") && isGet(init)) return Promise.resolve(response({ questions }))
      return Promise.resolve(response({}))
    })
    vi.stubGlobal("fetch", fetchMock)
    await renderAuthenticatedApp()

    expect(await screen.findByText("資料を添付して開始できます")).toBeInTheDocument()
    await userEvent.click(screen.getByTitle("担当者対応"))
    expect(await screen.findByText("問い合わせ一覧")).toBeInTheDocument()
    expect(screen.getByText("対応中 / 総務部")).toBeInTheDocument()
    await userEvent.click(screen.getByText("緊急確認"))
    expect(screen.getByText("解決済み / 総務部")).toBeInTheDocument()
    expect(screen.getByText("緊急")).toBeInTheDocument()
  })

  it("shows an empty assignee workspace when no questions exist", async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url)
      if (requestUrl === "/config.json") return Promise.resolve(response({ apiBaseUrl: "http://api.test" }))
      if (requestUrl.endsWith("/me") && isGet(init)) return Promise.resolve(response(currentUserResponse()))
      if (requestUrl.endsWith("/documents")) return Promise.resolve(response({ documents: [] }))
      if (requestUrl.endsWith("/debug-runs")) return Promise.resolve(response({ debugRuns: [] }))
      if (requestUrl.endsWith("/questions")) return Promise.resolve(response({ questions: [] }))
      return Promise.resolve(response({}))
    })
    vi.stubGlobal("fetch", fetchMock)
    await renderAuthenticatedApp()

    await userEvent.click(await screen.findByTitle("担当者対応"))
    expect(await screen.findByText("担当者へ送信された質問はまだありません。")).toBeInTheDocument()
  })

})
