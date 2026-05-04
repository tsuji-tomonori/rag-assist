import assert from "node:assert/strict"
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"
import test from "node:test"

type OpenApiDoc = {
  paths: Record<string, Record<string, { responses?: Record<string, { content?: Record<string, { schema: unknown }> }> }>>
  components?: { schemas?: Record<string, unknown> }
}

type Fixtures = {
  requests: {
    postDocuments: { fileName: string; text: string }
    postChat: { question: string; includeDebug: boolean; minScore: number }
    postSearch: { query: string; topK: number }
  }
  responses: {
    health: { ok: true; service: string }
    documentsListShape: { documents: unknown[] }
    uploadedDocumentShape: { documentId: string; fileName: string; chunkCount: number; vectorKeys: string[] }
    chatShape: { answer: string; citations: unknown[]; isAnswerable: boolean }
  }
}

test("HTTP contract validates major endpoint responses against /openapi.json", async () => {
  const fixtures = await loadFixtures()
  const port = 18000 + Math.floor(Math.random() * 1000)
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-contract-"))
  const tsxBin = path.resolve(process.cwd(), "../../node_modules/.bin/tsx")
  const server = spawn(tsxBin, ["src/local.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      MOCK_BEDROCK: "true",
      USE_LOCAL_VECTOR_STORE: "true",
      USE_LOCAL_QUESTION_STORE: "true",
      LOCAL_DATA_DIR: dataDir,
      AUTH_ENABLED: "false"
    },
    stdio: ["ignore", "pipe", "pipe"]
  })

  try {
    await waitUntilReady(server, port)

    const openapiRes = await fetch(`http://127.0.0.1:${port}/openapi.json`)
    assert.equal(openapiRes.status, 200)
    const openapi = (await openapiRes.json()) as OpenApiDoc

    const health = await getJson(`http://127.0.0.1:${port}/health`)
    assert.equal(health.body.ok, fixtures.responses.health.ok)
    assert.equal(health.body.service, fixtures.responses.health.service)
    validateSchema(health.body, responseSchema(openapi, "/health", "get", 200), openapi)

    const currentUser = await getJson(`http://127.0.0.1:${port}/me`)
    assert.equal(currentUser.body.user.userId, "local-dev")
    assert.ok(currentUser.body.user.permissions.includes("chat:admin:read_all"))
    validateSchema(currentUser.body, responseSchema(openapi, "/me", "get", 200), openapi)

    const documents = await getJson(`http://127.0.0.1:${port}/documents`)
    assert.ok(Array.isArray(documents.body.documents))
    validateSchema(documents.body, responseSchema(openapi, "/documents", "get", 200), openapi)

    const postDocument = await fetch(`http://127.0.0.1:${port}/documents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fixtures.requests.postDocuments)
    })
    assert.equal(postDocument.status, 200)
    const created = (await postDocument.json()) as Record<string, unknown>
    assert.equal(created.fileName, fixtures.responses.uploadedDocumentShape.fileName)
    validateSchema(created, responseSchema(openapi, "/documents", "post", 200), openapi)

    const postChat = await fetch(`http://127.0.0.1:${port}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fixtures.requests.postChat)
    })
    assert.equal(postChat.status, 200)
    const chat = (await postChat.json()) as Record<string, unknown>
    assert.equal(typeof chat.answer, typeof fixtures.responses.chatShape.answer)
    assert.equal(Array.isArray(chat.citations), true)
    validateSchema(chat, responseSchema(openapi, "/chat", "post", 200), openapi)

    const postSearch = await fetch(`http://127.0.0.1:${port}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fixtures.requests.postSearch)
    })
    assert.equal(postSearch.status, 200)
    const search = (await postSearch.json()) as Record<string, unknown>
    assert.equal(search.query, fixtures.requests.postSearch.query)
    assert.ok(Array.isArray(search.results))
    assert.ok((search.results as unknown[]).length >= 1)
    validateSchema(search, responseSchema(openapi, "/search", "post", 200), openapi)

    const postHistory = await fetch(`http://127.0.0.1:${port}/conversation-history`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "conversation-1",
        title: "分類について",
        updatedAt: "2026-05-02T00:00:00.000Z",
        messages: [{ role: "user", text: "分類は？", createdAt: "2026-05-02T00:00:00.000Z" }]
      })
    })
    assert.equal(postHistory.status, 200)
    const savedHistory = (await postHistory.json()) as Record<string, unknown>
    assert.equal(savedHistory.schemaVersion, 1)
    assert.equal(savedHistory.isFavorite, false)
    validateSchema(savedHistory, responseSchema(openapi, "/conversation-history", "post", 200), openapi)

    const history = await getJson(`http://127.0.0.1:${port}/conversation-history`)
    assert.equal(history.body.history[0].schemaVersion, 1)
    validateSchema(history.body, responseSchema(openapi, "/conversation-history", "get", 200), openapi)

    const createAdminUser = await fetch(`http://127.0.0.1:${port}/admin/users`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "new-user@example.com", displayName: "新規 利用者", groups: ["CHAT_USER"] })
    })
    assert.equal(createAdminUser.status, 200)
    validateSchema(await createAdminUser.json(), responseSchema(openapi, "/admin/users", "post", 200), openapi)

    const adminUsers = await getJson(`http://127.0.0.1:${port}/admin/users`)
    assert.equal(Array.isArray(adminUsers.body.users), true)
    assert.ok(adminUsers.body.users.some((user: { userId: string }) => user.userId === "local-dev"))
    validateSchema(adminUsers.body, responseSchema(openapi, "/admin/users", "get", 200), openapi)

    const roles = await getJson(`http://127.0.0.1:${port}/admin/roles`)
    assert.equal(Array.isArray(roles.body.roles), true)
    assert.ok(roles.body.roles.some((role: { role: string }) => role.role === "SYSTEM_ADMIN"))
    validateSchema(roles.body, responseSchema(openapi, "/admin/roles", "get", 200), openapi)

    const createAlias = await fetch(`http://127.0.0.1:${port}/admin/aliases`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ term: "pto", expansions: ["年次有給休暇"], scope: { tenantId: "tenant-a" } })
    })
    assert.equal(createAlias.status, 200)
    const alias = (await createAlias.json()) as { aliasId: string }
    validateSchema(alias, responseSchema(openapi, "/admin/aliases", "post", 200), openapi)

    const reviewAlias = await fetch(`http://127.0.0.1:${port}/admin/aliases/${alias.aliasId}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approve", comment: "contract" })
    })
    assert.equal(reviewAlias.status, 200)
    validateSchema(await reviewAlias.json(), responseSchema(openapi, "/admin/aliases/{aliasId}/review", "post", 200), openapi)

    const publishAliases = await fetch(`http://127.0.0.1:${port}/admin/aliases/publish`, { method: "POST" })
    assert.equal(publishAliases.status, 200)
    validateSchema(await publishAliases.json(), responseSchema(openapi, "/admin/aliases/publish", "post", 200), openapi)

    const aliases = await getJson(`http://127.0.0.1:${port}/admin/aliases`)
    assert.equal(Array.isArray(aliases.body.aliases), true)
    validateSchema(aliases.body, responseSchema(openapi, "/admin/aliases", "get", 200), openapi)

    const aliasAudit = await getJson(`http://127.0.0.1:${port}/admin/aliases/audit-log`)
    assert.equal(Array.isArray(aliasAudit.body.auditLog), true)
    validateSchema(aliasAudit.body, responseSchema(openapi, "/admin/aliases/audit-log", "get", 200), openapi)

    const assignRoles = await fetch(`http://127.0.0.1:${port}/admin/users/local-dev/roles`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ groups: ["SYSTEM_ADMIN", "COST_AUDITOR"] })
    })
    assert.equal(assignRoles.status, 200)
    validateSchema(await assignRoles.json(), responseSchema(openapi, "/admin/users/{userId}/roles", "post", 200), openapi)

    const adminAuditLog = await getJson(`http://127.0.0.1:${port}/admin/audit-log`)
    assert.equal(Array.isArray(adminAuditLog.body.auditLog), true)
    assert.ok(adminAuditLog.body.auditLog.some((entry: { action: string }) => entry.action === "user:create"))
    validateSchema(adminAuditLog.body, responseSchema(openapi, "/admin/audit-log", "get", 200), openapi)

    const usage = await getJson(`http://127.0.0.1:${port}/admin/usage`)
    assert.equal(Array.isArray(usage.body.users), true)
    validateSchema(usage.body, responseSchema(openapi, "/admin/usage", "get", 200), openapi)

    const costs = await getJson(`http://127.0.0.1:${port}/admin/costs`)
    assert.equal(costs.body.currency, "USD")
    validateSchema(costs.body, responseSchema(openapi, "/admin/costs", "get", 200), openapi)
  } finally {
    server.kill("SIGTERM")
  }
})

