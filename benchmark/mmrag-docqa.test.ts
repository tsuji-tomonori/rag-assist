import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { convertMmLongBenchRow, prepareMmragDocqaBenchmark } from "./mmrag-docqa.js"

test("convertMmLongBenchRow maps answerable rows to benchmark JSONL rows", () => {
  const row = convertMmLongBenchRow({
    doc_id: "example.pdf",
    doc_type: "Academic paper",
    question: "Which items are listed?",
    answer: "['alpha', 'beta']",
    evidence_pages: "[2, 3]",
    evidence_sources: "['Chart', 'Table']",
    answer_format: "List"
  }, 0)

  assert.equal(row.id, "mmlongbench-doc-0001")
  assert.equal(row.answerable, true)
  assert.equal(row.expectedResponseType, "answer")
  assert.equal(row.referenceAnswer, "['alpha', 'beta']")
  assert.deepEqual(row.expectedContains, ["alpha", "beta"])
  assert.deepEqual(row.expectedFiles, ["example.pdf"])
  assert.deepEqual(row.expectedPages, [2, 3])
  assert.equal(row.topK, 20)
  assert.equal(row.memoryTopK, 6)
  assert.equal(row.minScore, 0.15)
  assert.equal(row.useMemory, false)
  assert.deepEqual(row.metadata.evidenceSources, ["Chart", "Table"])
  assert.equal(row.expectedFactSlots[0]?.id, "answer_core")
})

test("convertMmLongBenchRow maps Not answerable rows to expected refusal", () => {
  const row = convertMmLongBenchRow({
    doc_id: "example.pdf",
    doc_type: "Tutorial",
    question: "What is missing?",
    answer: "Not answerable",
    evidence_pages: "[]",
    evidence_sources: "[]",
    answer_format: "None"
  }, 12)

  assert.equal(row.id, "mmlongbench-doc-0013")
  assert.equal(row.answerable, false)
  assert.equal(row.expectedResponseType, "refusal")
  assert.equal(row.referenceAnswer, undefined)
  assert.equal(row.expectedAnswer, undefined)
  assert.deepEqual(row.expectedContains, undefined)
  assert.deepEqual(row.expectedFactSlots, [])
})

test("convertMmLongBenchRow can enable memory ablation explicitly", () => {
  const row = convertMmLongBenchRow({
    doc_id: "example.pdf",
    doc_type: "Tutorial",
    question: "What is listed?",
    answer: "Answer",
    evidence_pages: "[1]",
    evidence_sources: "['Text']",
    answer_format: "Str"
  }, 2, { useMemory: true })

  assert.equal(row.useMemory, true)
})

test("prepareMmragDocqaBenchmark writes all 1091 rows by default", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mmrag-docqa-"))
  const datasetOutput = path.join(tempDir, "dataset.jsonl")
  const requestedOffsets: number[] = []
  const sourceRows = Array.from({ length: 1091 }, (_, index) => ({
    doc_id: `doc-${String(index % 3).padStart(2, "0")}.pdf`,
    doc_type: "Research report / Introduction",
    question: `Question ${index + 1}?`,
    answer: index % 5 === 0 ? "Not answerable" : `Answer ${index + 1}`,
    evidence_pages: index % 5 === 0 ? "[]" : "[1]",
    evidence_sources: index % 5 === 0 ? "[]" : "['Pure-text (Plain-text)']",
    answer_format: index % 5 === 0 ? "None" : "Str"
  }))
  const fakeFetch = (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input.toString())
    const offset = Number(url.searchParams.get("offset") ?? "0")
    const length = Number(url.searchParams.get("length") ?? "100")
    requestedOffsets.push(offset)
    return Response.json({
      rows: sourceRows.slice(offset, offset + length).map((row, index) => ({ row_idx: offset + index, row })),
      num_rows_total: sourceRows.length
    })
  }) as typeof fetch

  try {
    await prepareMmragDocqaBenchmark({
      MMRAG_DOCQA_DATASET_OUTPUT: datasetOutput,
      MMRAG_DOCQA_DOWNLOAD_DOCUMENTS: "0"
    }, fakeFetch)

    const lines = (await readFile(datasetOutput, "utf-8")).trim().split("\n")
    assert.equal(lines.length, 1091)
    assert.deepEqual(requestedOffsets, [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000])
  } finally {
    await rm(tempDir, { force: true, recursive: true })
  }
})

test("prepareMmragDocqaBenchmark writes memory-enabled rows when requested", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mmrag-docqa-memory-"))
  const datasetOutput = path.join(tempDir, "dataset.jsonl")
  const sourceRows = [{
    doc_id: "doc-00.pdf",
    doc_type: "Research report",
    question: "Question?",
    answer: "Answer",
    evidence_pages: "[1]",
    evidence_sources: "['Pure-text (Plain-text)']",
    answer_format: "Str"
  }]
  const fakeFetch = (async () => Response.json({
    rows: sourceRows.map((row, index) => ({ row_idx: index, row })),
    num_rows_total: sourceRows.length
  })) as typeof fetch

  try {
    await prepareMmragDocqaBenchmark({
      MMRAG_DOCQA_DATASET_OUTPUT: datasetOutput,
      MMRAG_DOCQA_DOWNLOAD_DOCUMENTS: "0",
      MMRAG_DOCQA_EXPECTED_TOTAL: "1",
      MMRAG_DOCQA_USE_MEMORY: "1"
    }, fakeFetch)

    const [line] = (await readFile(datasetOutput, "utf-8")).trim().split("\n")
    assert.equal(JSON.parse(line ?? "{}").useMemory, true)
  } finally {
    await rm(tempDir, { force: true, recursive: true })
  }
})
