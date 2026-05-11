import assert from "node:assert/strict"
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"
import test from "node:test"
import { isBenchmarkSeedUpload, isBenchmarkSeedUploadedObjectIngest } from "../app.js"
import { authorizeDocumentDelete, authorizeDocumentUpload, authorizeUploadedDocumentIngest } from "../routes/benchmark-seed.js"

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

    const groups = await fetch(`http://127.0.0.1:${port}/document-groups`)
    assert.equal(groups.status, 200)
    const createGroup = await fetch(`http://127.0.0.1:${port}/document-groups`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "契約管理", visibility: "private" })
    })
    assert.equal(createGroup.status, 200)
    const group = (await createGroup.json()) as { groupId: string }
    const shareMissingGroup = await fetch(`http://127.0.0.1:${port}/document-groups/missing/share`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visibility: "org" })
    })
    assert.equal(shareMissingGroup.status, 404)
    const shareGroup = await fetch(`http://127.0.0.1:${port}/document-groups/${encodeURIComponent(group.groupId)}/share`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visibility: "org", sharedGroups: ["CHAT_USER"] })
    })
    assert.equal(shareGroup.status, 200)

    const invalidDocument = await fetch(`http://127.0.0.1:${port}/documents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: "empty.txt" })
    })
    assert.equal(invalidDocument.status, 400)

    const invalidGroupScopeDocument = await fetch(`http://127.0.0.1:${port}/documents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fileName: "group-scope.txt",
        text: "group scoped text",
        scope: { scopeType: "group", groupIds: [] }
      })
    })
    assert.equal(invalidGroupScopeDocument.status, 400)

    const personalDocument = await fetch(`http://127.0.0.1:${port}/documents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fileName: "personal-scope.txt",
        text: "personal scoped text",
        scope: { scopeType: "personal" }
      })
    })
    assert.equal(personalDocument.status, 200)

    const postDocument = await fetch(`http://127.0.0.1:${port}/documents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fixtures.requests.postDocuments)
    })
    assert.equal(postDocument.status, 200)
    const created = (await postDocument.json()) as Record<string, unknown>
    assert.equal(created.fileName, fixtures.responses.uploadedDocumentShape.fileName)
    assert.equal(created.vectorKeys, undefined)
    assert.equal(created.chunks, undefined)
    assert.equal(created.sourceObjectKey, undefined)
    validateSchema(created, responseSchema(openapi, "/documents", "post", 200), openapi)

    const uploadSessionRes = await fetch(`http://127.0.0.1:${port}/documents/uploads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: "handoff.txt", mimeType: "text/plain" })
    })
    assert.equal(uploadSessionRes.status, 200)
    const uploadSession = (await uploadSessionRes.json()) as { uploadId: string; uploadUrl: string; method: "POST"; headers: Record<string, string> }
    validateSchema(uploadSession, responseSchema(openapi, "/documents/uploads", "post", 200), openapi)

    const putUpload = await fetch(uploadSession.uploadUrl, {
      method: uploadSession.method,
      headers: uploadSession.headers,
      body: "S3 handoff upload text."
    })
    assert.equal(putUpload.status, 204)

    const ingestUploaded = await fetch(`http://127.0.0.1:${port}/documents/uploads/${encodeURIComponent(uploadSession.uploadId)}/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: "handoff.txt", mimeType: "text/plain" })
    })
    assert.equal(ingestUploaded.status, 200)
    const ingested = (await ingestUploaded.json()) as Record<string, unknown>
    assert.equal(ingested.vectorKeys, undefined)
    assert.equal(ingested.chunks, undefined)
    assert.equal(ingested.sourceObjectKey, undefined)
    validateSchema(ingested, responseSchema(openapi, "/documents/uploads/{uploadId}/ingest", "post", 200), openapi)

    const invalidUploadIdIngest = await fetch(`http://127.0.0.1:${port}/documents/uploads/not-a-valid-upload-id/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: "handoff.txt", mimeType: "text/plain" })
    })
    assert.equal(invalidUploadIdIngest.status, 400)

    const chatAttachmentSessionRes = await fetch(`http://127.0.0.1:${port}/documents/uploads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: "chat.txt", mimeType: "text/plain", purpose: "chatAttachment" })
    })
    assert.equal(chatAttachmentSessionRes.status, 200)
    const chatAttachmentSession = (await chatAttachmentSessionRes.json()) as { uploadId: string }
    const missingChatScopeIngest = await fetch(
      `http://127.0.0.1:${port}/documents/uploads/${encodeURIComponent(chatAttachmentSession.uploadId)}/ingest`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: "chat.txt", mimeType: "text/plain" })
      }
    )
    assert.equal(missingChatScopeIngest.status, 400)
    const wrongChatScopeIngest = await fetch(
      `http://127.0.0.1:${port}/documents/uploads/${encodeURIComponent(chatAttachmentSession.uploadId)}/ingest`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: "chat.txt", mimeType: "text/plain", scope: { scopeType: "personal", temporaryScopeId: "chat-1" } })
      }
    )
    assert.equal(wrongChatScopeIngest.status, 400)

    const missingIngestRun = await fetch(`http://127.0.0.1:${port}/document-ingest-runs/missing-run`)
    assert.equal(missingIngestRun.status, 404)
    const missingIngestRunEvents = await fetch(`http://127.0.0.1:${port}/document-ingest-runs/missing-run/events`)
    assert.equal(missingIngestRunEvents.status, 404)
    const missingReindex = await fetch(`http://127.0.0.1:${port}/documents/missing-document/reindex`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    })
    assert.equal(missingReindex.status, 404)
    const migrations = await fetch(`http://127.0.0.1:${port}/documents/reindex-migrations`)
    assert.equal(migrations.status, 200)
    const missingCutover = await fetch(`http://127.0.0.1:${port}/documents/reindex-migrations/missing/cutover`, { method: "POST" })
    assert.equal(missingCutover.status, 404)
    const missingRollback = await fetch(`http://127.0.0.1:${port}/documents/reindex-migrations/missing/rollback`, { method: "POST" })
    assert.equal(missingRollback.status, 404)
    const missingDelete = await fetch(`http://127.0.0.1:${port}/documents/missing-document`, { method: "DELETE" })
    assert.equal(missingDelete.status, 404)

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

    const postChatRun = await fetch(`http://127.0.0.1:${port}/chat-runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fixtures.requests.postChat)
    })
    assert.equal(postChatRun.status, 200)
    const chatRun = (await postChatRun.json()) as { runId: string; eventsPath: string }
    validateSchema(chatRun, responseSchema(openapi, "/chat-runs", "post", 200), openapi)
    assert.match(chatRun.eventsPath, new RegExp(`/chat-runs/${chatRun.runId}/events$`))

    const chatRunEvents = await readChatRunEvents(`http://127.0.0.1:${port}${chatRun.eventsPath}`)
    assert.match(chatRunEvents.contentType, /text\/event-stream/)
    const eventStreamText = chatRunEvents.text
    assert.match(eventStreamText, /event: status/)
    assert.match(eventStreamText, /event: final|event: error/)

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

    const createdUser = adminUsers.body.users.find((user: { email: string }) => user.email === "new-user@example.com")
    assert.ok(createdUser)
    const assignRoles = await fetch(`http://127.0.0.1:${port}/admin/users/${createdUser.userId}/roles`, {
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

test("ACCESS_ADMIN は自分自身への SYSTEM_ADMIN 付与が拒否される", async () => {
  const port = 20000 + Math.floor(Math.random() * 1000)
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-contract-access-admin-"))
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
      LOCAL_AUTH_USER_ID: "attacker-sub",
      LOCAL_AUTH_GROUPS: "ACCESS_ADMIN"
    },
    stdio: ["ignore", "pipe", "pipe"]
  })

  try {
    await waitUntilReady(server, port)

    const res = await fetch(`http://127.0.0.1:${port}/admin/users/attacker-sub/roles`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ groups: ["SYSTEM_ADMIN"] })
    })

    assert.equal(res.status, 403)
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

