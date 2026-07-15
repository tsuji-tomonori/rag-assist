import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"
import app from "../app.js"

test("unknown routes return the JSON error contract", async () => {
  const response = await app.request("/unknown-api-path", {
    headers: { Origin: "http://localhost:5173" }
  })

  assert.equal(response.status, 404)
  assert.match(response.headers.get("content-type") ?? "", /application\/json/)
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173")
  assert.deepEqual(await response.json(), { error: "Not found" })
})

test("HTTPException responses return the JSON error contract", async () => {
  const response = await app.request("/benchmark/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Origin: "http://localhost:5173"
    },
    body: JSON.stringify({ query: "benchmark", suiteId: "search-standard-v1", user: { userId: "request-user", groups: ["CHAT_USER"] } })
  })

  assert.equal(response.status, 400)
  assert.match(response.headers.get("content-type") ?? "", /application\/json/)
  const body = await response.json() as { error?: string; details?: unknown }
  assert.equal(body.error, "Validation failed")
  assert.ok(body.details)
})

test("production config rejects fail-open auth", () => {
  const result = importConfigInSubprocess({
    NODE_ENV: "production",
    AUTH_ENABLED: "false",
    CORS_ALLOWED_ORIGINS: "https://app.example.com",
    DOCS_BUCKET_NAME: "docs-bucket",
    FAVORITES_TABLE_NAME: "favorites-table"
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /AUTH_ENABLED must be true in production/)
})

test("production config temporarily allows wildcard CORS origins", () => {
  const result = importConfigJsonInSubprocess({
    NODE_ENV: "production",
    AUTH_ENABLED: "true",
    CORS_ALLOWED_ORIGINS: "*",
    DOCS_BUCKET_NAME: "docs-bucket",
    FAVORITES_TABLE_NAME: "favorites-table",
    COGNITO_REGION: "ap-northeast-1",
    COGNITO_USER_POOL_ID: "ap-northeast-1_example",
    COGNITO_APP_CLIENT_ID: "client-id",
    AUTH_TENANT_ID: "tenant-production",
    BENCHMARK_EVALUATION_ENABLED: "false"
  })

  assert.equal(result.status, 0, result.stderr)
  const config = JSON.parse(result.stdout)
  assert.deepEqual(config.corsAllowedOrigins, ["*"])
})

test("production config requires Cognito settings when auth is enabled", () => {
  const result = importConfigInSubprocess({
    NODE_ENV: "production",
    AUTH_ENABLED: "true",
    CORS_ALLOWED_ORIGINS: "https://app.example.com",
    DOCS_BUCKET_NAME: "docs-bucket",
    FAVORITES_TABLE_NAME: "favorites-table",
    COGNITO_REGION: "ap-northeast-1",
    COGNITO_USER_POOL_ID: "",
    COGNITO_APP_CLIENT_ID: "",
    AUTH_TENANT_ID: "tenant-production"
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /COGNITO_USER_POOL_ID is required in production/)
})

test("production config parses explicit runtime environment values", () => {
  const result = importConfigJsonInSubprocess({
    NODE_ENV: "production",
    AWS_DEFAULT_REGION: "us-west-2",
    AUTH_ENABLED: "true",
    CORS_ALLOWED_ORIGINS: "https://app.example.com, https://admin.example.com",
    DOCS_BUCKET_NAME: "docs-bucket",
    FAVORITES_TABLE_NAME: "favorites-table",
    COGNITO_USER_POOL_ID: "us-west-2_example",
    COGNITO_APP_CLIENT_ID: "client-id",
    AUTH_TENANT_ID: "tenant-production",
    BENCHMARK_EVALUATION_ENABLED: "true",
    BENCHMARK_EVALUATION_TENANT_ID: "benchmark-production",
    PORT: "9000.5",
    MOCK_BEDROCK: "yes",
    USE_LOCAL_VECTOR_STORE: "0",
    USE_LOCAL_QUESTION_STORE: "false",
    USE_LOCAL_CONVERSATION_HISTORY_STORE: "off",
    USE_LOCAL_BENCHMARK_RUN_STORE: "no",
    USE_LOCAL_CHAT_RUN_STORE: "true",
    USE_LOCAL_DOCUMENT_INGEST_RUN_STORE: "1",
    USE_LOCAL_DOCUMENT_GROUP_STORE: "on",
    USAGE_ACCOUNTING_MODE: "active",
    DOCUMENT_UPLOAD_MAX_BYTES: "1234.9",
    EMBEDDING_DIMENSIONS: "256",
    RAG_ADAPTIVE_RETRIEVAL: "true",
    RAG_DEFAULT_TOP_K: "7.8",
    PDF_OCR_FALLBACK_ENABLED: "on",
    PUBLISH_LEXICAL_INDEX_ON_SEARCH: "false"
  })

  assert.equal(result.status, 0, result.stderr)
  const config = JSON.parse(result.stdout)
  assert.equal(config.region, "us-west-2")
  assert.equal(config.authTenantId, "tenant-production")
  assert.equal(config.benchmarkEvaluationEnabled, true)
  assert.equal(config.benchmarkEvaluationTenantId, "benchmark-production")
  assert.equal(config.port, 9000.5)
  assert.deepEqual(config.corsAllowedOrigins, ["https://app.example.com", "https://admin.example.com"])
  assert.equal(config.mockBedrock, true)
  assert.equal(config.useLocalVectorStore, false)
  assert.equal(config.useLocalQuestionStore, false)
  assert.equal(config.useLocalConversationHistoryStore, false)
  assert.equal(config.useLocalBenchmarkRunStore, false)
  assert.equal(config.useLocalChatRunStore, true)
  assert.equal(config.useLocalDocumentIngestRunStore, true)
  assert.equal(config.useLocalDocumentGroupStore, true)
  assert.equal(config.usageAccountingMode, "active")
  assert.equal(config.documentUploadMaxBytes, 1234)
  assert.equal(config.embeddingDimensions, 256)
  assert.equal(config.ragAdaptiveRetrieval, true)
  assert.equal(config.ragDefaultTopK, 7)
  assert.equal(config.pdfOcrFallbackEnabled, true)
  assert.equal(config.publishLexicalIndexOnSearch, false)
})

test("production config rejects missing docs bucket and invalid scalar values", () => {
  const requiredProductionEnv = {
    NODE_ENV: "production",
    AUTH_ENABLED: "true",
    CORS_ALLOWED_ORIGINS: "https://app.example.com",
    DOCS_BUCKET_NAME: "docs-bucket",
    FAVORITES_TABLE_NAME: "favorites-table",
    COGNITO_REGION: "ap-northeast-1",
    COGNITO_USER_POOL_ID: "ap-northeast-1_example",
    COGNITO_APP_CLIENT_ID: "client-id",
    AUTH_TENANT_ID: "tenant-production",
    BENCHMARK_EVALUATION_ENABLED: "true",
    BENCHMARK_EVALUATION_TENANT_ID: "benchmark-production"
  }
  const missingDocsBucket = importConfigInSubprocess({
    ...requiredProductionEnv,
    DOCS_BUCKET_NAME: ""
  })
  const invalidBoolean = importConfigInSubprocess({
    ...requiredProductionEnv,
    MOCK_BEDROCK: "maybe"
  })
  const invalidNumber = importConfigInSubprocess({
    ...requiredProductionEnv,
    PORT: "not-a-number"
  })
  const invalidUsageAccountingMode = importConfigInSubprocess({
    ...requiredProductionEnv,
    USAGE_ACCOUNTING_MODE: "cutover-now"
  })
  const missingAppClient = importConfigInSubprocess({
    ...requiredProductionEnv,
    COGNITO_APP_CLIENT_ID: ""
  })
  const missingFavoritesTable = importConfigInSubprocess({
    ...requiredProductionEnv,
    FAVORITES_TABLE_NAME: ""
  })
  const missingTenant = importConfigInSubprocess({
    ...requiredProductionEnv,
    AUTH_TENANT_ID: ""
  })
  const missingBenchmarkToggle = importConfigInSubprocess({
    ...requiredProductionEnv,
    BENCHMARK_EVALUATION_ENABLED: undefined
  })
  const missingBenchmarkTenant = importConfigInSubprocess({
    ...requiredProductionEnv,
    BENCHMARK_EVALUATION_TENANT_ID: ""
  })
  const sharedBenchmarkTenant = importConfigInSubprocess({
    ...requiredProductionEnv,
    BENCHMARK_EVALUATION_TENANT_ID: "tenant-production"
  })
  const explicitlyDisabledBenchmark = importConfigInSubprocess({
    ...requiredProductionEnv,
    BENCHMARK_EVALUATION_ENABLED: "false",
    BENCHMARK_EVALUATION_TENANT_ID: ""
  })

  assert.notEqual(missingDocsBucket.status, 0)
  assert.match(missingDocsBucket.stderr, /DOCS_BUCKET_NAME is required in production/)
  assert.notEqual(invalidBoolean.status, 0)
  assert.match(invalidBoolean.stderr, /MOCK_BEDROCK must be a boolean value in production/)
  assert.notEqual(invalidNumber.status, 0)
  assert.match(invalidNumber.stderr, /PORT must be a finite number in production/)
  assert.notEqual(invalidUsageAccountingMode.status, 0)
  assert.match(invalidUsageAccountingMode.stderr, /USAGE_ACCOUNTING_MODE must be one of/)
  assert.notEqual(missingAppClient.status, 0)
  assert.match(missingAppClient.stderr, /COGNITO_APP_CLIENT_ID is required in production/)
  assert.notEqual(missingFavoritesTable.status, 0)
  assert.match(missingFavoritesTable.stderr, /FAVORITES_TABLE_NAME is required in production/)
  assert.notEqual(missingTenant.status, 0)
  assert.match(missingTenant.stderr, /AUTH_TENANT_ID is required in production/)
  assert.notEqual(missingBenchmarkToggle.status, 0)
  assert.match(missingBenchmarkToggle.stderr, /BENCHMARK_EVALUATION_ENABLED must be explicitly configured in production/)
  assert.notEqual(missingBenchmarkTenant.status, 0)
  assert.match(missingBenchmarkTenant.stderr, /BENCHMARK_EVALUATION_TENANT_ID is required in production/)
  assert.notEqual(sharedBenchmarkTenant.status, 0)
  assert.match(sharedBenchmarkTenant.stderr, /BENCHMARK_EVALUATION_TENANT_ID must be isolated from AUTH_TENANT_ID/)
  assert.equal(explicitlyDisabledBenchmark.status, 0, explicitlyDisabledBenchmark.stderr)
})

test("development config falls back for invalid scalar values", () => {
  const result = importConfigJsonInSubprocess({
    NODE_ENV: "development",
    MOCK_BEDROCK: "maybe",
    PORT: "not-a-number",
    CORS_ALLOWED_ORIGINS: "",
    DOCUMENT_UPLOAD_MAX_BYTES: ""
  })

  assert.equal(result.status, 0, result.stderr)
  const config = JSON.parse(result.stdout)
  assert.equal(config.authEnabled, false)
  assert.equal(config.port, 8787)
  assert.equal(config.mockBedrock, false)
  assert.deepEqual(config.corsAllowedOrigins, ["*"])
  assert.equal(config.documentUploadMaxBytes, 20 * 1024 * 1024)
  assert.equal(config.useLocalVectorStore, true)
  assert.equal(config.useLocalQuestionStore, true)
  assert.equal(config.publishLexicalIndexOnSearch, true)
})

function importConfigInSubprocess(env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, ["--import", "tsx", "--eval", "import './src/config.ts'"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env
    },
    encoding: "utf8"
  })
}

function importConfigJsonInSubprocess(env: NodeJS.ProcessEnv) {
  return spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--eval",
      "import { config } from './src/config.ts'; console.log(JSON.stringify(config))"
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env
      },
      encoding: "utf8"
    }
  )
}
