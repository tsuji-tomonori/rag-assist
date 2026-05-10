import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { parseArchitectureDrawingQaragDefinition, prepareArchitectureDrawingQaragBenchmark, toDatasetRows } from "./architecture-drawing-qarag.js"

test("converts the managed JSON into benchmark dataset rows", async () => {
  const definition = parseArchitectureDrawingQaragDefinition(await readFile("architecture-drawing-qarag-v0.1.json", "utf-8"))
  const rows = toDatasetRows(definition)

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
      expectedEvidenceRegions: [],
      drawingSourceType: "standard_detail",
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
    const configPath = path.join(tempDir, "benchmark.json")
    const datasetOutput = path.join(tempDir, "dataset.jsonl")
    const corpusDir = path.join(tempDir, "corpus")
    await import("node:fs/promises").then(({ writeFile }) => writeFile(configPath, JSON.stringify({
      schemaVersion: 1,
      suiteId: "architecture-drawing-qarag-v0.1",
      label: "Sample",
      description: "Sample benchmark definition",
      sources: [
        {
          sourceId: "S01",
          sourceName: "Sample Drawing",
          type: "PDF",
          publisher: "Publisher",
          yearVersion: "2026",
          primaryUse: "test",
          url: "https://example.com/sample.pdf",
          notes: "note"
        },
        {
          sourceId: "B01",
          sourceName: "Unused Benchmark",
          type: "PDF",
          publisher: "Publisher",
          yearVersion: "2026",
          primaryUse: "unused",
          url: "https://example.com/unused.pdf",
          notes: "note"
        }
      ],
      seedQa: [
        {
          id: "QA-001",
          taskCategory: "titleblock/OCR",
          subSkill: "drawing title",
          sourceId: "S01",
          documentName: "Sample Drawing",
          pageOrSheet: "P1",
          evidenceAnchor: "title block",
          modalityScope: "drawing image+OCR",
          retrievalSetting: "single-page",
          questionJa: "図名は何か。",
          expectedAnswerJa: "サンプル図。",
          acceptableAliasesOrNormalization: "完全一致。",
          scoringRule: "exact_or_alias",
          difficulty: "easy"
        }
      ]
    }), "utf-8"))

    const requested: string[] = []
    const fetcher = (async (url: string | URL | Request) => {
      requested.push(String(url))
      return new Response(Buffer.from("%PDF-1.4 sample"), { status: 200 })
    }) as typeof fetch

    const result = await prepareArchitectureDrawingQaragBenchmark({ configPath, datasetOutput, corpusDir, fetchImpl: fetcher })
    const dataset = await readFile(datasetOutput, "utf-8")
    const corpus = await readFile(path.join(corpusDir, "s01-sample-drawing.pdf"))
    const corpusMetadata = JSON.parse(await readFile(path.join(corpusDir, "s01-sample-drawing.pdf.metadata.json"), "utf-8")) as {
      drawingSourceType?: string
      drawingSheetMetadata?: Array<{ pageOrSheet?: string; sheetTitle?: string; sourceQaIds?: string[] }>
      drawingRegionIndex?: Array<{ regionType?: string; pageOrSheet?: string; bbox?: { unit?: string }; sourceQaIds?: string[] }>
    }

    assert.equal(result.datasetRows, 1)
    assert.deepEqual(result.corpusFiles, ["s01-sample-drawing.pdf"])
    assert.deepEqual(requested, ["https://example.com/sample.pdf"])
    assert.match(dataset, /"id":"QA-001"/)
    assert.match(dataset, /"expectedEvidenceRegions":/)
    assert.equal(corpusMetadata.drawingSourceType, "external")
    assert.deepEqual(corpusMetadata.drawingSheetMetadata?.[0]?.sourceQaIds, ["QA-001"])
    assert.equal(corpusMetadata.drawingRegionIndex?.[0]?.regionType, "titleblock")
    assert.equal(corpusMetadata.drawingRegionIndex?.[0]?.bbox?.unit, "normalized_page")
    assert.equal(corpus.toString(), "%PDF-1.4 sample")
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test("prepares visual page retrieval candidate artifacts behind a feature flag", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "architecture-qarag-visual-"))
  try {
    const configPath = path.join(tempDir, "benchmark.json")
    const datasetOutput = path.join(tempDir, "dataset.jsonl")
    const corpusDir = path.join(tempDir, "corpus")
    const visualIndexOutput = path.join(tempDir, "visual-page-index.json")
    const visualReportOutput = path.join(tempDir, "visual-page-report.md")
    await import("node:fs/promises").then(({ writeFile }) => writeFile(configPath, JSON.stringify({
      schemaVersion: 1,
      suiteId: "architecture-drawing-qarag-v0.1",
      label: "Sample",
      description: "Sample benchmark definition",
      sources: [
        {
          sourceId: "A01",
          sourceName: "Project Drawing",
          type: "PDF",
          publisher: "Publisher",
          yearVersion: "2026",
          primaryUse: "public procurement drawing",
          url: "https://example.com/project.pdf",
          notes: "note"
        }
      ],
      seedQa: [
        {
          id: "QA-001",
          taskCategory: "legend/abbreviation",
          subSkill: "legend lookup",
          sourceId: "A01",
          documentName: "Project Drawing",
          pageOrSheet: "A-01",
          evidenceAnchor: "凡例表",
          modalityScope: "drawing image+OCR",
          retrievalSetting: "single-page",
          questionJa: "凡例の意味は何か。",
          expectedAnswerJa: "凡例の意味。",
          acceptableAliasesOrNormalization: "要旨一致。",
          scoringRule: "semantic_exact",
          difficulty: "medium"
        }
      ]
    }), "utf-8"))

    const fetcher = (async () => new Response(Buffer.from("%PDF-1.4 sample"), { status: 200 })) as typeof fetch

    await prepareArchitectureDrawingQaragBenchmark({
      configPath,
      datasetOutput,
      corpusDir,
      fetchImpl: fetcher,
      visualPageRetrieval: {
        enabled: true,
        indexOutput: visualIndexOutput,
        reportOutput: visualReportOutput,
        profileId: "drawing-visual-page-test@1"
      }
    })

    const dataset = JSON.parse((await readFile(datasetOutput, "utf-8")).trim()) as { metadata?: { visualPageRetrieval?: { profileId?: string; expectedPageCandidates?: unknown[] } } }
    const visualIndex = JSON.parse(await readFile(visualIndexOutput, "utf-8")) as {
      profileId?: string
      defaultPath?: boolean
      pages?: Array<{ sourceId?: string; pageOrSheet?: string; regionIds?: string[] }>
      adoptionGate?: { decision?: string; requiredMetrics?: string[] }
    }
    const report = await readFile(visualReportOutput, "utf-8")

    assert.equal(dataset.metadata?.visualPageRetrieval?.profileId, "drawing-visual-page-test@1")
    assert.equal(dataset.metadata?.visualPageRetrieval?.expectedPageCandidates?.length, 1)
    assert.equal(visualIndex.profileId, "drawing-visual-page-test@1")
    assert.equal(visualIndex.defaultPath, false)
    assert.equal(visualIndex.pages?.[0]?.sourceId, "A01")
    assert.equal(visualIndex.pages?.[0]?.pageOrSheet, "A-01")
    assert.equal(visualIndex.pages?.[0]?.regionIds?.length, 1)
    assert.equal(visualIndex.adoptionGate?.decision, "not_adopted_pending_ablation")
    assert.ok(visualIndex.adoptionGate?.requiredMetrics?.includes("page_recall_at_k"))
    assert.match(report, /Not adopted as default yet/)
    assert.match(report, /no_access_leak_count=0/)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
