import {
  BenchmarkCaseResultSchema,
  BenchmarkRunSchema,
  type BenchmarkCaseResult,
  type BenchmarkDatasetPrepareRun,
  type BenchmarkDatasetSource,
  type BenchmarkRun,
  type BenchmarkRunner,
  type BenchmarkSuite,
  type BenchmarkTargetConfig,
  type BenchmarkUseCase
} from "@memorag-mvp/contract"
import type { JsonValue } from "@memorag-mvp/contract"

export const benchmarkArtifactContractVersion = 1 as const
export const s3VectorsMetadataBudgetBytes = 2048
export const benchmarkCompactMetadataBudgetBytes = 1500
export const benchmarkLambdaTimeoutSeconds = 900
export const benchmarkLambdaMemoryMb = 3008

export type SuiteMetadataInput = {
  suiteId: string
  runner: BenchmarkRunner
  useCase?: BenchmarkUseCase
  corpus?: {
    source?: "local" | "codebuild-bucket" | "prepared" | "none"
    dir?: string
    suiteId?: string
    s3Prefix?: string
  }
  datasetSource?: BenchmarkDatasetSource
  evaluatorProfile?: string
  metadata?: Record<string, JsonValue>
}

export type ArtifactTargetInput = {
  suite: BenchmarkSuite
  apiBaseUrl?: string
  modelId?: string
  embeddingModelId?: string
  clueModelId?: string
  topK?: number
  memoryTopK?: number
  minScore?: number
  evaluatorProfile: string
}

export function createBenchmarkSuiteMetadata(input: SuiteMetadataInput): BenchmarkSuite {
  const corpusSuiteId = input.corpus?.suiteId ?? input.suiteId
  return {
    suiteId: input.suiteId,
    useCase: input.useCase ?? inferBenchmarkUseCase(input.suiteId, input.runner),
    runner: input.runner,
    corpus: {
      suiteId: corpusSuiteId,
      source: input.corpus?.source ?? (input.corpus?.dir ? "local" : "none"),
      dir: input.corpus?.dir,
      s3Prefix: input.corpus?.s3Prefix,
      isolation: {
        source: "benchmark-runner",
        docType: "benchmark-corpus",
        benchmarkSuiteId: corpusSuiteId,
        aclGroups: ["BENCHMARK_RUNNER"]
      }
    },
    datasetSource: input.datasetSource ?? { type: "local" },
    evaluatorProfile: input.evaluatorProfile ?? "default",
    answerPolicy: benchmarkAnswerPolicyContract(),
    metadata: input.metadata
  }
}

export function createBenchmarkTargetConfig(input: ArtifactTargetInput): BenchmarkTargetConfig {
  return {
    targetName: "candidate",
    apiBaseUrl: input.apiBaseUrl,
    modelId: input.modelId,
    embeddingModelId: input.embeddingModelId,
    clueModelId: input.clueModelId,
    topK: input.topK,
    memoryTopK: input.memoryTopK,
    minScore: input.minScore,
    evaluatorProfile: input.evaluatorProfile,
    benchmarkSuiteId: input.suite.suiteId,
    runner: input.suite.runner
  }
}

export function createBenchmarkRunArtifact(input: {
  runId?: string
  suite: BenchmarkSuite
  candidateConfig: BenchmarkTargetConfig
  baselineConfig?: BenchmarkTargetConfig
  caseResults?: BenchmarkCaseResult[]
  datasetPrepareRuns?: BenchmarkDatasetPrepareRun[]
  seedManifest?: BenchmarkRun["seedManifest"]
  skipManifest?: BenchmarkRun["skipManifest"]
  generatedAt?: string
}): BenchmarkRun {
  return BenchmarkRunSchema.parse({
    artifactContractVersion: benchmarkArtifactContractVersion,
    runId: input.runId,
    suite: input.suite,
    baselineConfig: input.baselineConfig,
    candidateConfig: input.candidateConfig,
    caseResults: input.caseResults ?? [],
    datasetPrepareRuns: input.datasetPrepareRuns ?? [],
    seedManifest: input.seedManifest ?? [],
    skipManifest: input.skipManifest ?? [],
    generatedAt: input.generatedAt ?? new Date().toISOString()
  })
}

