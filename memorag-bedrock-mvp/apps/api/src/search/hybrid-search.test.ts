import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import type { AppUser } from "../auth.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalQuestionStore } from "../adapters/local-question-store.js"
import { LocalConversationHistoryStore } from "../adapters/local-conversation-history-store.js"
import { LocalVectorStore } from "../adapters/local-vector-store.js"
import { MockBedrockTextModel } from "../adapters/mock-bedrock.js"
import type { Dependencies } from "../dependencies.js"
import { MemoRagService } from "../rag/memorag-service.js"
import { bm25Search, buildLexicalIndex, rrfFuse, tokenizeQuery } from "./hybrid-search.js"

test("tokenizeQuery normalizes Japanese and ASCII terms with n-grams", () => {
  const tokens = tokenizeQuery("  経費精算 Workflow  ")

  assert.ok(tokens.includes("経費精算"))
  assert.ok(tokens.includes("経費"))
  assert.ok(tokens.includes("費精"))
  assert.ok(tokens.includes("workflow"))
})

test("BM25 search covers exact, Japanese n-gram, prefix, and ASCII fuzzy matches", () => {
  const index = buildLexicalIndex(
    [
      lexicalDoc("doc-expense-chunk-0000", "doc-expense", "経費精算ワークフロー.md", "経費精算ワークフローの承認条件は部長承認です。expense policy applies."),
      lexicalDoc("doc-sales-chunk-0000", "doc-sales", "salesforce-guide.md", "Salesforce SFA pipeline settings are managed by sales ops."),
      lexicalDoc("doc-attendance-chunk-0000", "doc-attendance", "勤怠.md", "勤怠打刻の修正は勤怠管理システムから申請します。")
    ],
    "test-index"
  )

  assert.equal(bm25Search(index, tokenizeQuery("経費 承認"), 3)[0]?.id, "doc-expense-chunk-0000")
  assert.equal(bm25Search(index, tokenizeQuery("精算ワ"), 3)[0]?.id, "doc-expense-chunk-0000")
  assert.equal(bm25Search(index, tokenizeQuery("sales"), 3)[0]?.id, "doc-sales-chunk-0000")
  assert.equal(bm25Search(index, tokenizeQuery("expnse"), 3)[0]?.id, "doc-expense-chunk-0000")
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
    fileName: "finance-policy.md",
    text: "経費精算ワークフローの承認条件は部長承認です。Concur expense approval policy.",
    skipMemory: true,
    metadata: {
      tenantId: "tenant-a",
      source: "notion",
      docType: "policy",
      aclGroup: "FINANCE"
    }
  })
  await service.ingest({
    fileName: "hr-policy.md",
    text: "勤怠打刻の修正条件は人事部の確認です。attendance correction policy.",
    skipMemory: true,
    metadata: {
      tenantId: "tenant-a",
      source: "confluence",
      docType: "policy",
      aclGroup: "HR"
    }
  })

  const financeUser = user(["FINANCE"])
  const financeSearch = await service.search({ query: "policy approval", topK: 10, filters: { tenantId: "tenant-a", source: "notion" } }, financeUser)
  assert.equal(financeSearch.results.length, 1)
  assert.equal(financeSearch.results[0]?.fileName, "finance-policy.md")
  assert.deepEqual(financeSearch.results[0]?.sources.sort(), ["lexical", "semantic"])

  const hrOnlySearch = await service.search({ query: "経費精算 承認", topK: 10 }, user(["HR"]))
  assert.equal(hrOnlySearch.results.some((result) => result.fileName === "finance-policy.md"), false)
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
    conversationHistoryStore: new LocalConversationHistoryStore(dataDir)
  }
}

function user(cognitoGroups: string[]): AppUser {
  return {
    userId: "user-1",
    email: "user-1@example.com",
    cognitoGroups
  }
}
