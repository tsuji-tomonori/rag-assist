import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { mkdtemp } from "node:fs/promises"
import { setTimeout as delay } from "node:timers/promises"
import test from "node:test"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalConversationHistoryStore } from "../adapters/local-conversation-history-store.js"
import { LocalChatRunEventStore } from "../adapters/local-chat-run-event-store.js"
import { LocalChatRunStore } from "../adapters/local-chat-run-store.js"
import { LocalDocumentIngestRunEventStore } from "../adapters/local-document-ingest-run-event-store.js"
import { LocalDocumentIngestRunStore } from "../adapters/local-document-ingest-run-store.js"
import { LocalDocumentGroupStore } from "../adapters/local-document-group-store.js"
import { LocalBenchmarkRunStore } from "../adapters/local-benchmark-run-store.js"
import { LocalQuestionStore } from "../adapters/local-question-store.js"
import { LocalVectorStore } from "../adapters/local-vector-store.js"
import { MockBedrockTextModel } from "../adapters/mock-bedrock.js"
import type { Dependencies } from "../dependencies.js"
import type { DebugTrace, ManagedUser } from "../types.js"
import type { UserDirectory } from "../adapters/user-directory.js"
import type { CodeBuildLogReader } from "../adapters/codebuild-log-reader.js"
import { ragRuntimePolicy } from "../agent/runtime-policy.js"
import { createBenchmarkArtifactDownloadMetadata, createDebugTraceDownloadMetadata, formatDebugTraceJson, MemoRagService } from "./memorag-service.js"

test("service ingests text, lists manifests, persists debug traces, and deletes all document vectors", async () => {
  const { service, dataDir } = await createService()

  const manifest = await service.ingest({
    fileName: "requirements.txt",
    text: "ソフトウェア要求の分類。ソフトウェア製品要求、ソフトウェアプロジェクト要求、機能要求、非機能要求、技術制約、サービス品質制約。",
    metadata: { owner: "qa" }
  })

  assert.equal(manifest.fileName, "requirements.txt")
  assert.equal(manifest.chunkCount, 1)
  assert.ok(manifest.memoryCardCount >= 1)
  assert.ok(manifest.memoryCardsObjectKey)
  assert.ok(manifest.evidenceVectorKeys?.length)
  assert.ok(manifest.memoryVectorKeys?.length)
  assert.equal(manifest.pipelineVersions?.chunkerVersion, "chunk-semantic-v3")
  assert.ok(manifest.chunks?.[0]?.chunkHash)
  assert.equal(manifest.documentStatistics?.chunkCount, manifest.chunkCount)
  assert.ok((manifest.documentStatistics?.averageChunkChars ?? 0) > 0)

  const listed = await service.listDocuments()
  assert.deepEqual(listed.map((doc) => doc.documentId), [manifest.documentId])

  const answer = await service.chat({
    question: "ソフトウェア要求の分類を洗い出して",
    includeDebug: true,
    minScore: 0.01
  })
  assert.equal(answer.isAnswerable, true)
  assert.ok(answer.debug?.runId)
  assert.equal(answer.debug?.schemaVersion, 1)
  assert.equal(answer.debug?.pipelineVersions?.promptVersion, "rag-prompts-v1")
  assert.equal(answer.debug?.steps.at(-1)?.label, "finalize_response")
  assert.match(String(answer.debug?.steps.at(-1)?.output?.answer ?? ""), /ソフトウェア製品要求|分類/)

  const debugRuns = await service.listDebugRuns()
  assert.equal(debugRuns.length, 1)
  assert.deepEqual(await service.getDebugRun(answer.debug?.runId ?? ""), debugRuns[0])

  const deleted = await service.deleteDocument(manifest.documentId)
  assert.equal(deleted.documentId, manifest.documentId)
  assert.equal(deleted.deletedVectorCount, manifest.vectorKeys.length)
  assert.deepEqual(await service.listDocuments(), [])

  const evidenceDb = JSON.parse(await readFile(path.join(dataDir, "evidence-vectors.json"), "utf-8")) as { records: unknown[] }
  const memoryDb = JSON.parse(await readFile(path.join(dataDir, "memory-vectors.json"), "utf-8")) as { records: unknown[] }
  assert.equal(evidenceDb.records.length, 0)
  assert.equal(memoryDb.records.length, 0)
})

test("service rejects empty uploads and missing documents", async () => {
  const { service } = await createService()

  await assert.rejects(() => service.ingest({ fileName: "empty.txt", text: "   " }), /extractable text|No chunks/)
  await assert.rejects(() => service.deleteDocument("missing-document-id"))
  assert.equal(await service.getDebugRun("missing-run"), undefined)
})

test("service listDocuments filters manifests by ACL for callers", async () => {
  const { service } = await createService()
  const general = await service.ingest({
    fileName: "general.md",
    text: "通常利用者向けの資料です。",
    skipMemory: true
  })
  const benchmark = await service.ingest({
    fileName: "handbook.md",
    text: "経費精算は30日以内です。",
    skipMemory: true,
    metadata: {
      aclGroups: ["BENCHMARK_RUNNER"],
      docType: "benchmark-corpus",
      source: "benchmark-runner",
      lifecycleStatus: "active"
    }
  })
  const chatUser = { userId: "chat-1", email: "chat@example.com", cognitoGroups: ["CHAT_USER"] }
  const benchmarkRunner = { userId: "runner-1", email: "runner@example.com", cognitoGroups: ["BENCHMARK_RUNNER"] }
  const systemAdmin = { userId: "admin-1", email: "admin@example.com", cognitoGroups: ["SYSTEM_ADMIN"] }

  assert.deepEqual((await service.listDocuments(chatUser)).map((doc) => doc.documentId), [general.documentId])
  assert.deepEqual((await service.listDocuments(benchmarkRunner)).map((doc) => doc.documentId).sort(), [benchmark.documentId, general.documentId].sort())
  assert.deepEqual((await service.listDocuments(systemAdmin)).map((doc) => doc.documentId).sort(), [benchmark.documentId, general.documentId].sort())
})

