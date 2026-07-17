import { z } from "zod"
import { JsonValueSchema } from "../json.js"
import { ChatRequestSchema, ChatResponseSchema, FirstTokenTimingEvidenceSchema } from "./chat.js"
import { SearchRequestSchema, SearchResponseSchema } from "./search.js"

export const BenchmarkQueryRequestSchema = ChatRequestSchema.omit({ searchScope: true }).extend({
  id: z.string().optional(),
  suiteId: z.string().min(1)
}).strict()

export const BenchmarkQueryResponseSchema = ChatResponseSchema.extend({
  id: z.string().optional()
})

export const BenchmarkSearchRequestSchema = SearchRequestSchema.omit({ filters: true, scope: true }).extend({
  suiteId: z.string().min(1)
}).strict()

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
  runner: BenchmarkRunnerSchema,
  runtimeProfileVersion: z.string().min(1).optional(),
  workloadProfileVersion: z.string().min(1).optional(),
  corpusProfileVersion: z.string().min(1).optional(),
  aclDistributionVersion: z.string().min(1).optional(),
  workloadConcurrency: z.number().int().positive().optional(),
  documentSizeProfileVersion: z.string().min(1).optional(),
  dependencyLatencyProfileVersion: z.string().min(1).optional(),
  priceCatalogVersion: z.string().min(1).optional(),
  indexVersion: z.string().min(1).optional(),
  promptVersion: z.string().min(1).optional(),
  pipelineVersion: z.string().min(1).optional(),
  parserVersion: z.string().min(1).optional(),
  chunkerVersion: z.string().min(1).optional()
})

export const BenchmarkCaseResultSchema = z.object({
  caseId: z.string().optional(),
  status: z.number().int(),
  passed: z.boolean(),
  failureReasons: z.array(z.string()),
  slice: z.object({
    questionType: z.string().min(1),
    tenantRole: z.string().min(1),
    ocrMode: z.enum(["none", "native", "ocr", "mixed"]),
    language: z.string().min(1),
    multiEvidence: z.boolean(),
    answerability: z.enum(["answerable", "refusal", "clarification", "handoff"]),
    severity: z.enum(["critical", "high", "medium", "low"])
  }).strict().optional(),
  retrieval: z.object({
    retrievedCount: z.number().int().nonnegative().optional(),
    recallAtK: z.number().nullable().optional(),
    recallAt20: z.number().nullable().optional(),
    mrrAtK: z.number().nullable().optional(),
    relevantRetrievedCount: z.number().int().nonnegative().optional(),
    evaluatedRetrievedCount: z.number().int().nonnegative().optional(),
    noAccessLeakCount: z.number().int().nonnegative().optional()
  }).superRefine((value, context) => {
    const relevant = value.relevantRetrievedCount
    const evaluated = value.evaluatedRetrievedCount
    if ((relevant === undefined) !== (evaluated === undefined)) {
      context.addIssue({ code: "custom", message: "retrieval relevance counts must be provided together" })
    } else if (relevant !== undefined && evaluated !== undefined && relevant > evaluated) {
      context.addIssue({ code: "custom", message: "relevantRetrievedCount must not exceed evaluatedRetrievedCount" })
    }
  }).default(() => ({})),
  citation: z.object({
    citationCount: z.number().int().nonnegative().optional(),
    citationHit: z.boolean().nullable().optional(),
    citationSupportPass: z.boolean().nullable().optional(),
    expectedFileHit: z.boolean().nullable().optional(),
    expectedPageHit: z.boolean().nullable().optional()
  }).default(() => ({})),
  claims: z.array(z.object({
    claimId: z.string().min(1),
    severity: z.enum(["critical", "high", "medium", "low"]),
    requiresCitation: z.boolean(),
    supported: z.boolean(),
    supportSpans: z.array(z.object({
      documentId: z.string().min(1),
      documentVersion: z.string().min(1),
      spanId: z.string().min(1),
      locatorValid: z.boolean()
    }).strict()),
    citationIds: z.array(z.string().min(1))
  }).strict()).optional(),
  citations: z.array(z.object({
    citationId: z.string().min(1),
    claimIds: z.array(z.string().min(1)),
    relevant: z.boolean(),
    supportValid: z.boolean(),
    locatorValid: z.boolean()
  }).strict()).optional(),
  answerability: z.object({
    expectedAnswerable: z.boolean().optional(),
    actualAnswerable: z.boolean().optional(),
    expectedResponseType: z.enum(["answer", "refusal", "clarification", "handoff"]).optional(),
    actualResponseType: z.enum(["answer", "refusal", "clarification", "handoff"]).optional()
  }).default(() => ({})),
  task: z.object({
    expectedOutcome: z.enum(["complete", "partial", "handoff"]).optional(),
    actualOutcome: z.enum(["complete", "partial", "handoff", "failed"]).optional(),
    scenario: z.object({
      actor: z.string().min(1),
      goal: z.string().min(1),
      successCriteria: z.array(z.string().min(1)).min(1),
      allowedHandoffs: z.array(z.enum(["partial", "handoff"])),
      severity: z.enum(["critical", "high", "medium", "low"])
    }).strict().optional()
  }).default(() => ({})),
  generation: z.object({
    supportedClaimCount: z.number().int().nonnegative().optional(),
    unsupportedClaimCount: z.number().int().nonnegative().optional(),
    evaluatedClaimCount: z.number().int().nonnegative().optional()
  }).default(() => ({})),
  latency: z.object({
    latencyMs: z.number().int().nonnegative().optional(),
    taskLatencyMs: z.number().int().nonnegative().optional(),
    firstToken: FirstTokenTimingEvidenceSchema.optional(),
    stages: z.array(z.object({
      endpoint: z.enum(["chat", "search", "ingest"]),
      stage: z.string().min(1),
      latencyMs: z.number().int().nonnegative(),
      backlogAgeMs: z.number().int().nonnegative(),
      outcome: z.enum(["success", "timeout", "error"]),
      retryExhausted: z.boolean()
    }).strict()).optional()
  }).default(() => ({})),
  cost: z.object({
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    embeddingInputTokens: z.number().int().nonnegative().optional(),
    storageByteHours: z.number().nonnegative().optional(),
    workerMilliseconds: z.number().nonnegative().optional(),
    egressBytes: z.number().nonnegative().optional(),
    estimatedCostUsd: z.number().nonnegative().optional(),
    unitKind: z.enum(["chat_request", "search_request", "ingest_document"]).optional(),
    usageComplete: z.boolean().default(false)
  }).default(() => ({ usageComplete: false }))
})

