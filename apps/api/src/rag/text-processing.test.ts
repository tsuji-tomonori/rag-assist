import assert from "node:assert/strict"
import test from "node:test"
import { MockBedrockTextModel } from "../adapters/mock-bedrock.js"
import { buildSearchClues, clamp, compactDetail, estimateTokenCount, toCitation, unique } from "../agent/utils.js"
import { chunkStructuredBlocks, chunkText, summarizeDocumentStatistics } from "./chunk.js"
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

test("chunking covers heading variants, empty segments, figures, code fences, tables, and statistics", () => {
  assert.deepEqual(summarizeDocumentStatistics([]), {
    chunkCount: 0,
    sectionCount: 0,
    tableCount: 0,
    listCount: 0,
    codeCount: 0,
    figureCount: 0,
    averageChunkChars: 0,
    headingDensity: 0
  })

  const chunks = chunkText([
    "第1章 概要",
    "概要本文です。",
    "\f",
    "注意:",
    "Figure: 承認フロー",
    "\f",
    "```",
    "const approved = true",
    "```",
    "\f",
    "| 項目 | 期限 |",
    "| --- | --- |",
    "| 申請 | 翌月5営業日 |"
  ].join("\n"), 80, 10)

  assert.ok(chunks.some((chunk) => chunk.heading === "概要"))
  assert.ok(chunks.some((chunk) => chunk.heading === "注意"))
  assert.ok(chunks.some((chunk) => chunk.chunkKind === "figure"))
  assert.ok(chunks.some((chunk) => chunk.chunkKind === "code"))
  assert.ok(chunks.some((chunk) => chunk.chunkKind === "table"))
  const stats = summarizeDocumentStatistics(chunks)
  assert.equal(stats.chunkCount, chunks.length)
  assert.ok(stats.sectionCount >= 1)
  assert.equal(stats.figureCount, 1)
  assert.equal(stats.codeCount, 1)
  assert.equal(stats.tableCount, 1)
  assert.ok(stats.headingDensity > 0)
})

test("structured chunking keeps explicit section paths, page ranges, and fallback breaks", () => {
  const chunks = chunkStructuredBlocks(
    [
      {
        id: "heading-1",
        kind: "text",
        text: "明細",
        heading: "明細",
        sectionPath: ["規程", "明細"],
        pageStart: 2,
        pageEnd: 3,
        sourceBlockId: "source-heading",
        normalizedFrom: "test-heading",
        extractionMethod: "test-v1"
      },
      {
        id: "long-1",
        kind: "text",
        text: "A".repeat(30) + "、" + "B".repeat(30) + "、" + "C".repeat(30),
        pageStart: 4
      }
    ],
    32,
    100
  )

  assert.equal(chunks[0]?.sectionPath?.join(">"), "規程>明細")
  assert.equal(chunks[0]?.pageStart, 2)
  assert.equal(chunks[0]?.pageEnd, 3)
  assert.equal(chunks[0]?.sourceBlockId, "source-heading")
  assert.equal(chunks[0]?.normalizedFrom, "test-heading")
  assert.equal(chunks[0]?.extractionMethod, "test-v1")
  assert.ok(chunks.length > 2)
  assert.ok(chunks.every((chunk) => chunk.text.length <= 32 || chunk.id === "chunk-0000"))
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
  assert.equal(await extractTextFromUpload({ fileName: "a.bin", contentBytes: Buffer.from("bytes body") }), "bytes body")
  assert.equal(
    await extractTextFromUpload({
      fileName: "layout.textract.json",
      contentBytes: Buffer.from(JSON.stringify({ blocks: [{ Id: "line-1", BlockType: "LINE", Text: "本文", Page: 1 }] }))
    }),
    "本文"
  )
  await assert.rejects(() => extractTextFromUpload({ fileName: "missing.txt" }), /Either text or contentBase64/)
})

