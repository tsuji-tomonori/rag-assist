import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import type { AppUser } from "../auth.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalQuestionStore } from "../adapters/local-question-store.js"
import { LocalConversationHistoryStore } from "../adapters/local-conversation-history-store.js"
import { LocalBenchmarkRunStore } from "../adapters/local-benchmark-run-store.js"
import { LocalChatRunStore } from "../adapters/local-chat-run-store.js"
import { LocalChatRunEventStore } from "../adapters/local-chat-run-event-store.js"
import { LocalDocumentIngestRunStore } from "../adapters/local-document-ingest-run-store.js"
import { LocalDocumentIngestRunEventStore } from "../adapters/local-document-ingest-run-event-store.js"
import { LocalVectorStore } from "../adapters/local-vector-store.js"
import { MockBedrockTextModel } from "../adapters/mock-bedrock.js"
import type { Dependencies } from "../dependencies.js"
import { MemoRagService } from "../rag/memorag-service.js"
import { adaptiveEffectiveMinScore, bm25Search, buildLexicalIndex, rrfFuse, tokenizeQuery } from "./hybrid-search.js"

test("tokenizeQuery normalizes Japanese and ASCII terms with n-grams", () => {
  const tokens = tokenizeQuery("  申請承認 Workflow  ")

  assert.ok(tokens.includes("申請承認"))
  assert.ok(tokens.includes("申請"))
  assert.ok(tokens.includes("請承"))
  assert.ok(tokens.includes("workflow"))
})

test("BM25 search covers exact, Japanese n-gram, prefix, and ASCII fuzzy matches", () => {
  const index = buildLexicalIndex(
    [
      lexicalDoc("doc-request-chunk-0000", "doc-request", "申請承認ワークフロー.md", "申請承認ワークフローの確認条件は責任者承認です。approval policy applies."),
      lexicalDoc("doc-pipeline-chunk-0000", "doc-pipeline", "pipeline-guide.md", "Pipeline settings are managed by sales ops."),
      lexicalDoc("doc-inventory-chunk-0000", "doc-inventory", "在庫.md", "在庫数の修正は在庫管理システムから申請します。")
    ],
    "test-index"
  )

  assert.equal(bm25Search(index, tokenizeQuery("申請 承認"), 3)[0]?.id, "doc-request-chunk-0000")
  assert.equal(bm25Search(index, tokenizeQuery("承認ワ"), 3)[0]?.id, "doc-request-chunk-0000")
  assert.equal(bm25Search(index, tokenizeQuery("pipe"), 3)[0]?.id, "doc-pipeline-chunk-0000")
  assert.equal(bm25Search(index, tokenizeQuery("aproval"), 3)[0]?.id, "doc-request-chunk-0000")
})

test("BM25 search expands short CJK abbreviation-like terms from the corpus dictionary", () => {
  const index = buildLexicalIndex(
    [
      lexicalDoc("doc-parental-leave-chunk-0000", "doc-parental-leave", "handbook.md", "育児休業の申請期限は開始日の1か月前です。"),
      lexicalDoc("doc-vacation-chunk-0000", "doc-vacation", "handbook.md", "有給休暇の取得申請は取得日の前営業日までに提出します。")
    ],
    "test-index"
  )

  const hits = bm25Search(index, tokenizeQuery("8/1から育休を取る場合、いつまでに申請する必要がある?"), 3)

  assert.equal(hits[0]?.id, "doc-parental-leave-chunk-0000")
})

test("BM25 alias expansion uses caller-provided alias maps only", () => {
  const docs = [
    lexicalDoc("doc-vacation-chunk-0000", "doc-vacation", "vacation-guide.md", "Vacation requests require manager approval.")
  ]
  const noAliases = buildLexicalIndex(docs, "no-aliases")
  const withAliases = buildLexicalIndex(docs, "with-aliases", { pto: ["vacation"] })

  assert.equal(noAliases.aliasVersion, "none")
  assert.match(withAliases.aliasVersion, /^alias:[a-f0-9]{8}$/)
  assert.equal(bm25Search(noAliases, tokenizeQuery("pto"), 3).length, 0)
  assert.equal(bm25Search(withAliases, tokenizeQuery("pto"), 3)[0]?.id, "doc-vacation-chunk-0000")
})