export const BenchmarkWorkloadEvidenceSchema = z.object({
  schemaVersion: z.literal(1),
  profileId: z.string().min(1),
  version: z.string().min(1),
  approvedBy: z.string().min(1),
  approvedAt: z.string().datetime(),
  datasetVersion: z.string().min(1),
  runtimeProfileVersion: z.string().min(1),
  dimensions: z.object({
    corpusProfileVersion: z.string().min(1),
    aclDistributionVersion: z.string().min(1),
    concurrency: z.number().int().positive(),
    documentSizeProfileVersion: z.string().min(1),
    dependencyLatencyProfileVersion: z.string().min(1)
  }).strict(),
  eligibilityProbes: z.array(z.object({
    probeId: z.string().min(1),
    trigger: z.enum(["share", "account", "role", "group", "classification", "usage", "quality", "expiry", "archive", "delete"]),
    path: z.enum(["active", "staged", "old_index", "cache", "session", "memory", "queued_worker"]),
    committedAt: z.string().datetime(),
    deniedAt: z.string().datetime(),
    unreflectedResourceIds: z.array(z.string().min(1))
  }).strict()),
  recoveryScenarios: z.array(z.object({
    scenarioId: z.string().min(1),
    dependency: z.enum(["vector", "llm", "ocr", "queue"]),
    failedAt: z.string().datetime(),
    recoveredAt: z.string().datetime(),
    retryExhausted: z.boolean(),
    reconciledWithoutLoss: z.boolean(),
    duplicateOrLostArtifactCount: z.number().int().nonnegative()
  }).strict()),
  endpointStageSamples: z.array(z.object({
    sampleId: z.string().min(1),
    endpoint: z.enum(["chat", "search", "ingest"]),
    stage: z.string().min(1),
    createdAt: z.string().datetime(),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
    outcome: z.enum(["success", "timeout", "error"]),
    retryExhausted: z.boolean()
  }).strict())
}).strict()

export const BenchmarkPriceCatalogSchema = z.object({
  schemaVersion: z.literal(1),
  catalogId: z.string().min(1),
  version: z.string().min(1),
  approvedBy: z.string().min(1),
  approvedAt: z.string().datetime(),
  region: z.string().min(1),
  currency: z.literal("USD"),
  modelRates: z.record(z.string(), z.object({
    inputUsdPerMillionTokens: z.number().nonnegative(),
    outputUsdPerMillionTokens: z.number().nonnegative()
  }).strict()),
  embeddingRates: z.record(z.string(), z.object({
    usdPerMillionTokens: z.number().nonnegative()
  }).strict()),
  storageUsdPerGbHour: z.number().nonnegative(),
  workerUsdPerSecond: z.number().nonnegative(),
  egressUsdPerGb: z.number().nonnegative()
}).strict()

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
export type BenchmarkWorkloadEvidence = z.output<typeof BenchmarkWorkloadEvidenceSchema>
export type BenchmarkPriceCatalog = z.output<typeof BenchmarkPriceCatalogSchema>