test("benchmark query endpoint requires authentication when auth is enabled", async () => {
  const port = 19000 + Math.floor(Math.random() * 1000)
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-contract-auth-"))
  const tsxBin = path.resolve(process.cwd(), "../../node_modules/.bin/tsx")
  const server = spawn(tsxBin, ["src/local.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      MOCK_BEDROCK: "true",
      USE_LOCAL_VECTOR_STORE: "true",
      USE_LOCAL_QUESTION_STORE: "true",
      LOCAL_DATA_DIR: dataDir,
      AUTH_ENABLED: "true"
    },
    stdio: ["ignore", "pipe", "pipe"]
  })

  try {
    await waitUntilReady(server, port)

    const res = await fetch(`http://127.0.0.1:${port}/benchmark/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "auth-check", question: "認証確認" })
    })

    assert.equal(res.status, 401)
  } finally {
    server.kill("SIGTERM")
  }
})

test("benchmark query endpoint remains available for local benchmark runs when auth is disabled", async () => {
  const port = 20000 + Math.floor(Math.random() * 1000)
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-contract-benchmark-"))
  const tsxBin = path.resolve(process.cwd(), "../../node_modules/.bin/tsx")
  const server = spawn(tsxBin, ["src/local.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      MOCK_BEDROCK: "true",
      USE_LOCAL_VECTOR_STORE: "true",
      USE_LOCAL_QUESTION_STORE: "true",
      LOCAL_DATA_DIR: dataDir,
      AUTH_ENABLED: "false"
    },
    stdio: ["ignore", "pipe", "pipe"]
  })

  try {
    await waitUntilReady(server, port)

    const res = await fetch(`http://127.0.0.1:${port}/benchmark/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "local-benchmark", question: "資料にない制度の詳細は？", includeDebug: false })
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as Record<string, unknown>
    assert.equal(body.id, "local-benchmark")
    assert.equal(typeof body.answer, "string")
    assert.equal(typeof body.isAnswerable, "boolean")
    assert.equal(Array.isArray(body.citations), true)
    assert.equal("debug" in body, false)
  } finally {
    server.kill("SIGTERM")
  }
})

