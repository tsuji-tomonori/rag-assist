import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { validateSuite } from "./validate-suite.mjs";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);
const sampleSuiteDir = resolve(repoRoot, "benchmarks/suites/internal_qa/leave_policy_v1");

function createSuite(overrides = {}) {
  const dir = join(tmpdir(), `rag-assist-benchmark-suite-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(join(dir, "config"), { recursive: true });
  mkdirSync(join(dir, "corpus/pdfs"), { recursive: true });
  mkdirSync(resolve(repoRoot, "artifacts/benchmarks"), { recursive: true });
  writeFileSync(resolve(repoRoot, "artifacts/benchmarks/.gitignore"), "*\n!.gitignore\n");

  const suite = {
    schemaVersion: "benchmark.suite.v1",
    suiteId: "tmp_suite_v1",
    useCase: "internal_qa",
    name: "tmp",
    status: "active",
  };
  const corpus = {
    schemaVersion: "benchmark.corpus.v1",
    suiteId: "tmp_suite_v1",
    corpusVersion: "2026-05-21.001",
    benchmarkScope: { scopeType: "benchmark", folderLabel: "bench/tmp_suite_v1" },
    documents: [
      {
        documentKey: "doc_001",
        filePath: "./corpus/pdfs/doc.pdf",
        title: "Doc",
        mimeType: "application/pdf",
        expectedPageCount: 1,
        tags: ["tmp"],
      },
    ],
  };
  const runSpec = {
    schemaVersion: "benchmark.run.v1",
    suiteId: "tmp_suite_v1",
    runLabel: "tmp_suite_v1_default",
    seedManifestPath: "${ARTIFACT_DIR}/init/${CORPUS_VERSION}/seed_manifest.json",
    casesPath: "./cases.jsonl",
    pipeline: { pipelineId: "rag_chat_benchmark_v1", stages: ["citation_eval"] },
    targetConfigPath: "./config/target.dev.json",
    answerPolicyPath: "./config/answer_policy.json",
    promotionGatePath: "./config/promotion_gate.json",
    permissionFixturePath: "./config/permission_fixture.json",
    output: {
      artifactDir: "${ARTIFACT_DIR}/runs/${RUN_ID}",
      format: ["json", "jsonl", "md"],
      includeDebugTraceLink: true,
      includeCaseLevelResult: true,
    },
  };
  const cases = [
    {
      caseId: "case_001",
      suiteId: "tmp_suite_v1",
      useCase: "internal_qa",
      question: "Question?",
      expectedAnswer: "Answer.",
      expectedDocumentKeys: ["doc_001"],
      expectedPages: [1],
      answerUnavailableExpected: false,
      tags: ["tmp"],
      judge: ["answer_similarity", "citation_page_match"],
    },
  ];
  const answerPolicy = {
    schemaVersion: "benchmark.answer_policy.v1",
    answerStyle: "benchmark_grounded_short",
    forbidExternalKnowledge: true,
    forbidConversationHistoryOnlyAnswer: true,
    requireReferenceLikeShortAnswer: true,
    switchBy: "benchmark_metadata",
    forbidDatasetRowIdBranching: true,
  };
  const targetConfig = {
    schemaVersion: "benchmark.target_config.v1",
    modelId: "gpt-4.1",
    embeddingModelId: "text-embedding-3-large",
    retrieverVersion: "retriever_test",
    rerankerVersion: "reranker_test",
    chunkerVersion: "chunker_test",
    promptVersion: "prompt_test",
    contextCompressionVersion: "compression_test",
    indexVersion: "idx_test",
    searchTermMappingVersion: "mapping_test",
  };
  const promotionGate = {
    schemaVersion: "benchmark.promotion_gate.v1",
    minRecallAtK: 0.85,
    minCitationPrecision: 0.9,
    minFaithfulness: 0.9,
    maxUnsupportedSentenceRate: 0.02,
    maxFalseRefusalRate: 0.05,
    maxAnswerUnavailableFalseNegativeRate: 0.03,
    maxLatencyP95Ms: 15000,
    maxCostPerCase: 0.1,
    requireNoCriticalRegression: true,
  };

  const next = {
    suite: { ...suite, ...(overrides.suite ?? {}) },
    corpus: { ...corpus, ...(overrides.corpus ?? {}) },
    runSpec: { ...runSpec, ...(overrides.runSpec ?? {}) },
    cases: overrides.cases ?? cases,
    answerPolicy: { ...answerPolicy, ...(overrides.answerPolicy ?? {}) },
    targetConfig: { ...targetConfig, ...(overrides.targetConfig ?? {}) },
    promotionGate: { ...promotionGate, ...(overrides.promotionGate ?? {}) },
  };

  writeFileSync(join(dir, "init.sh"), '#!/usr/bin/env bash\nexec "$REPO_ROOT/benchmarks/_shared/scripts/init-suite.sh" --suite-dir "$SUITE_DIR" "$@"\n');
  writeFileSync(join(dir, "suite.json"), `${JSON.stringify(next.suite, null, 2)}\n`);
  writeFileSync(join(dir, "corpus.json"), `${JSON.stringify(next.corpus, null, 2)}\n`);
  writeFileSync(join(dir, "benchmark.run.json"), `${JSON.stringify(next.runSpec, null, 2)}\n`);
  writeFileSync(join(dir, "cases.jsonl"), `${next.cases.map((benchmarkCase) => JSON.stringify(benchmarkCase)).join("\n")}\n`);
  writeFileSync(join(dir, "config/target.dev.json"), `${JSON.stringify(next.targetConfig, null, 2)}\n`);
  writeFileSync(join(dir, "config/answer_policy.json"), `${JSON.stringify(next.answerPolicy, null, 2)}\n`);
  writeFileSync(join(dir, "config/promotion_gate.json"), `${JSON.stringify(next.promotionGate, null, 2)}\n`);
  writeFileSync(join(dir, "config/permission_fixture.json"), '{"schemaVersion":"benchmark.permission_fixture.v1"}\n');
  writeFileSync(join(dir, "corpus/pdfs/doc.pdf"), "%PDF-1.4\n%%EOF\n");
  return dir;
}

test("sample suite passes validation", () => {
  const result = validateSuite(sampleSuiteDir);
  assert.equal(result.suiteId, "leave_policy_v1");
  assert.equal(result.caseCount, 2);
});

test("duplicate caseId fails validation", () => {
  const dir = createSuite({
    cases: [
      {
        caseId: "dup",
        suiteId: "tmp_suite_v1",
        useCase: "internal_qa",
        question: "Q1",
        expectedAnswer: "A1",
        expectedDocumentKeys: ["doc_001"],
        answerUnavailableExpected: false,
        tags: ["tmp"],
        judge: ["answer_similarity"],
      },
      {
        caseId: "dup",
        suiteId: "tmp_suite_v1",
        useCase: "internal_qa",
        question: "Q2",
        expectedAnswer: "A2",
        expectedDocumentKeys: ["doc_001"],
        answerUnavailableExpected: false,
        tags: ["tmp"],
        judge: ["answer_similarity"],
      },
    ],
  });
  try {
    assert.throws(() => validateSuite(dir), /duplicate caseId/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("unknown expectedDocumentKeys fails validation", () => {
  const dir = createSuite({
    cases: [
      {
        caseId: "case_001",
        suiteId: "tmp_suite_v1",
        useCase: "internal_qa",
        question: "Q",
        expectedAnswer: "A",
        expectedDocumentKeys: ["missing_doc"],
        answerUnavailableExpected: false,
        tags: ["tmp"],
        judge: ["answer_similarity"],
      },
    ],
  });
  try {
    assert.throws(() => validateSuite(dir), /expectedDocumentKey is not in corpus/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("non-benchmark corpus scope fails validation", () => {
  const dir = createSuite({
    corpus: {
      benchmarkScope: { scopeType: "normal", folderLabel: "normal/tmp" },
    },
  });
  try {
    assert.throws(() => validateSuite(dir), /scopeType must be benchmark/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("benchmark_grounded_short requires grounded flags", () => {
  const dir = createSuite({
    answerPolicy: {
      forbidExternalKnowledge: false,
    },
  });
  try {
    assert.throws(() => validateSuite(dir), /forbidExternalKnowledge=true/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