test("benchmark query endpoint is limited to benchmark runner permission", async () => {
  const port = 20500 + Math.floor(Math.random() * 1000)
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-contract-benchmark-query-rbac-"))
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
      LOCAL_AUTH_GROUPS: "RAG_GROUP_MANAGER"
    },
    stdio: ["ignore", "pipe", "pipe"]
  })

  try {
    await waitUntilReady(server, port)

    const query = await fetch(`http://127.0.0.1:${port}/benchmark/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "rbac-check", question: "権限確認" })
    })
    assert.equal(query.status, 403)

    const runs = await fetch(`http://127.0.0.1:${port}/benchmark-runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ suiteId: "standard-agent-v1", mode: "agent", runner: "codebuild" })
    })
    assert.equal(runs.status, 200)
  } finally {
    server.kill("SIGTERM")
  }
})

test("benchmark runner can call query endpoint without benchmark run administration", async () => {
  const port = 20700 + Math.floor(Math.random() * 1000)
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-contract-benchmark-runner-rbac-"))
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

    const query = await fetch(`http://127.0.0.1:${port}/benchmark/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "runner-check", question: "権限確認", includeDebug: false })
    })
    assert.equal(query.status, 200)
    const body = (await query.json()) as Record<string, unknown>
    assert.equal(body.id, "runner-check")
    assert.equal("debug" in body, false)

    const benchmarkSearch = await fetch(`http://127.0.0.1:${port}/benchmark/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "権限確認", topK: 3 })
    })
    assert.equal(benchmarkSearch.status, 200)
    const searchBody = (await benchmarkSearch.json()) as Record<string, unknown>
    assert.equal(searchBody.query, "権限確認")
    assert.equal(Array.isArray(searchBody.results), true)

    const publicSearch = await fetch(`http://127.0.0.1:${port}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "権限確認", topK: 3 })
    })
    assert.equal(publicSearch.status, 403)

    const runs = await fetch(`http://127.0.0.1:${port}/benchmark-runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ suiteId: "standard-agent-v1", mode: "agent", runner: "codebuild" })
    })
    assert.equal(runs.status, 403)
  } finally {
    server.kill("SIGTERM")
  }
})

