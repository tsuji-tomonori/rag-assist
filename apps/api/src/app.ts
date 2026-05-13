import { OpenAPIHono } from "@hono/zod-openapi"
import { RPCHandler } from "@orpc/server/fetch"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "./app-env.js"
import { authMiddleware } from "./auth.js"
import { config } from "./config.js"
import { createDependencies } from "./dependencies.js"
import { logUnhandledApiError, safeUnhandledErrorResponse } from "./error-response.js"
import { orpcRouter } from "./orpc/router.js"
import { enrichOpenApiDocument, type OpenApiDocument } from "./openapi-doc-quality.js"
import { MemoRagService } from "./rag/memorag-service.js"
import { registerApiRoutes } from "./routes/api-routes.js"

export { isBenchmarkSeedUpload, isBenchmarkSeedUploadedObjectIngest } from "./routes/api-routes.js"

const deps = createDependencies()
const service = new MemoRagService(deps)
const rpcHandler = new RPCHandler(orpcRouter)

const app = new OpenAPIHono<AppEnv>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ error: "Validation failed", details: result.error.flatten() }, 400)
    }
  }
})

const publicApiPaths = new Set(["/health", "/openapi.json"])

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (config.corsAllowedOrigins.includes("*")) return origin
      return config.corsAllowedOrigins.includes(origin) ? origin : ""
    },
    allowHeaders: ["Content-Type", "Authorization", "Last-Event-ID"],
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"]
  })
)
app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS" || publicApiPaths.has(c.req.path)) return next()
  return authMiddleware(c, next)
})

registerApiRoutes(app, deps, service)

app.all("/rpc/*", async (c) => {
  const result = await rpcHandler.handle(c.req.raw, {
    prefix: "/rpc",
    context: {
      deps,
      service,
      user: c.get("user")
    }
  })

  if (result.matched) return result.response
  return c.json({ error: "oRPC procedure not found" }, 404)
})

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
  if (err instanceof HTTPException) return c.json({ error: err.message || "Request failed" }, err.status)
  if (typeof err === "object" && err !== null && "getResponse" in err && typeof (err as { getResponse?: unknown }).getResponse === "function") {
    return (err as { getResponse: () => Response }).getResponse()
  }
  logUnhandledApiError(err, c)
  const response = safeUnhandledErrorResponse(err)
  return c.json(response.body, response.status)
})

app.notFound((c) => c.json({ error: "Not found" }, 404))

export default app