test("RRF fusion rewards overlap while keeping independent lexical hits", () => {
  const fused = rrfFuse(
    [
      [{ id: "lexical-only" }, { id: "shared" }],
      [{ id: "shared" }, { id: "semantic-only" }]
    ],
    { k: 60, weights: [1, 0.9] }
  )

  assert.equal(fused[0]?.id, "shared")
  assert.ok(fused.some((hit) => hit.id === "lexical-only"))
  assert.ok(fused.some((hit) => hit.id === "semantic-only"))
})

test("adaptive score floor does not reuse MIN_RETRIEVAL_SCORE for fused scores", () => {
  const lowSemanticOnlyScores = [0.0159, 0.0142, 0.011]

  assert.equal(adaptiveEffectiveMinScore(lowSemanticOnlyScores, 0, 0.25), 0.011)
  assert.equal(adaptiveEffectiveMinScore([0.0159], 0, 0.25), 0.0159)
})

test("service search applies ACL and metadata filters across lexical and vector results", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-hybrid-search-"))
  const service = new MemoRagService(createLocalDeps(dataDir))

  await service.ingest({
    fileName: "group-a-policy.md",
    text: "申請承認ワークフローの確認条件は責任者承認です。approval policy.",
    skipMemory: true,
    metadata: {
      tenantId: "tenant-a",
      source: "notion",
      docType: "policy",
      department: "hr",
      aclGroup: "GROUP_A",
      aclGroups: ["GROUP_A"],
      allowedUsers: ["user-1"],
      privateToUserId: "user-1",
      internalProjectCode: "confidential-project-x",
      searchAliases: {
        pto: ["approval"]
      }
    }
  })
  await service.ingest({
    fileName: "group-b-policy.md",
    text: "利用申請の修正条件は担当者の確認です。correction policy.",
    skipMemory: true,
    metadata: {
      tenantId: "tenant-a",
      source: "confluence",
      docType: "policy",
      aclGroup: "GROUP_B"
    }
  })
  await removeLifecycleStatusFromLocalVectors(dataDir)

  const groupAUser = user(["GROUP_A"])
  const groupASearch = await service.search({ query: "policy approval", topK: 10, filters: { tenantId: "tenant-a", source: "notion" } }, groupAUser)
  assert.equal(groupASearch.results.length, 1)
  assert.equal(groupASearch.results[0]?.fileName, "group-a-policy.md")
  assert.deepEqual(groupASearch.results[0]?.sources.sort(), ["lexical", "semantic"])
  assert.equal(groupASearch.diagnostics.profileVersion, "1")
  assert.equal(typeof groupASearch.diagnostics.lexicalSemanticOverlap, "number")
  assert.ok(groupASearch.diagnostics.scoreDistribution.top !== null)
  assert.deepEqual(groupASearch.results[0]?.metadata, {
    tenantId: "tenant-a",
    source: "notion",
    docType: "policy",
    department: "hr"
  })

  const aliasSearch = await service.search({ query: "pto", topK: 10, filters: { tenantId: "tenant-a", source: "notion" } }, groupAUser)
  assert.equal(aliasSearch.results[0]?.fileName, "group-a-policy.md")
  assert.match(aliasSearch.diagnostics.indexVersion, /^lexical:[a-f0-9]{8}$/)
  assert.match(aliasSearch.diagnostics.aliasVersion, /^alias:[a-f0-9]{8}$/)
  const aliasPayload = JSON.stringify({ results: aliasSearch.results, diagnostics: aliasSearch.diagnostics })
  assert.equal(aliasPayload.includes("pto"), false)
  assert.equal(aliasPayload.includes("confidential-project-x"), false)
  assert.equal(aliasPayload.includes("allowedUsers"), false)

  const semanticOnlySearch = await service.search({ query: "policy approval", topK: 10, lexicalTopK: 0, filters: { tenantId: "tenant-a", source: "notion" } }, groupAUser)
  assert.equal(semanticOnlySearch.results[0]?.fileName, "group-a-policy.md")
  assert.equal(semanticOnlySearch.diagnostics.lexicalCount, 0)
  assert.ok(semanticOnlySearch.diagnostics.semanticCount > 0)

  const lexicalOnlySearch = await service.search({ query: "policy approval", topK: 10, semanticTopK: 0, filters: { tenantId: "tenant-a", source: "notion" } }, groupAUser)
  assert.equal(lexicalOnlySearch.results[0]?.fileName, "group-a-policy.md")
  assert.ok(lexicalOnlySearch.diagnostics.lexicalCount > 0)
  assert.equal(lexicalOnlySearch.diagnostics.semanticCount, 0)

  const groupBOnlySearch = await service.search({ query: "申請承認", topK: 10 }, user(["GROUP_B"]))
  assert.equal(groupBOnlySearch.results.some((result) => result.fileName === "group-a-policy.md"), false)
})

