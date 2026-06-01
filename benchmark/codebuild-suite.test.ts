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
  assert.equal(suite.metadata?.useCase, "search_retrieval")
  assert.equal(env.BENCHMARK_SUITE_ID, "search-standard-v1")
  assert.equal(env.BENCHMARK_CORPUS_DIR, "benchmark/corpus/standard-agent-v1")
  assert.equal(env.BENCHMARK_CORPUS_SUITE_ID, "standard-agent-v1")
  assert.equal(env.BENCHMARK_USE_CASE, "search_retrieval")
  assert.equal(env.BENCHMARK_DATASET_SOURCE_TYPE, "codebuild-input")
})

test("resolves dynamic prepare suites from manifest", async () => {
  const manifest = await loadCodeBuildSuiteManifest()
  const suite = resolveCodeBuildSuite(manifest, "mmrag-docqa-v1")
  const env = createRunnerEnv(manifest, suite, {})

  assert.equal(suite.dataset.source, "prepare")
  assert.equal(suite.metadata?.useCase, "long_pdf_qa")
  assert.equal(suite.prepare?.script, "prepare:mmrag-docqa")
  assert.equal(suite.runner, "agent")
  assert.equal(env.DATASET, "./benchmark/.runner-dataset.jsonl")
  assert.equal(env.OUTPUT, "./benchmark/.runner-results.jsonl")
  assert.equal(env.MMRAG_DOCQA_DATASET_OUTPUT, "./benchmark/.runner-dataset.jsonl")
  assert.equal(env.BENCHMARK_CORPUS_DIR, "./benchmark/.runner-mmrag-docqa-corpus")
  assert.equal(env.BENCHMARK_CORPUS_SUITE_ID, "mmrag-docqa-v1")
  assert.equal(env.BENCHMARK_USE_CASE, "long_pdf_qa")
  assert.equal(env.BENCHMARK_DATASET_SOURCE_TYPE, "prepare")
  assert.equal(env.BENCHMARK_DATASET_NAME, "mmlongbench-docqa")
})

test("resolves conversation corpus from the CodeBuild bucket", async () => {
  const manifest = await loadCodeBuildSuiteManifest()
  const cases = [
    {
      suiteId: "mtrag-v1",
      dir: "./benchmark/.runner-mtrag-corpus",
      s3Prefix: "corpus/conversation/mtrag-v1"
    },
    {
      suiteId: "chatrag-bench-v1",
      dir: "./benchmark/.runner-chatrag-bench-corpus",
      s3Prefix: "corpus/conversation/chatrag-bench-v1"
    }
  ]

  for (const expected of cases) {
    const suite = resolveCodeBuildSuite(manifest, expected.suiteId)
    const env = createRunnerEnv(manifest, suite, {})

    assert.equal(suite.runner, "conversation")
    assert.ok(suite.metadata?.useCase === "multi_turn_rag" || suite.metadata?.useCase === "chat_rag")
    assert.deepEqual(suite.corpus, {
      source: "codebuild-bucket",
      dir: expected.dir,
      suiteId: expected.suiteId,
      s3Prefix: expected.s3Prefix
    })
    assert.equal(env.BENCHMARK_CORPUS_DIR, expected.dir)
    assert.equal(env.BENCHMARK_CORPUS_SUITE_ID, expected.suiteId)
  }
})

test("sets async agent runner env for CodeBuild suites without requiring a package script", () => {
  const manifest = {
    version: 1,
    defaults: {
      dataset: "./benchmark/.runner-dataset.jsonl",
      output: "./benchmark/.runner-results.jsonl",
      summary: "./benchmark/.runner-summary.json",
      report: "./benchmark/.runner-report.md"
    },
    suites: []
  } as Parameters<typeof createRunnerEnv>[0]
  const env = createRunnerEnv(manifest, {
    suiteId: "async-agent-task-v1",
    mode: "async_agent",
    runner: "async_agent",
    dataset: { source: "local", path: "benchmark/dataset.sample.jsonl" },
    metadata: { useCase: "async_agent_task" }
  }, {})

  assert.equal(env.BENCHMARK_RUNNER, "async_agent")
  assert.equal(env.BENCHMARK_USE_CASE, "async_agent_task")
  assert.equal(env.BENCHMARK_SUITE_ID, "async-agent-task-v1")
})

test("fails unknown CodeBuild benchmark suites before running shell commands", async () => {
  const manifest = await loadCodeBuildSuiteManifest()

  assert.throws(
    () => resolveCodeBuildSuite(manifest, "new-suite-not-in-manifest"),
    /Unknown benchmark suite/
  )
})
