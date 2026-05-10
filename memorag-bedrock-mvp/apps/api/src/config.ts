import path from "node:path"
import { config as loadDotEnv } from "dotenv"

loadDotEnv({ path: path.resolve(process.cwd(), ".env") })
loadDotEnv({ path: path.resolve(process.cwd(), "../../.env"), override: false })

const nodeEnv = process.env.NODE_ENV ?? "development"
const isProduction = nodeEnv === "production"
const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1"

function boolEnv(name: string, defaultValue = false): boolean {
  const value = process.env[name]
  if (value === undefined) return defaultValue
  const normalized = value.toLowerCase()
  if (["1", "true", "yes", "on"].includes(normalized)) return true
  if (["0", "false", "no", "off"].includes(normalized)) return false
  if (isProduction) throw new Error(`${name} must be a boolean value in production`)
  return defaultValue
}

function numberEnv(name: string, defaultValue: number): number {
  const raw = process.env[name]
  if (!raw) return defaultValue
  const parsed = Number(raw)
  if (Number.isFinite(parsed)) return parsed
  if (isProduction) throw new Error(`${name} must be a finite number in production`)
  return defaultValue
}

function intEnv(name: string, defaultValue: number): number {
  return Math.trunc(numberEnv(name, defaultValue))
}

function csvEnv(name: string, defaultValue: readonly string[] = []): readonly string[] {
  const raw = process.env[name]
  if (!raw) return defaultValue
  return raw.split(",").map((value) => value.trim()).filter(Boolean)
}

function requireProductionValue(name: string, value: string): void {
  if (isProduction && value.trim().length === 0) throw new Error(`${name} is required in production`)
}

const authEnabled = boolEnv("AUTH_ENABLED", isProduction)
const corsAllowedOrigins = csvEnv("CORS_ALLOWED_ORIGINS", isProduction ? [] : ["*"])
const docsBucketName = process.env.DOCS_BUCKET_NAME ?? ""
const cognitoRegion = process.env.COGNITO_REGION ?? region
const cognitoUserPoolId = process.env.COGNITO_USER_POOL_ID ?? ""
const cognitoAppClientId = process.env.COGNITO_APP_CLIENT_ID ?? ""

if (isProduction && !authEnabled) throw new Error("AUTH_ENABLED must be true in production")
if (isProduction && corsAllowedOrigins.length === 0) throw new Error("CORS_ALLOWED_ORIGINS is required in production")
requireProductionValue("DOCS_BUCKET_NAME", docsBucketName)
if (authEnabled) {
  requireProductionValue("COGNITO_REGION", cognitoRegion)
  requireProductionValue("COGNITO_USER_POOL_ID", cognitoUserPoolId)
  requireProductionValue("COGNITO_APP_CLIENT_ID", cognitoAppClientId)
}