test("service listDocuments denies group-scoped manifests to non-members without legacy ACLs", async () => {
  const { service } = await createService()
  const owner = { userId: "owner-1", email: "owner@example.com", cognitoGroups: ["CHAT_USER"] }
  const member = { userId: "member-1", email: "member@example.com", cognitoGroups: ["CHAT_USER"] }
  const outsider = { userId: "outsider-1", email: "outsider@example.com", cognitoGroups: ["CHAT_USER"] }
  const group = await service.createDocumentGroup(owner, {
    name: "Private launch group",
    sharedUserIds: [member.userId]
  })
  const publicDoc = await service.ingest({
    fileName: "public.md",
    text: "全員が読める一般資料です。",
    skipMemory: true
  })
  const groupDoc = await service.ingest({
    fileName: "group-secret.md",
    text: "group scope only launch plan.",
    skipMemory: true,
    metadata: {
      scopeType: "group",
      ownerUserId: owner.userId,
      groupIds: [group.groupId]
    }
  })

  assert.deepEqual((await service.listDocuments(outsider)).map((doc) => doc.documentId), [publicDoc.documentId])
  assert.deepEqual((await service.listDocuments(owner)).map((doc) => doc.documentId).sort(), [groupDoc.documentId, publicDoc.documentId].sort())
  assert.deepEqual((await service.listDocuments(member)).map((doc) => doc.documentId).sort(), [groupDoc.documentId, publicDoc.documentId].sort())
})

test("service stores document group hierarchy outside S3 object keys", async () => {
  const { service, deps } = await createService()
  const owner = { userId: "owner-1", email: "owner@example.com", cognitoGroups: ["CHAT_USER"] }
  const parent = await service.createDocumentGroup(owner, {
    name: "社内規定",
    visibility: "shared",
    sharedGroups: ["HR"]
  })
  const child = await service.createDocumentGroup(owner, {
    name: "人事",
    parentGroupId: parent.groupId,
    visibility: "private"
  })
  const grandchild = await service.createDocumentGroup(owner, {
    name: "採用",
    parentGroupId: child.groupId,
    visibility: "private"
  })
  const anotherParent = await service.createDocumentGroup(owner, {
    name: "全社共有",
    visibility: "private"
  })

  assert.equal(child.parentGroupId, parent.groupId)
  assert.deepEqual(child.ancestorGroupIds, [parent.groupId])
  assert.deepEqual(grandchild.ancestorGroupIds, [parent.groupId, child.groupId])
  assert.equal((await deps.objectStore.listKeys("document-groups/")).length, 0)

  const moved = await service.updateDocumentGroupSharing(owner, child.groupId, {
    parentGroupId: anotherParent.groupId,
    visibility: "shared",
    sharedGroups: ["HR"]
  })
  assert.equal(moved?.parentGroupId, anotherParent.groupId)
  assert.deepEqual(moved?.ancestorGroupIds, [anotherParent.groupId])
  assert.deepEqual(moved?.sharedGroups, ["HR"])
  assert.deepEqual((await deps.documentGroupStore.get(grandchild.groupId))?.ancestorGroupIds, [anotherParent.groupId, child.groupId])
})

test("service reindexes documents through embedding cache compatible pipeline versions", async () => {
  const { service } = await createService()
  const manifest = await service.ingest({
    fileName: "policy.md",
    text: "# 申請手順\n申請期限は翌月5営業日です。\n\n# 例外\n例外承認者は部長です。",
    metadata: { tenantId: "tenant-a" }
  })

  assert.ok(manifest.chunks?.some((chunk) => chunk.sectionPath?.includes("申請手順")))
  const actor = { userId: "manager-1", email: "manager@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"] }
  const reindexed = await service.reindexDocument(actor, manifest.documentId)
  assert.notEqual(reindexed.documentId, manifest.documentId)
  assert.equal(reindexed.metadata?.stagedFromDocumentId, manifest.documentId)
  assert.equal(reindexed.lifecycleStatus, "active")
  assert.equal(reindexed.embeddingModelId, manifest.embeddingModelId)
  assert.ok(reindexed.memoryCardCount >= manifest.memoryCardCount)

  const migrations = await service.listReindexMigrations()
  assert.equal(migrations[0]?.status, "cutover")
  assert.equal((await service.listDocuments()).some((doc) => doc.documentId === manifest.documentId), false)
})

