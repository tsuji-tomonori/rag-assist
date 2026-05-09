import assert from "node:assert/strict"
import test from "node:test"
import { createRunnerEnv, loadCodeBuildSuiteManifest, resolveCodeBuildSuite } from "./codebuild-suite.js"

test("loads CodeBuild suite manifest and resolves standard corpus without CDK conditionals", async () => {
  const manifest = await loadCodeBuildSuiteManifest()
  const suite = resolveCodeBuildSuite(manifest, "search-standard-v1")
  const env = createRunnerEnv(manifest, suite, {
    DATASET: "./benchmark/.runner-dataset.jsonl",
    OUTPUT: "./benchmark/.runner-results.jsonl",
    SUMMARY: "./benchmark/.runner-summary.json",
    REPORT: "./benchmark/.runner-report.md"
  })

  assert.equal(suite.runner, "search")
  assert.equal(env.BENCHMARK_SUITE_ID, "search-standard-v1")
  assert.equal(env.BENCHMARK_CORPUS_DIR, "benchmark/corpus/standard-agent-v1")
  assert.equal(env.BENCHMARK_CORPUS_SUITE_ID, "standard-agent-v1")
})

test("resolves dynamic prepare suites from manifest", async () => {
  const manifest = await loadCodeBuildSuiteManifest()
  const suite = resolveCodeBuildSuite(manifest, "mmrag-docqa-v1")
  const env = createRunnerEnv(manifest, suite, {})

  assert.equal(suite.dataset.source, "prepare")
  assert.equal(suite.prepare?.script, "prepare:mmrag-docqa")
  assert.equal(suite.runner, "agent")
  assert.equal(env.DATASET, "./benchmark/.runner-dataset.jsonl")
  assert.equal(env.OUTPUT, "./benchmark/.runner-results.jsonl")
  assert.equal(env.MMRAG_DOCQA_DATASET_OUTPUT, "./benchmark/.runner-dataset.jsonl")
  assert.equal(env.BENCHMARK_CORPUS_DIR, "./benchmark/.runner-mmrag-docqa-corpus")
  assert.equal(env.BENCHMARK_CORPUS_SUITE_ID, "mmrag-docqa-v1")
})

test("fails unknown CodeBuild benchmark suites before running shell commands", async () => {
  const manifest = await loadCodeBuildSuiteManifest()

  assert.throws(
    () => resolveCodeBuildSuite(manifest, "new-suite-not-in-manifest"),
    /Unknown benchmark suite/
  )
})
