import assert from "node:assert/strict"
import test from "node:test"
import { MockBedrockTextModel } from "../adapters/mock-bedrock.js"
import { buildSearchClues, clamp, compactDetail, estimateTokenCount, toCitation, unique } from "../agent/utils.js"
import { chunkStructuredBlocks, chunkText } from "./chunk.js"
import { parseJsonObject } from "./json.js"
import { extractDocumentFromUpload, extractTextFromUpload } from "./text-extract.js"

test("chunking normalizes whitespace and prefers semantic boundaries", () => {
  assert.deepEqual(chunkText(" \n\n "), [])

  const chunks = chunkText("第1文。第2文。\n\n第3文。第4文。", 12, 20)
  assert.ok(chunks.length > 1)
  assert.equal(chunks[0]?.id, "chunk-0000")
  assert.ok(chunks.every((chunk) => !chunk.text.startsWith("文。")))
  assert.deepEqual(
    chunks.map((chunk) => chunk.text),
    ["第1文。第2文。", "第3文。第4文。"]
  )
})

test("chunking uses semantic-unit overlap instead of starting mid sentence", () => {
  const chunks = chunkText("第1文。\n\n第2文。\n\n第3文。", 14, 10)

  assert.deepEqual(
    chunks.map((chunk) => chunk.text),
    ["第1文。\n\n第2文。", "第2文。\n\n第3文。"]
  )
  assert.equal(chunks[1]?.startChar, chunks[0]?.text.indexOf("第2文。"))
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

test("chunking keeps list items intact and falls back only for oversized units", () => {
  const listChunks = chunkText("- 申請を入力します\n- 上長が承認します\n- 経理が確認します", 24, 8)

  assert.ok(listChunks.length > 1)
  assert.ok(listChunks.every((chunk) => chunk.text.split("\n").every((line) => /^-\s+/.test(line))))
  assert.ok(listChunks.some((chunk) => chunk.text.includes("- 上長が承認します")))

  const longChunks = chunkText("A".repeat(65), 20, 4)
  assert.ok(longChunks.length > 1)
  assert.ok(longChunks.every((chunk) => chunk.text.length <= 20))
})

test("chunking normalizes table, list, code, and figure blocks", () => {
  const chunks = chunkStructuredBlocks(
    [
      { id: "table-1", kind: "table", text: "| 項目 | 期限 |\n| --- | --- |\n| 申請 | 翌月5営業日 |", tableColumnCount: 2, normalizedFrom: "test-table" },
      { id: "list-1", kind: "list", text: "- 申請\n- 承認", listDepth: 1, normalizedFrom: "test-list" },
      { id: "code-1", kind: "code", text: "```\nstatus = approved\n```", normalizedFrom: "test-code" },
      { id: "fig-1", kind: "figure", text: "Figure: 承認フロー", figureCaption: "承認フロー", normalizedFrom: "test-figure" }
    ],
    1200,
    200
  )

  assert.deepEqual(chunks.map((chunk) => chunk.chunkKind), ["table", "list", "code", "figure"])
  assert.equal(chunks[0]?.tableColumnCount, 2)
  assert.equal(chunks[1]?.listDepth, 1)
  assert.equal(chunks[3]?.figureCaption, "承認フロー")
})

test("chunking keeps atomic structured blocks unsplit", () => {
  const tableText = "| 項目 | 期限 |\n| --- | --- |\n| 申請 | 翌月5営業日 |\n| 承認 | 翌月7営業日 |"
  const codeText = "```\n" + "status = approved\n".repeat(8) + "```"
  const figureText = "Figure: " + "承認フロー".repeat(20)
  const chunks = chunkStructuredBlocks(
    [
      { id: "table-1", kind: "table", text: tableText },
      { id: "code-1", kind: "code", text: codeText },
      { id: "fig-1", kind: "figure", text: figureText, figureCaption: "承認フロー" }
    ],
    32,
    8
  )

  assert.deepEqual(chunks.map((chunk) => chunk.text), [tableText, codeText, figureText])
})

test("upload text extraction handles direct text, base64, limits, and missing payloads", async () => {
  assert.equal(await extractTextFromUpload({ fileName: "a.txt", text: "\u0000 body \u0000" }), "body")
  assert.equal(await extractTextFromUpload({ fileName: "a.txt", contentBase64: Buffer.from("hello").toString("base64") }), "hello")
  await assert.rejects(() => extractTextFromUpload({ fileName: "missing.txt" }), /Either text or contentBase64/)
})

test("upload extraction parses Textract JSON tables and lines into structured blocks", async () => {
  const textractJson = JSON.stringify({
    Blocks: [
      { Id: "line-1", BlockType: "LINE", Text: "1. 申請手順", Page: 1 },
      { Id: "table-1", BlockType: "TABLE", Page: 1, Relationships: [{ Type: "CHILD", Ids: ["cell-1", "cell-2", "cell-3", "cell-4"] }] },
      { Id: "cell-1", BlockType: "CELL", RowIndex: 1, ColumnIndex: 1, Relationships: [{ Type: "CHILD", Ids: ["word-1"] }] },
      { Id: "cell-2", BlockType: "CELL", RowIndex: 1, ColumnIndex: 2, Relationships: [{ Type: "CHILD", Ids: ["word-2"] }] },
      { Id: "cell-3", BlockType: "CELL", RowIndex: 2, ColumnIndex: 1, Relationships: [{ Type: "CHILD", Ids: ["word-3"] }] },
      { Id: "cell-4", BlockType: "CELL", RowIndex: 2, ColumnIndex: 2, Relationships: [{ Type: "CHILD", Ids: ["word-4"] }] },
      { Id: "word-1", BlockType: "WORD", Text: "項目" },
      { Id: "word-2", BlockType: "WORD", Text: "期限" },
      { Id: "word-3", BlockType: "WORD", Text: "申請" },
      { Id: "word-4", BlockType: "WORD", Text: "翌月5営業日" }
    ]
  })

  const extracted = await extractDocumentFromUpload({ fileName: "policy.pdf", textractJson })
  assert.equal(extracted.sourceExtractorVersion, "textract-json-v1")
  assert.ok(extracted.blocks?.some((block) => block.kind === "table" && block.text.includes("| 項目 | 期限 |")))
  assert.ok(extracted.blocks?.some((block) => block.kind === "list" && block.text.includes("- 申請手順")))
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
  assert.match(await model.generate(`FINAL_ANSWER_JSON <computedFacts>${JSON.stringify([
    { id: "date-unavailable-001", kind: "calculation_unavailable", reason: "計算対象の期限日を特定できません。" },
    { id: "relative-deadline-001", kind: "relative_policy_deadline", resultDate: "2026-07-01", ruleText: "申請期限は開始日の1か月前" }
  ])}</computedFacts>`), /2026-07-01/)
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
  assert.deepEqual(buildSearchClues("分類を教えて", ["分類を教えて", "追加"]), ["分類を教えて", "追加"])
  assert.equal(clamp(25, 1, 20), 20)
  assert.equal(clamp(-1, 1, 20), 1)
  assert.equal(compactDetail(["a", undefined, "b"], 3), "a\nb")
})