test("service stages and rolls back structured blue-green reindex migrations", async () => {
  const { service, dataDir } = await createService()
  const textractJson = JSON.stringify({
    Blocks: [
      { Id: "table-1", BlockType: "TABLE", Page: 1, Relationships: [{ Type: "CHILD", Ids: ["cell-1", "cell-2"] }] },
      { Id: "cell-1", BlockType: "CELL", RowIndex: 1, ColumnIndex: 1, Relationships: [{ Type: "CHILD", Ids: ["word-1"] }] },
      { Id: "cell-2", BlockType: "CELL", RowIndex: 1, ColumnIndex: 2, Relationships: [{ Type: "CHILD", Ids: ["word-2"] }] },
      { Id: "word-1", BlockType: "WORD", Text: "項目" },
      { Id: "word-2", BlockType: "WORD", Text: "期限" }
    ]
  })
  const manifest = await service.ingest({ fileName: "policy.textract.json", textractJson, skipMemory: true })

  assert.equal(manifest.chunks?.[0]?.chunkKind, "table")
  assert.ok(manifest.structuredBlocksObjectKey)

  const actor = { userId: "manager-1", email: "manager@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"] }
  const staged = await service.stageReindexMigration(actor, manifest.documentId)
  assert.equal(staged.status, "staged")
  assert.deepEqual((await service.listDocuments()).map((doc) => doc.documentId), [manifest.documentId])

  const cutover = await service.cutoverReindexMigration(staged.migrationId)
  assert.equal(cutover.status, "cutover")
  const activeAfterCutover = await service.listDocuments()
  assert.deepEqual(activeAfterCutover.map((doc) => doc.documentId), [staged.stagedDocumentId])
  assert.equal(activeAfterCutover[0]?.chunks?.[0]?.chunkKind, "table")
  const evidenceDbAfterCutover = JSON.parse(await readFile(path.join(dataDir, "evidence-vectors.json"), "utf-8")) as {
    records: Array<{ key: string; metadata?: { lifecycleStatus?: string } }>
  }
  assert.equal(
    evidenceDbAfterCutover.records.find((record) => record.key.startsWith(staged.stagedDocumentId))?.metadata?.lifecycleStatus,
    "active"
  )

  const rolledBack = await service.rollbackReindexMigration(staged.migrationId)
  assert.equal(rolledBack.status, "rolled_back")
  const activeAfterRollback = await service.listDocuments()
  assert.equal(activeAfterRollback.length, 1)
  assert.equal(activeAfterRollback[0]?.chunks?.[0]?.chunkKind, "table")
})

test("service restores staging state when cutover vector activation fails after partial write", async () => {
  let failActivePut = false
  let stagedDocumentId = ""
  const { service, dataDir } = await createService({
    evidencePutErrorAfterWriteWhen: (records) =>
      failActivePut && records.some((record) => record.key.startsWith(stagedDocumentId) && record.metadata.lifecycleStatus === "active")
  })
  const manifest = await service.ingest({
    fileName: "policy.md",
    text: "申請期限は翌月5営業日です。",
    skipMemory: true
  })
  const actor = { userId: "manager-1", email: "manager@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"] }
  const staged = await service.stageReindexMigration(actor, manifest.documentId)
  stagedDocumentId = staged.stagedDocumentId

  failActivePut = true
  await assert.rejects(() => service.cutoverReindexMigration(staged.migrationId), /simulated partial active put failure/)

  assert.deepEqual((await service.listDocuments()).map((doc) => doc.documentId), [manifest.documentId])
  const stagedManifest = JSON.parse(await readFile(path.join(dataDir, `objects/manifests/${staged.stagedDocumentId}.json`), "utf-8")) as { lifecycleStatus?: string }
  assert.equal(stagedManifest.lifecycleStatus, "staging")
  const evidenceDb = JSON.parse(await readFile(path.join(dataDir, "evidence-vectors.json"), "utf-8")) as {
    records: Array<{ key: string; metadata?: { lifecycleStatus?: string } }>
  }
  assert.equal(
    evidenceDb.records.find((record) => record.key.startsWith(staged.stagedDocumentId))?.metadata?.lifecycleStatus,
    "staging"
  )
})

test("service manages reviewed alias artifacts and audit log", async () => {
  const { service, dataDir } = await createService()
  const actor = { userId: "manager-1", email: "manager@example.com", cognitoGroups: ["RAG_GROUP_MANAGER"] }

  const alias = await service.createAlias(actor, {
    term: "PTO",
    expansions: ["有給休暇", "休暇申請"],
    scope: { tenantId: "tenant-a" }
  })
  assert.equal(alias.status, "draft")
  assert.equal(alias.term, "pto")

  const updated = await service.updateAlias(actor, alias.aliasId, { expansions: ["年次有給休暇"] })
  assert.deepEqual(updated?.expansions, ["年次有給休暇"])

  const reviewed = await service.reviewAlias(actor, alias.aliasId, { decision: "approve", comment: "社内用語として確認済み" })
  assert.equal(reviewed?.status, "approved")

  const published = await service.publishAliases(actor)
  assert.equal(published.aliasCount, 1)
  assert.match(published.version, /^alias_/)

  const audit = await service.listAliasAuditLog()
  assert.deepEqual(audit.map((item) => item.action).sort(), ["create", "publish", "review", "update"])

  const latest = JSON.parse(await readFile(path.join(dataDir, "objects", "aliases", "latest.json"), "utf-8")) as { objectKey: string }
  assert.match(latest.objectKey, /^aliases\/alias_/)
})

test("service delegates human question lifecycle to the question store", async () => {
  const { service } = await createService()

  const question = await service.createQuestion({
    title: "資料外の質問",
    question: "担当者へ確認してください。",
    sourceQuestion: "資料外の質問は？",
    chatAnswer: "資料からは回答できません。"
  })
  assert.equal(question.status, "open")
  assert.equal((await service.listQuestions())[0]?.questionId, question.questionId)
  assert.equal((await service.getQuestion(question.questionId))?.questionId, question.questionId)

  const answered = await service.answerQuestion(question.questionId, {
    answerTitle: "回答",
    answerBody: "担当者の確認結果です。",
    references: "社内確認"
  })
  assert.equal(answered.status, "answered")
  assert.equal(answered.answerBody, "担当者の確認結果です。")

  const resolved = await service.resolveQuestion(question.questionId)
  assert.equal(resolved.status, "resolved")
})

