import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { prepareArchitectureDrawingQaragBenchmark, toDatasetRows } from "./architecture-drawing-qarag.js"

test("converts the managed Markdown into benchmark dataset rows", async () => {
  const markdown = await readFile("architecture-drawing-qarag-v0.1.md", "utf-8")
  const rows = toDatasetRows(markdown)

  assert.equal(rows.length, 82)
  assert.deepEqual(rows[0], {
    id: "OV-001",
    question: "建築工事標準詳細図の目的は何か。",
    answerable: true,
    expectedResponseType: "answer",
    referenceAnswer: "設計で使用頻度の高い詳細を標準化し、設計の質の確保、能率向上、寸法統一を図り、積算・施工等の業務簡素化を図ること。",
    expectedContains: ["設計で使用頻度の高い詳細を標準化し", "設計の質の確保"],
    expectedFiles: ["s01-建築工事標準詳細図-令和4年改定-概要-表示記号及び略号.pdf"],
    expectedPages: ["P1"],
    complexity: "procedure",
    metadata: {
      benchmarkSuiteId: "architecture-drawing-qarag-v0.1",
      sourceId: "S01",
      documentName: "建築工事標準詳細図（令和4年改定）概要・表示記号及び略号",
      pageOrSheet: "P1",
      evidenceAnchor: "lines 12-15",
      modalityScope: "text+layout",
      taskCategory: "metadata/policy",
      subSkill: "purpose",
      retrievalSetting: "single-page",
      scoringRule: "semantic_exact_with_required_terms",
      difficulty: "easy",
      acceptableAliasesOrNormalization: "要旨一致。設計品質/能率/寸法統一/積算施工簡素化のうち主要要素を含む。",
      notes: undefined
    }
  })

  const refusal = rows.find((row) => row.id === "NEG-001")
  assert.equal(refusal?.answerable, false)
  assert.equal(refusal?.expectedResponseType, "refusal")
  assert.equal(refusal?.unanswerableType, "missing_fact")
})

test("prepares a dataset and downloads only sources referenced by seed QA", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "architecture-qarag-"))
  try {
    const markdownPath = path.join(tempDir, "benchmark.md")
    const datasetOutput = path.join(tempDir, "dataset.jsonl")
    const corpusDir = path.join(tempDir, "corpus")
    await import("node:fs/promises").then(({ writeFile }) => writeFile(markdownPath, [
      "# Sample",
      "## 公的図面・参照ソース",
      "",
      "| source_id | source_name | type | publisher | year/version | primary_use | url | notes |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
      "| S01 | Sample Drawing | PDF | Publisher | 2026 | test | https://example.com/sample.pdf | note |",
      "| B01 | Unused Benchmark | PDF | Publisher | 2026 | unused | https://example.com/unused.pdf | note |",
      "",
      "## Seed QA",
      "",
      "### QA-001 / titleblock/OCR / drawing title",
      "",
      "- source_id: `S01`",
      "- document_name: Sample Drawing",
      "- page_or_sheet: P1",
      "- evidence_anchor: title block",
      "- modality_scope: drawing image+OCR",
      "- retrieval_setting: single-page",
      "- question_ja: 図名は何か。",
      "- expected_answer_ja: サンプル図。",
      "- acceptable_aliases_or_normalization: 完全一致。",
      "- scoring_rule: `exact_or_alias`",
      "- difficulty: `easy`",
      ""
    ].join("\n"), "utf-8"))

    const requested: string[] = []
    const fetcher = (async (url: string | URL | Request) => {
      requested.push(String(url))
      return new Response(Buffer.from("%PDF-1.4 sample"), { status: 200 })
    }) as typeof fetch

    const result = await prepareArchitectureDrawingQaragBenchmark({ markdownPath, datasetOutput, corpusDir, fetchImpl: fetcher })
    const dataset = await readFile(datasetOutput, "utf-8")
    const corpus = await readFile(path.join(corpusDir, "s01-sample-drawing.pdf"))

    assert.equal(result.datasetRows, 1)
    assert.deepEqual(result.corpusFiles, ["s01-sample-drawing.pdf"])
    assert.deepEqual(requested, ["https://example.com/sample.pdf"])
    assert.match(dataset, /"id":"QA-001"/)
    assert.equal(corpus.toString(), "%PDF-1.4 sample")
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
