import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

type SummaryArtifact = {
  evaluatorProfile: {
    id: string
    version: string
    retrieval: {
      recallK: number
    }
    thresholds: {
      retrievalRecallAtK?: number
      p95LatencyMs?: number
    }
  }
  total: number
  skipped: number
  metrics?: {
    queryRewriteAccuracy?: number | null
    pageRecallAtK?: number | null
    pageRecallAt20?: number | null
    regionRecallAtK?: number | null
    regionRecallAt20?: number | null
    normalizedAnswerAccuracy?: number | null
    extractionAccuracy?: number | null
    countMape?: number | null
    graphResolutionAccuracy?: number | null
    evidenceSufficiencyPassRate?: number | null
    retrievalRecallAtK?: number | null
    retrievalRecallAt20?: number | null
    retrievalMrrAtK?: number | null
    citationSupportPassRate?: number | null
    noAccessLeakCount?: number
    noAccessLeakRate?: number | null
    abstainAccuracy?: number | null
    unsupportedAnswerRate?: number | null
  }
  turnDependencyMetrics?: Record<string, {
    total: number
    queryRewriteAccuracy?: number | null
    retrievalRecallAtK?: number | null
    refusalPrecision?: number | null
    refusalRecall?: number | null
    unsupportedSentenceRate?: number | null
  }>
  corpusSeed: Array<{ fileName: string; status: string; skipReason?: string }>
  skippedRows: Array<{ id?: string; fileNames: string[]; reason: string }>
  failures: Array<{ id?: string; reasons: string[]; categories?: string[] }>
  diagnosticFailureBreakdown?: Record<string, number>
}

const benchmarkDir = path.dirname(fileURLToPath(import.meta.url))