test("service preserves asynchronous chat run options and can mark worker failures", async () => {
  const { service, deps } = await createService()
  const user = { userId: "user-1", email: "user@example.com", cognitoGroups: ["CHAT_USER"] }

  const started = await service.startChatRun({
    question: "検索設定を確認して",
    modelId: "model-a",
    embeddingModelId: "embed-a",
    clueModelId: "clue-a",
    topK: 5,
    memoryTopK: 2,
    minScore: 2,
    strictGrounded: false,
    useMemory: false,
    maxIterations: 999
  }, user)
  const stored = await deps.chatRunStore.get(started.runId)
  assert.equal(stored?.strictGrounded, false)
  assert.equal(stored?.useMemory, false)
  assert.equal(stored?.maxIterations, ragRuntimePolicy.retrieval.maxIterations)
  assert.equal(stored?.minScore, 1)

  const benchmarkRun = await service.createBenchmarkRun(user, { minScore: 2 })
  assert.equal(benchmarkRun.minScore, 1)
  const mmragSuite = service.listBenchmarkSuites().find((suite) => suite.suiteId === "mmrag-docqa-v1")
  assert.deepEqual(mmragSuite, {
    suiteId: "mmrag-docqa-v1",
    label: "MMRAG-DocQA",
    mode: "agent",
    datasetS3Key: "hf://datasets/yubo2333/MMLongBench-Doc",
    preset: "standard",
    defaultConcurrency: 1
  })
  const mmragRun = await service.createBenchmarkRun(user, { suiteId: "mmrag-docqa-v1", mode: "agent" })
  assert.equal(mmragRun.suiteId, "mmrag-docqa-v1")
  assert.equal(mmragRun.datasetS3Key, "hf://datasets/yubo2333/MMLongBench-Doc")
  const jpPublicPdfSuite = service.listBenchmarkSuites().find((suite) => suite.suiteId === "jp-public-pdf-qa-v1")
  assert.deepEqual(jpPublicPdfSuite, {
    suiteId: "jp-public-pdf-qa-v1",
    label: "日本語公開PDF QA",
    mode: "agent",
    datasetS3Key: "benchmark/dataset.jp-public-pdf-qa.jsonl",
    preset: "standard",
    defaultConcurrency: 1
  })
  const jpPublicPdfRun = await service.createBenchmarkRun(user, { suiteId: "jp-public-pdf-qa-v1", mode: "agent" })
  assert.equal(jpPublicPdfRun.suiteId, "jp-public-pdf-qa-v1")
  assert.equal(jpPublicPdfRun.datasetS3Key, "benchmark/dataset.jp-public-pdf-qa.jsonl")
  const mlitSuite = service.listBenchmarkSuites().find((suite) => suite.suiteId === "mlit-pdf-figure-table-rag-seed-v1")
  assert.deepEqual(mlitSuite, {
    suiteId: "mlit-pdf-figure-table-rag-seed-v1",
    label: "MLIT PDF figure/table RAG seed",
    mode: "agent",
    datasetS3Key: "datasets/agent/mlit-pdf-figure-table-rag-seed-v1.jsonl",
    preset: "standard",
    defaultConcurrency: 1
  })
  const mlitRun = await service.createBenchmarkRun(user, { suiteId: "mlit-pdf-figure-table-rag-seed-v1", mode: "agent" })
  assert.equal(mlitRun.suiteId, "mlit-pdf-figure-table-rag-seed-v1")
  assert.equal(mlitRun.datasetS3Key, "datasets/agent/mlit-pdf-figure-table-rag-seed-v1.jsonl")
  const architectureSuite = service.listBenchmarkSuites().find((suite) => suite.suiteId === "architecture-drawing-qarag-v0.1")
  assert.deepEqual(architectureSuite, {
    suiteId: "architecture-drawing-qarag-v0.1",
    label: "建築図面 QARAG v0.1",
    mode: "agent",
    datasetS3Key: "generated://architecture-drawing-qarag-v0.1",
    preset: "standard",
    defaultConcurrency: 1
  })
  const architectureRun = await service.createBenchmarkRun(user, { suiteId: "architecture-drawing-qarag-v0.1", mode: "agent" })
  assert.equal(architectureRun.suiteId, "architecture-drawing-qarag-v0.1")
  assert.equal(architectureRun.datasetS3Key, "generated://architecture-drawing-qarag-v0.1")

  await deps.chatRunStore.create({
    runId: "run-worker-timeout",
    status: "running",
    createdBy: "user-1",
    question: "timeout",
    modelId: "model-a",
    createdAt: "2026-05-04T00:00:00.000Z",
    updatedAt: "2026-05-04T00:00:00.000Z",
    ttl: 1_800_000_000
  })
  const failed = await service.markChatRunFailed("run-worker-timeout", "States.Timeout: worker timed out")
  assert.equal(failed.status, "failed")
  assert.equal(failed.error, "States.Timeout: worker timed out")
  const errorEvents = await deps.chatRunEventStore.listAfter("run-worker-timeout", 0)
  assert.equal(errorEvents.at(-1)?.type, "error")
  assert.equal(errorEvents.at(-1)?.message, "States.Timeout: worker timed out")
})