test("service search publishes and reuses immutable lexical index artifacts", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-lexical-artifact-"))
  const objectStore = new LocalObjectStore(dataDir)
  const service = new MemoRagService({ ...createLocalDeps(dataDir), objectStore })

  await service.ingest({
    fileName: "policy.md",
    text: "申請承認ワークフローの確認条件は責任者承認です。approval policy.",
    skipMemory: true,
    metadata: { tenantId: "tenant-a", aclGroup: "GROUP_A" }
  })

  const first = await service.search({ query: "approval", topK: 10 }, user(["GROUP_A"]))
  assert.ok(first.results.length >= 1)
  assert.match(first.diagnostics.indexVersion, /^lexical:[a-f0-9]{8}$/)

  const keys = await objectStore.listKeys("lexical-index/")
  assert.ok(keys.includes("lexical-index/latest.json"))
  assert.ok(keys.some((key) => /^lexical-index\/lexical_[a-f0-9]{8}\.json$/.test(key)))
  const latest = JSON.parse(await objectStore.getText("lexical-index/latest.json")) as { indexVersion?: string }
  assert.equal(latest.indexVersion, first.diagnostics.indexVersion)

  const second = await service.search({ query: "申請承認", topK: 10 }, user(["GROUP_A"]))
  assert.equal(second.diagnostics.indexVersion, first.diagnostics.indexVersion)
})

test("service search scopes benchmark corpus by suite metadata", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-benchmark-suite-search-"))
  const service = new MemoRagService(createLocalDeps(dataDir))
  const runner = user(["BENCHMARK_RUNNER"])

  await service.ingest({
    fileName: "handbook.md",
    text: "経費精算は申請から30日以内に行う必要があります。立替精算も同じ期限です。",
    skipMemory: true,
    metadata: {
      benchmarkSeed: true,
      benchmarkSuiteId: "standard-agent-v1",
      benchmarkSourceHash: "hash-a",
      benchmarkIngestSignature: "signature-a",
      benchmarkCorpusSkipMemory: true,
      benchmarkEmbeddingModelId: "api-default",
      aclGroups: ["BENCHMARK_RUNNER"],
      docType: "benchmark-corpus",
      lifecycleStatus: "active",
      source: "benchmark-runner",
      searchAliases: { "立替": ["経費精算"] }
    }
  })
  await service.ingest({
    fileName: "old-suite.pdf",
    text: "経費精算 期限 申請という語を大量に含むが、別 suite の古い benchmark corpus です。",
    skipMemory: true,
    metadata: {
      benchmarkSeed: true,
      benchmarkSuiteId: "allganize-rag-evaluation-ja-v1",
      benchmarkSourceHash: "hash-b",
      benchmarkIngestSignature: "signature-b",
      benchmarkCorpusSkipMemory: true,
      benchmarkEmbeddingModelId: "api-default",
      aclGroups: ["BENCHMARK_RUNNER"],
      docType: "benchmark-corpus",
      lifecycleStatus: "active",
      source: "benchmark-runner"
    }
  })

  const result = await service.search({
    query: "立替 申請",
    topK: 10,
    lexicalTopK: 80,
    semanticTopK: 0,
    filters: {
      source: "benchmark-runner",
      docType: "benchmark-corpus",
      benchmarkSuiteId: "standard-agent-v1"
    }
  }, runner)

  assert.equal(result.results[0]?.fileName, "handbook.md")
  assert.equal(result.results.some((item) => item.fileName === "old-suite.pdf"), false)
  assert.equal(result.diagnostics.index?.visibleManifestCount, 1)
  assert.equal(result.diagnostics.index?.indexedChunkCount, 1)
})

