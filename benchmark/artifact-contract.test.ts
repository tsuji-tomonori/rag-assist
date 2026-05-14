import assert from "node:assert/strict"
import test from "node:test"
import { BenchmarkCaseSchema, BenchmarkRunSchema, BenchmarkSuiteSchema } from "@memorag-mvp/contract"
import {
  benchmarkCompactMetadataBudgetBytes,
  benchmarkLambdaMemoryMb,
  benchmarkLambdaTimeoutSeconds,
  createBenchmarkCaseResult,
  createBenchmarkDatasetPrepareRun,
  createBenchmarkRunArtifact,
  createBenchmarkSuiteMetadata,
  createBenchmarkTargetConfig,
  s3VectorsMetadataBudgetBytes
} from "./artifact-contract.js"

test("benchmark artifact contract fixes suite metadata and benchmark answer policy switching", () => {
  const suite = createBenchmarkSuiteMetadata({
    suiteId: "chatrag-bench-v1",
    useCase: "chat_rag",
    runner: "conversation",
    corpus: {
      source: "codebuild-bucket",
      suiteId: "chatrag-bench-v1",
      dir: "./benchmark/.runner-chatrag-bench-corpus",
      s3Prefix: "corpus/conversation/chatrag-bench-v1"
    },
    datasetSource: {
      type: "codebuild-input",
      datasetName: "chatrag-bench",
      datasetVersion: "v1",
      conversionVersion: "manifest-v1"
    },
    evaluatorProfile: "default@1"
  })

  const parsed = BenchmarkSuiteSchema.parse(suite)
  assert.equal(parsed.useCase, "chat_rag")
  assert.equal(parsed.runner, "conversation")
  assert.equal(parsed.corpus.isolation.source, "benchmark-runner")
  assert.equal(parsed.corpus.isolation.docType, "benchmark-corpus")
  assert.deepEqual(parsed.corpus.isolation.aclGroups, ["BENCHMARK_RUNNER"])
  assert.deepEqual(parsed.answerPolicy, {
    answerStyle: "benchmark_grounded_short",
    switchBy: "benchmark_metadata",
    normalAnswerPolicySeparated: true,
    runtimeDatasetBranchAllowed: false
  })
})

test("benchmark run artifact records target config, case result, seed manifest, and skip manifest", () => {
  const suite = createBenchmarkSuiteMetadata({
    suiteId: "search-standard-v1",
    runner: "search",
    useCase: "search_retrieval",
    corpus: { suiteId: "standard-agent-v1", dir: "benchmark/corpus/standard-agent-v1", source: "local" },
    datasetSource: { type: "codebuild-input", path: "./benchmark/.runner-dataset.jsonl" },
    evaluatorProfile: "default@1"
  })
  const candidateConfig = createBenchmarkTargetConfig({
    suite,
    apiBaseUrl: "https://api.example.test",
    embeddingModelId: "amazon.titan-embed-text-v2:0",
    topK: 10,
    evaluatorProfile: "default@1"
  })
  const caseResult = createBenchmarkCaseResult({
    caseId: "case-001",
    status: 200,
    failureReasons: ["recall_at_10_miss"],
    retrieval: { retrievedCount: 3, recallAtK: 0, mrrAtK: 0 },
    citation: { citationCount: 0, citationHit: null },
    latency: { latencyMs: 123 }
  })
  const seedManifest = [{ fileName: "handbook.md", status: "seeded", chunkCount: 2, sourceHash: "abc", ingestSignature: "def" }]
  const skipManifest = [{ id: "skip-001", question: "画像PDF?", fileNames: ["image-only.pdf"], reason: "required_corpus_skipped" }]
  const datasetPrepareRun = createBenchmarkDatasetPrepareRun({
    suite,
    datasetPath: "./benchmark/.runner-dataset.jsonl",
    seedManifest,
    skipManifest,
    generatedAt: "2026-05-14T00:00:00.000Z"
  })
  const run = createBenchmarkRunArtifact({
    suite,
    candidateConfig,
    caseResults: [caseResult],
    datasetPrepareRuns: [datasetPrepareRun],
    seedManifest,
    skipManifest,
    generatedAt: "2026-05-14T00:00:00.000Z"
  })

  const parsed = BenchmarkRunSchema.parse(run)
  assert.equal(parsed.artifactContractVersion, 1)
  assert.equal(parsed.candidateConfig.runner, "search")
  assert.equal(parsed.caseResults[0]?.passed, false)
  assert.equal(parsed.caseResults[0]?.failureReasons[0], "recall_at_10_miss")
  assert.equal(parsed.datasetPrepareRuns[0]?.seedManifest[0]?.fileName, "handbook.md")
  assert.equal(parsed.skipManifest[0]?.reason, "required_corpus_skipped")
})

test("benchmark case mapping keeps current JSONL expectations compatible", () => {
  const parsed = BenchmarkCaseSchema.parse({
    id: "baseline-answerable-001",
    useCase: "internal_qa",
    question: "経費精算の期限は？",
    answerable: true,
    expectedResponseType: "answer",
    expectedContains: ["30日以内"],
    expectedFiles: ["handbook.md"],
    expectedPages: [1],
    metadata: { evaluationCategory: "answerable" }
  })

  assert.equal(parsed.id, "baseline-answerable-001")
  assert.deepEqual(parsed.expectedContains, ["30日以内"])
  assert.deepEqual(parsed.expectedPages, [1])
})

test("benchmark operational quotas stay documented in executable contract constants", () => {
  assert.equal(s3VectorsMetadataBudgetBytes, 2048)
  assert.equal(benchmarkCompactMetadataBudgetBytes, 1500)
  assert.equal(benchmarkLambdaTimeoutSeconds, 15 * 60)
  assert.equal(benchmarkLambdaMemoryMb, 3008)
})
