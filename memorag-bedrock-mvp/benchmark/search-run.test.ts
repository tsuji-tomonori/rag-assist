import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { fileURLToPath } from "node:url"

type SearchSummaryArtifact = {
  evaluatorProfile: {
    id: string
    version: string
  }
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

function readSummary(summaryPath: string): SearchSummaryArtifact {
  return JSON.parse(readFileSync(summaryPath, "utf-8")) as SearchSummaryArtifact
}