export function createBenchmarkCaseResult(input: {
  caseId?: string
  status: number
  failureReasons: string[]
  retrieval?: BenchmarkCaseResult["retrieval"]
  citation?: BenchmarkCaseResult["citation"]
  latency?: BenchmarkCaseResult["latency"]
  cost?: BenchmarkCaseResult["cost"]
}): BenchmarkCaseResult {
  return BenchmarkCaseResultSchema.parse({
    caseId: input.caseId,
    status: input.status,
    passed: input.failureReasons.length === 0 && input.status >= 200 && input.status < 300,
    failureReasons: input.failureReasons,
    retrieval: input.retrieval,
    citation: input.citation,
    latency: input.latency,
    cost: input.cost
  })
}

export function createBenchmarkDatasetPrepareRun(input: {
  prepareRunId?: string
  suite: BenchmarkSuite
  datasetPath?: string
  status?: "succeeded" | "failed" | "skipped"
  seedManifest?: BenchmarkRun["seedManifest"]
  skipManifest?: BenchmarkRun["skipManifest"]
  failureReason?: string
  generatedAt?: string
}): BenchmarkDatasetPrepareRun {
  return {
    prepareRunId: input.prepareRunId ?? `${input.suite.suiteId}:dataset-prepare`,
    suiteId: input.suite.suiteId,
    datasetSource: input.suite.datasetSource,
    status: input.status ?? (input.failureReason ? "failed" : "succeeded"),
    datasetPath: input.datasetPath,
    seedManifest: input.seedManifest ?? [],
    skipManifest: input.skipManifest ?? [],
    failureReason: input.failureReason,
    generatedAt: input.generatedAt ?? new Date().toISOString()
  }
}

export function benchmarkAnswerPolicyContract(): BenchmarkSuite["answerPolicy"] {
  return {
    answerStyle: "benchmark_grounded_short",
    switchBy: "benchmark_metadata",
    normalAnswerPolicySeparated: true,
    runtimeDatasetBranchAllowed: false
  }
}

export function datasetSourceFromEnv(env: NodeJS.ProcessEnv, fallbackType: BenchmarkDatasetSource["type"] = "local"): BenchmarkDatasetSource {
  const type = benchmarkDatasetSourceType(env.BENCHMARK_DATASET_SOURCE_TYPE) ?? fallbackType
  return {
    type,
    path: env.DATASET,
    datasetName: env.BENCHMARK_DATASET_NAME,
    datasetVersion: env.BENCHMARK_DATASET_VERSION,
    conversionVersion: env.BENCHMARK_DATASET_CONVERSION_VERSION,
    sourceUri: env.DATASET_S3_URI ?? env.BENCHMARK_DATASET_SOURCE_URI
  }
}

export function targetConfigFromEnv(input: {
  suite: BenchmarkSuite
  env: NodeJS.ProcessEnv
  apiBaseUrl: string
  evaluatorProfile: string
  defaultModelId?: string
  defaultEmbeddingModelId?: string
}): BenchmarkTargetConfig {
  return createBenchmarkTargetConfig({
    suite: input.suite,
    apiBaseUrl: input.apiBaseUrl,
    modelId: input.env.MODEL_ID ?? input.defaultModelId,
    embeddingModelId: input.env.EMBEDDING_MODEL_ID ?? input.defaultEmbeddingModelId,
    clueModelId: input.env.CLUE_MODEL_ID,
    topK: envInt(input.env, "TOP_K"),
    memoryTopK: envInt(input.env, "MEMORY_TOP_K"),
    minScore: envNumber(input.env, "MIN_SCORE"),
    evaluatorProfile: input.evaluatorProfile
  })
}

export function inferBenchmarkUseCase(suiteId: string, runner: BenchmarkRunner): BenchmarkUseCase {
  if (runner === "search") return "search_retrieval"
  if (/mtrag/i.test(suiteId)) return "multi_turn_rag"
  if (/chatrag/i.test(suiteId)) return "chat_rag"
  if (/drawing|architecture/i.test(suiteId)) return "design_drawing_qa"
  if (/mmrag|long|docqa/i.test(suiteId)) return "long_pdf_qa"
  if (/public-pdf/i.test(suiteId)) return "public_pdf_qa"
  return "internal_qa"
}

function benchmarkDatasetSourceType(value: string | undefined): BenchmarkDatasetSource["type"] | undefined {
  if (value === "local" || value === "codebuild-input" || value === "prepare" || value === "external") return value
  return undefined
}

function envInt(env: NodeJS.ProcessEnv, name: string): number | undefined {
  const raw = env[name]
  if (!raw) return undefined
  const value = Number(raw)
  return Number.isInteger(value) ? value : undefined
}

function envNumber(env: NodeJS.ProcessEnv, name: string): number | undefined {
  const raw = env[name]
  if (!raw) return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}
