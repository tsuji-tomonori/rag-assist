export type BooleanEnv = "true" | "false"

export type ApiRuntimeEnv = {
  NODE_ENV: "production" | "development" | "test"
  USE_LOCAL_VECTOR_STORE: BooleanEnv
  MOCK_BEDROCK: BooleanEnv
  DOCS_BUCKET_NAME: string
  QUESTION_TABLE_NAME: string
  CONVERSATION_HISTORY_TABLE_NAME: string
  BENCHMARK_RUNS_TABLE_NAME: string
  CHAT_RUNS_TABLE_NAME: string
  CHAT_RUN_EVENTS_TABLE_NAME: string
  DOCUMENT_INGEST_RUNS_TABLE_NAME: string
  DOCUMENT_INGEST_RUN_EVENTS_TABLE_NAME: string
  DOCUMENT_GROUPS_TABLE_NAME: string
  BENCHMARK_BUCKET_NAME: string
  BENCHMARK_DEFAULT_DATASET_KEY: string
  BENCHMARK_DOWNLOAD_EXPIRES_IN_SECONDS: string
  USE_LOCAL_QUESTION_STORE: BooleanEnv
  USE_LOCAL_CONVERSATION_HISTORY_STORE: BooleanEnv
  USE_LOCAL_BENCHMARK_RUN_STORE: BooleanEnv
  USE_LOCAL_CHAT_RUN_STORE: BooleanEnv
  VECTOR_BUCKET_NAME: string
  MEMORY_VECTOR_INDEX_NAME: string
  EVIDENCE_VECTOR_INDEX_NAME: string
  DEFAULT_MODEL_ID: string
  DEFAULT_MEMORY_MODEL_ID: string
  EMBEDDING_MODEL_ID: string
  EMBEDDING_DIMENSIONS: string
  MIN_RETRIEVAL_SCORE: string
  AUTH_ENABLED: BooleanEnv
  COGNITO_REGION: string
  COGNITO_USER_POOL_ID: string
  COGNITO_APP_CLIENT_ID: string
  DEBUG_DOWNLOAD_BUCKET_NAME: string
  DEBUG_DOWNLOAD_EXPIRES_IN_SECONDS: string
}

export type ApiFunctionRuntimeEnv = ApiRuntimeEnv & {
  PDF_OCR_FALLBACK_ENABLED: BooleanEnv
  PDF_OCR_FALLBACK_TIMEOUT_MS: string
}

export type BenchmarkSuiteId =
  | "smoke-agent-v1"
  | "standard-agent-v1"
  | "clarification-smoke-v1"
  | "search-smoke-v1"
  | "search-standard-v1"
  | "mtrag-v1"
  | "chatrag-bench-v1"
  | "architecture-drawing-qarag-v0.1"
  | "jp-public-pdf-qa-v1"
  | "mlit-pdf-figure-table-rag-v1"