test("benchmark operators can use benchmark run administration without direct query permission", async () => {
  const port = 21900 + Math.floor(Math.random() * 1000)
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-contract-benchmark-operator-rbac-"))
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
      LOCAL_AUTH_GROUPS: "BENCHMARK_OPERATOR"
    },
    stdio: ["ignore", "pipe", "pipe"]
  })

  try {
    await waitUntilReady(server, port)

    const suites = await fetch(`http://127.0.0.1:${port}/benchmark-suites`)
    assert.equal(suites.status, 200)
    const suitesBody = (await suites.json()) as { suites?: Array<{ suiteId?: string; datasetS3Key?: string }> }
    assert.equal(
      suitesBody.suites?.some((suite) =>
        suite.suiteId === "mlit-pdf-figure-table-rag-seed-v1"
          && suite.datasetS3Key === "datasets/agent/mlit-pdf-figure-table-rag-seed-v1.jsonl"
      ),
      true
    )

    const listRuns = await fetch(`http://127.0.0.1:${port}/benchmark-runs`)
    assert.equal(listRuns.status, 200)

    const createRun = await fetch(`http://127.0.0.1:${port}/benchmark-runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ suiteId: "standard-agent-v1", mode: "agent", runner: "codebuild" })
    })
    assert.equal(createRun.status, 200)
    const run = (await createRun.json()) as { runId: string }

    const query = await fetch(`http://127.0.0.1:${port}/benchmark/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "operator-check", question: "権限確認" })
    })
    assert.equal(query.status, 403)

    const cancel = await fetch(`http://127.0.0.1:${port}/benchmark-runs/${run.runId}/cancel`, { method: "POST" })
    assert.equal(cancel.status, 403)

    const download = await fetch(`http://127.0.0.1:${port}/benchmark-runs/${run.runId}/download`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ artifact: "report" })
    })
    assert.equal(download.status, 403)

    const logs = await fetch(`http://127.0.0.1:${port}/benchmark-runs/${run.runId}/logs`)
    assert.equal(logs.status, 403)
  } finally {
    server.kill("SIGTERM")
  }
})

