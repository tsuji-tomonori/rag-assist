import assert from "node:assert/strict"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { resolveExistingPath, resolveOutputPath } from "./paths.js"

test("resolveOutputPath resolves runner artifacts from the repository root", () => {
  const repoRoot = path.join(os.tmpdir(), "memorag-bedrock-mvp")

  assert.equal(
    resolveOutputPath("./benchmark/.runner-results.jsonl", repoRoot),
    path.join(repoRoot, "benchmark", ".runner-results.jsonl")
  )
})

test("resolveOutputPath keeps absolute artifact paths", () => {
  const absolutePath = path.join(os.tmpdir(), "benchmark-results.jsonl")

  assert.equal(resolveOutputPath(absolutePath, "/unused/base"), absolutePath)
})

test("resolveExistingPath checks all provided bases before falling back to cwd", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "benchmark-paths-"))
  const benchmarkDir = path.join(repoRoot, "benchmark")
  const datasetPath = path.join(benchmarkDir, ".runner-dataset.jsonl")
  await mkdir(benchmarkDir)
  await writeFile(datasetPath, "", "utf-8")

  assert.equal(
    resolveExistingPath("./benchmark/.runner-dataset.jsonl", [benchmarkDir, repoRoot]),
    datasetPath
  )
})
