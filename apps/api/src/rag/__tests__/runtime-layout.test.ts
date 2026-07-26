import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { chunkStructuredBlocks, chunkText } from "../offline/pre-retrieval/chunking/chunker.service.js"
import { extractDocumentFromUpload } from "../offline/pre-retrieval/extraction/text-extractor.js"
import { createChatOrchestrationGraph } from "../orchestration/chat-rag-orchestrator.js"
import {
  answerPolicyById,
  resolveRetrievalProfileId
} from "../_shared/policies/answer-policy.js"
import {
  assembleContext,
  buildRelevantSnippet,
  textAnswerRelevanceScore
} from "../online/post-retrieval/context-packing/context-packer.js"
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

test("RAG runtime policies are resolved from the new shared policy layout", () => {
  assert.equal(resolveRetrievalProfileId(undefined), "default")
  assert.equal(resolveRetrievalProfileId("default", true), "adaptive-retrieval")
  assert.equal(resolveRetrievalProfileId("adaptive-retrieval"), "adaptive-retrieval")
  assert.throws(() => resolveRetrievalProfileId("unknown-profile"), /Unknown RAG_PROFILE_ID/)

  const neutral = answerPolicyById(undefined)
  assert.equal(neutral.id, "default-answer-policy")
  assert.equal(answerPolicyById("default").id, "default-answer-policy")
  assert.throws(() => answerPolicyById("domain-specific-policy"), /Unknown RAG_DOMAIN_POLICY_ID/)
})

test("RAG context packing keeps focused snippets and drop accounting in the new layout", () => {
  const assembly = assembleContext({
    question: "休暇申請の承認者と期限は？",
    requiredFacts: ["休暇申請 承認者", "休暇申請 期限"],
    tokenBudget: 800,
    chunks: [
      {
        key: "empty",
        score: 0.1,
        metadata: {
          kind: "chunk",
          documentId: "doc-1",
          fileName: "handbook.md",
          text: "",
          createdAt: "2026-05-20T00:00:00.000Z"
        }
      },
      {
        key: "policy",
        score: 0.9,
        metadata: {
          kind: "chunk",
          documentId: "doc-1",
          fileName: "handbook.md",
          chunkId: "chunk-1",
          text: "# 休暇申請\n休暇申請の承認者は直属上長です。\n期限は開始日の3日前です。",
          heading: "休暇申請",
          sectionPath: ["人事", "休暇"],
          createdAt: "2026-05-20T00:00:00.000Z"
        }
      }
    ]
  })

  assert.deepEqual(assembly.includedChunkIds, ["policy"])
  assert.deepEqual(assembly.droppedChunkIds, ["empty"])
  assert.match(assembly.contextBlocks[0]?.reason ?? "", /^covers:/)
  assert.ok(buildRelevantSnippet("要求分類を列挙して", "分類A\n分類B", 20).includes("分類A"))
  assert.ok(textAnswerRelevanceScore("承認者は？", "承認者は直属上長です。") > 0)
})

test("old RAG flat paths are compatibility re-export shims", () => {
  const oldFiles = [
    "rag/chunk.ts",
    "rag/text-extract.ts",
    "rag/embedding-cache.ts",
    "rag/quality.ts",
    "rag/manifest-chunks.ts",
    "rag/pipeline-versions.ts",
    "rag/prompts.ts",
    "rag/context-assembler.ts",
    "rag/profiles.ts",
    "rag/json.ts",
    "search/hybrid-search.ts",
    "chat-orchestration/graph.ts"
  ]

  for (const file of oldFiles) {
    const source = readFileSync(path.join(apiSrcDir, file), "utf8")
    assert.match(source, /^export \* from ["'][.][/\w.-]+["']\s*$/u, `${file} should re-export from the new layout`)
  }
})

test("production code does not import old RAG compatibility shims", () => {
  const forbiddenSpecifiers = [
    "../search/hybrid-search.js",
    "../chat-orchestration/graph.js",
    "./chunk.js",
    "./text-extract.js",
    "./embedding-cache.js",
    "./manifest-chunks.js",
    "./pipeline-versions.js",
    "./quality.js",
    "./prompts.js",
    "./context-assembler.js",
    "./profiles.js",
    "./json.js"
  ]

  const files = walkTsFiles(apiSrcDir)
    .filter((file) => !file.includes("/__tests__/"))
    .filter((file) => !file.endsWith(".test.ts"))
    .filter((file) => !file.endsWith("/search/hybrid-search.ts"))
    .filter((file) => !file.endsWith("/chat-orchestration/graph.ts"))
    .filter((file) => !file.match(/\/rag\/(chunk|text-extract|embedding-cache|manifest-chunks|pipeline-versions|quality|prompts|context-assembler|profiles|json)\.ts$/))

  for (const file of files) {
    const source = readFileSync(file, "utf8")
    for (const specifier of forbiddenSpecifiers) {
      assert.doesNotMatch(source, new RegExp(`from ["']${escapeRegExp(specifier)}["']`), file)
    }
  }
})

test("old flat RAG root files are shims or removed", () => {
  const files = readdirSync(path.join(apiSrcDir, "rag"))
    .filter((name) => name.endsWith(".ts"))
    .filter((name) => !name.endsWith(".test.ts"))

  for (const file of files) {
    if (file === "memorag-service.ts") continue

    const source = readFileSync(path.join(apiSrcDir, "rag", file), "utf8")
    assert.match(
      source,
      /^export \* from ["'][^"']+["']\s*$/u,
      `${file} must be a compatibility shim or moved into the runtime layout`
    )
  }
})

test("MemoRagService delegates ingest pipeline to offline ingest service", () => {
  const source = readFileSync(path.join(apiSrcDir, "rag/memorag-service.ts"), "utf8")

  assert.doesNotMatch(source, /evidenceVectorStore\.put/)
  assert.doesNotMatch(source, /memoryVectorStore\.put/)
  assert.doesNotMatch(source, /chunkStructuredBlocks|chunkText/)
  assert.match(source, /offline\/pre-retrieval\/ingestion/)
})

test("RAG production modules are not empty placeholders", () => {
  const files = walkTsFiles(path.join(apiSrcDir, "rag"))
    .filter((file) => !file.endsWith(".test.ts"))

  for (const file of files) {
    const source = readFileSync(file, "utf8").trim()

    assert.notEqual(source, "export {}", `${file} is an empty placeholder module`)
    assert.notEqual(source, "export {};", `${file} is an empty placeholder module`)
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

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