test("asynchronous chat run stores debug trace by reference", async () => {
  const { service, deps } = await createService()
  await service.ingest({
    fileName: "debug.txt",
    text: "debug trace は object store に保存し、非同期 run には参照 ID だけを残します。"
  })

  await deps.chatRunStore.create({
    runId: "run-debug-reference",
    status: "queued",
    createdBy: "user-1",
    userEmail: "user@example.com",
    userGroups: ["SYSTEM_ADMIN"],
    question: "debug trace の保存先は？",
    modelId: "model-a",
    topK: 6,
    memoryTopK: 4,
    minScore: 0.01,
    includeDebug: true,
    createdAt: "2026-05-04T00:00:00.000Z",
    updatedAt: "2026-05-04T00:00:00.000Z",
    ttl: 1_800_000_000
  })

  const completed = await service.executeChatRun("run-debug-reference")
  assert.equal(completed.status, "succeeded")
  assert.equal((completed as unknown as Record<string, unknown>).debug, undefined)
  assert.ok(completed.debugRunId)

  const events = await deps.chatRunEventStore.listAfter("run-debug-reference", 0)
  const final = events.find((event) => event.type === "final")
  assert.ok(final)
  assert.equal(typeof (final.data as Record<string, unknown>).debugRunId, "string")
  assert.equal((final.data as Record<string, unknown>).debug, undefined)
  assert.ok(await service.getDebugRun(completed.debugRunId ?? ""))
})

test("service executes asynchronous document ingest runs from uploaded object", async () => {
  const { service, deps } = await createService()
  const user = { userId: "user-1", email: "user@example.com", cognitoGroups: ["CHAT_USER"] }
  await deps.objectStore.putBytes("uploads/documents/user-1/handbook.txt", Buffer.from("非同期取り込みはS3 upload sessionからworkerで実行します。"), "text/plain")

  const started = await service.startDocumentIngestRun({
    uploadId: "upload-1",
    objectKey: "uploads/documents/user-1/handbook.txt",
    purpose: "document",
    fileName: "handbook.txt",
    mimeType: "text/plain",
    skipMemory: true
  }, user)

  const completed = await waitForDocumentIngestRun(deps, started.runId)
  assert.equal(completed.status, "succeeded")
  assert.equal(completed.manifest?.fileName, "handbook.txt")
  assert.equal(completed.documentId, completed.manifest?.documentId)

  const events = await deps.documentIngestRunEventStore.listAfter(started.runId, 0)
  assert.deepEqual(events.map((event) => event.type), ["status", "status", "final"])
  assert.equal(events.at(-1)?.stage, "done")
})

test("service lists all Cognito directory users in the managed user ledger", async () => {
  const directoryUsers: ManagedUser[] = [
    {
      userId: "admin-sub",
      email: "admin@example.com",
      displayName: "Admin",
      status: "active",
      groups: ["SYSTEM_ADMIN"],
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z"
    },
    {
      userId: "member-sub",
      email: "member@example.com",
      displayName: "Member",
      status: "active",
      groups: ["CHAT_USER"],
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z"
    }
  ]
  const assignedGroups: Array<{ username: string; groups: string[] }> = []
  const { service } = await createService({
    userDirectory: {
      listUsers: async () => directoryUsers,
      setUserGroups: async (username, groups) => {
        assignedGroups.push({ username, groups })
      }
    }
  })
  const actor = { userId: "admin-sub", email: "admin@example.com", cognitoGroups: ["SYSTEM_ADMIN"] }

  const users = await service.listManagedUsers(actor)

  assert.deepEqual(users.map((user) => user.email), ["admin@example.com", "member@example.com"])
  assert.equal(users.find((user) => user.userId === "member-sub")?.groups[0], "CHAT_USER")

  const updated = await service.assignUserRoles(actor, "member-sub", ["ANSWER_EDITOR"])
  assert.deepEqual(updated?.groups, ["ANSWER_EDITOR"])
  assert.deepEqual(assignedGroups, [{ username: "member@example.com", groups: ["ANSWER_EDITOR"] }])
  assert.deepEqual((await service.listManagedUsers(actor)).find((user) => user.userId === "member-sub")?.groups, ["ANSWER_EDITOR"])

  const suspended = await service.suspendManagedUser(actor, "member-sub")
  assert.equal(suspended?.status, "suspended")
  assert.equal((await service.listManagedUsers(actor)).find((user) => user.userId === "member-sub")?.status, "suspended")

  await service.deleteManagedUser(actor, "member-sub")
  assert.equal((await service.listManagedUsers(actor)).some((user) => user.userId === "member-sub"), false)
})

test("service merges Cognito directory users with existing ledger users by email", async () => {
  let directoryUsers: ManagedUser[] = []
  const { service } = await createService({
    userDirectory: {
      listUsers: async () => directoryUsers
    }
  })
  const actor = { userId: "admin-sub", email: "admin@example.com", cognitoGroups: ["SYSTEM_ADMIN"] }

  await service.createManagedUser(actor, {
    email: "dup@example.com",
    displayName: "Ledger User",
    groups: ["ANSWER_EDITOR"]
  })
  directoryUsers = [
    {
      userId: "dup-sub",
      email: "dup@example.com",
      displayName: "Cognito User",
      status: "active",
      groups: ["CHAT_USER"],
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-02T00:00:00.000Z"
    }
  ]

  const users = await service.listManagedUsers(actor)
  const matchingUsers = users.filter((user) => user.email === "dup@example.com")

  assert.equal(matchingUsers.length, 1)
  assert.equal(matchingUsers[0]?.userId, "dup-sub")
  assert.deepEqual(matchingUsers[0]?.groups, ["ANSWER_EDITOR"])
})