test("benchmark search does not allow dataset user overrides", async () => {
  const setupPort = 20800 + Math.floor(Math.random() * 1000)
  const runnerPort = 21800 + Math.floor(Math.random() * 1000)
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-contract-benchmark-search-acl-"))
  const tsxBin = path.resolve(process.cwd(), "../../node_modules/.bin/tsx")
  const setupServer = spawn(tsxBin, ["src/local.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(setupPort),
      MOCK_BEDROCK: "true",
      USE_LOCAL_VECTOR_STORE: "true",
      USE_LOCAL_QUESTION_STORE: "true",
      LOCAL_DATA_DIR: dataDir,
      AUTH_ENABLED: "false",
      LOCAL_AUTH_GROUPS: "SYSTEM_ADMIN"
    },
    stdio: ["ignore", "pipe", "pipe"]
  })

  try {
    await waitUntilReady(setupServer, setupPort)
    const upload = await fetch(`http://127.0.0.1:${setupPort}/documents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fileName: "group-a-secret.md",
        text: "Alpha launch approval policy is visible only to group A.",
        skipMemory: true,
        metadata: { tenantId: "tenant-a", aclGroups: ["GROUP_A"] }
      })
    })
    assert.equal(upload.status, 200)

    const systemAdminOverride = await fetch(`http://127.0.0.1:${setupPort}/benchmark/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: "alpha launch approval",
        user: { userId: "dataset-user-a", groups: ["GROUP_A"] }
      })
    })
    assert.equal(systemAdminOverride.status, 400)
  } finally {
    await stopServer(setupServer)
  }

  const runnerServer = spawn(tsxBin, ["src/local.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(runnerPort),
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
    await waitUntilReady(runnerServer, runnerPort)
    const groupA = await fetch(`http://127.0.0.1:${runnerPort}/benchmark/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: "alpha launch approval",
        topK: 10,
        lexicalTopK: 20,
        semanticTopK: 0,
        user: { userId: "dataset-user-a", groups: ["GROUP_A"] }
      })
    })
    assert.equal(groupA.status, 400)

    const groupB = await fetch(`http://127.0.0.1:${runnerPort}/benchmark/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: "alpha launch approval",
        topK: 10,
        lexicalTopK: 20,
        semanticTopK: 0,
        user: { userId: "dataset-user-b", groups: ["GROUP_B"] }
      })
    })
    assert.equal(groupB.status, 400)

    const privilegedSubject = await fetch(`http://127.0.0.1:${runnerPort}/benchmark/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: "alpha launch approval",
        user: { userId: "dataset-admin", groups: ["SYSTEM_ADMIN"] }
      })
    })
    assert.equal(privilegedSubject.status, 400)
  } finally {
    await stopServer(runnerServer)
  }
})

test("benchmark runner can list and upload only isolated benchmark seed documents", async () => {
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

    const documentsBeforeSeed = await fetch(`http://127.0.0.1:${port}/documents`)
    assert.equal(documentsBeforeSeed.status, 200)

    const generalUpload = await fetch(`http://127.0.0.1:${port}/documents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: "general.md", text: "通常文書です。", mimeType: "text/markdown" })
    })
    assert.equal(generalUpload.status, 403)

    const generalUploadSession = await fetch(`http://127.0.0.1:${port}/documents/uploads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: "general.md", mimeType: "text/markdown" })
    })
    assert.equal(generalUploadSession.status, 403)

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
          source: "benchmark-runner",
          searchAliases: { "立替": ["経費精算"] },
          drawingSourceType: "project_drawing",
          drawingSheetMetadata: [{ pageOrSheet: "P1", drawingNo: "A-001", sheetTitle: "配置図", scale: "1/100", sourceQaIds: ["QA-001"], confidence: 0.75 }],
          drawingRegionIndex: [{
            regionId: "s01-titleblock-001",
            regionType: "titleblock",
            pageOrSheet: "P1",
            bbox: { unit: "normalized_page", x: 0.55, y: 0.72, width: 0.45, height: 0.28 },
            bboxSource: "heuristic_region_candidate",
            evidenceAnchor: "title block",
            sourceQaIds: ["QA-001"],
            confidence: 0.55
          }],
          drawingReferenceGraph: {
            schemaVersion: 1,
            nodes: [{
              nodeId: "s01-page-p1",
              nodeType: "page",
              pageOrSheet: "P1",
              bbox: { unit: "normalized_page", x: 0, y: 0, width: 1, height: 1 },
              label: "P1",
              sourceQaIds: [],
              confidence: 0.6
            }],
            edges: [],
            detailIndex: [],
            calloutEdges: [],
            conflicts: []
          }
        }
      })
    })
    assert.equal(seedUpload.status, 200)
    const manifest = (await seedUpload.json()) as {
      documentId: string
    }
    const documentsAfterSeed = await fetch(`http://127.0.0.1:${port}/documents`)
    assert.equal(documentsAfterSeed.status, 200)
    const seedList = (await documentsAfterSeed.json()) as {
      documents?: Array<{
        documentId?: string
        vectorKeys?: string[]
        chunks?: unknown[]
        sourceObjectKey?: string
        metadata?: { aclGroups?: string[]; docType?: string; source?: string; searchAliases?: Record<string, string[]>; drawingSourceType?: string; drawingSheetMetadata?: unknown[]; drawingRegionIndex?: unknown[]; drawingReferenceGraph?: { schemaVersion?: number } }
      }>
    }
    const listedSeed = seedList.documents?.find((document) => document.documentId === manifest.documentId)
    assert.ok(listedSeed)
    assert.equal(listedSeed.vectorKeys, undefined)
    assert.equal(listedSeed.chunks, undefined)
    assert.equal(listedSeed.sourceObjectKey, undefined)
    assert.deepEqual(listedSeed.metadata?.aclGroups, ["BENCHMARK_RUNNER"])
    assert.equal(listedSeed.metadata?.docType, "benchmark-corpus")
    assert.equal(listedSeed.metadata?.source, "benchmark-runner")
    assert.deepEqual(listedSeed.metadata?.searchAliases, { "立替": ["経費精算"] })
    assert.equal(listedSeed.metadata?.drawingSourceType, "project_drawing")
    assert.equal(listedSeed.metadata?.drawingSheetMetadata?.length, 1)
    assert.equal(listedSeed.metadata?.drawingRegionIndex?.length, 1)
    assert.equal(listedSeed.metadata?.drawingReferenceGraph?.schemaVersion, 1)

    const seedDelete = await fetch(`http://127.0.0.1:${port}/documents/${encodeURIComponent(manifest.documentId)}`, {
      method: "DELETE"
    })
    assert.equal(seedDelete.status, 200)
    const deleteBody = (await seedDelete.json()) as { documentId?: string; deletedVectorCount?: number }
    assert.equal(deleteBody.documentId, manifest.documentId)
    assert.equal(typeof deleteBody.deletedVectorCount, "number")

    const missingDelete = await fetch(`http://127.0.0.1:${port}/documents/missing-benchmark-seed`, {
      method: "DELETE"
    })
    assert.equal(missingDelete.status, 404)

    const allganizeSeedUpload = await fetch(`http://127.0.0.1:${port}/documents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fileName: "allganize.txt",
        text: "Allganize benchmark seed text.",
        mimeType: "text/plain",
        skipMemory: true,
        metadata: {
          benchmarkSeed: true,
          benchmarkSuiteId: "allganize-rag-evaluation-ja-v1",
          benchmarkSourceHash: "allganize-hash",
          benchmarkIngestSignature: "allganize-signature",
          benchmarkCorpusSkipMemory: true,
          benchmarkEmbeddingModelId: "api-default",
          aclGroups: ["BENCHMARK_RUNNER"],
          docType: "benchmark-corpus",
          lifecycleStatus: "active",
          source: "benchmark-runner"
        }
      })
    })
    assert.equal(allganizeSeedUpload.status, 200)

    const seedUploadSession = await fetch(`http://127.0.0.1:${port}/documents/uploads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: "allganize-uploaded.txt", mimeType: "text/plain", purpose: "benchmarkSeed" })
    })
    assert.equal(seedUploadSession.status, 200)
    const session = (await seedUploadSession.json()) as { uploadId: string; uploadUrl: string; method: "POST"; headers: Record<string, string> }
    const transfer = await fetch(session.uploadUrl, {
      method: session.method,
      headers: session.headers,
      body: "Allganize benchmark seed text from upload session."
    })
    assert.equal(transfer.status, 204)
    const uploadedSeedIngest = await fetch(`http://127.0.0.1:${port}/documents/uploads/${encodeURIComponent(session.uploadId)}/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fileName: "allganize-uploaded.txt",
        mimeType: "text/plain",
        skipMemory: true,
        metadata: {
          benchmarkSeed: true,
          benchmarkSuiteId: "allganize-rag-evaluation-ja-v1",
          benchmarkSourceHash: "allganize-upload-hash",
          benchmarkIngestSignature: "allganize-upload-signature",
          benchmarkCorpusSkipMemory: true,
          benchmarkEmbeddingModelId: "api-default",
          aclGroups: ["BENCHMARK_RUNNER"],
          docType: "benchmark-corpus",
          lifecycleStatus: "active",
          source: "benchmark-runner"
        }
      })
    })
    assert.equal(uploadedSeedIngest.status, 200)

    const asyncSeedUploadSession = await fetch(`http://127.0.0.1:${port}/documents/uploads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: "async-seed.txt", mimeType: "text/plain", purpose: "benchmarkSeed" })
    })
    assert.equal(asyncSeedUploadSession.status, 200)
    const asyncSession = (await asyncSeedUploadSession.json()) as { uploadId: string; uploadUrl: string; method: "POST"; headers: Record<string, string> }
    const asyncTransfer = await fetch(asyncSession.uploadUrl, {
      method: asyncSession.method,
      headers: asyncSession.headers,
      body: "Async benchmark seed text from upload session."
    })
    assert.equal(asyncTransfer.status, 204)
    const asyncRunStart = await fetch(`http://127.0.0.1:${port}/document-ingest-runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        uploadId: asyncSession.uploadId,
        fileName: "async-seed.txt",
        mimeType: "text/plain",
        skipMemory: true,
        metadata: {
          benchmarkSeed: true,
          benchmarkSuiteId: "allganize-rag-evaluation-ja-v1",
          benchmarkSourceHash: "async-upload-hash",
          benchmarkIngestSignature: "async-upload-signature",
          benchmarkCorpusSkipMemory: true,
          benchmarkEmbeddingModelId: "api-default",
          aclGroups: ["BENCHMARK_RUNNER"],
          docType: "benchmark-corpus",
          lifecycleStatus: "active",
          source: "benchmark-runner"
        }
      })
    })
    assert.equal(asyncRunStart.status, 200)
    const asyncRun = (await asyncRunStart.json()) as { runId: string }
    const asyncRunRead = await fetch(`http://127.0.0.1:${port}/document-ingest-runs/${encodeURIComponent(asyncRun.runId)}`)
    assert.equal(asyncRunRead.status, 200)
  } finally {
    server.kill("SIGTERM")
  }
})

