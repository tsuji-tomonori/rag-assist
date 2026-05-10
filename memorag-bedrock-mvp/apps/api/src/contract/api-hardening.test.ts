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

test("production config requires explicit CORS origins without wildcard", () => {
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
  assert.match(result.stderr, /CORS_ALLOWED_ORIGINS cannot include \* in production/)
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
