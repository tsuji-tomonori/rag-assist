import { OpenAPIHono } from "@hono/zod-openapi"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"
import { authMiddleware } from "./auth.js"
import { createDependencies } from "./dependencies.js"
import { enrichOpenApiDocument, type OpenApiDocument } from "./openapi-doc-quality.js"
import { MemoRagService } from "./rag/memorag-service.js"
import { registerApiRoutes } from "./routes/api-routes.js"

export { isBenchmarkSeedUpload, isBenchmarkSeedUploadedObjectIngest } from "./routes/api-routes.js"

const deps = createDependencies()
const service = new MemoRagService(deps)

const app = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ error: "Validation failed", details: result.error.flatten() }, 400)
    }
  }
})

const protectedApiPaths = [
  "/me",
  "/admin/*",
  "/documents",
  "/documents/*",
  "/document-ingest-runs",
  "/document-ingest-runs/*",
  "/chat",
  "/chat-runs",
  "/chat-runs/*",
  "/search",
  "/questions",
  "/questions/*",
  "/conversation-history",
  "/conversation-history/*",
  "/debug-runs",
  "/debug-runs/*",
  "/benchmark/query",
  "/benchmark/search",
  "/benchmark-runs",
  "/benchmark-runs/*",
  "/benchmark-suites"
]

app.use("*", cors({ origin: "*", allowHeaders: ["Content-Type", "Authorization", "Last-Event-ID"], allowMethods: ["GET", "POST", "DELETE", "OPTIONS"] }))
for (const path of protectedApiPaths) {
  app.use(path, authMiddleware)
}

registerApiRoutes(app, deps, service)

const openApiConfig = {
  openapi: "3.0.0",
  info: {
    version: "0.1.0",
    title: "MemoRAG Bedrock QA MVP API",
    description: "Grounded internal-document QA API. Answers only from uploaded documents; otherwise returns a no-answer response."
  }
}

app.get("/openapi.json", (c) => {
  return c.json(enrichOpenApiDocument(app.getOpenAPIDocument(openApiConfig) as OpenApiDocument))
})

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse()
  if (typeof err === "object" && err !== null && "getResponse" in err && typeof (err as { getResponse?: unknown }).getResponse === "function") {
    return (err as { getResponse: () => Response }).getResponse()
  }
  if (typeof err === "object" && err !== null && "status" in err) {
    const status = Number((err as { status?: number }).status ?? 500)
    const message = err instanceof Error ? err.message : "Unknown error"
    return c.json({ error: message }, status as any)
  }
  console.error(err)
  return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500)
})

export default app
