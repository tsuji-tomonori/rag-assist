import { z } from "zod"
import { JsonValueSchema } from "../json.js"
import { ChatRequestSchema, ChatResponseSchema } from "./chat.js"
import { SearchRequestSchema, SearchResponseSchema } from "./search.js"

const BenchmarkSearchForbiddenUserGroups = new Set([
  "SYSTEM_ADMIN",
  "RAG_GROUP_MANAGER",
  "BENCHMARK_OPERATOR",
  "BENCHMARK_RUNNER",
  "ANSWER_EDITOR",
  "USER_ADMIN",
  "ACCESS_ADMIN",
  "COST_AUDITOR"
])

export const BenchmarkQueryRequestSchema = ChatRequestSchema.extend({
  id: z.string().optional(),
  benchmarkSuiteId: z.string().optional()
})

export const BenchmarkQueryResponseSchema = ChatResponseSchema.extend({
  id: z.string().optional()
})

export const BenchmarkSearchRequestSchema = SearchRequestSchema.extend({
  benchmarkSuiteId: z.string().optional(),
  user: z.object({
    userId: z.string().min(1).max(160).optional(),
    groups: z.array(z.string().min(1).max(160)).max(20).optional()
  }).optional()
}).superRefine((value, ctx) => {
  for (const group of value.user?.groups ?? []) {
    if (BenchmarkSearchForbiddenUserGroups.has(group)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["user", "groups"],
        message: `Benchmark search user cannot include privileged group ${group}`
      })
    }
  }
})

export const BenchmarkSearchResponseSchema = SearchResponseSchema

export const BenchmarkUseCaseSchema = z.enum([
  "internal_qa",
  "multi_turn_rag",
  "chat_rag",
  "search_retrieval",
  "long_pdf_qa",
  "design_drawing_qa",
  "knowledge_quality",
  "public_pdf_qa",
  "async_agent_task"
])

export const BenchmarkRunnerSchema = z.enum(["agent", "search", "conversation", "async_agent"])

export const BenchmarkDatasetSourceSchema = z.object({
  type: z.enum(["local", "codebuild-input", "prepare", "external"]),
  path: z.string().optional(),
  datasetName: z.string().optional(),
  datasetVersion: z.string().optional(),
  conversionVersion: z.string().optional(),
  sourceUri: z.string().optional()
})

export const BenchmarkCorpusConfigSchema = z.object({
  suiteId: z.string().min(1),
  source: z.enum(["local", "codebuild-bucket", "prepared", "none"]).default("none"),
  dir: z.string().optional(),
  s3Prefix: z.string().optional(),
  isolation: z.object({
    source: z.literal("benchmark-runner"),
    docType: z.literal("benchmark-corpus"),
    aclGroups: z.array(z.literal("BENCHMARK_RUNNER")),
    benchmarkSuiteId: z.string().min(1)
  })
})

export const BenchmarkAnswerPolicyContractSchema = z.object({
  answerStyle: z.literal("benchmark_grounded_short"),
  switchBy: z.literal("benchmark_metadata"),
  normalAnswerPolicySeparated: z.literal(true),
  runtimeDatasetBranchAllowed: z.literal(false)
})

export const BenchmarkSuiteSchema = z.object({
  suiteId: z.string().min(1),
  useCase: BenchmarkUseCaseSchema,
  runner: BenchmarkRunnerSchema,
  corpus: BenchmarkCorpusConfigSchema,
  datasetSource: BenchmarkDatasetSourceSchema,
  evaluatorProfile: z.string().min(1),
  answerPolicy: BenchmarkAnswerPolicyContractSchema,
  metadata: z.record(z.string(), JsonValueSchema).optional()
})

export const BenchmarkCaseSchema = z.object({
  id: z.string().min(1).optional(),
  useCase: BenchmarkUseCaseSchema.optional(),
  runner: BenchmarkRunnerSchema.optional(),
  question: z.string().optional(),
  query: z.string().optional(),
  conversationId: z.string().optional(),
  turnId: z.string().optional(),
  turnIndex: z.number().int().nonnegative().optional(),
  expectedResponseType: z.enum(["answer", "refusal", "clarification"]).optional(),
  answerable: z.boolean().optional(),
  expectedContains: z.union([z.string(), z.array(z.string())]).optional(),
  expectedRegex: z.union([z.string(), z.array(z.string())]).optional(),
  expectedFiles: z.array(z.string()).optional(),
  expectedFileNames: z.array(z.string()).optional(),
  expectedDocumentIds: z.array(z.string()).optional(),
  expectedPages: z.array(z.union([z.string(), z.number()])).optional(),
  evaluatorProfile: z.string().optional(),
  metadata: z.record(z.string(), JsonValueSchema).optional()
})