test("benchmark runner can only upload isolated benchmark seed documents", async () => {
  const port = 25000 + Math.floor(Math.random() * 1000)
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-contract-benchmark-seed-rbac-"))
  const tsxBin = path.resolve(process.cwd(), "../../node_modules/.bin/tsx")
  const server = spawn(tsxBin, ["src/local.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      MOCK_BEDROCK: "true",
      USE_LOCAL_VECTOR_STORE: "true",
      USE_LOCAL_QUESTION_STORE: "true",
      LOCAL_DATA_DIR: dataDir,
      AUTH_ENABLED: "false",
      LOCAL_AUTH_GROUPS: "BENCHMARK_RUNNER"
    },
    stdio: ["ignore", "pipe", "pipe"]
  })

  try {
    await waitUntilReady(server, port)

    const generalUpload = await fetch(`http://127.0.0.1:${port}/documents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: "general.md", text: "通常文書です。", mimeType: "text/markdown" })
    })
    assert.equal(generalUpload.status, 403)

    const seedUpload = await fetch(`http://127.0.0.1:${port}/documents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fileName: "handbook.md",
        text: "# Handbook\n\n経費精算は30日以内です。",
        mimeType: "text/markdown",
        skipMemory: true,
        metadata: {
          benchmarkSeed: true,
          benchmarkSuiteId: "smoke-agent-v1",
          benchmarkSourceHash: "hash",
          benchmarkIngestSignature: "signature",
          benchmarkCorpusSkipMemory: true,
          benchmarkEmbeddingModelId: "api-default",
          aclGroups: ["BENCHMARK_RUNNER"],
          docType: "benchmark-corpus",
          lifecycleStatus: "active",
          source: "benchmark-runner"
        }
      })
    })
    assert.equal(seedUpload.status, 200)
    const manifest = (await seedUpload.json()) as { metadata?: { aclGroups?: string[]; docType?: string; source?: string } }
    assert.deepEqual(manifest.metadata?.aclGroups, ["BENCHMARK_RUNNER"])
    assert.equal(manifest.metadata?.docType, "benchmark-corpus")
    assert.equal(manifest.metadata?.source, "benchmark-runner")
  } finally {
    server.kill("SIGTERM")
  }
})

