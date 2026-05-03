import assert from "node:assert/strict"
import test from "node:test"
import { MockBedrockTextModel } from "../adapters/mock-bedrock.js"
import { buildSearchClues, clamp, compactDetail, estimateTokenCount, toCitation, unique } from "../agent/utils.js"
import { chunkText } from "./chunk.js"
import { parseJsonObject } from "./json.js"
import { extractTextFromUpload } from "./text-extract.js"

test("chunking normalizes whitespace and respects overlap and sentence boundaries", () => {
  assert.deepEqual(chunkText(" \n\n "), [])

  const chunks = chunkText("第1文。第2文。\n\n第3文。第4文。", 12, 20)
  assert.ok(chunks.length > 1)
  assert.equal(chunks[0]?.id, "chunk-0000")
  assert.ok((chunks[1]?.startChar ?? 0) < (chunks[0]?.endChar ?? 0))
})

test("chunking keeps PDF page-break segments from being merged", () => {
  const chunks = chunkText("1.2 ソフトウェア要求の分類\n\f\n2 Requirements Elicitation\n\f\n4.3 ATDD BDD", 1200, 200)

  assert.deepEqual(
    chunks.map((chunk) => chunk.text),
    ["1.2 ソフトウェア要求の分類", "2 Requirements Elicitation", "4.3 ATDD BDD"]
  )
})

test("chunking records section metadata and neighboring chunk links", () => {
  const chunks = chunkText("# 申請手順\n申請はシステムから行います。期限は翌月5営業日です。\n\n追加説明です。", 24, 4)

  assert.ok(chunks.length > 1)
  assert.deepEqual(chunks[0]?.sectionPath, ["申請手順"])
  assert.equal(chunks[0]?.heading, "申請手順")
  assert.ok(chunks[0]?.parentSectionId?.startsWith("section:"))
  assert.ok(chunks[0]?.chunkHash)
  assert.equal(chunks[0]?.nextChunkId, chunks[1]?.id)
  assert.equal(chunks[1]?.previousChunkId, chunks[0]?.id)
})

test("upload text extraction handles direct text, base64, limits, and missing payloads", async () => {
  assert.equal(await extractTextFromUpload({ fileName: "a.txt", text: "\u0000 body \u0000" }), "body")
  assert.equal(await extractTextFromUpload({ fileName: "a.txt", contentBase64: Buffer.from("hello").toString("base64") }), "hello")
  await assert.rejects(() => extractTextFromUpload({ fileName: "missing.txt" }), /Either text or contentBase64/)
})

test("json parser accepts raw JSON, fenced JSON, embedded JSON, and invalid inputs", () => {
  assert.deepEqual(parseJsonObject<{ ok: boolean }>("{\"ok\":true}"), { ok: true })
  assert.deepEqual(parseJsonObject<{ ok: boolean }>("```json\n{\"ok\":true}\n```"), { ok: true })
  assert.deepEqual(parseJsonObject<{ ok: boolean }>("prefix {\"ok\":true} suffix"), { ok: true })
  assert.equal(parseJsonObject("not-json"), undefined)
})

test("mock model generates embeddings, memory cards, clues, final answers, and fallback JSON", async () => {
  const model = new MockBedrockTextModel()
  const vector = await model.embed("ソフトウェア要求", { dimensions: 8 })
  assert.equal(vector.length, 8)
  assert.ok(vector.some((value) => value !== 0))

  assert.match(await model.generate("MEMORY_CARD_JSON <document>要求分類</document>"), /資料外の内容は回答しない/)
  assert.match(await model.generate("CLUES_JSON <question>分類は？</question>"), /分類/)
  assert.match(await model.generate('FINAL_ANSWER_JSON <chunk id="c1">根拠本文</chunk>'), /根拠本文/)
  assert.match(await model.generate("FINAL_ANSWER_JSON"), /資料からは回答できません/)
  assert.equal(await model.generate("other prompt"), "{}")
})

test("agent utility helpers normalize citations, clues, tokens, ranges, and trace details", () => {
  assert.deepEqual(
    toCitation({
      key: "k",
      score: 0.123456,
      metadata: {
        kind: "memory",
        documentId: "doc",
        fileName: "file.txt",
        memoryId: "memory-1",
        text: "body",
        createdAt: "2026-04-30T00:00:00.000Z"
      }
    }),
    { documentId: "doc", fileName: "file.txt", chunkId: "memory-1", score: 0.1235, text: "body" }
  )
  assert.equal(estimateTokenCount(""), 0)
  assert.equal(estimateTokenCount("abcd"), 1)
  assert.deepEqual(unique([" a ", "a", "", " b "]), ["a", "b"])
  assert.ok(buildSearchClues("分類を教えて", ["分類を教えて", "追加"]).includes("ソフトウェア要求の分類"))
  assert.equal(clamp(25, 1, 20), 20)
  assert.equal(clamp(-1, 1, 20), 1)
  assert.equal(compactDetail(["a", undefined, "b"], 3), "a\nb")
})