export const BenchmarkTargetConfigSchema = z.object({
  targetName: z.string().default("candidate"),
  apiBaseUrl: z.string().optional(),
  modelId: z.string().optional(),
  embeddingModelId: z.string().optional(),
  clueModelId: z.string().optional(),
  topK: z.number().int().positive().optional(),
  memoryTopK: z.number().int().positive().optional(),
  minScore: z.number().optional(),
  evaluatorProfile: z.string().min(1),
  benchmarkSuiteId: z.string().min(1),
  runner: BenchmarkRunnerSchema
})

export const BenchmarkCaseResultSchema = z.object({
  caseId: z.string().optional(),
  status: z.number().int(),
  passed: z.boolean(),
  failureReasons: z.array(z.string()),
  retrieval: z.object({
    retrievedCount: z.number().int().nonnegative().optional(),
    recallAtK: z.number().nullable().optional(),
    recallAt20: z.number().nullable().optional(),
    mrrAtK: z.number().nullable().optional(),
    noAccessLeakCount: z.number().int().nonnegative().optional()
  }).default(() => ({})),
  citation: z.object({
    citationCount: z.number().int().nonnegative().optional(),
    citationHit: z.boolean().nullable().optional(),
    citationSupportPass: z.boolean().nullable().optional(),
    expectedFileHit: z.boolean().nullable().optional(),
    expectedPageHit: z.boolean().nullable().optional()
  }).default(() => ({})),
  latency: z.object({
    latencyMs: z.number().int().nonnegative().optional(),
    taskLatencyMs: z.number().int().nonnegative().optional()
  }).default(() => ({})),
  cost: z.object({
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    estimatedCostUsd: z.number().nonnegative().optional()
  }).default(() => ({}))
})

export const BenchmarkSeedManifestEntrySchema = z.object({
  fileName: z.string(),
  status: z.string(),
  chunkCount: z.number().int().nonnegative().optional(),
  sourceHash: z.string().optional(),
  ingestSignature: z.string().optional(),
  skipReason: z.string().optional()
})

export const BenchmarkSkipManifestEntrySchema = z.object({
  id: z.string().optional(),
  question: z.string().optional(),
  fileNames: z.array(z.string()).default(() => []),
  reason: z.string()
})

export const BenchmarkDatasetPrepareRunSchema = z.object({
  prepareRunId: z.string(),
  suiteId: z.string().min(1),
  datasetSource: BenchmarkDatasetSourceSchema,
  status: z.enum(["succeeded", "failed", "skipped"]),
  datasetPath: z.string().optional(),
  seedManifest: z.array(BenchmarkSeedManifestEntrySchema).default(() => []),
  skipManifest: z.array(BenchmarkSkipManifestEntrySchema).default(() => []),
  failureReason: z.string().optional(),
  generatedAt: z.string()
})

export const BenchmarkRunSchema = z.object({
  artifactContractVersion: z.literal(1),
  runId: z.string().optional(),
  suite: BenchmarkSuiteSchema,
  baselineConfig: BenchmarkTargetConfigSchema.optional(),
  candidateConfig: BenchmarkTargetConfigSchema,
  caseResults: z.array(BenchmarkCaseResultSchema).default(() => []),
  datasetPrepareRuns: z.array(BenchmarkDatasetPrepareRunSchema).default(() => []),
  seedManifest: z.array(BenchmarkSeedManifestEntrySchema).default(() => []),
  skipManifest: z.array(BenchmarkSkipManifestEntrySchema).default(() => []),
  generatedAt: z.string()
})

export type BenchmarkQueryRequest = z.input<typeof BenchmarkQueryRequestSchema>
export type BenchmarkQueryResponse = z.output<typeof BenchmarkQueryResponseSchema>
export type BenchmarkSearchRequest = z.input<typeof BenchmarkSearchRequestSchema>
export type BenchmarkSearchResponse = z.output<typeof BenchmarkSearchResponseSchema>
export type BenchmarkUseCase = z.output<typeof BenchmarkUseCaseSchema>
export type BenchmarkRunner = z.output<typeof BenchmarkRunnerSchema>
export type BenchmarkDatasetSource = z.output<typeof BenchmarkDatasetSourceSchema>
export type BenchmarkCorpusConfig = z.output<typeof BenchmarkCorpusConfigSchema>
export type BenchmarkAnswerPolicyContract = z.output<typeof BenchmarkAnswerPolicyContractSchema>
export type BenchmarkSuite = z.output<typeof BenchmarkSuiteSchema>
export type BenchmarkCase = z.output<typeof BenchmarkCaseSchema>
export type BenchmarkTargetConfig = z.output<typeof BenchmarkTargetConfigSchema>
export type BenchmarkCaseResult = z.output<typeof BenchmarkCaseResultSchema>
export type BenchmarkDatasetPrepareRun = z.output<typeof BenchmarkDatasetPrepareRunSchema>
export type BenchmarkRun = z.output<typeof BenchmarkRunSchema>
