import assert from "node:assert/strict"
import test from "node:test"
import { apiContract } from "@memorag-mvp/contract"
import app, { openApiConfig } from "./app.js"
import { collectRestOrpcRoutes, validateRestOrpcContractDrift } from "./openapi-contract-drift.js"
import {
  enrichOpenApiDocument,
  validateOpenApiDocument,
  type OpenApiDocument
} from "./openapi-doc-quality.js"
import {
  renderMarkdownArtifacts,
  validateGeneratedMarkdownFreshness
} from "./generate-openapi-docs.js"

test("GET /openapi.json is the runtime OpenAPI source of truth", async () => {
  const response = await app.request("/openapi.json")

  assert.equal(response.status, 200)
  const runtimeDocument = await response.json() as OpenApiDocument
  const inProcessDocument = enrichOpenApiDocument(app.getOpenAPIDocument(openApiConfig) as OpenApiDocument)

  assert.deepEqual(runtimeDocument, inProcessDocument)
  assert.equal(runtimeDocument.info?.title, "MemoRAG Bedrock QA MVP API")
  assert.ok(runtimeDocument.paths?.["/chat"]?.post)
  assert.ok(runtimeDocument.paths?.["/chat-runs"]?.post)
})

test("OpenAPI quality gate validates lifecycle metadata and generated Markdown freshness", async () => {
  const response = await app.request("/openapi.json")
  const runtimeDocument = await response.json() as OpenApiDocument

  assert.deepEqual(validateOpenApiDocument(runtimeDocument), [])
  assert.deepEqual(await validateGeneratedMarkdownFreshness(runtimeDocument), [])

  const chat = runtimeDocument.paths?.["/chat"]?.post
  assert.equal(chat?.["x-memorag-lifecycle"]?.stage, "compatibility")
  assert.equal(chat?.["x-memorag-lifecycle"]?.replacement, "POST /chat-runs + GET /chat-runs/{runId}/events")

  const chatMarkdown = renderMarkdownArtifacts(runtimeDocument)
    .find((artifact) => artifact.relativePath === "openapi/post-chat.md")
  assert.ok(chatMarkdown?.content.includes("## Lifecycle"))
  assert.ok(chatMarkdown?.content.includes("POST /chat-runs + GET /chat-runs/{runId}/events"))
})

test("representative oRPC contract routes stay mapped to runtime OpenAPI operations", async () => {
  const response = await app.request("/openapi.json")
  const runtimeDocument = await response.json() as OpenApiDocument
  const routes = collectRestOrpcRoutes(apiContract)

  assert.deepEqual(
    routes.map((route) => `${route.procedure}:${route.method.toUpperCase()} ${route.path}`),
    [
      "benchmark.query:POST /benchmark/query",
      "benchmark.search:POST /benchmark/search",
      "chat.create:POST /chat",
      "chat.startRun:POST /chat-runs",
      "system.health:GET /health"
    ]
  )
  assert.deepEqual(validateRestOrpcContractDrift(runtimeDocument), [])
})