export const config = {
  nodeEnv,
  region,
  port: numberEnv("PORT", 8787),
  authEnabled,
  corsAllowedOrigins,
  mockBedrock: boolEnv("MOCK_BEDROCK", false),
  useLocalVectorStore: boolEnv("USE_LOCAL_VECTOR_STORE", process.env.NODE_ENV !== "production"),
  useLocalQuestionStore: boolEnv("USE_LOCAL_QUESTION_STORE", process.env.NODE_ENV !== "production"),
  useLocalConversationHistoryStore: boolEnv("USE_LOCAL_CONVERSATION_HISTORY_STORE", process.env.NODE_ENV !== "production"),
  useLocalBenchmarkRunStore: boolEnv("USE_LOCAL_BENCHMARK_RUN_STORE", process.env.NODE_ENV !== "production"),
  useLocalChatRunStore: boolEnv("USE_LOCAL_CHAT_RUN_STORE", process.env.NODE_ENV !== "production"),
  useLocalDocumentIngestRunStore: boolEnv("USE_LOCAL_DOCUMENT_INGEST_RUN_STORE", process.env.NODE_ENV !== "production"),
  useLocalDocumentGroupStore: boolEnv("USE_LOCAL_DOCUMENT_GROUP_STORE", process.env.NODE_ENV !== "production"),
  localDataDir: process.env.LOCAL_DATA_DIR ?? ".local-data",
  docsBucketName,
  questionTableName: process.env.QUESTION_TABLE_NAME ?? "memorag-human-questions",
  conversationHistoryTableName: process.env.CONVERSATION_HISTORY_TABLE_NAME ?? "memorag-conversation-history",
  benchmarkRunsTableName: process.env.BENCHMARK_RUNS_TABLE_NAME ?? "memorag-benchmark-runs",
  chatRunsTableName: process.env.CHAT_RUNS_TABLE_NAME ?? "memorag-chat-runs",
  chatRunEventsTableName: process.env.CHAT_RUN_EVENTS_TABLE_NAME ?? "memorag-chat-run-events",
  chatRunStateMachineArn: process.env.CHAT_RUN_STATE_MACHINE_ARN ?? "",
  documentIngestRunsTableName: process.env.DOCUMENT_INGEST_RUNS_TABLE_NAME ?? "memorag-document-ingest-runs",
  documentIngestRunEventsTableName: process.env.DOCUMENT_INGEST_RUN_EVENTS_TABLE_NAME ?? "memorag-document-ingest-run-events",
  documentGroupsTableName: process.env.DOCUMENT_GROUPS_TABLE_NAME ?? "memorag-document-groups",
  documentIngestRunStateMachineArn: process.env.DOCUMENT_INGEST_RUN_STATE_MACHINE_ARN ?? "",
  benchmarkBucketName: process.env.BENCHMARK_BUCKET_NAME ?? "",
  benchmarkStateMachineArn: process.env.BENCHMARK_STATE_MACHINE_ARN ?? "",
  benchmarkDefaultDatasetKey: process.env.BENCHMARK_DEFAULT_DATASET_KEY ?? "datasets/agent/standard-v1.jsonl",
  benchmarkTargetApiBaseUrl: process.env.BENCHMARK_TARGET_API_BASE_URL ?? process.env.API_BASE_URL ?? "",
  benchmarkDownloadExpiresInSeconds: numberEnv("BENCHMARK_DOWNLOAD_EXPIRES_IN_SECONDS", 900),
  documentUploadExpiresInSeconds: numberEnv("DOCUMENT_UPLOAD_EXPIRES_IN_SECONDS", 900),
  documentUploadMaxBytes: intEnv("DOCUMENT_UPLOAD_MAX_BYTES", 20 * 1024 * 1024),
  vectorBucketName: process.env.VECTOR_BUCKET_NAME ?? "local-vector-bucket",
  memoryVectorIndexName: process.env.MEMORY_VECTOR_INDEX_NAME ?? process.env.VECTOR_INDEX_NAME ?? "memory-index",
  evidenceVectorIndexName: process.env.EVIDENCE_VECTOR_INDEX_NAME ?? process.env.VECTOR_INDEX_NAME ?? "evidence-index",
  defaultModelId: process.env.DEFAULT_MODEL_ID ?? "amazon.nova-lite-v1:0",
  defaultMemoryModelId: process.env.DEFAULT_MEMORY_MODEL_ID ?? process.env.DEFAULT_MODEL_ID ?? "amazon.nova-lite-v1:0",
  embeddingModelId: process.env.EMBEDDING_MODEL_ID ?? "amazon.titan-embed-text-v2:0",
  embeddingDimensions: numberEnv("EMBEDDING_DIMENSIONS", 1024),
  ragProfileId: process.env.RAG_PROFILE_ID ?? "default",
  ragDomainPolicyId: process.env.RAG_DOMAIN_POLICY_ID ?? "default-answer-policy",
  ragAdaptiveRetrieval: boolEnv("RAG_ADAPTIVE_RETRIEVAL", false),
  minRetrievalScore: numberEnv("MIN_RETRIEVAL_SCORE", 0.20),
  ragDefaultTopK: intEnv("RAG_DEFAULT_TOP_K", 6),
  ragMaxTopK: intEnv("RAG_MAX_TOP_K", 20),
  ragDefaultMemoryTopK: intEnv("RAG_DEFAULT_MEMORY_TOP_K", 4),
  ragMaxMemoryTopK: intEnv("RAG_MAX_MEMORY_TOP_K", 10),
  ragDefaultMaxIterations: intEnv("RAG_DEFAULT_MAX_ITERATIONS", 3),
  ragMaxIterations: intEnv("RAG_MAX_ITERATIONS", 8),
  ragSearchCandidateMinTopK: intEnv("RAG_SEARCH_CANDIDATE_MIN_TOP_K", 30),
  ragDefaultSearchBenchmarkTopK: intEnv("RAG_DEFAULT_SEARCH_BENCHMARK_TOP_K", 10),
  ragSearchLexicalTopK: intEnv("RAG_SEARCH_LEXICAL_TOP_K", 80),
  ragSearchSemanticTopK: intEnv("RAG_SEARCH_SEMANTIC_TOP_K", 80),
  ragSearchRrfK: intEnv("RAG_SEARCH_RRF_K", 60),
  ragSearchLexicalWeight: numberEnv("RAG_SEARCH_LEXICAL_WEIGHT", 1),
  ragSearchSemanticWeight: numberEnv("RAG_SEARCH_SEMANTIC_WEIGHT", 0.9),
  ragSearchBm25K1: numberEnv("RAG_SEARCH_BM25_K1", 1.2),
  ragSearchBm25B: numberEnv("RAG_SEARCH_BM25_B", 0.75),
  ragAdaptiveTopGapExpandBelow: numberEnv("RAG_ADAPTIVE_TOP_GAP_EXPAND_BELOW", 0.015),
  ragAdaptiveOverlapBoostAtLeast: numberEnv("RAG_ADAPTIVE_OVERLAP_BOOST_AT_LEAST", 0.35),
  ragAdaptiveScoreFloorQuantile: numberEnv("RAG_ADAPTIVE_SCORE_FLOOR_QUANTILE", 0.25),
  ragAdaptiveMinCombinedScore: numberEnv("RAG_ADAPTIVE_MIN_COMBINED_SCORE", 0),
  ragSearchSemanticPrefetchMultiplier: numberEnv("RAG_SEARCH_SEMANTIC_PREFETCH_MULTIPLIER", 3),
  ragMemoryPrefetchMultiplier: numberEnv("RAG_MEMORY_PREFETCH_MULTIPLIER", 3),
  ragMemoryPrefetchMaxTopK: intEnv("RAG_MEMORY_PREFETCH_MAX_TOP_K", 100),
  ragMinEvidenceCountMin: intEnv("RAG_MIN_EVIDENCE_COUNT_MIN", 2),
  ragMinEvidenceCountMax: intEnv("RAG_MIN_EVIDENCE_COUNT_MAX", 4),
  ragMaxNoNewEvidenceStreak: intEnv("RAG_MAX_NO_NEW_EVIDENCE_STREAK", 2),
  ragReferenceMaxDepth: intEnv("RAG_REFERENCE_MAX_DEPTH", 2),
  ragSearchBudgetCalls: intEnv("RAG_SEARCH_BUDGET_CALLS", 3),
  ragContextWindowDecay: numberEnv("RAG_CONTEXT_WINDOW_DECAY", 0.03),
  ragContextWindowMaxScore: numberEnv("RAG_CONTEXT_WINDOW_MAX_SCORE", 0.99),
  ragRetrievalCombinedMaxScore: numberEnv("RAG_RETRIEVAL_COMBINED_MAX_SCORE", 0.99),
  ragRetrievalLexicalBaseScore: numberEnv("RAG_RETRIEVAL_LEXICAL_BASE_SCORE", 0.35),
  ragRetrievalLexicalLogDivisor: numberEnv("RAG_RETRIEVAL_LEXICAL_LOG_DIVISOR", 3),
  ragRetrievalMaxSourceScore: numberEnv("RAG_RETRIEVAL_MAX_SOURCE_SCORE", 0.95),
  ragSearchRagMaxTopK: intEnv("RAG_SEARCH_RAG_MAX_TOP_K", 50),
  ragSearchRagMaxSourceTopK: intEnv("RAG_SEARCH_RAG_MAX_SOURCE_TOP_K", 100),
  ragCrossQueryRrfBoostCap: numberEnv("RAG_CROSS_QUERY_RRF_BOOST_CAP", 0.08),
  ragCrossQueryRrfBoostMultiplier: numberEnv("RAG_CROSS_QUERY_RRF_BOOST_MULTIPLIER", 3),
  ragLlmTemperature: numberEnv("RAG_LLM_TEMPERATURE", 0),
  ragClueMaxTokens: intEnv("RAG_CLUE_MAX_TOKENS", 600),
  ragFinalAnswerMaxTokens: intEnv("RAG_FINAL_ANSWER_MAX_TOKENS", 1200),
  ragSufficientContextMaxTokens: intEnv("RAG_SUFFICIENT_CONTEXT_MAX_TOKENS", 900),
  ragRetrievalJudgeMaxTokens: intEnv("RAG_RETRIEVAL_JUDGE_MAX_TOKENS", 700),
  ragAnswerSupportMaxTokens: intEnv("RAG_ANSWER_SUPPORT_MAX_TOKENS", 900),
  ragAnswerRepairMaxTokens: intEnv("RAG_ANSWER_REPAIR_MAX_TOKENS", 900),
  ragMemoryCardMaxTokens: intEnv("RAG_MEMORY_CARD_MAX_TOKENS", 1000),
  ragComputedFactConfidence: numberEnv("RAG_COMPUTED_FACT_CONFIDENCE", 0.86),
  ragFactCoverageMissingClassificationConfidence: numberEnv("RAG_FACT_COVERAGE_MISSING_CLASSIFICATION_CONFIDENCE", 0.35),
  ragFactCoverageMissingAmountConfidence: numberEnv("RAG_FACT_COVERAGE_MISSING_AMOUNT_CONFIDENCE", 0.4),
  ragFactCoverageMissingDateConfidence: numberEnv("RAG_FACT_COVERAGE_MISSING_DATE_CONFIDENCE", 0.4),
  ragFactCoverageMissingProcedureConfidence: numberEnv("RAG_FACT_COVERAGE_MISSING_PROCEDURE_CONFIDENCE", 0.45),
  ragFactCoverageSupportedConfidence: numberEnv("RAG_FACT_COVERAGE_SUPPORTED_CONFIDENCE", 0.8),
  ragAnswerabilityMaxConfidence: numberEnv("RAG_ANSWERABILITY_MAX_CONFIDENCE", 0.99),
  ragPartialEvidenceConfidenceCap: numberEnv("RAG_PARTIAL_EVIDENCE_CONFIDENCE_CAP", 0.78),
  ragPartialEvidenceFallbackConfidence: numberEnv("RAG_PARTIAL_EVIDENCE_FALLBACK_CONFIDENCE", 0.66),
  ragLlmJudgeNoConflictMinConfidence: numberEnv("RAG_LLM_JUDGE_NO_CONFLICT_MIN_CONFIDENCE", 0.7),
  ragSupportSupportedFallbackConfidence: numberEnv("RAG_SUPPORT_SUPPORTED_FALLBACK_CONFIDENCE", 0.7),
  ragSupportUnsupportedFallbackConfidence: numberEnv("RAG_SUPPORT_UNSUPPORTED_FALLBACK_CONFIDENCE", 0.3),
  ragJudgeChunkLimit: intEnv("RAG_JUDGE_CHUNK_LIMIT", 8),
  ragJudgeReasonMaxChars: intEnv("RAG_JUDGE_REASON_MAX_CHARS", 800),
  ragRequiredFactLimit: intEnv("RAG_REQUIRED_FACT_LIMIT", 12),
  ragSupportingChunkFallbackLimit: intEnv("RAG_SUPPORTING_CHUNK_FALLBACK_LIMIT", 5),
  ragUnsupportedSentenceLimit: intEnv("RAG_UNSUPPORTED_SENTENCE_LIMIT", 20),
  ragAnswerabilityDebugAssessmentLimit: intEnv("RAG_ANSWERABILITY_DEBUG_ASSESSMENT_LIMIT", 12),
  ragAnswerabilitySentenceScanLimit: intEnv("RAG_ANSWERABILITY_SENTENCE_SCAN_LIMIT", 24),
  ragExpandedQueryLimit: intEnv("RAG_EXPANDED_QUERY_LIMIT", 8),
  ragQueryRewriteFactLimit: intEnv("RAG_QUERY_REWRITE_FACT_LIMIT", 4),
  ragActionFactLimit: intEnv("RAG_ACTION_FACT_LIMIT", 3),
  ragFactReferenceLimit: intEnv("RAG_FACT_REFERENCE_LIMIT", 8),
  ragRiskSignalValueLimit: intEnv("RAG_RISK_SIGNAL_VALUE_LIMIT", 6),
  ragMemorySummaryMaxChars: intEnv("RAG_MEMORY_SUMMARY_MAX_CHARS", 500),
  ragMemoryKeywordLimit: intEnv("RAG_MEMORY_KEYWORD_LIMIT", 30),
  ragMemoryQuestionLimit: intEnv("RAG_MEMORY_QUESTION_LIMIT", 20),
  ragMemoryConstraintLimit: intEnv("RAG_MEMORY_CONSTRAINT_LIMIT", 20),
  ragSectionMemoryLimit: intEnv("RAG_SECTION_MEMORY_LIMIT", 12),
  ragConceptMemoryTermLimit: intEnv("RAG_CONCEPT_MEMORY_TERM_LIMIT", 8),
  ragConceptMemorySourceChunkLimit: intEnv("RAG_CONCEPT_MEMORY_SOURCE_CHUNK_LIMIT", 8),
  ragCitationLimit: intEnv("RAG_CITATION_LIMIT", 5),
  ragSearchClueLimit: intEnv("RAG_SEARCH_CLUE_LIMIT", 6),
  ragClarificationOptionLimit: intEnv("RAG_CLARIFICATION_OPTION_LIMIT", 5),
  ragClarificationGroundingLimit: intEnv("RAG_CLARIFICATION_GROUNDING_LIMIT", 3),
  ragClarificationRejectedOptionLimit: intEnv("RAG_CLARIFICATION_REJECTED_OPTION_LIMIT", 8),
  ragClarificationMissingSlotLimit: intEnv("RAG_CLARIFICATION_MISSING_SLOT_LIMIT", 3),
  ragClarificationMinAmbiguityScore: numberEnv("RAG_CLARIFICATION_MIN_AMBIGUITY_SCORE", 0.65),
  ragClarificationConfidenceCap: numberEnv("RAG_CLARIFICATION_CONFIDENCE_CAP", 0.95),
  ragClarificationConfidenceFloor: numberEnv("RAG_CLARIFICATION_CONFIDENCE_FLOOR", 0.55),
  ragClarificationNotNeededConfidenceCap: numberEnv("RAG_CLARIFICATION_NOT_NEEDED_CONFIDENCE_CAP", 0.49),
  ragAliasExpansionLimit: intEnv("RAG_ALIAS_EXPANSION_LIMIT", 20),
  maxUploadChars: numberEnv("MAX_UPLOAD_CHARS", 500_000),
  pdfOcrFallbackEnabled: boolEnv("PDF_OCR_FALLBACK_ENABLED", false),
  pdfOcrFallbackTimeoutMs: intEnv("PDF_OCR_FALLBACK_TIMEOUT_MS", 45_000),
  pdfOcrFallbackPollIntervalMs: intEnv("PDF_OCR_FALLBACK_POLL_INTERVAL_MS", 2_000),
  pdfOcrFallbackSyncMaxBytes: intEnv("PDF_OCR_FALLBACK_SYNC_MAX_BYTES", 10 * 1024 * 1024),
  chunkSizeChars: numberEnv("CHUNK_SIZE_CHARS", 1200),
  chunkOverlapChars: numberEnv("CHUNK_OVERLAP_CHARS", 200),
  embeddingConcurrency: numberEnv("EMBEDDING_CONCURRENCY", 3),
  publishLexicalIndexOnSearch: boolEnv("PUBLISH_LEXICAL_INDEX_ON_SEARCH", process.env.NODE_ENV !== "production"),
  debugDownloadBucketName: process.env.DEBUG_DOWNLOAD_BUCKET_NAME ?? "",
  debugDownloadExpiresInSeconds: numberEnv("DEBUG_DOWNLOAD_EXPIRES_IN_SECONDS", 900),
  cognitoRegion,
  cognitoUserPoolId,
  cognitoAppClientId
} as const
