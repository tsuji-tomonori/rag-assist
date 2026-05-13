import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { resolveExistingPath, resolveOutputPath } from "./conversation-run.js"

test("conversation runner resolves CodeBuild corpus paths from repo root candidates", () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "memorag-conversation-run-"))
  const repoRoot = path.join(tempDir, "repo")
  const benchmarkDir = path.join(repoRoot, "benchmark")
  const workspaceCwd = path.join(repoRoot, "benchmark")
  const corpusDir = path.join(repoRoot, "benchmark", ".runner-chatrag-bench-corpus")
  mkdirSync(corpusDir, { recursive: true })
  writeFileSync(path.join(corpusDir, "chatrag_sample_it.md"), "# sample\n", "utf-8")

  const resolved = resolveExistingPath("./benchmark/.runner-chatrag-bench-corpus", [workspaceCwd, benchmarkDir, repoRoot])
  assert.equal(resolved, corpusDir)
})

test("conversation runner writes relative outputs under the repository root", () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const resolved = resolveOutputPath(".local-data/conversation-summary.json")
  assert.equal(resolved, path.join(repoRoot, ".local-data", "conversation-summary.json"))
})