test("benchmark seed upload whitelist accepts isolated PDF corpus payloads only", () => {
  const metadata = {
    benchmarkSeed: true,
    benchmarkSuiteId: "mlit-pdf-figure-table-rag-seed-v1",
    benchmarkSourceHash: "hash",
    benchmarkIngestSignature: "signature",
    benchmarkCorpusSkipMemory: true,
    benchmarkEmbeddingModelId: "api-default",
    aclGroups: ["BENCHMARK_RUNNER"],
    docType: "benchmark-corpus",
    lifecycleStatus: "active",
    source: "benchmark-runner"
  }
  const pdfSeed = {
    fileName: "source.pdf",
    contentBase64: Buffer.from("%PDF-1.4 sample").toString("base64"),
    mimeType: "application/pdf",
    metadata
  }

  assert.equal(isBenchmarkSeedUpload(pdfSeed), true)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, fileName: "../source.pdf" }), false)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, mimeType: "text/plain" }), false)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, text: "mixed payload" }), false)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, contentBase64: "not-base64" }), false)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, metadata: { ...metadata, extra: "blocked" } }), false)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, metadata: { ...metadata, benchmarkSuiteId: "unknown-suite" } }), false)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, metadata: undefined }), false)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, metadata: { ...metadata, benchmarkSeed: false } }), false)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, metadata: { ...metadata, benchmarkIngestSignature: "" } }), false)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, metadata: { ...metadata, benchmarkEmbeddingModelId: "" } }), false)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, metadata: { ...metadata, source: "manual" } }), false)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, metadata: { ...metadata, docType: "general" } }), false)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, metadata: { ...metadata, lifecycleStatus: "archived" } }), false)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, metadata: { ...metadata, aclGroups: "BENCHMARK_RUNNER" } }), false)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, metadata: { ...metadata, aclGroups: ["CHAT_USER"] } }), false)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, fileName: "nested\\source.pdf" }), false)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, contentBase64: "" }), false)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, contentBase64: "AAA" }), false)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, fileName: "source.txt" }), false)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, textractJson: "{}" }), false)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, metadata: { ...metadata, benchmarkSuiteId: "architecture-drawing-qarag-v0.1" } }), true)
  assert.equal(isBenchmarkSeedUpload({
    ...pdfSeed,
    metadata: {
      ...metadata,
      benchmarkSuiteId: "architecture-drawing-qarag-v0.1",
      drawingSourceType: "project_drawing",
      drawingSheetMetadata: [{ pageOrSheet: "P1", drawingNo: "A-001", sourceQaIds: ["QA-001"], confidence: 0.75 }],
      drawingRegionIndex: [{
        regionId: "s01-titleblock-001",
        regionType: "titleblock",
        pageOrSheet: "P1",
        bbox: { unit: "normalized_page", x: 0.55, y: 0.72, width: 0.45, height: 0.28 },
        bboxSource: "heuristic_region_candidate",
        evidenceAnchor: "title block",
        sourceQaIds: ["QA-001"],
        confidence: 0.55
      }],
      drawingReferenceGraph: {
        schemaVersion: 1,
        nodes: [{
          nodeId: "s01-page-p1",
          nodeType: "page",
          pageOrSheet: "P1",
          bbox: { unit: "normalized_page", x: 0, y: 0, width: 1, height: 1 },
          label: "P1",
          sourceQaIds: [],
          confidence: 0.6
        }],
        edges: [],
        detailIndex: [],
        calloutEdges: [],
        conflicts: []
      }
    }
  }), true)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, metadata: { ...metadata, benchmarkSuiteId: "architecture-drawing-qarag-v0.1", drawingSourceType: "unsafe" } }), false)
  assert.equal(isBenchmarkSeedUpload({ ...pdfSeed, metadata: { ...metadata, benchmarkSuiteId: "architecture-drawing-qarag-v0.1", drawingReferenceGraph: { schemaVersion: 2 } } }), false)
  assert.equal(isBenchmarkSeedUploadedObjectIngest({ fileName: "source.pdf", mimeType: "application/pdf", metadata }), true)
  assert.equal(isBenchmarkSeedUploadedObjectIngest({ fileName: "source.pdf", mimeType: "text/plain", metadata }), false)
  assert.equal(isBenchmarkSeedUploadedObjectIngest({ fileName: "../source.pdf", mimeType: "application/pdf", metadata }), false)
  assert.equal(isBenchmarkSeedUploadedObjectIngest({ fileName: "source.pdf", mimeType: "application/pdf" }), false)
  assert.equal(isBenchmarkSeedUploadedObjectIngest({ fileName: "source.pdf", metadata }), false)

  const textSeed = {
    fileName: "source.md",
    text: "benchmark seed",
    mimeType: "text/markdown",
    metadata: { ...metadata, searchAliases: { "立替": ["経費精算"] } }
  }
  assert.equal(isBenchmarkSeedUpload(textSeed), true)
  assert.equal(isBenchmarkSeedUpload({ ...textSeed, mimeType: undefined }), true)
  assert.equal(isBenchmarkSeedUpload({ ...textSeed, fileName: "source.csv" }), false)
  assert.equal(isBenchmarkSeedUpload({ ...textSeed, contentBase64: "AAAA" }), false)
  assert.equal(isBenchmarkSeedUpload({ ...textSeed, textractJson: "{}" }), false)
  assert.equal(isBenchmarkSeedUpload({ ...textSeed, text: "" }), false)
  assert.equal(isBenchmarkSeedUpload({ ...textSeed, metadata: { ...metadata, searchAliases: { "": ["経費精算"] } } }), false)
  assert.equal(isBenchmarkSeedUpload({ ...textSeed, metadata: { ...metadata, searchAliases: { "立替": [] } } }), false)
  assert.equal(isBenchmarkSeedUpload({ ...textSeed, metadata: { ...metadata, searchAliases: { "立替": [""] } } }), false)
  assert.equal(isBenchmarkSeedUpload({ ...textSeed, metadata: { ...metadata, searchAliases: [] } }), false)
  assert.equal(isBenchmarkSeedUpload({ ...textSeed, metadata: { ...metadata, benchmarkSourceHash: "" } }), false)
  assert.equal(isBenchmarkSeedUpload({ ...textSeed, metadata: { ...metadata, benchmarkCorpusSkipMemory: "true" } }), false)
  assert.equal(isBenchmarkSeedUpload({ ...textSeed, metadata: { ...metadata, aclGroups: ["BENCHMARK_RUNNER", "EXTRA"] } }), false)
  assert.equal(isBenchmarkSeedUpload({ fileName: "source.txt", metadata }), false)
  assert.equal(isBenchmarkSeedUploadedObjectIngest({ fileName: "source.md", mimeType: "text/markdown", metadata }), true)
  assert.equal(isBenchmarkSeedUploadedObjectIngest({ fileName: "source.txt", metadata }), true)
  assert.equal(isBenchmarkSeedUploadedObjectIngest({ fileName: "source.csv", metadata }), false)
  assert.equal(isBenchmarkSeedUploadedObjectIngest({ fileName: "source.txt", mimeType: "application/json", metadata }), false)
})