test("upload extraction parses Textract JSON tables and lines into structured blocks", async () => {
  const textractJson = JSON.stringify({
    Blocks: [
      { Id: "line-1", BlockType: "LINE", Text: "1. 申請手順", Page: 1 },
      { Id: "line-2", BlockType: "LINE", Text: "Figure: 承認フロー", Page: 1 },
      { Id: "line-3", BlockType: "LINE", Text: "# 見出し", Page: 1 },
      { Id: "table-1", BlockType: "TABLE", Page: 1, Relationships: [{ Type: "CHILD", Ids: ["cell-1", "cell-2", "cell-3", "cell-4"] }] },
      { Id: "table-empty", BlockType: "TABLE", Page: 1 },
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
  assert.ok(extracted.blocks?.some((block) => block.kind === "figure" && block.text === "Figure: 承認フロー"))
  assert.ok(extracted.blocks?.some((block) => block.heading === "見出し"))
})

test("upload extraction handles PDF embedded text and OCR fallback outcomes", async () => {
  const embedded = await extractDocumentFromUpload({
    fileName: "policy.pdf",
    contentBytes: Buffer.from("%PDF-1.4 text sample"),
    mimeType: "application/pdf",
    pdfTextExtractor: async () => "申請期限は翌月5営業日です。",
    ocrDetector: async () => {
      throw new Error("OCR should not run when embedded text is usable")
    }
  })
  assert.equal(embedded.sourceExtractorVersion, "pdf-layout-v2")
  assert.equal(embedded.text, "申請期限は翌月5営業日です。")

  const noFallback = await extractDocumentFromUpload({
    fileName: "policy.pdf",
    contentBytes: Buffer.from("%PDF-1.4 scanned sample"),
    mimeType: "application/pdf",
    pdfTextExtractor: async () => "   ",
    ocrDetector: async () => undefined
  })
  assert.equal(noFallback.sourceExtractorVersion, "pdf-layout-v2")
  assert.equal(noFallback.text, "")

  let fallbackCalled = false
  const extracted = await extractDocumentFromUpload({
    fileName: "foodkaku5.pdf",
    contentBytes: Buffer.from("%PDF-1.4 scanned sample"),
    mimeType: "application/pdf",
    sourceS3Object: { bucketName: "docs-bucket", key: "uploads/benchmarkSeed/foodkaku5.pdf" },
    pdfTextExtractor: async () => "   ",
    ocrDetector: async (input) => {
      fallbackCalled = true
      assert.equal(input.fileName, "foodkaku5.pdf")
      assert.equal(input.sourceS3Object?.bucketName, "docs-bucket")
      assert.equal(input.sourceS3Object?.key, "uploads/benchmarkSeed/foodkaku5.pdf")
      return {
        text: "食品表示基準について",
        sourceExtractorVersion: "textract-detect-document-text-v1",
        blocks: [
          {
            id: "line-1",
            kind: "text",
            text: "食品表示基準について",
            pageStart: 1,
            pageEnd: 1,
            sourceBlockId: "line-1",
            normalizedFrom: "textract-line",
            extractionMethod: "textract-detect-document-text-v1"
          }
        ]
      }
    }
  })

  assert.equal(fallbackCalled, true)
  assert.equal(extracted.sourceExtractorVersion, "textract-detect-document-text-v1")
  assert.equal(extracted.text, "食品表示基準について")
  assert.equal(extracted.blocks?.[0]?.pageStart, 1)

  await assert.rejects(
    () => extractDocumentFromUpload({
      fileName: "failed.pdf",
      contentBytes: Buffer.from("%PDF-1.4 scanned sample"),
      mimeType: "application/pdf",
      pdfTextExtractor: async () => "   ",
      ocrDetector: async () => {
        throw new Error("textract unavailable")
      }
    }),
    /textract unavailable/
  )
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

test("mock model covers failure modes, support judgement, retrieval judge, and computed fact answer variants", async () => {
  await assert.rejects(() => new MockBedrockTextModel({ embed: new Error("embed failed") }).embed("text"), /embed failed/)
  await assert.rejects(() => new MockBedrockTextModel({ generate: new Error("generate failed") }).generate("FINAL_ANSWER_JSON"), /generate failed/)
  assert.equal(await new MockBedrockTextModel({ invalidJsonOnGenerate: true }).generate("FINAL_ANSWER_JSON"), "not-json")

  const model = new MockBedrockTextModel()
  assert.equal((await model.embed("default dimensions")).length > 0, true)
  assert.deepEqual(await model.embed("", { dimensions: 4 }), [0, 0, 0, 0])
  assert.match(await model.generate("MEMORY_CARD_JSON <document></document>"), /ローカルモック/)
  assert.match(await model.generate("CLUES_JSON <question>"), /clues/)
  assert.match(await model.generate("CLUES_JSON <question></question>"), /clues/)
  assert.match(await model.generate("SUFFICIENT_CONTEXT_JSON <question>期限は？</question>"), /UNANSWERABLE/)
  assert.match(await model.generate('SUFFICIENT_CONTEXT_JSON <question>期限は？</question><chunk id="c1">   </chunk>'), /UNANSWERABLE/)
  assert.match(
    await model.generate('SUFFICIENT_CONTEXT_JSON <question>期限は？</question><chunk id="c1">申請期限は翌月5営業日です。</chunk>'),
    /ANSWERABLE/
  )

  assert.match(await model.generate("ANSWER_SUPPORT_JSON <answer></answer>"), /根拠チャンクがありません/)
  assert.match(await model.generate('ANSWER_SUPPORT_JSON <answer></answer><chunk id="c1">根拠</chunk>'), /unsupportedSentences/)
  assert.match(await model.generate('ANSWER_SUPPORT_JSON <answer>根拠あり。</answer><chunk id="c1">   </chunk>'), /0.4/)
  assert.match(await model.generate('ANSWER_SUPPORT_JSON <answer>計算済みです。</answer><computedFacts>[{"id":"fact-1"}]</computedFacts>'), /fact-1/)
  assert.match(
    await model.generate('ANSWER_SUPPORT_JSON <answer>期限は翌月5営業日です。</answer><chunk id="c1">申請期限は翌月5営業日です。</chunk>'),
    /supported/
  )

  assert.match(
    await model.generate('RETRIEVAL_JUDGE_JSON - deadline: 期限\n<chunk id="old">旧制度の期限は翌月10日です。</chunk><chunk id="current">現行制度の期限は翌月5営業日です。</chunk>'),
    /NO_CONFLICT/
  )
  assert.match(await model.generate('RETRIEVAL_JUDGE_JSON - deadline: 期限\n<chunk id="c1">期限は未確認です。</chunk>'), /UNCLEAR/)
  assert.match(await model.generate('RETRIEVAL_JUDGE_JSON <chunk id="c1">旧制度と現行制度です。</chunk>'), /NO_CONFLICT/)

  const computedFacts = [
    { id: "not-due", kind: "deadline_status", today: "2026-05-10", dueDate: "2026-05-12", status: "not_due", daysRemaining: 2 },
    { id: "due-today", kind: "deadline_status", today: "2026-05-10", dueDate: "2026-05-10", status: "due_today" },
    { id: "overdue", kind: "deadline_status", today: "2026-05-10", dueDate: "2026-05-08", status: "overdue", overdueDays: 2 },
    { id: "days", kind: "days_until", today: "2026-05-10", dueDate: "2026-05-20", daysRemaining: 10 },
    { id: "today", kind: "current_date", today: "2026-05-10" },
    { id: "add", kind: "add_days", resultDate: "2026-05-17" },
    { id: "arith", kind: "arithmetic", result: 42, unit: "円" },
    { id: "arith-no-unit", kind: "arithmetic", result: 42 },
    { id: "threshold-yes", kind: "threshold_comparison", effect: "required", satisfiesCondition: true, explanation: "1万円以上です。" },
    { id: "threshold-no", kind: "threshold_comparison", effect: "required", satisfiesCondition: false, explanation: "1万円未満です。" },
    { id: "threshold-no-explanation", kind: "threshold_comparison", effect: "required", satisfiesCondition: true },
    { id: "threshold-unknown", kind: "threshold_comparison", effect: "unknown", satisfiesCondition: true, explanation: "対象外です。" },
    { id: "task-unavailable", kind: "task_deadline_query_unavailable" },
    { id: "calc-unavailable", kind: "calculation_unavailable", reason: "日付が不足しています。" },
    { id: "calc-unavailable-default", kind: "calculation_unavailable" },
    { id: "unknown", kind: "unknown" }
  ]
  for (const fact of computedFacts) {
    const response = await model.generate(`FINAL_ANSWER_JSON <computedFacts>${JSON.stringify([fact])}</computedFacts>`)
    assert.match(response, /answer/)
  }
  assert.match(await model.generate('FINAL_ANSWER_JSON <computedFacts>[{"id":123,"kind":"current_date","today":"2026-05-10"}]</computedFacts>'), /usedComputedFactIds/)
  assert.match(await model.generate('FINAL_ANSWER_JSON <computedFacts>[null,[],{"kind":"calculation_unavailable"}]</computedFacts>'), /計算できません/)
  assert.match(await model.generate("FINAL_ANSWER_JSON <computedFacts>[]</computedFacts>"), /資料からは回答できません/)
  assert.match(await model.generate("FINAL_ANSWER_JSON <computedFacts>{bad</computedFacts>"), /資料からは回答できません/)
  assert.match(await model.generate('FINAL_ANSWER_JSON <question>期限</question><chunk id="c1"></chunk>'), /資料からは回答できません/)
  assert.match(await model.generate('FINAL_ANSWER_JSON <question>期限</question><chunk id="c1">対象外です。\n申請期限は翌月5営業日です。</chunk>'), /申請期限/)

  const policyExtraction = await model.generate(
    'POLICY_COMPUTATION_EXTRACTION_JSON <question>5200円の領収書添付は必要ですか？</question><context><chunk id="c1">1万円以上の経費精算では領収書が必要です。1万円未満の経費精算では領収書は不要です。</chunk></context>'
  )
  assert.match(policyExtraction, /questionTarget/)
  assert.match(
    await model.generate('POLICY_COMPUTATION_EXTRACTION_JSON <question>5200円の領収書添付は必要ですか？</question><context><chunk id="c&amp;1">経費精算の説明のみです。</chunk></context>'),
    /比較可能な条件はありません/
  )
  assert.match(
    await model.generate('POLICY_COMPUTATION_EXTRACTION_JSON <question>5200円の領収書添付は必要ですか？</question><context><chunk id="c1">1万円以上では必要です。</chunk></context>'),
    /candidates/
  )
  assert.match(await model.generate("POLICY_COMPUTATION_EXTRACTION_JSON <question>期限は？</question><context></context>"), /canExtract/)
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
        pageOrSheet: "P1 / sheet 1-01",
        drawingNo: "1-01",
        sheetTitle: "床: 仕上げ",
        scale: "1/5",
        regionId: "s02-titleblock-001",
        regionType: "titleblock",
        sourceType: "titleblock_ocr",
        bbox: { unit: "normalized_page", x: 0.55, y: 0.72, width: 0.45, height: 0.28 },
        text: "body",
        createdAt: "2026-04-30T00:00:00.000Z"
      }
    }),
    {
      documentId: "doc",
      fileName: "file.txt",
      chunkId: "memory-1",
      pageOrSheet: "P1 / sheet 1-01",
      drawingNo: "1-01",
      sheetTitle: "床: 仕上げ",
      scale: "1/5",
      regionId: "s02-titleblock-001",
      regionType: "titleblock",
      sourceType: "titleblock_ocr",
      bbox: { unit: "normalized_page", x: 0.55, y: 0.72, width: 0.45, height: 0.28 },
      score: 0.1235,
      text: "body"
    }
  )
  assert.equal(estimateTokenCount(""), 0)
  assert.equal(estimateTokenCount("abcd"), 1)
  assert.deepEqual(unique([" a ", "a", "", " b "]), ["a", "b"])
  assert.deepEqual(buildSearchClues("分類を教えて", ["分類を教えて", "追加"]), ["分類を教えて", "追加"])
  assert.equal(clamp(25, 1, 20), 20)
  assert.equal(clamp(-1, 1, 20), 1)
  assert.equal(compactDetail(["a", undefined, "b"], 3), "a\nb")
})
