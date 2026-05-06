import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { createServer, type IncomingMessage } from "node:http"
import type { AddressInfo } from "node:net"
import path from "node:path"
import { spawn, spawnSync } from "node:child_process"
import test from "node:test"
import { fileURLToPath } from "node:url"

type SearchSummaryArtifact = {
  evaluatorProfile: {
    id: string
    version: string
  }
  total: number
  runnerError?: string
  failures: Array<{
    id: string
    reasons: string[]
  }>
}

const benchmarkDir = path.dirname(fileURLToPath(import.meta.url))

test("search runner writes artifacts when evaluator profile is unknown", () => {
  const paths = artifactPaths("unknown-profile")
  const result = runSearchRunner({
    EVALUATOR_PROFILE: "unknown",
    OUTPUT: paths.output,
    SUMMARY: paths.summary,
    REPORT: paths.report
  })

  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /Unknown evaluator profile: unknown/)
  assert.equal(existsSync(paths.output), true)
  assert.equal(existsSync(paths.summary), true)
  assert.equal(existsSync(paths.report), true)

  const summary = readSummary(paths.summary)
  assert.equal(summary.evaluatorProfile.id, "default")
  assert.equal(summary.evaluatorProfile.version, "1")
  assert.match(summary.runnerError ?? "", /Unknown evaluator profile: unknown/)
  assert.equal(summary.failures.some((failure) => failure.id === "__runner__"), true)
})

test("search runner preserves evaluator profile in artifacts when baseline loading fails", () => {
  const paths = artifactPaths("missing-baseline")
  const result = runSearchRunner({
    EVALUATOR_PROFILE: "strict-ja",
    BASELINE_SUMMARY: path.join(paths.dir, "missing-summary.json"),
    OUTPUT: paths.output,
    SUMMARY: paths.summary,
    REPORT: paths.report
  })

  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /no such file or directory/)
  assert.equal(existsSync(paths.output), true)
  assert.equal(existsSync(paths.summary), true)
  assert.equal(existsSync(paths.report), true)

  const summary = readSummary(paths.summary)
  assert.equal(summary.evaluatorProfile.id, "strict-ja")
  assert.equal(summary.evaluatorProfile.version, "1")
  assert.match(summary.runnerError ?? "", /no such file or directory/)
  assert.match(readFileSync(paths.report, "utf-8"), /Evaluator profile: strict-ja@1/)
})

test("search runner seeds benchmark corpus before search rows when configured", async () => {
  const paths = artifactPaths("seed-corpus")
  const corpusDir = mkdtempSync(path.join(tmpdir(), "memorag-search-corpus-"))
  const datasetPath = path.join(paths.dir, "dataset.jsonl")
  writeFileSync(path.join(corpusDir, "handbook.md"), "# Handbook\n\n経費精算は30日以内です。\n", "utf-8")
  writeFileSync(datasetPath, `${JSON.stringify({
    id: "search-seeded-001",
    query: "経費精算 期限",
    relevant: [{ fileName: "handbook.md", grade: 2 }]
  })}\n`, "utf-8")

  const calls: Array<{ method?: string; path?: string; body?: unknown }> = []
  const server = createServer(async (req, res) => {
    const body = await readRequestJson(req)
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
    if (req.method === "POST" && req.url === "/benchmark/search") {
      res.end(JSON.stringify({
        query: "経費精算 期限",
        results: [{ id: "doc-handbook-chunk-0000", documentId: "doc-handbook", fileName: "handbook.md", chunkId: "chunk-0000", score: 0.9 }],
        diagnostics: { lexicalCount: 1, semanticCount: 0, fusedCount: 1, latencyMs: 12 }
      }))
      return
    }
    res.statusCode = 404
    res.end(JSON.stringify({ error: "not found" }))
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo | null
  assert.ok(address)

  try {
    const result = await runSearchRunnerAsync({
      API_BASE_URL: `http://127.0.0.1:${address.port}`,
      DATASET: datasetPath,
      BENCHMARK_CORPUS_DIR: corpusDir,
      BENCHMARK_CORPUS_SUITE_ID: "standard-agent-v1",
      OUTPUT: paths.output,
      SUMMARY: paths.summary,
      REPORT: paths.report
    })

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.deepEqual(calls.map((call) => `${call.method} ${call.path}`), ["GET /documents", "POST /documents", "POST /benchmark/search"])
    assert.equal((calls[1]?.body as { metadata?: { benchmarkSuiteId?: string } }).metadata?.benchmarkSuiteId, "standard-agent-v1")
    const summary = readSummary(paths.summary)
    assert.equal(summary.total, 1)
    assert.equal(summary.failures.length, 0)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

function artifactPaths(name: string): { dir: string; output: string; summary: string; report: string } {
  const dir = mkdtempSync(path.join(tmpdir(), `memorag-search-run-${name}-`))
  return {
    dir,
    output: path.join(dir, "results.jsonl"),
    summary: path.join(dir, "summary.json"),
    report: path.join(dir, "report.md")
  }
}

function runSearchRunner(env: Record<string, string>): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, ["--import", "tsx", "search-run.ts"], {
    cwd: benchmarkDir,
    env: {
      ...process.env,
      API_BASE_URL: "http://127.0.0.1:1",
      DATASET: "datasets/search.sample.jsonl",
      ...env
    },
    encoding: "utf-8"
  })
}

function runSearchRunnerAsync(env: Record<string, string>): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "search-run.ts"], {
      cwd: benchmarkDir,
      env: {
        ...process.env,
        API_BASE_URL: "http://127.0.0.1:1",
        DATASET: "datasets/search.sample.jsonl",
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

function readSummary(summaryPath: string): SearchSummaryArtifact {
  return JSON.parse(readFileSync(summaryPath, "utf-8")) as SearchSummaryArtifact
}

async function readRequestJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  const text = Buffer.concat(chunks).toString("utf-8")
  return text ? JSON.parse(text) : undefined
}
