import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import path from "node:path"
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
    body: JSON.stringify({ query: "benchmark", user: { userId: "request-user", groups: ["CHAT_USER"] } })
  })

  assert.equal(response.status, 400)
  assert.match(response.headers.get("content-type") ?? "", /application\/json/)
  assert.deepEqual(await response.json(), { error: "Benchmark search user override is not supported" })
})

test("production config rejects fail-open auth", () => {
  const result = importConfigInSubprocess({
    NODE_ENV: "production",
    AUTH_ENABLED: "false",
    CORS_ALLOWED_ORIGINS: "https://app.example.com",
    DOCS_BUCKET_NAME: "docs-bucket"
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /AUTH_ENABLED must be true in production/)
})

test("production config rejects wildcard CORS origins", () => {
  const result = importConfigInSubprocess({
    NODE_ENV: "production",
    AUTH_ENABLED: "true",
    CORS_ALLOWED_ORIGINS: "*",
    DOCS_BUCKET_NAME: "docs-bucket",
    COGNITO_REGION: "ap-northeast-1",
    COGNITO_USER_POOL_ID: "ap-northeast-1_example",
    COGNITO_APP_CLIENT_ID: "client-id"
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /CORS_ALLOWED_ORIGINS must not include \* in production/)
})

test("production config requires Cognito settings when auth is enabled", () => {
  const result = importConfigInSubprocess({
    NODE_ENV: "production",
    AUTH_ENABLED: "true",
    CORS_ALLOWED_ORIGINS: "https://app.example.com",
    DOCS_BUCKET_NAME: "docs-bucket",
    COGNITO_REGION: "ap-northeast-1",
    COGNITO_USER_POOL_ID: "",
    COGNITO_APP_CLIENT_ID: ""
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
    COGNITO_USER_POOL_ID: "us-west-2_example",
    COGNITO_APP_CLIENT_ID: "client-id",
    PORT: "9000.5",
    MOCK_BEDROCK: "yes",
    USE_LOCAL_VECTOR_STORE: "0",
    USE_LOCAL_QUESTION_STORE: "false",
    USE_LOCAL_CONVERSATION_HISTORY_STORE: "off",
    USE_LOCAL_BENCHMARK_RUN_STORE: "no",
    USE_LOCAL_CHAT_RUN_STORE: "true",
    USE_LOCAL_DOCUMENT_INGEST_RUN_STORE: "1",
    USE_LOCAL_DOCUMENT_GROUP_STORE: "on",
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
    COGNITO_REGION: "ap-northeast-1",
    COGNITO_USER_POOL_ID: "ap-northeast-1_example",
    COGNITO_APP_CLIENT_ID: "client-id"
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
  const missingAppClient = importConfigInSubprocess({
    ...requiredProductionEnv,
    COGNITO_APP_CLIENT_ID: ""
  })

  assert.notEqual(missingDocsBucket.status, 0)
  assert.match(missingDocsBucket.stderr, /DOCS_BUCKET_NAME is required in production/)
  assert.notEqual(invalidBoolean.status, 0)
  assert.match(invalidBoolean.stderr, /MOCK_BEDROCK must be a boolean value in production/)
  assert.notEqual(invalidNumber.status, 0)
  assert.match(invalidNumber.stderr, /PORT must be a finite number in production/)
  assert.notEqual(missingAppClient.status, 0)
  assert.match(missingAppClient.stderr, /COGNITO_APP_CLIENT_ID is required in production/)
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
  const tsxBin = path.resolve(process.cwd(), "../../node_modules/.bin/tsx")
  return spawnSync(tsxBin, ["--eval", "import './src/config.ts'"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env
    },
    encoding: "utf8"
  })
}

function importConfigJsonInSubprocess(env: NodeJS.ProcessEnv) {
  const tsxBin = path.resolve(process.cwd(), "../../node_modules/.bin/tsx")
  return spawnSync(
    tsxBin,
    [
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
