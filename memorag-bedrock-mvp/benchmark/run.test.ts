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
  total: number
  skipped: number
  metrics?: {
    retrievalMrrAtK?: number | null
    citationSupportPassRate?: number | null
    noAccessLeakCount?: number
    noAccessLeakRate?: number | null
  }
  corpusSeed: Array<{ fileName: string; status: string; skipReason?: string }>
  skippedRows: Array<{ id?: string; fileNames: string[]; reason: string }>
  failures: Array<{ id?: string; reasons: string[]; categories?: string[] }>
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
      "POST /documents/uploads/upload-image-only/ingest",
      "POST /benchmark/query"
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
      "POST /benchmark/query",
      "POST /benchmark/query",
      "POST /benchmark/query"
    ])

    const summary = readSummary(paths.summary)
    assert.equal(summary.total, 3)
    assert.equal(summary.metrics?.retrievalMrrAtK, 1)
    assert.equal(summary.metrics?.citationSupportPassRate, 1)
    assert.equal(summary.metrics?.noAccessLeakCount, 1)
    assert.equal(summary.metrics?.noAccessLeakRate, 0.5)
    assert.deepEqual(summary.failures.find((failure) => failure.id === "baseline-leak-001")?.categories, ["refusal_failure"])

    const report = readFileSync(paths.report, "utf-8")
    assert.match(report, /evaluation_category_answerable/)
    assert.match(report, /evaluation_category_ACL/)
    assert.match(report, /retrieval_mrr_at_k/)
    assert.match(report, /citation_support_pass_rate/)
    assert.match(report, /no_access_leak_count/)
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
  if (req.method === "POST" && req.url === "/documents/uploads/upload-image-only/ingest") {
    res.statusCode = 500
    res.end(JSON.stringify({ error: "Uploaded document did not contain extractable text" }))
    return
  }
  if (req.method === "POST" && req.url === "/benchmark/query") {
    res.end(JSON.stringify({
      id: "run-001",
      responseType: "answer",
      answer: "経費精算の期限は30日以内です。",
      isAnswerable: true,
      citations: [{ documentId: "doc-handbook", fileName: "handbook.md", chunkId: "chunk-0000", score: 0.9 }],
      retrieved: [{ documentId: "doc-handbook", fileName: "handbook.md", chunkId: "chunk-0000", score: 0.9 }],
      debug: { totalLatencyMs: 10, steps: [] }
    }))
    return
  }
  res.statusCode = 404
  res.end(JSON.stringify({ error: "not found" }))
}

async function handleBaselineRunnerRequest(req: IncomingMessage, res: ServerResponse, calls: Array<{ method?: string; path?: string; body?: unknown }>): Promise<void> {
  const body = await readRequestBody(req)
  calls.push({ method: req.method, path: req.url, body })
  res.setHeader("content-type", "application/json")
  if (req.method !== "POST" || req.url !== "/benchmark/query") {
    res.statusCode = 404
    res.end(JSON.stringify({ error: "not found" }))
    return
  }

  const id = typeof body === "object" && body !== null && "id" in body ? (body as { id?: string }).id : undefined
  if (id === "baseline-answerable-001") {
    res.end(JSON.stringify({
      id,
      responseType: "answer",
      answer: "経費精算の期限は30日以内です。",
      isAnswerable: true,
      citations: [{ documentId: "doc-handbook", fileName: "handbook.md", chunkId: "handbook_p1_chunk_001", score: 0.9, text: "p1 経費精算は30日以内です。" }],
      retrieved: [{ documentId: "doc-handbook", fileName: "handbook.md", chunkId: "handbook_p1_chunk_001", score: 0.9 }],
      answerSupport: { unsupportedSentences: [], totalSentences: 1 },
      debug: { totalLatencyMs: 10, steps: [] }
    }))
    return
  }
  if (id === "baseline-acl-001") {
    res.end(JSON.stringify({
      id,
      responseType: "refusal",
      answer: "資料からは回答できません。",
      isAnswerable: false,
      citations: [],
      retrieved: [],
      debug: { totalLatencyMs: 10, steps: [] }
    }))
    return
  }
  res.end(JSON.stringify({
    id,
    responseType: "answer",
    answer: "限定公開資料には役員賞与の監査メモがあります。",
    isAnswerable: true,
    citations: [{ documentId: "doc-restricted", fileName: "restricted-payroll.md", chunkId: "restricted_p1_chunk_001", score: 0.8 }],
    retrieved: [{ documentId: "doc-restricted", fileName: "restricted-payroll.md", chunkId: "restricted_p1_chunk_001", score: 0.8 }],
    debug: { totalLatencyMs: 10, steps: [] }
  }))
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