test("question and debug management endpoints enforce Phase 1 role boundaries", async () => {
  const port = 21000 + Math.floor(Math.random() * 1000)
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-contract-rbac-"))
  const tsxBin = path.resolve(process.cwd(), "../../node_modules/.bin/tsx")
  const server = spawn(tsxBin, ["src/local.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      MOCK_BEDROCK: "true",
      USE_LOCAL_VECTOR_STORE: "true",
      USE_LOCAL_QUESTION_STORE: "true",
      LOCAL_DATA_DIR: dataDir,
      AUTH_ENABLED: "false",
      LOCAL_AUTH_GROUPS: "CHAT_USER"
    },
    stdio: ["ignore", "pipe", "pipe"]
  })

  try {
    await waitUntilReady(server, port)

    const currentUser = await getJson(`http://127.0.0.1:${port}/me`)
    assert.deepEqual(currentUser.body.user.groups, ["CHAT_USER"])
    assert.ok(currentUser.body.user.permissions.includes("chat:create"))
    assert.equal(currentUser.body.user.permissions.includes("answer:edit"), false)
    assert.equal(currentUser.body.user.permissions.includes("chat:admin:read_all"), false)

    const createQuestion = await fetch(`http://127.0.0.1:${port}/questions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "担当者へ確認したい",
        question: "この制度の詳細を担当者へ確認してください。",
        requesterName: "山田 太郎",
        requesterDepartment: "利用部門",
        assigneeDepartment: "総務部",
        category: "その他の質問",
        priority: "normal"
      })
    })
    assert.equal(createQuestion.status, 200)
    const question = (await createQuestion.json()) as { questionId: string }

    const listQuestions = await fetch(`http://127.0.0.1:${port}/questions`)
    assert.equal(listQuestions.status, 403)

    const getQuestion = await fetch(`http://127.0.0.1:${port}/questions/${question.questionId}`)
    assert.equal(getQuestion.status, 200)
    const visibleQuestion = (await getQuestion.json()) as Record<string, unknown>
    assert.equal(visibleQuestion.questionId, question.questionId)
    assert.equal(Object.hasOwn(visibleQuestion, "internalMemo"), false)

    const answerQuestion = await fetch(`http://127.0.0.1:${port}/questions/${question.questionId}/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answerTitle: "回答", answerBody: "回答本文" })
    })
    assert.equal(answerQuestion.status, 403)

    const resolveQuestion = await fetch(`http://127.0.0.1:${port}/questions/${question.questionId}/resolve`, { method: "POST" })
    assert.equal(resolveQuestion.status, 409)

    const getDebugRun = await fetch(`http://127.0.0.1:${port}/debug-runs/unknown-run`)
    assert.equal(getDebugRun.status, 403)

    const downloadDebugRun = await fetch(`http://127.0.0.1:${port}/debug-runs/unknown-run/download`, { method: "POST" })
    assert.equal(downloadDebugRun.status, 403)
  } finally {
    server.kill("SIGTERM")
  }
})

test("answer editors can list questions without user administration permission", async () => {
  const port = 22000 + Math.floor(Math.random() * 1000)
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-contract-answer-editor-"))
  const tsxBin = path.resolve(process.cwd(), "../../node_modules/.bin/tsx")
  const server = spawn(tsxBin, ["src/local.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      MOCK_BEDROCK: "true",
      USE_LOCAL_VECTOR_STORE: "true",
      USE_LOCAL_QUESTION_STORE: "true",
      LOCAL_DATA_DIR: dataDir,
      AUTH_ENABLED: "false",
      LOCAL_AUTH_GROUPS: "ANSWER_EDITOR"
    },
    stdio: ["ignore", "pipe", "pipe"]
  })

  try {
    await waitUntilReady(server, port)

    const listQuestions = await fetch(`http://127.0.0.1:${port}/questions`)
    assert.equal(listQuestions.status, 200)
    const body = (await listQuestions.json()) as Record<string, unknown>
    assert.equal(Array.isArray(body.questions), true)
  } finally {
    server.kill("SIGTERM")
  }
})