test("benchmark seed authorization rejects non-isolated document operations", async () => {
  const runner = { userId: "runner-1", email: "runner@example.com", cognitoGroups: ["BENCHMARK_RUNNER"] }
  const manager = { userId: "manager-1", email: "manager@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"] }
  const chatUser = { userId: "chat-1", email: "chat@example.com", cognitoGroups: ["CHAT_USER"] }
  const seedBody = {
    fileName: "source.txt",
    text: "benchmark seed",
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
  }

  assert.doesNotThrow(() => authorizeDocumentUpload(runner, seedBody))
  assert.doesNotThrow(() => authorizeDocumentUpload(manager, { fileName: "general.txt", text: "general" }))
  assert.throws(() => authorizeDocumentUpload(runner, { fileName: "general.txt", text: "general" }), /benchmark seed upload/)
  assert.doesNotThrow(() => authorizeUploadedDocumentIngest(chatUser, "chatAttachment", { fileName: "note.txt", mimeType: "text/plain" }))
  assert.throws(() => authorizeUploadedDocumentIngest(runner, "document", { fileName: "note.txt", mimeType: "text/plain" }), /missing rag:doc:write:group/)
  assert.throws(() => authorizeUploadedDocumentIngest(runner, "benchmarkSeed", { fileName: "source.txt", mimeType: "text/plain", metadata: { ...seedBody.metadata, docType: "general" } }), /benchmark seed upload/)

  const documentManifests = {
    "seed-1": {
      documentId: "seed-1",
      fileName: "source.txt",
      chunkCount: 1,
      memoryCardCount: 0,
      createdAt: "2026-05-01T00:00:00.000Z",
      lifecycleStatus: "active",
      metadata: seedBody.metadata
    },
    "general-1": {
      documentId: "general-1",
      fileName: "general.txt",
      chunkCount: 1,
      memoryCardCount: 0,
      createdAt: "2026-05-01T00:00:00.000Z",
      lifecycleStatus: "active",
      metadata: { docType: "general" }
    }
  }
  const service = {
    getDocumentManifest: async (documentId: string) => documentManifests[documentId as keyof typeof documentManifests]
  } as any
  await assert.doesNotReject(() => authorizeDocumentDelete(service, runner, "seed-1"))
  await assert.rejects(() => authorizeDocumentDelete(service, runner, "general-1"), /benchmark seed delete/)
  await assert.rejects(() => authorizeDocumentDelete(service, chatUser, "seed-1"), /missing document delete permission/)
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
        assigneeDepartment: "総務部",
        category: "その他の質問",
        priority: "normal"
      })
    })
    assert.equal(createQuestion.status, 200)
    const question = (await createQuestion.json()) as { questionId: string; requesterName: string; requesterDepartment: string; requesterUserId?: string }
    assert.equal(question.requesterName, "local-dev@example.com")
    assert.equal(question.requesterDepartment, "未設定")
    assert.equal(question.requesterUserId, "local-dev")

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

async function readChatRunEvents(url: string): Promise<{ contentType: string; text: string }> {
  let lastStatus = 0
  let lastContentType = ""
  let lastText = ""
  let lastError: unknown

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "text/event-stream" },
        signal: AbortSignal.timeout(20_000)
      })
      lastStatus = response.status
      lastContentType = response.headers.get("content-type") ?? ""
      lastText = await response.text()
      if (
        response.status === 200 &&
        /text\/event-stream/.test(lastContentType) &&
        /event: status/.test(lastText) &&
        /event: final|event: error/.test(lastText)
      ) {
        return { contentType: lastContentType, text: lastText }
      }
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(
    `chat run event stream was not ready: status=${lastStatus} contentType=${lastContentType} body=${lastText.slice(0, 200)} error=${String(lastError ?? "")}`
  )
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

  for (let i = 0; i < 90; i += 1) {
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

async function stopServer(server: ReturnType<typeof spawn>): Promise<void> {
  if (server.exitCode !== null) return
  const closed = new Promise<void>((resolve) => server.once("close", () => resolve()))
  server.kill("SIGTERM")
  await Promise.race([closed, new Promise((resolve) => setTimeout(resolve, 1000))])
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
