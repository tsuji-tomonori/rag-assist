import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { chunkStructuredBlocks, chunkText } from "../offline/pre-retrieval/chunking/chunker.service.js"
import { extractDocumentFromUpload } from "../offline/pre-retrieval/extraction/text-extractor.js"
import { createChatOrchestrationGraph } from "../orchestration/chat-rag-orchestrator.js"
import { bm25Search, buildLexicalIndex, rrfFuse } from "../online/retrieval/hybrid/hybrid-retriever.js"

const apiSrcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")

test("RAG production modules are not placeholder-only descriptors", () => {
  const files = walkTsFiles(path.join(apiSrcDir, "rag"))

  for (const file of files) {
    const source = readFileSync(file, "utf8")
    assert.doesNotMatch(source, /status:\s*["']planned["']/, `${file} still contains planned placeholder descriptor`)
    assert.doesNotMatch(source, /export const ragComponentDescriptor\s*=/, `${file} is descriptor-only; move real implementation instead`)
  }
})

test("offline chunker is available from the new layout", () => {
  const chunks = chunkText("第1章\n\nこれは本文です。\n\n第2章\n\nこれは次の本文です。", 40, 5)

  assert.ok(chunks.length >= 1)
  assert.ok(chunks[0]?.id)
  assert.ok(chunks[0]?.text.includes("第1章"))
})

test("offline chunker preserves structured block metadata from the new layout", () => {
  const chunks = chunkStructuredBlocks([
    {
      id: "block-1",
      kind: "table",
      text: "| 項目 | 値 |\n|---|---|\n| A | 1 |",
      pageStart: 2,
      tableId: "table-1",
      tableColumnCount: 2
    }
  ])

  assert.equal(chunks[0]?.chunkKind, "table")
  assert.equal(chunks[0]?.pageStart, 2)
  assert.equal(chunks[0]?.tableId, "table-1")
})

test("offline extractor keeps direct text ingestion behavior from the new layout", async () => {
  const result = await extractDocumentFromUpload({
    fileName: "policy.txt",
    text: "出張申請は事前承認が必要です。",
    mimeType: "text/plain"
  })

  assert.equal(result.text, "出張申請は事前承認が必要です。")
  assert.equal(result.sourceExtractorVersion, "direct-text-v1")
})

test("online hybrid retriever keeps BM25 and RRF behavior from the new layout", () => {
  const index = buildLexicalIndex(
    [
      {
        id: "doc-1-chunk-1",
        documentId: "doc-1",
        fileName: "policy.md",
        chunkId: "chunk-1",
        text: "出張申請は事前承認が必要です。",
        len: 0,
        createdAt: "2026-05-19T00:00:00.000Z"
      }
    ],
    "test-index"
  )

  const bm25 = bm25Search(index, ["出張", "申請"], 5)
  assert.equal(bm25[0]?.id, "doc-1-chunk-1")

  const fused = rrfFuse([[{ id: "a" }], [{ id: "a" }, { id: "b" }]])
  assert.equal(fused[0]?.id, "a")
})

test("chat RAG orchestrator is exported from the new rag/orchestration path", () => {
  assert.equal(typeof createChatOrchestrationGraph, "function")
})

test("old RAG flat paths are compatibility re-export shims", () => {
  const oldFiles = [
    "rag/chunk.ts",
    "rag/text-extract.ts",
    "rag/embedding-cache.ts",
    "rag/quality.ts",
    "rag/manifest-chunks.ts",
    "rag/pipeline-versions.ts",
    "search/hybrid-search.ts",
    "chat-orchestration/graph.ts"
  ]

  for (const file of oldFiles) {
    const source = readFileSync(path.join(apiSrcDir, file), "utf8")
    assert.match(source, /^export \* from ["'][.][/\w.-]+["']\s*$/u, `${file} should re-export from the new layout`)
  }
})

function walkTsFiles(root: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root)) {
    const fullPath = path.join(root, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) files.push(...walkTsFiles(fullPath))
    if (stat.isFile() && fullPath.endsWith(".ts") && !fullPath.endsWith(".test.ts")) files.push(fullPath)
  }
  return files
}