test("service chat returns refusal and error debug trace when external dependencies fail", async () => {
  const { service } = await createService({
    textModel: new MockBedrockTextModel({ embed: new Error("Bedrock embed timeout") }),
    evidenceQueryError: new Error("Vector query failed"),
    objectGetErrorPrefix: "debug-runs/",
    objectGetError: new Error("S3 get failed")
  })

  const result = await service.chat({
    question: "仕様は？",
    includeDebug: true
  })

  assert.equal(result.isAnswerable, false)
  assert.equal(result.answer, "資料からは回答できません。")
  assert.equal(result.debug?.status, "warning")
  const errorStep = result.debug?.steps.find((step) => step.status === "error")
  assert.ok(errorStep)
  assert.match(errorStep?.detail ?? "", /Bedrock embed timeout|Vector query failed/)
  await assert.rejects(() => service.listDebugRuns(), /S3 get failed/)
})

test("debug trace download metadata forces attachment and sanitizes the file name", () => {
  const metadata = createDebugTraceDownloadMetadata("run/with:unsafe*chars")

  assert.deepEqual(metadata, {
    fileName: "debug-trace-run_with_unsafe_chars.json",
    objectKey: "downloads/debug-trace-run_with_unsafe_chars.json",
    contentDisposition: 'attachment; filename="debug-trace-run_with_unsafe_chars.json"'
  })
})

test("benchmark artifact download metadata forces attachment and artifact extensions", () => {
  assert.deepEqual(createBenchmarkArtifactDownloadMetadata("bench/with:unsafe*chars", "report", "runs/bench/report.md"), {
    fileName: "benchmark-report-bench_with_unsafe_chars.md",
    objectKey: "runs/bench/report.md",
    contentDisposition: 'attachment; filename="benchmark-report-bench_with_unsafe_chars.md"'
  })
  assert.deepEqual(createBenchmarkArtifactDownloadMetadata("bench-1", "summary", "runs/bench-1/summary.json"), {
    fileName: "benchmark-summary-bench-1.json",
    objectKey: "runs/bench-1/summary.json",
    contentDisposition: 'attachment; filename="benchmark-summary-bench-1.json"'
  })
  assert.deepEqual(createBenchmarkArtifactDownloadMetadata("bench-1", "results", "runs/bench-1/results.jsonl"), {
    fileName: "benchmark-results-bench-1.jsonl",
    objectKey: "runs/bench-1/results.jsonl",
    contentDisposition: 'attachment; filename="benchmark-results-bench-1.jsonl"'
  })
})

test("benchmark CodeBuild log download returns the stored log URL", async () => {
  const { service, deps } = await createService()
  const user = { userId: "user-1", email: "user@example.com", cognitoGroups: ["SYSTEM_ADMIN"] }
  const run = await service.createBenchmarkRun(user, {})
  await deps.benchmarkRunStore.update(run.runId, {
    codeBuildBuildId: "memo-benchmark:build-id",
    codeBuildLogUrl: "https://console.aws.amazon.com/codesuite/codebuild/projects/memo/build/build-id/log"
  })

  assert.equal(await service.createBenchmarkArtifactDownloadUrl("missing-run", "logs"), undefined)
  const download = await service.createBenchmarkArtifactDownloadUrl(run.runId, "logs")
  assert.deepEqual(download, {
    url: "https://console.aws.amazon.com/codesuite/codebuild/projects/memo/build/build-id/log",
    expiresInSeconds: 900,
    objectKey: "memo-benchmark:build-id"
  })
})

test("benchmark CodeBuild log text download uses stored log stream metadata", async () => {
  const references: unknown[] = []
  const logReader: CodeBuildLogReader = {
    getText: async (reference) => {
      references.push(reference)
      return reference.logGroupName === "/aws/codebuild/memo" && reference.logStreamName === "build-stream"
        ? "install phase\nbuild phase\n"
        : undefined
    }
  }
  const { service, deps } = await createService({ codeBuildLogReader: logReader })
  const user = { userId: "user-1", email: "user@example.com", cognitoGroups: ["SYSTEM_ADMIN"] }
  const run = await service.createBenchmarkRun(user, {})
  await deps.benchmarkRunStore.update(run.runId, {
    codeBuildBuildId: "memo-benchmark:build-id",
    codeBuildLogGroupName: "/aws/codebuild/memo",
    codeBuildLogStreamName: "build-stream"
  })

  assert.equal(await service.getBenchmarkCodeBuildLogText("missing-run"), undefined)
  const download = await service.getBenchmarkCodeBuildLogText(run.runId)
  assert.deepEqual(download, {
    text: "install phase\nbuild phase\n",
    fileName: `benchmark-logs-${run.runId}.txt`,
    contentDisposition: `attachment; filename="benchmark-logs-${run.runId}.txt"`
  })
  assert.deepEqual(references, [
    {
      buildId: "memo-benchmark:build-id",
      logGroupName: "/aws/codebuild/memo",
      logStreamName: "build-stream"
    }
  ])
})