test("answer editors cannot create questions without chat permission", async () => {
  const port = 23000 + Math.floor(Math.random() * 1000)
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-contract-question-create-rbac-"))
  const tsxBin = path.resolve(process.cwd(), "../../node_modules/.bin/tsx")
  const server = spawn(tsxBin, ["src/local.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      MOCK_BEDROCK: "true",
      USE_LOCAL_VECTOR_STORE: "true",
      USE_LOCAL_QUESTION_STORE: "true",
      LOCAL_DATA_DIR: dataDir,
      AUTH_ENABLED: "false",
      LOCAL_AUTH_GROUPS: "ANSWER_EDITOR"
    },
    stdio: ["ignore", "pipe", "pipe"]
  })

  try {
    await waitUntilReady(server, port)

    const createQuestion = await fetch(`http://127.0.0.1:${port}/questions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "担当者へ確認したい",
        question: "この制度の詳細を担当者へ確認してください。",
        requesterName: "山田 太郎",
        requesterDepartment: "利用部門",
        assigneeDepartment: "総務部",
        category: "その他の質問",
        priority: "normal"
      })
    })

    assert.equal(createQuestion.status, 403)
  } finally {
    server.kill("SIGTERM")
  }
})

test("Phase 2 admin endpoints enforce user, access, usage, and cost permissions", async () => {
  const port = 24000 + Math.floor(Math.random() * 1000)
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-contract-phase2-rbac-"))
  const tsxBin = path.resolve(process.cwd(), "../../node_modules/.bin/tsx")
  const server = spawn(tsxBin, ["src/local.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      MOCK_BEDROCK: "true",
      USE_LOCAL_VECTOR_STORE: "true",
      USE_LOCAL_QUESTION_STORE: "true",
      LOCAL_DATA_DIR: dataDir,
      AUTH_ENABLED: "false",
      LOCAL_AUTH_GROUPS: "CHAT_USER"
    },
    stdio: ["ignore", "pipe", "pipe"]
  })

  try {
    await waitUntilReady(server, port)

    assert.equal((await fetch(`http://127.0.0.1:${port}/admin/users`)).status, 403)
    assert.equal((await fetch(`http://127.0.0.1:${port}/admin/users`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "blocked@example.com" })
    })).status, 403)
    assert.equal((await fetch(`http://127.0.0.1:${port}/admin/audit-log`)).status, 403)
    assert.equal((await fetch(`http://127.0.0.1:${port}/admin/roles`)).status, 403)
    assert.equal((await fetch(`http://127.0.0.1:${port}/admin/aliases`)).status, 403)
    assert.equal((await fetch(`http://127.0.0.1:${port}/admin/aliases/publish`, { method: "POST" })).status, 403)
    assert.equal((await fetch(`http://127.0.0.1:${port}/admin/usage`)).status, 403)
    assert.equal((await fetch(`http://127.0.0.1:${port}/admin/costs`)).status, 403)
    assert.equal((await fetch(`http://127.0.0.1:${port}/admin/users/local-dev/suspend`, { method: "POST" })).status, 403)
    assert.equal(
      (await fetch(`http://127.0.0.1:${port}/admin/users/local-dev/roles`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ groups: ["CHAT_USER"] })
      })).status,
      403
    )
  } finally {
    server.kill("SIGTERM")
  }
})