test("service search expands published reviewed aliases without returning alias details", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-published-alias-"))
  const service = new MemoRagService(createLocalDeps(dataDir))
  const manager = user(["RAG_GROUP_MANAGER"])

  await service.ingest({
    fileName: "vacation.md",
    text: "年次有給休暇の申請期限は取得日の3営業日前です。",
    skipMemory: true,
    metadata: { tenantId: "tenant-a", aclGroup: "GROUP_A" }
  })
  const alias = await service.createAlias(manager, {
    term: "pto",
    expansions: ["年次有給休暇"],
    scope: { tenantId: "tenant-a" }
  })
  await service.reviewAlias(manager, alias.aliasId, { decision: "approve" })
  await service.publishAliases(manager)

  const result = await service.search({ query: "pto", topK: 10, filters: { tenantId: "tenant-a" } }, user(["GROUP_A"]))
  assert.equal(result.results[0]?.fileName, "vacation.md")
  assert.match(result.diagnostics.aliasVersion, /^alias:[a-f0-9]{8}$/)
  const unfilteredResult = await service.search({ query: "pto", topK: 10 }, user(["GROUP_A"]))
  assert.equal(unfilteredResult.results[0]?.fileName, "vacation.md")
  const payload = JSON.stringify(result)
  assert.equal(payload.includes("pto"), true)
  assert.equal(payload.includes("年次有給休暇"), true)
  assert.equal(payload.includes("aliasId"), false)
  assert.equal(payload.includes("manager-1"), false)
})

function lexicalDoc(id: string, documentId: string, fileName: string, text: string) {
  return {
    id,
    documentId,
    fileName,
    chunkId: "chunk-0000",
    text,
    len: 0,
    createdAt: "2026-05-02T00:00:00.000Z"
  }
}

function createLocalDeps(dataDir: string): Dependencies {
  return {
    objectStore: new LocalObjectStore(dataDir),
    evidenceVectorStore: new LocalVectorStore(dataDir, "evidence-vectors.json"),
    memoryVectorStore: new LocalVectorStore(dataDir, "memory-vectors.json"),
    textModel: new MockBedrockTextModel(),
    questionStore: new LocalQuestionStore(dataDir),
    conversationHistoryStore: new LocalConversationHistoryStore(dataDir),
    benchmarkRunStore: new LocalBenchmarkRunStore(dataDir),
    chatRunStore: new LocalChatRunStore(dataDir),
    chatRunEventStore: new LocalChatRunEventStore(dataDir),
    documentIngestRunStore: new LocalDocumentIngestRunStore(dataDir),
    documentIngestRunEventStore: new LocalDocumentIngestRunEventStore(dataDir)
  }
}

function user(cognitoGroups: string[]): AppUser {
  return {
    userId: "user-1",
    email: "user-1@example.com",
    cognitoGroups
  }
}

async function removeLifecycleStatusFromLocalVectors(dataDir: string): Promise<void> {
  const vectorPath = path.join(dataDir, "evidence-vectors.json")
  const raw = JSON.parse(await readFile(vectorPath, "utf-8")) as { records: Array<{ metadata?: { lifecycleStatus?: string } }> }
  for (const record of raw.records) {
    if (record.metadata) delete record.metadata.lifecycleStatus
  }
  await writeFile(vectorPath, JSON.stringify(raw, null, 2))
}