test("debug trace JSON for answerable runs matches the v1 schema example", () => {
  const trace: DebugTrace = {
    schemaVersion: 1,
    runId: "run_answerable",
    question: "期限はいつですか？",
    modelId: "amazon.nova-lite-v1:0",
    embeddingModelId: "amazon.titan-embed-text-v2:0",
    clueModelId: "amazon.nova-lite-v1:0",
    topK: 6,
    memoryTopK: 4,
    minScore: 0.2,
    startedAt: "2026-05-02T00:00:00.000Z",
    completedAt: "2026-05-02T00:00:01.000Z",
    totalLatencyMs: 1000,
    status: "success",
    answerPreview: "期限は翌月5営業日までです。",
    isAnswerable: true,
    citations: [
      {
        documentId: "doc-1",
        fileName: "policy.txt",
        chunkId: "chunk-0001",
        score: 0.91,
        text: "申請期限は翌月5営業日までです。"
      }
    ],
    retrieved: [
      {
        documentId: "doc-1",
        fileName: "policy.txt",
        chunkId: "chunk-0001",
        score: 0.91,
        text: "申請期限は翌月5営業日までです。"
      }
    ],
    steps: [
      {
        id: 1,
        label: "retrieve_memory",
        status: "success",
        latencyMs: 12,
        modelId: "amazon.titan-embed-text-v2:0",
        summary: "memory hits=1",
        output: {
          memoryCards: [
            {
              key: "doc-1-memory-0000",
              score: 0.8,
              metadata: {
                kind: "memory",
                documentId: "doc-1",
                fileName: "policy.txt",
                memoryId: "memory-0000",
                text: "Summary: 申請期限",
                createdAt: "2026-05-01T00:00:00.000Z"
              }
            }
          ]
        },
        hitCount: 1,
        startedAt: "2026-05-02T00:00:00.000Z",
        completedAt: "2026-05-02T00:00:00.012Z"
      },
      {
        id: 2,
        label: "finalize_response",
        status: "success",
        latencyMs: 3,
        summary: "finalized",
        detail: "期限は翌月5営業日までです。",
        output: {
          answer: "期限は翌月5営業日までです。"
        },
        tokenCount: 10,
        startedAt: "2026-05-02T00:00:00.997Z",
        completedAt: "2026-05-02T00:00:01.000Z"
      }
    ]
  }

  assert.equal(formatDebugTraceJson(trace), `{
  "schemaVersion": 1,
  "runId": "run_answerable",
  "question": "期限はいつですか？",
  "modelId": "amazon.nova-lite-v1:0",
  "embeddingModelId": "amazon.titan-embed-text-v2:0",
  "clueModelId": "amazon.nova-lite-v1:0",
  "topK": 6,
  "memoryTopK": 4,
  "minScore": 0.2,
  "startedAt": "2026-05-02T00:00:00.000Z",
  "completedAt": "2026-05-02T00:00:01.000Z",
  "totalLatencyMs": 1000,
  "status": "success",
  "answerPreview": "期限は翌月5営業日までです。",
  "isAnswerable": true,
  "citations": [
    {
      "documentId": "doc-1",
      "fileName": "policy.txt",
      "chunkId": "chunk-0001",
      "score": 0.91,
      "text": "申請期限は翌月5営業日までです。"
    }
  ],
  "retrieved": [
    {
      "documentId": "doc-1",
      "fileName": "policy.txt",
      "chunkId": "chunk-0001",
      "score": 0.91,
      "text": "申請期限は翌月5営業日までです。"
    }
  ],
  "steps": [
    {
      "id": 1,
      "label": "retrieve_memory",
      "status": "success",
      "latencyMs": 12,
      "modelId": "amazon.titan-embed-text-v2:0",
      "summary": "memory hits=1",
      "output": {
        "memoryCards": [
          {
            "key": "doc-1-memory-0000",
            "score": 0.8,
            "metadata": {
              "kind": "memory",
              "documentId": "doc-1",
              "fileName": "policy.txt",
              "memoryId": "memory-0000",
              "text": "Summary: 申請期限",
              "createdAt": "2026-05-01T00:00:00.000Z"
            }
          }
        ]
      },
      "hitCount": 1,
      "startedAt": "2026-05-02T00:00:00.000Z",
      "completedAt": "2026-05-02T00:00:00.012Z"
    },
    {
      "id": 2,
      "label": "finalize_response",
      "status": "success",
      "latencyMs": 3,
      "summary": "finalized",
      "detail": "期限は翌月5営業日までです。",
      "output": {
        "answer": "期限は翌月5営業日までです。"
      },
      "tokenCount": 10,
      "startedAt": "2026-05-02T00:00:00.997Z",
      "completedAt": "2026-05-02T00:00:01.000Z"
    }
  ]
}`)
})

test("debug trace JSON for refusal runs matches the v1 schema example", () => {
  const trace: DebugTrace = {
    schemaVersion: 1,
    runId: "run_refusal",
    question: "資料にない制度は？",
    modelId: "amazon.nova-lite-v1:0",
    embeddingModelId: "amazon.titan-embed-text-v2:0",
    clueModelId: "amazon.nova-lite-v1:0",
    topK: 6,
    memoryTopK: 4,
    minScore: 0.2,
    startedAt: "2026-05-02T00:00:00.000Z",
    completedAt: "2026-05-02T00:00:00.200Z",
    totalLatencyMs: 200,
    status: "warning",
    answerPreview: "資料からは回答できません。",
    isAnswerable: false,
    citations: [],
    retrieved: [],
    steps: [
      {
        id: 1,
        label: "answerability_gate",
        status: "warning",
        latencyMs: 8,
        summary: "answerable=false, reason=no_relevant_chunks",
        detail: "reason=no_relevant_chunks\nconfidence=0",
        output: {
          answerability: {
            isAnswerable: false,
            reason: "no_relevant_chunks",
            confidence: 0
          },
          answer: "資料からは回答できません。",
          citations: []
        },
        startedAt: "2026-05-02T00:00:00.100Z",
        completedAt: "2026-05-02T00:00:00.108Z"
      }
    ]
  }

  assert.deepEqual(JSON.parse(formatDebugTraceJson(trace)), {
    schemaVersion: 1,
    runId: "run_refusal",
    question: "資料にない制度は？",
    modelId: "amazon.nova-lite-v1:0",
    embeddingModelId: "amazon.titan-embed-text-v2:0",
    clueModelId: "amazon.nova-lite-v1:0",
    topK: 6,
    memoryTopK: 4,
    minScore: 0.2,
    startedAt: "2026-05-02T00:00:00.000Z",
    completedAt: "2026-05-02T00:00:00.200Z",
    totalLatencyMs: 200,
    status: "warning",
    answerPreview: "資料からは回答できません。",
    isAnswerable: false,
    citations: [],
    retrieved: [],
    steps: [
      {
        id: 1,
        label: "answerability_gate",
        status: "warning",
        latencyMs: 8,
        summary: "answerable=false, reason=no_relevant_chunks",
        detail: "reason=no_relevant_chunks\nconfidence=0",
        output: {
          answerability: {
            isAnswerable: false,
            reason: "no_relevant_chunks",
            confidence: 0
          },
          answer: "資料からは回答できません。",
          citations: []
        },
        startedAt: "2026-05-02T00:00:00.100Z",
        completedAt: "2026-05-02T00:00:00.108Z"
      }
    ]
  })
})