test("benchmark runner skips rows that require unextractable corpus", async () => {
  const paths = artifactPaths("skip-unextractable")
  const corpusDir = mkdtempSync(path.join(tmpdir(), "memorag-run-corpus-"))
  const datasetPath = path.join(paths.dir, "dataset.jsonl")
  writeFileSync(path.join(corpusDir, "handbook.md"), "# Handbook\n\n経費精算は30日以内です。\n", "utf-8")
  writeFileSync(path.join(corpusDir, "image-only.pdf"), Buffer.from("%PDF-1.4 image only"))
  writeFileSync(datasetPath, `${[
    {
      id: "skip-001",
      question: "画像だけの PDF について",
      answerable: true,
      expectedFiles: ["image-only.pdf"],
      expectedContains: ["画像"]
    },
    {
      id: "run-001",
      question: "経費精算の期限は？",
      answerable: true,
      expectedFiles: ["handbook.md"],
      expectedContains: ["30日以内"]
    }
  ].map((row) => JSON.stringify(row)).join("\n")}\n`, "utf-8")

  const calls: Array<{ method?: string; path?: string; body?: unknown }> = []
  const server = createServer((req, res) => {
    void handleRunnerRequest(req, res, calls)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo | null
  assert.ok(address)

  try {
    const result = await runBenchmarkRunner({
      API_BASE_URL: `http://127.0.0.1:${address.port}`,
      DATASET: datasetPath,
      BENCHMARK_CORPUS_DIR: corpusDir,
      BENCHMARK_SUITE_ID: "allganize-rag-evaluation-ja-v1",
      OUTPUT: paths.output,
      SUMMARY: paths.summary,
      REPORT: paths.report
    })

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.deepEqual(calls.map((call) => `${call.method} ${call.path}`), [
      "GET /documents",
      "POST /documents",
      "POST /documents/uploads",
      "PUT /upload/image-only.pdf",
      "POST /document-ingest-runs",
      "GET /document-ingest-runs/ingest-image-only",
      "POST /rpc/benchmark/query"
    ])

    const summary = readSummary(paths.summary)
    assert.equal(summary.total, 1)
    assert.equal(summary.skipped, 1)
    assert.equal(summary.failures.length, 0)
    assert.deepEqual(summary.skippedRows, [{
      id: "skip-001",
      question: "画像だけの PDF について",
      fileNames: ["image-only.pdf"],
      reason: "required_corpus_skipped"
    }])
    assert.equal(summary.corpusSeed.find((seed) => seed.fileName === "image-only.pdf")?.status, "skipped_unextractable")
    assert.equal(summary.corpusSeed.find((seed) => seed.fileName === "image-only.pdf")?.skipReason, "no_extractable_text")
    assert.match(readFileSync(paths.report, "utf-8"), /## Skipped Rows/)
    assert.match(readFileSync(paths.report, "utf-8"), /image-only\.pdf/)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test("benchmark runner reports baseline categories, support, MRR, and ACL leak metrics", async () => {
  const paths = artifactPaths("rag-baseline")
  const datasetPath = path.join(paths.dir, "dataset.jsonl")
  writeFileSync(datasetPath, `${[
    {
      id: "baseline-answerable-001",
      question: "経費精算の期限は？",
      answerable: true,
      expectedResponseType: "answer",
      expectedContains: ["30日以内"],
      expectedFiles: ["handbook.md"],
      expectedPages: [1],
      metadata: { evaluationCategory: "answerable" }
    },
    {
      id: "baseline-acl-001",
      question: "役員賞与の監査メモには何と書かれていますか？",
      answerable: false,
      expectedResponseType: "refusal",
      forbiddenFiles: ["restricted-payroll.md"],
      metadata: { evaluationCategory: "ACL" }
    },
    {
      id: "baseline-leak-001",
      question: "限定公開資料を誤って参照するケース",
      answerable: false,
      expectedResponseType: "refusal",
      forbiddenFiles: ["restricted-payroll.md"],
      metadata: { evaluationCategory: "ACL" }
    }
  ].map((row) => JSON.stringify(row)).join("\n")}\n`, "utf-8")

  const calls: Array<{ method?: string; path?: string; body?: unknown }> = []
  const server = createServer((req, res) => {
    void handleBaselineRunnerRequest(req, res, calls)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo | null
  assert.ok(address)

  try {
    const result = await runBenchmarkRunner({
      API_BASE_URL: `http://127.0.0.1:${address.port}`,
      DATASET: datasetPath,
      OUTPUT: paths.output,
      SUMMARY: paths.summary,
      REPORT: paths.report
    })

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.deepEqual(calls.map((call) => `${call.method} ${call.path}`), [
      "POST /rpc/benchmark/query",
      "POST /rpc/benchmark/query",
      "POST /rpc/benchmark/query"
    ])

    const summary = readSummary(paths.summary)
    assert.equal(summary.total, 3)
    assert.equal(summary.metrics?.retrievalMrrAtK, 1)
    assert.equal(summary.metrics?.pageRecallAtK, 1)
    assert.equal(summary.metrics?.pageRecallAt20, 1)
    assert.equal(summary.metrics?.citationSupportPassRate, 1)
    assert.equal(summary.metrics?.noAccessLeakCount, 1)
    assert.equal(summary.metrics?.noAccessLeakRate, 0.5)
    assert.deepEqual(summary.failures.find((failure) => failure.id === "baseline-leak-001")?.categories, ["refusal_failure"])

    const report = readFileSync(paths.report, "utf-8")
    assert.match(report, /evaluation_category_answerable/)
    assert.match(report, /evaluation_category_ACL/)
    assert.match(report, /retrieval_mrr_at_k/)
    assert.match(report, /page_recall_at_k/)
    assert.match(report, /citation_support_pass_rate/)
    assert.match(report, /no_access_leak_count/)
    assert.match(report, /RAG profile: default@1 retrieval=default@1 answer=default-answer-policy@1/)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test("benchmark runner evaluates normalized drawing values without breaking contains checks", async () => {
  const paths = artifactPaths("drawing-normalized")
  const datasetPath = path.join(paths.dir, "dataset.jsonl")
  writeFileSync(datasetPath, `${[
    {
      id: "drawing-normalized-pass",
      question: "縮尺と延長は？",
      answerable: true,
      expectedResponseType: "answer",
      expectedContains: ["延長"],
      expectedFiles: ["drawing.pdf"],
      expectedNormalizedValues: [
        { kind: "scale", raw: "S=1/100" },
        { kind: "length", raw: "L=12.5m" }
      ]
    },
    {
      id: "drawing-normalized-fail",
      question: "管径は？",
      answerable: true,
      expectedResponseType: "answer",
      expectedContains: ["管径"],
      expectedFiles: ["drawing.pdf"],
      expectedNormalizedValues: [{ kind: "diameter", raw: "φ75" }]
    },
    {
      id: "plain-contains",
      question: "通常QA",
      answerable: true,
      expectedResponseType: "answer",
      expectedContains: ["通常回答"],
      expectedFiles: ["handbook.md"]
    }
  ].map((row) => JSON.stringify(row)).join("\n")}\n`, "utf-8")

  const calls: Array<{ method?: string; path?: string; body?: unknown }> = []
  const server = createServer((req, res) => {
    void handleNormalizedDrawingRunnerRequest(req, res, calls)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo | null
  assert.ok(address)

  try {
    const result = await runBenchmarkRunner({
      API_BASE_URL: `http://127.0.0.1:${address.port}`,
      DATASET: datasetPath,
      OUTPUT: paths.output,
      SUMMARY: paths.summary,
      REPORT: paths.report
    })

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.equal(calls.length, 3)

    const summary = readSummary(paths.summary)
    assert.equal(summary.metrics?.normalizedAnswerAccuracy, 0.5)
    assert.deepEqual(summary.failures.find((failure) => failure.id === "drawing-normalized-fail")?.reasons, ["normalized_answer_mismatch"])
    assert.equal(summary.failures.some((failure) => failure.id === "plain-contains"), false)

    const report = readFileSync(paths.report, "utf-8")
    assert.match(report, /normalized_answer_accuracy/)
    assert.match(report, /rows_with_expected_normalized_values/)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test("benchmark runner reports drawing diagnostic metrics only when expected fields exist", async () => {
  const paths = artifactPaths("drawing-diagnostics")
  const datasetPath = path.join(paths.dir, "dataset.jsonl")
  writeFileSync(datasetPath, `${[
    {
      id: "drawing-diagnostic-pass",
      question: "図面診断の正常系",
      answerable: true,
      expectedResponseType: "answer",
      expectedContains: ["正常"],
      expectedFiles: ["drawing.pdf"],
      expectedRegionIds: ["region-a"],
      expectedExtractionValues: [{ kind: "diameter", raw: "φ75" }],
      expectedCounts: [{ label: "door", expected: 2 }],
      expectedGraphResolutions: [{ id: "detail", target: "A-101" }]
    },
    {
      id: "drawing-diagnostic-fail",
      question: "図面診断の失敗系",
      answerable: true,
      expectedResponseType: "answer",
      expectedContains: ["失敗"],
      expectedFiles: ["drawing.pdf"],
      expectedRegionIds: ["region-missing"],
      expectedExtractionValues: [{ kind: "diameter", raw: "φ75" }],
      expectedCounts: [{ label: "door", expected: 4 }],
      expectedGraphResolutions: [{ id: "detail", target: "A-101" }]
    },
    {
      id: "plain-diagnostic-not-applicable",
      question: "通常QA",
      answerable: true,
      expectedResponseType: "answer",
      expectedContains: ["通常回答"],
      expectedFiles: ["handbook.md"]
    }
  ].map((row) => JSON.stringify(row)).join("\n")}\n`, "utf-8")

  const calls: Array<{ method?: string; path?: string; body?: unknown }> = []
  const server = createServer((req, res) => {
    void handleDrawingDiagnosticsRunnerRequest(req, res, calls)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo | null
  assert.ok(address)

  try {
    const result = await runBenchmarkRunner({
      API_BASE_URL: `http://127.0.0.1:${address.port}`,
      DATASET: datasetPath,
      OUTPUT: paths.output,
      SUMMARY: paths.summary,
      REPORT: paths.report
    })

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.equal(calls.length, 3)

    const summary = readSummary(paths.summary)
    assert.equal(summary.metrics?.regionRecallAtK, 0.5)
    assert.equal(summary.metrics?.regionRecallAt20, 0.5)
    assert.equal(summary.metrics?.extractionAccuracy, 0.5)
    assert.equal(summary.metrics?.countMape, 0.25)
    assert.equal(summary.metrics?.graphResolutionAccuracy, 0.5)
    assert.deepEqual(summary.failures.find((failure) => failure.id === "drawing-diagnostic-fail")?.reasons, [
      "region_recall_at_20_miss",
      "extraction_accuracy_mismatch",
      "count_mape_nonzero",
      "graph_resolution_mismatch"
    ])
    assert.equal(summary.diagnosticFailureBreakdown?.ocr, 1)
    assert.equal(summary.diagnosticFailureBreakdown?.grounding, 1)
    assert.equal(summary.diagnosticFailureBreakdown?.reasoning, 1)
    assert.equal(summary.failures.some((failure) => failure.id === "plain-diagnostic-not-applicable"), false)

    const report = readFileSync(paths.report, "utf-8")
    assert.match(report, /region_recall_at_k/)
    assert.match(report, /extraction_accuracy/)
    assert.match(report, /count_mape/)
    assert.match(report, /graph_resolution_accuracy/)
    assert.match(report, /rows_with_expected_region_ids/)
    assert.match(report, /Diagnostic Failure Breakdown/)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test("benchmark runner applies drawing evidence sufficiency gates", async () => {
  const paths = artifactPaths("drawing-evidence-gate")
  const datasetPath = path.join(paths.dir, "dataset.jsonl")
  writeFileSync(datasetPath, `${[
    {
      id: "drawing-gate-pass",
      question: "根拠bbox付きで縮尺を答える",
      answerable: true,
      expectedResponseType: "answer",
      expectedContains: ["縮尺"],
      expectedFiles: ["drawing.pdf"],
      expectedNormalizedValues: [{ kind: "scale", raw: "S=1/100" }],
      evidenceSufficiency: {
        requireBbox: true,
        expectedSourceTypes: ["project_drawing"],
        sourcePriority: ["project_drawing", "standard_detail"]
      }
    },
    {
      id: "drawing-gate-missing-bbox",
      question: "bboxなしの回答",
      answerable: true,
      expectedResponseType: "answer",
      expectedContains: ["縮尺"],
      expectedFiles: ["drawing.pdf"],
      evidenceSufficiency: {
        requireBbox: true,
        expectedSourceTypes: ["project_drawing"],
        sourcePriority: ["project_drawing", "standard_detail"]
      }
    },
    {
      id: "drawing-gate-source-priority",
      question: "標準図より案件図面を優先する",
      answerable: true,
      expectedResponseType: "answer",
      expectedContains: ["案件図面"],
      evidenceSufficiency: {
        expectedSourceTypes: ["project_drawing"],
        sourcePriority: ["project_drawing", "standard_detail"]
      }
    },
    {
      id: "drawing-gate-source-mismatch",
      question: "標準図だけで答えてしまう",
      answerable: true,
      expectedResponseType: "answer",
      expectedContains: ["案件図面"],
      evidenceSufficiency: {
        expectedSourceTypes: ["project_drawing"],
        sourcePriority: ["project_drawing", "standard_detail"]
      }
    },
    {
      id: "drawing-gate-normalized-mismatch",
      question: "正規化値が違う回答",
      answerable: true,
      expectedResponseType: "answer",
      expectedContains: ["管径"],
      expectedFiles: ["drawing.pdf"],
      expectedNormalizedValues: [{ kind: "diameter", raw: "φ75" }],
      evidenceSufficiency: {
        requireBbox: true,
        expectedSourceTypes: ["project_drawing"],
        sourcePriority: ["project_drawing", "standard_detail"]
      }
    },
    {
      id: "drawing-gate-refusal-ok",
      question: "根拠がない場合",
      answerable: false,
      expectedResponseType: "refusal"
    },
    {
      id: "drawing-gate-unsupported",
      question: "根拠がないのに回答",
      answerable: false,
      expectedResponseType: "refusal"
    }
  ].map((row) => JSON.stringify(row)).join("\n")}\n`, "utf-8")

  const calls: Array<{ method?: string; path?: string; body?: unknown }> = []
  const server = createServer((req, res) => {
    void handleDrawingEvidenceGateRunnerRequest(req, res, calls)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo | null
  assert.ok(address)

  try {
    const result = await runBenchmarkRunner({
      API_BASE_URL: `http://127.0.0.1:${address.port}`,
      DATASET: datasetPath,
      OUTPUT: paths.output,
      SUMMARY: paths.summary,
      REPORT: paths.report
    })

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.equal(calls.length, 7)

    const summary = readSummary(paths.summary)
    assert.equal(summary.metrics?.evidenceSufficiencyPassRate, 0.4)
    assert.equal(summary.metrics?.normalizedAnswerAccuracy, 0.5)
    assert.equal(summary.metrics?.abstainAccuracy, 0.5)
    assert.equal(summary.metrics?.unsupportedAnswerRate, 0.5)
    assert.deepEqual(summary.failures.find((failure) => failure.id === "drawing-gate-missing-bbox")?.reasons, ["missing_evidence_bbox"])
    assert.equal(summary.failures.some((failure) => failure.id === "drawing-gate-source-priority"), false)
    assert.deepEqual(summary.failures.find((failure) => failure.id === "drawing-gate-source-mismatch")?.reasons, ["source_priority_mismatch"])
    assert.deepEqual(summary.failures.find((failure) => failure.id === "drawing-gate-normalized-mismatch")?.reasons, [
      "normalized_answer_mismatch",
      "evidence_normalized_value_mismatch"
    ])
    assert.deepEqual(summary.failures.find((failure) => failure.id === "drawing-gate-unsupported")?.reasons, [
      "expected_refusal_but_answered",
      "expected_refusal_but_answer",
      "unsupported_answer"
    ])
    assert.equal(summary.diagnosticFailureBreakdown?.grounding, 2)
    assert.equal(summary.diagnosticFailureBreakdown?.ocr, 1)
    assert.equal(summary.diagnosticFailureBreakdown?.abstention, 1)

    const report = readFileSync(paths.report, "utf-8")
    assert.match(report, /abstain_accuracy/)
    assert.match(report, /unsupported_answer_rate/)
    assert.match(report, /evidence_sufficiency_pass_rate/)
    assert.match(report, /rows_with_evidence_sufficiency/)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test("benchmark runner executes conversation rows in turn order and passes history", async () => {
  const paths = artifactPaths("multiturn")
  const datasetPath = path.join(paths.dir, "dataset.jsonl")
  writeFileSync(datasetPath, `${[
    {
      id: "conv-1-turn-2",
      conversationId: "conv-1",
      turnIndex: 2,
      question: "その例外は？",
      expectedStandaloneQuestion: "経費精算の期限は？ その例外は？",
      turnDependency: "coreference",
      expectedContains: ["上長承認"],
      expectedFiles: ["handbook.md"]
    },
    {
      id: "conv-1-turn-1",
      conversationId: "conv-1",
      turnIndex: 1,
      question: "経費精算の期限は？",
      expectedContains: ["30日以内"],
      expectedFiles: ["handbook.md"]
    },
    {
      id: "conv-1-turn-3",
      conversationId: "conv-1",
      turnIndex: 3,
      question: "資料にない例外もある？",
      answerable: false,
      expectedResponseType: "refusal",
      turnDependency: "coreference",
      expectedFiles: ["handbook.md"]
    }
  ].map((row) => JSON.stringify(row)).join("\n")}\n`, "utf-8")

  const calls: Array<{ method?: string; path?: string; body?: unknown }> = []
  const server = createServer((req, res) => {
    void handleMultiturnRunnerRequest(req, res, calls)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo | null
  assert.ok(address)

  try {
    const result = await runBenchmarkRunner({
      API_BASE_URL: `http://127.0.0.1:${address.port}`,
      DATASET: datasetPath,
      OUTPUT: paths.output,
      SUMMARY: paths.summary,
      REPORT: paths.report
    })

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.deepEqual(calls.map((call) => (unwrapRpcBody(call.body) as { id?: string }).id), ["conv-1-turn-1", "conv-1-turn-2", "conv-1-turn-3"])
    const secondBody = unwrapRpcBody(calls[1]?.body) as { conversation?: { conversationId?: string; turns?: Array<{ role?: string; text?: string; citations?: unknown[] }> } }
    assert.equal(secondBody.conversation?.conversationId, "conv-1")
    assert.deepEqual(secondBody.conversation?.turns?.map((turn) => `${turn.role}:${turn.text}`), [
      "user:経費精算の期限は？",
      "assistant:経費精算の期限は30日以内です。"
    ])
    assert.equal(secondBody.conversation?.turns?.[1]?.citations?.length, 1)

    const summary = readSummary(paths.summary)
    assert.equal(summary.total, 3)
    assert.equal(summary.metrics?.queryRewriteAccuracy, 1)
    assert.equal(summary.turnDependencyMetrics?.coreference?.total, 2)
    assert.equal(summary.turnDependencyMetrics?.coreference?.refusalPrecision, 1)
    assert.equal(summary.turnDependencyMetrics?.coreference?.refusalRecall, 1)
    const report = readFileSync(paths.report, "utf-8")
    assert.match(report, /Turn Dependency Metrics/)
    assert.match(report, /refusal_precision/)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test("benchmark runner applies suite evaluator profile to retrieval K and thresholds", async () => {
  const paths = artifactPaths("strict-profile")
  const datasetPath = path.join(paths.dir, "dataset.jsonl")
  writeFileSync(datasetPath, `${JSON.stringify({
    id: "strict-profile-001",
    question: "経費精算の期限は？",
    answerable: true,
    expectedResponseType: "answer",
    expectedContains: ["30日以内"],
    expectedFiles: ["handbook.md"]
  })}\n`, "utf-8")

  const calls: Array<{ method?: string; path?: string; body?: unknown }> = []
  const server = createServer((req, res) => {
    void handleStrictProfileRunnerRequest(req, res, calls)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo | null
  assert.ok(address)

  try {
    const result = await runBenchmarkRunner({
      API_BASE_URL: `http://127.0.0.1:${address.port}`,
      DATASET: datasetPath,
      EVALUATOR_PROFILE: "strict-ja",
      OUTPUT: paths.output,
      SUMMARY: paths.summary,
      REPORT: paths.report
    })

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.deepEqual(calls.map((call) => `${call.method} ${call.path}`), ["POST /rpc/benchmark/query"])

    const summary = readSummary(paths.summary)
    assert.equal(summary.evaluatorProfile.id, "strict-ja")
    assert.equal(summary.evaluatorProfile.version, "1")
    assert.equal(summary.evaluatorProfile.retrieval.recallK, 10)
    assert.equal(summary.evaluatorProfile.thresholds.retrievalRecallAtK, 0.05)
    assert.equal(summary.evaluatorProfile.thresholds.p95LatencyMs, 2000)
    assert.equal(summary.metrics?.retrievalRecallAtK, 0)
    assert.equal(summary.metrics?.retrievalRecallAt20, 1)
    assert.deepEqual(summary.failures[0]?.reasons, ["retrieval_recall_at_10_miss"])

    const resultRow = JSON.parse(readFileSync(paths.output, "utf-8").trim()) as { evaluatorProfile?: string }
    assert.equal(resultRow.evaluatorProfile, "strict-ja@1")
    const report = readFileSync(paths.report, "utf-8")
    assert.match(report, /Evaluator profile: strict-ja@1/)
    assert.match(report, /retrieval_recall_at_k/)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

function artifactPaths(name: string): { dir: string; output: string; summary: string; report: string } {
  const dir = mkdtempSync(path.join(tmpdir(), `memorag-run-${name}-`))
  return {
    dir,
    output: path.join(dir, "results.jsonl"),
    summary: path.join(dir, "summary.json"),
    report: path.join(dir, "report.md")
  }
}

function runBenchmarkRunner(env: Record<string, string>): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "run.ts"], {
      cwd: benchmarkDir,
      env: {
        ...process.env,
        API_BASE_URL: "http://127.0.0.1:1",
        DATASET: "dataset.sample.jsonl",
        ...env
      },
      stdio: ["ignore", "pipe", "pipe"]
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)))
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)))
    child.on("error", reject)
    child.on("close", (status) => {
      resolve({
        status,
        stdout: Buffer.concat(stdout).toString("utf-8"),
        stderr: Buffer.concat(stderr).toString("utf-8")
      })
    })
  })
}

function readSummary(summaryPath: string): SummaryArtifact {
  return JSON.parse(readFileSync(summaryPath, "utf-8")) as SummaryArtifact
}

async function handleRunnerRequest(req: IncomingMessage, res: ServerResponse, calls: Array<{ method?: string; path?: string; body?: unknown }>): Promise<void> {
  const body = await readRequestBody(req)
  calls.push({ method: req.method, path: req.url, body })
  res.setHeader("content-type", "application/json")
  if (req.method === "GET" && req.url === "/documents") {
    res.end(JSON.stringify({ documents: [] }))
    return
  }
  if (req.method === "POST" && req.url === "/documents") {
    res.end(JSON.stringify({ fileName: "handbook.md", lifecycleStatus: "active", chunkCount: 1 }))
    return
  }
  if (req.method === "POST" && req.url === "/documents/uploads") {
    res.end(JSON.stringify({
      uploadId: "upload-image-only",
      uploadUrl: serverBaseUrl(req, "/upload/image-only.pdf"),
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      requiresAuth: false
    }))
    return
  }
  if (req.method === "PUT" && req.url === "/upload/image-only.pdf") {
    res.end(JSON.stringify({ ok: true }))
    return
  }
  if (req.method === "POST" && req.url === "/document-ingest-runs") {
    res.end(JSON.stringify({ runId: "ingest-image-only", status: "queued" }))
    return
  }
  if (req.method === "GET" && req.url === "/document-ingest-runs/ingest-image-only") {
    res.end(JSON.stringify({ runId: "ingest-image-only", status: "failed", error: "Uploaded document did not contain extractable text" }))
    return
  }
  if (req.method === "POST" && req.url === "/rpc/benchmark/query") {
    res.end(JSON.stringify({ json: {
      id: "run-001",
      responseType: "answer",
      answer: "経費精算の期限は30日以内です。",
      isAnswerable: true,
      citations: [{ documentId: "doc-handbook", fileName: "handbook.md", chunkId: "chunk-0000", score: 0.9 }],
      retrieved: [{ documentId: "doc-handbook", fileName: "handbook.md", chunkId: "chunk-0000", score: 0.9 }],
      debug: { ragProfile: defaultRagProfile(), totalLatencyMs: 10, steps: [] }
    } }))
    return
  }
  res.statusCode = 404
  res.end(JSON.stringify({ error: "not found" }))
}

async function handleBaselineRunnerRequest(req: IncomingMessage, res: ServerResponse, calls: Array<{ method?: string; path?: string; body?: unknown }>): Promise<void> {
  const body = await readRequestBody(req)
  calls.push({ method: req.method, path: req.url, body })
  res.setHeader("content-type", "application/json")
  if (req.method !== "POST" || req.url !== "/rpc/benchmark/query") {
    res.statusCode = 404
    res.end(JSON.stringify({ error: "not found" }))
    return
  }

  const input = unwrapRpcBody(body)
  const id = typeof input === "object" && input !== null && "id" in input ? (input as { id?: string }).id : undefined
  if (id === "baseline-answerable-001") {
    res.end(JSON.stringify({ json: {
      id,
      responseType: "answer",
      answer: "経費精算の期限は30日以内です。",
      isAnswerable: true,
      citations: [{ documentId: "doc-handbook", fileName: "handbook.md", chunkId: "handbook_p1_chunk_001", score: 0.9, text: "p1 経費精算は30日以内です。" }],
      retrieved: [{ documentId: "doc-handbook", fileName: "handbook.md", chunkId: "handbook_p1_chunk_001", score: 0.9 }],
      answerSupport: { unsupportedSentences: [], totalSentences: 1 },
      debug: { ragProfile: defaultRagProfile(), totalLatencyMs: 10, steps: [] }
    } }))
    return
  }
  if (id === "baseline-acl-001") {
    res.end(JSON.stringify({ json: {
      id,
      responseType: "refusal",
      answer: "資料からは回答できません。",
      isAnswerable: false,
      citations: [],
      retrieved: [],
      debug: { totalLatencyMs: 10, steps: [] }
    } }))
    return
  }
  res.end(JSON.stringify({ json: {
    id,
    responseType: "answer",
    answer: "限定公開資料には役員賞与の監査メモがあります。",
    isAnswerable: true,
    citations: [{ documentId: "doc-restricted", fileName: "restricted-payroll.md", chunkId: "restricted_p1_chunk_001", score: 0.8 }],
    retrieved: [{ documentId: "doc-restricted", fileName: "restricted-payroll.md", chunkId: "restricted_p1_chunk_001", score: 0.8 }],
    debug: { ragProfile: defaultRagProfile(), totalLatencyMs: 10, steps: [] }
  } }))
}

async function handleNormalizedDrawingRunnerRequest(req: IncomingMessage, res: ServerResponse, calls: Array<{ method?: string; path?: string; body?: unknown }>): Promise<void> {
  const body = await readRequestBody(req)
  calls.push({ method: req.method, path: req.url, body })
  res.setHeader("content-type", "application/json")
  if (req.method !== "POST" || req.url !== "/rpc/benchmark/query") {
    res.statusCode = 404
    res.end(JSON.stringify({ error: "not found" }))
    return
  }

  const input = unwrapRpcBody(body)
  const id = typeof input === "object" && input !== null && "id" in input ? (input as { id?: string }).id : undefined
  if (id === "drawing-normalized-pass") {
    res.end(JSON.stringify({ json: {
      id,
      responseType: "answer",
      answer: "縮尺は1:100、延長は12500mmです。",
      isAnswerable: true,
      citations: [{ documentId: "doc-drawing", fileName: "drawing.pdf", chunkId: "drawing_p1_chunk_001", score: 0.9, text: "タイトル欄 S=1/100。配管表 L=12.5m。" }],
      retrieved: [{ documentId: "doc-drawing", fileName: "drawing.pdf", chunkId: "drawing_p1_chunk_001", score: 0.9 }],
      answerSupport: { unsupportedSentences: [], totalSentences: 1 },
      debug: { ragProfile: defaultRagProfile(), totalLatencyMs: 10, steps: [] }
    } }))
    return
  }
  if (id === "drawing-normalized-fail") {
    res.end(JSON.stringify({ json: {
      id,
      responseType: "answer",
      answer: "管径はD=50です。",
      isAnswerable: true,
      citations: [{ documentId: "doc-drawing", fileName: "drawing.pdf", chunkId: "drawing_p1_chunk_002", score: 0.9, text: "管径 D=50" }],
      retrieved: [{ documentId: "doc-drawing", fileName: "drawing.pdf", chunkId: "drawing_p1_chunk_002", score: 0.9 }],
      answerSupport: { unsupportedSentences: [], totalSentences: 1 },
      debug: { ragProfile: defaultRagProfile(), totalLatencyMs: 10, steps: [] }
    } }))
    return
  }
  res.end(JSON.stringify({ json: {
    id,
    responseType: "answer",
    answer: "通常回答です。",
    isAnswerable: true,
    citations: [{ documentId: "doc-handbook", fileName: "handbook.md", chunkId: "handbook_p1_chunk_001", score: 0.9, text: "通常回答です。" }],
    retrieved: [{ documentId: "doc-handbook", fileName: "handbook.md", chunkId: "handbook_p1_chunk_001", score: 0.9 }],
    answerSupport: { unsupportedSentences: [], totalSentences: 1 },
    debug: { ragProfile: defaultRagProfile(), totalLatencyMs: 10, steps: [] }
  } }))
}

async function handleDrawingDiagnosticsRunnerRequest(req: IncomingMessage, res: ServerResponse, calls: Array<{ method?: string; path?: string; body?: unknown }>): Promise<void> {
  const body = await readRequestBody(req)
  calls.push({ method: req.method, path: req.url, body })
  res.setHeader("content-type", "application/json")
  if (req.method !== "POST" || req.url !== "/rpc/benchmark/query") {
    res.statusCode = 404
    res.end(JSON.stringify({ error: "not found" }))
    return
  }

  const input = unwrapRpcBody(body)
  const id = typeof input === "object" && input !== null && "id" in input ? (input as { id?: string }).id : undefined
  if (id === "drawing-diagnostic-pass") {
    res.end(JSON.stringify({ json: {
      id,
      responseType: "answer",
      answer: "正常に抽出しました。",
      isAnswerable: true,
      citations: [{ documentId: "doc-drawing", fileName: "drawing.pdf", chunkId: "drawing_p1_region_a", regionId: "region-a", score: 0.9, text: "VPφ75。door=2。detail A-101。" }],
      retrieved: [{ documentId: "doc-drawing", fileName: "drawing.pdf", chunkId: "drawing_p1_region_a", regionId: "region-a", score: 0.9 }],
      diagnostics: {
        extractions: [{ kind: "diameter", raw: "VPφ75", canonical: "diameter:phi:75" }],
        counts: [{ label: "door", value: 2 }],
        graphResolutions: [{ id: "detail", target: "A-101" }]
      },
      answerSupport: { unsupportedSentences: [], totalSentences: 1 },
      debug: { ragProfile: defaultRagProfile(), totalLatencyMs: 10, steps: [] }
    } }))
    return
  }
  if (id === "drawing-diagnostic-fail") {
    res.end(JSON.stringify({ json: {
      id,
      responseType: "answer",
      answer: "失敗例を返しました。",
      isAnswerable: true,
      citations: [{ documentId: "doc-drawing", fileName: "drawing.pdf", chunkId: "drawing_p1_region_b", regionId: "region-b", score: 0.9, text: "D=50。door=2。detail A-102。" }],
      retrieved: [{ documentId: "doc-drawing", fileName: "drawing.pdf", chunkId: "drawing_p1_region_b", regionId: "region-b", score: 0.9 }],
      diagnostics: {
        extractions: [{ kind: "diameter", raw: "D=50", canonical: "diameter:d:50" }],
        counts: [{ label: "door", value: 2 }],
        graphResolutions: [{ id: "detail", target: "A-102" }]
      },
      answerSupport: { unsupportedSentences: [], totalSentences: 1 },
      debug: { ragProfile: defaultRagProfile(), totalLatencyMs: 10, steps: [] }
    } }))
    return
  }
  res.end(JSON.stringify({ json: {
    id,
    responseType: "answer",
    answer: "通常回答です。",
    isAnswerable: true,
    citations: [{ documentId: "doc-handbook", fileName: "handbook.md", chunkId: "handbook_p1_chunk_001", score: 0.9, text: "通常回答です。" }],
    retrieved: [{ documentId: "doc-handbook", fileName: "handbook.md", chunkId: "handbook_p1_chunk_001", score: 0.9 }],
    answerSupport: { unsupportedSentences: [], totalSentences: 1 },
    debug: { ragProfile: defaultRagProfile(), totalLatencyMs: 10, steps: [] }
  } }))
}

async function handleDrawingEvidenceGateRunnerRequest(req: IncomingMessage, res: ServerResponse, calls: Array<{ method?: string; path?: string; body?: unknown }>): Promise<void> {
  const body = await readRequestBody(req)
  calls.push({ method: req.method, path: req.url, body })
  res.setHeader("content-type", "application/json")
  if (req.method !== "POST" || req.url !== "/rpc/benchmark/query") {
    res.statusCode = 404
    res.end(JSON.stringify({ error: "not found" }))
    return
  }

  const input = unwrapRpcBody(body)
  const id = typeof input === "object" && input !== null && "id" in input ? (input as { id?: string }).id : undefined
  if (id === "drawing-gate-pass") {
    res.end(JSON.stringify({ json: {
      id,
      responseType: "answer",
      answer: "縮尺は1:100です。",
      isAnswerable: true,
      citations: [{
        documentId: "doc-drawing",
        fileName: "drawing.pdf",
        chunkId: "drawing_p1_title",
        score: 0.9,
        text: "タイトル欄 S=1/100。",
        metadata: { drawingSourceType: "project_drawing", bbox: [10, 20, 120, 40] }
      }],
      retrieved: [{ documentId: "doc-drawing", fileName: "drawing.pdf", chunkId: "drawing_p1_title", score: 0.9 }],
      answerSupport: { unsupportedSentences: [], totalSentences: 1 },
      debug: { ragProfile: defaultRagProfile(), totalLatencyMs: 10, steps: [] }
    } }))
    return
  }
  if (id === "drawing-gate-missing-bbox") {
    res.end(JSON.stringify({ json: {
      id,
      responseType: "answer",
      answer: "縮尺は1:100です。",
      isAnswerable: true,
      citations: [{
        documentId: "doc-drawing",
        fileName: "drawing.pdf",
        chunkId: "drawing_p1_title",
        score: 0.9,
        text: "タイトル欄 S=1/100。",
        metadata: { drawingSourceType: "project_drawing" }
      }],
      retrieved: [{ documentId: "doc-drawing", fileName: "drawing.pdf", chunkId: "drawing_p1_title", score: 0.9 }],
      answerSupport: { unsupportedSentences: [], totalSentences: 1 },
      debug: { ragProfile: defaultRagProfile(), totalLatencyMs: 10, steps: [] }
    } }))
    return
  }
  if (id === "drawing-gate-source-priority") {
    res.end(JSON.stringify({ json: {
      id,
      responseType: "answer",
      answer: "案件図面の記載を優先します。",
      isAnswerable: true,
      citations: [
        {
          documentId: "doc-standard",
          fileName: "standard.pdf",
          chunkId: "standard_detail",
          score: 0.99,
          text: "標準図の一般記載。",
          metadata: { drawingSourceType: "standard_detail", bbox: [1, 2, 3, 4] }
        },
        {
          documentId: "doc-drawing",
          fileName: "drawing.pdf",
          chunkId: "project_note",
          score: 0.1,
          text: "案件図面の個別記載。",
          metadata: { drawingSourceType: "project_drawing", bbox: [10, 20, 120, 40] }
        }
      ],
      retrieved: [
        { documentId: "doc-standard", fileName: "standard.pdf", chunkId: "standard_detail", score: 0.99 },
        { documentId: "doc-drawing", fileName: "drawing.pdf", chunkId: "project_note", score: 0.1 }
      ],
      answerSupport: { unsupportedSentences: [], totalSentences: 1 },
      debug: { ragProfile: defaultRagProfile(), totalLatencyMs: 10, steps: [] }
    } }))
    return
  }
  if (id === "drawing-gate-source-mismatch") {
    res.end(JSON.stringify({ json: {
      id,
      responseType: "answer",
      answer: "案件図面の記載として回答します。",
      isAnswerable: true,
      citations: [{
        documentId: "doc-standard",
        fileName: "standard.pdf",
        chunkId: "standard_detail",
        score: 0.99,
        text: "標準図の一般記載。",
        metadata: { drawingSourceType: "standard_detail", bbox: [1, 2, 3, 4] }
      }],
      retrieved: [{ documentId: "doc-standard", fileName: "standard.pdf", chunkId: "standard_detail", score: 0.99 }],
      answerSupport: { unsupportedSentences: [], totalSentences: 1 },
      debug: { ragProfile: defaultRagProfile(), totalLatencyMs: 10, steps: [] }
    } }))
    return
  }
  if (id === "drawing-gate-normalized-mismatch") {
    res.end(JSON.stringify({ json: {
      id,
      responseType: "answer",
      answer: "管径はD=50です。",
      isAnswerable: true,
      citations: [{
        documentId: "doc-drawing",
        fileName: "drawing.pdf",
        chunkId: "drawing_pipe",
        score: 0.9,
        text: "管径 D=50。",
        metadata: { drawingSourceType: "project_drawing", bbox: [10, 20, 120, 40] }
      }],
      retrieved: [{ documentId: "doc-drawing", fileName: "drawing.pdf", chunkId: "drawing_pipe", score: 0.9 }],
      answerSupport: { unsupportedSentences: [], totalSentences: 1 },
      debug: { ragProfile: defaultRagProfile(), totalLatencyMs: 10, steps: [] }
    } }))
    return
  }
  if (id === "drawing-gate-refusal-ok") {
    res.end(JSON.stringify({ json: {
      id,
      responseType: "refusal",
      answer: "根拠がないため回答できません。",
      isAnswerable: false,
      citations: [],
      retrieved: [],
      answerSupport: { unsupportedSentences: [], totalSentences: 0 },
      debug: { ragProfile: defaultRagProfile(), totalLatencyMs: 10, steps: [] }
    } }))
    return
  }
  res.end(JSON.stringify({ json: {
    id,
    responseType: "answer",
    answer: "根拠はありませんが回答します。",
    isAnswerable: true,
    citations: [],
    retrieved: [],
    answerSupport: { unsupportedSentences: [], totalSentences: 1 },
    debug: { ragProfile: defaultRagProfile(), totalLatencyMs: 10, steps: [] }
  } }))
}

function unwrapRpcBody(body: unknown): unknown {
  if (typeof body === "object" && body !== null && "json" in body) return (body as { json?: unknown }).json
  return body
}

async function handleMultiturnRunnerRequest(req: IncomingMessage, res: ServerResponse, calls: Array<{ method?: string; path?: string; body?: unknown }>): Promise<void> {
  const body = await readRequestBody(req)
  calls.push({ method: req.method, path: req.url, body })
  res.setHeader("content-type", "application/json")
  if (req.method !== "POST" || req.url !== "/rpc/benchmark/query") {
    res.statusCode = 404
    res.end(JSON.stringify({ error: "not found" }))
    return
  }

  const input = unwrapRpcBody(body)
  const id = typeof input === "object" && input !== null && "id" in input ? (input as { id?: string }).id : undefined
  if (id === "conv-1-turn-1") {
    res.end(JSON.stringify({ json: {
      id,
      responseType: "answer",
      answer: "経費精算の期限は30日以内です。",
      isAnswerable: true,
      citations: [{ documentId: "doc-handbook", fileName: "handbook.md", chunkId: "handbook_p1_chunk_001", score: 0.9, text: "経費精算は30日以内です。" }],
      retrieved: [{ documentId: "doc-handbook", fileName: "handbook.md", chunkId: "handbook_p1_chunk_001", score: 0.9 }],
      debug: { ragProfile: defaultRagProfile(), totalLatencyMs: 10, steps: [] }
    } }))
    return
  }
  if (id === "conv-1-turn-3") {
    res.end(JSON.stringify({ json: {
      id,
      responseType: "refusal",
      answer: "資料からは回答できません。",
      isAnswerable: false,
      citations: [],
      retrieved: [{ documentId: "doc-handbook", fileName: "handbook.md", chunkId: "handbook_p1_chunk_002", score: 0.9 }],
      answerSupport: { unsupportedSentences: [], totalSentences: 0 },
      debug: { ragProfile: defaultRagProfile(), totalLatencyMs: 10, steps: [] }
    } }))
    return
  }
  res.end(JSON.stringify({ json: {
    id,
    responseType: "answer",
    answer: "例外は上長承認がある場合です。",
    isAnswerable: true,
    citations: [{ documentId: "doc-handbook", fileName: "handbook.md", chunkId: "handbook_p1_chunk_002", score: 0.9, text: "例外は上長承認がある場合です。" }],
    retrieved: [{ documentId: "doc-handbook", fileName: "handbook.md", chunkId: "handbook_p1_chunk_002", score: 0.9 }],
    debug: {
      ragProfile: defaultRagProfile(),
      totalLatencyMs: 10,
      steps: [{
        label: "decontextualize_query",
        latencyMs: 1,
        status: "success",
        output: {
          decontextualizedQuery: {
            standaloneQuestion: "経費精算の期限は？ その例外は？"
          }
        }
      }]
    }
  } }))
}

async function handleStrictProfileRunnerRequest(req: IncomingMessage, res: ServerResponse, calls: Array<{ method?: string; path?: string; body?: unknown }>): Promise<void> {
  const body = await readRequestBody(req)
  calls.push({ method: req.method, path: req.url, body })
  res.setHeader("content-type", "application/json")
  if (req.method !== "POST" || req.url !== "/rpc/benchmark/query") {
    res.statusCode = 404
    res.end(JSON.stringify({ error: "not found" }))
    return
  }

  const retrieved = Array.from({ length: 10 }, (_, index) => ({
    documentId: `doc-distractor-${index}`,
    fileName: `distractor-${index}.md`,
    chunkId: `distractor-${index}`,
    score: 0.8 - index * 0.01
  }))
  retrieved.push({ documentId: "doc-handbook", fileName: "handbook.md", chunkId: "handbook_p1_chunk_001", score: 0.5 })
  res.end(JSON.stringify({ json: {
    id: "strict-profile-001",
    responseType: "answer",
    answer: "経費精算の期限は30日以内です。",
    isAnswerable: true,
    citations: [{ documentId: "doc-handbook", fileName: "handbook.md", chunkId: "handbook_p1_chunk_001", score: 0.9 }],
    retrieved,
    answerSupport: { unsupportedSentences: [], totalSentences: 1 },
    debug: { ragProfile: defaultRagProfile(), totalLatencyMs: 10, steps: [] }
  } }))
}

function defaultRagProfile(): {
  id: string
  version: string
  retrievalProfileId: string
  retrievalProfileVersion: string
  answerPolicyId: string
  answerPolicyVersion: string
} {
  return {
    id: "default",
    version: "1",
    retrievalProfileId: "default",
    retrievalProfileVersion: "1",
    answerPolicyId: "default-answer-policy",
    answerPolicyVersion: "1"
  }
}

async function readRequestBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  const text = Buffer.concat(chunks).toString("utf-8")
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function serverBaseUrl(req: IncomingMessage, pathName: string): string {
  const host = req.headers.host
  assert.ok(host)
  return `http://${host}${pathName}`
}