function responseSchema(doc: OpenApiDoc, route: string, method: string, status: number): unknown {
  const schema = doc.paths[route]?.[method]?.responses?.[String(status)]?.content?.["application/json"]?.schema
  assert.ok(schema, `response schema missing for ${method.toUpperCase()} ${route} ${status}`)
  return schema
}

function validateSchema(value: unknown, schema: unknown, doc: OpenApiDoc, at = "$"): void {
  const resolved = deref(schema, doc)
  if (!resolved || typeof resolved !== "object") return
  const typed = resolved as Record<string, unknown>

  if (Array.isArray(typed.oneOf)) {
    assert.ok(typed.oneOf.some((option) => passes(() => validateSchema(value, option, doc, at))))
    return
  }
  if (Array.isArray(typed.anyOf)) {
    assert.ok(typed.anyOf.some((option) => passes(() => validateSchema(value, option, doc, at))))
    return
  }

  const expectedType = typed.type
  if (expectedType === "object") {
    assert.equal(typeof value, "object", `${at} must be object`)
    assert.notEqual(value, null, `${at} must not be null`)
    const obj = value as Record<string, unknown>
    for (const key of (typed.required as string[] | undefined) ?? []) {
      assert.ok(key in obj, `${at}.${key} is required`)
    }
    const properties = (typed.properties ?? {}) as Record<string, unknown>
    for (const [key, propertySchema] of Object.entries(properties)) {
      if (key in obj) validateSchema(obj[key], propertySchema, doc, `${at}.${key}`)
    }
    return
  }

  if (expectedType === "array") {
    assert.ok(Array.isArray(value), `${at} must be array`)
    for (const item of value) validateSchema(item, typed.items, doc, `${at}[]`)
    return
  }

  if (expectedType === "string") assert.equal(typeof value, "string", `${at} must be string`)
  if (expectedType === "number") assert.equal(typeof value, "number", `${at} must be number`)
  if (expectedType === "integer") assert.ok(Number.isInteger(value), `${at} must be integer`)
  if (expectedType === "boolean") assert.equal(typeof value, "boolean", `${at} must be boolean`)
}

function deref(schema: unknown, doc: OpenApiDoc): unknown {
  if (!schema || typeof schema !== "object") return schema
  const ref = (schema as { $ref?: string }).$ref
  if (!ref) return schema
  const key = ref.replace("#/components/schemas/", "")
  return doc.components?.schemas?.[key]
}

function passes(fn: () => void): boolean {
  try {
    fn()
    return true
  } catch {
    return false
  }
}

async function waitUntilReady(server: ReturnType<typeof spawn>, port: number): Promise<void> {
  let stderr = ""
  server.stderr?.on("data", (chunk) => {
    stderr += chunk.toString()
  })

  for (let i = 0; i < 30; i += 1) {
    if (server.exitCode !== null) {
      throw new Error(`server exited early: ${stderr}`)
    }
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`)
      if (res.ok) return
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`server did not become ready: ${stderr}`)
}

async function getJson(url: string): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(url)
  const body = await res.json()
  return { ok: res.ok, status: res.status, body }
}

async function loadFixtures(): Promise<Fixtures> {
  const [requests, responses] = await Promise.all([
    readFile(path.join(process.cwd(), "src/contract/fixtures/requests.json"), "utf-8"),
    readFile(path.join(process.cwd(), "src/contract/fixtures/responses.json"), "utf-8")
  ])
  return { requests: JSON.parse(requests), responses: JSON.parse(responses) }
}
