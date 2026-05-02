import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import type { AppUser } from "../auth.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalQuestionStore } from "../adapters/local-question-store.js"
import { LocalConversationHistoryStore } from "../adapters/local-conversation-history-store.js"
import { LocalBenchmarkRunStore } from "../adapters/local-benchmark-run-store.js"
import { LocalVectorStore } from "../adapters/local-vector-store.js"
import { MockBedrockTextModel } from "../adapters/mock-bedrock.js"
import type { Dependencies } from "../dependencies.js"
import { MemoRagService } from "../rag/memorag-service.js"
import { bm25Search, buildLexicalIndex, rrfFuse, tokenizeQuery } from "./hybrid-search.js"

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

  const groupAUser = user(["GROUP_A"])
  const groupASearch = await service.search({ query: "policy approval", topK: 10, filters: { tenantId: "tenant-a", source: "notion" } }, groupAUser)
  assert.equal(groupASearch.results.length, 1)
  assert.equal(groupASearch.results[0]?.fileName, "group-a-policy.md")
  assert.deepEqual(groupASearch.results[0]?.sources.sort(), ["lexical", "semantic"])
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
    benchmarkRunStore: new LocalBenchmarkRunStore(dataDir)
  }
}

function user(cognitoGroups: string[]): AppUser {
  return {
    userId: "user-1",
    email: "user-1@example.com",
    cognitoGroups
  }
}
