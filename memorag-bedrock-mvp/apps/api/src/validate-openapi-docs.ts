import { enrichOpenApiDocument, validateOpenApiDocument, type OpenApiDocument } from "./openapi-doc-quality.js"

process.env.MOCK_BEDROCK ??= "true"
process.env.USE_LOCAL_VECTOR_STORE ??= "true"
process.env.USE_LOCAL_QUESTION_STORE ??= "true"
process.env.USE_LOCAL_CONVERSATION_HISTORY_STORE ??= "true"
process.env.USE_LOCAL_BENCHMARK_RUN_STORE ??= "true"
process.env.USE_LOCAL_CHAT_RUN_STORE ??= "true"
process.env.USE_LOCAL_DOCUMENT_INGEST_RUN_STORE ??= "true"
process.env.LOCAL_DATA_DIR ??= ".local-data"

async function main(): Promise<void> {
  const { default: app } = await import("./app.js")
  const response = await app.request("/openapi.json")
  if (!response.ok) {
    throw new Error(`Failed to load OpenAPI document: ${response.status}`)
  }

  const api = enrichOpenApiDocument((await response.json()) as OpenApiDocument)
  const errors = validateOpenApiDocument(api)
  if (errors.length > 0) {
    console.error("OpenAPI document quality check failed:")
    for (const error of errors) console.error(`- ${error}`)
    process.exitCode = 1
    return
  }

  console.log("OpenAPI document quality check passed")
}

await main()