test("service ingest falls back when memory JSON parse fails and surfaces generate timeout", async () => {
  const { service: parseFallbackService } = await createService({
    textModel: new MockBedrockTextModel({ invalidJsonOnGenerate: true })
  })
  const manifest = await parseFallbackService.ingest({
    fileName: "doc.txt",
    text: "これは要件定義の本文です。"
  })
  assert.equal(manifest.memoryCardCount, 1)

  const { service: timeoutService } = await createService({
    textModel: new MockBedrockTextModel({ generate: new Error("Bedrock generate timeout") })
  })
  await assert.rejects(
    () => timeoutService.ingest({ fileName: "doc.txt", text: "これは要件定義の本文です。" }),
    /Bedrock generate timeout/
  )
})

async function createService(options: {
  textModel?: MockBedrockTextModel
  evidenceQueryError?: Error
  evidencePutErrorAfterWriteWhen?: (records: Parameters<LocalVectorStore["put"]>[0]) => boolean
  objectGetErrorPrefix?: string
  objectGetError?: Error
  userDirectory?: UserDirectory
  codeBuildLogReader?: CodeBuildLogReader
} = {}): Promise<{ service: MemoRagService; dataDir: string; deps: Dependencies }> {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-service-test-"))
  const baseObjectStore = new LocalObjectStore(dataDir)
  const baseEvidenceStore = new LocalVectorStore(dataDir, "evidence-vectors.json")
  const deps = {
    objectStore: {
      putText: (...args: Parameters<LocalObjectStore["putText"]>) => baseObjectStore.putText(...args),
      putBytes: (...args: Parameters<LocalObjectStore["putBytes"]>) => baseObjectStore.putBytes(...args),
      getText: async (key: string) => {
        if (options.objectGetError && options.objectGetErrorPrefix && key.startsWith(options.objectGetErrorPrefix)) {
          throw options.objectGetError
        }
        return baseObjectStore.getText(key)
      },
      getBytes: (...args: Parameters<LocalObjectStore["getBytes"]>) => baseObjectStore.getBytes(...args),
      deleteObject: (...args: Parameters<LocalObjectStore["deleteObject"]>) => baseObjectStore.deleteObject(...args),
      listKeys: (...args: Parameters<LocalObjectStore["listKeys"]>) => baseObjectStore.listKeys(...args)
    },
    memoryVectorStore: new LocalVectorStore(dataDir, "memory-vectors.json"),
    evidenceVectorStore: {
      put: async (...args: Parameters<LocalVectorStore["put"]>) => {
        await baseEvidenceStore.put(...args)
        if (options.evidencePutErrorAfterWriteWhen?.(args[0])) throw new Error("simulated partial active put failure")
      },
      query: async (...args: Parameters<LocalVectorStore["query"]>) => {
        if (options.evidenceQueryError) throw options.evidenceQueryError
        return baseEvidenceStore.query(...args)
      },
      delete: (...args: Parameters<LocalVectorStore["delete"]>) => baseEvidenceStore.delete(...args)
    },
    textModel: options.textModel ?? new MockBedrockTextModel(),
    questionStore: new LocalQuestionStore(dataDir),
    conversationHistoryStore: new LocalConversationHistoryStore(dataDir),
    benchmarkRunStore: new LocalBenchmarkRunStore(dataDir),
    chatRunStore: new LocalChatRunStore(dataDir),
    chatRunEventStore: new LocalChatRunEventStore(dataDir),
    documentIngestRunStore: new LocalDocumentIngestRunStore(dataDir),
    documentIngestRunEventStore: new LocalDocumentIngestRunEventStore(dataDir),
    documentGroupStore: new LocalDocumentGroupStore(dataDir),
    codeBuildLogReader: options.codeBuildLogReader ?? { getText: async () => undefined },
    userDirectory: options.userDirectory
  } as unknown as Dependencies
  return { service: new MemoRagService(deps), dataDir, deps }
}

async function waitForDocumentIngestRun(deps: Dependencies, runId: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const run = await deps.documentIngestRunStore.get(runId)
    if (run?.status === "succeeded" || run?.status === "failed" || run?.status === "cancelled") return run
    await delay(20)
  }
  throw new Error(`Timed out waiting for document ingest run: ${runId}`)
}
