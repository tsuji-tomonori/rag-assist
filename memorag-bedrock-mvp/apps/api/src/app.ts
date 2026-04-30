import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"
import { createDependencies } from "./dependencies.js"
import { MemoRagService } from "./rag/memorag-service.js"
import {
  ChatRequestSchema,
  ChatResponseSchema,
  BenchmarkQueryRequestSchema,
  BenchmarkQueryResponseSchema,
  DeleteDocumentResponseSchema,
  DebugTraceListResponseSchema,
  DebugTraceSchema,
  DocumentListResponseSchema,
  DocumentManifestSchema,
  DocumentUploadRequestSchema,
  ErrorResponseSchema,
  HealthResponseSchema
} from "./schemas.js"

const deps = createDependencies()
const service = new MemoRagService(deps)

const app = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ error: "Validation failed", details: result.error.flatten() }, 400)
    }
  }
})

app.use("*", cors({ origin: "*", allowHeaders: ["Content-Type"], allowMethods: ["GET", "POST", "DELETE", "OPTIONS"] }))

function looseRoute(config: any) {
  return createRoute(config) as any
}

app.openapi(
  looseRoute({
    method: "get",
    path: "/health",
    responses: {
      200: { description: "Health check", content: { "application/json": { schema: HealthResponseSchema } } }
    }
  }),
  (c) => c.json({ ok: true, service: "memorag-bedrock-mvp", timestamp: new Date().toISOString() }, 200)
)

app.openapi(
  looseRoute({
    method: "get",
    path: "/documents",
    responses: {
      200: {
        description: "List ingested documents",
        content: { "application/json": { schema: DocumentListResponseSchema } }
      },
      500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => c.json({ documents: await service.listDocuments() }, 200)
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/documents",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: DocumentUploadRequestSchema } }
      }
    },
    responses: {
      200: { description: "Ingested document", content: { "application/json": { schema: DocumentManifestSchema } } },
      400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
      500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    const body = (c.req as any).valid("json") as z.infer<typeof DocumentUploadRequestSchema>
    if (!body.text && !body.contentBase64) return c.json({ error: "Either text or contentBase64 is required" }, 400)
    return c.json(await service.ingest(body), 200)
  }
)

app.openapi(
  looseRoute({
    method: "delete",
    path: "/documents/{documentId}",
    request: {
      params: z.object({ documentId: z.string().min(1) })
    },
    responses: {
      200: {
        description: "Deleted document",
        content: { "application/json": { schema: DeleteDocumentResponseSchema } }
      },
      404: { description: "Document not found", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    try {
      const { documentId } = (c.req as any).valid("param") as { documentId: string }
      return c.json(await service.deleteDocument(documentId), 200)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes("ENOENT") || message.includes("NoSuchKey") || message.includes("NotFound")) {
        return c.json({ error: "Document not found" }, 404)
      }
      throw err
    }
  }
)

const chatRoute = looseRoute({
  method: "post",
  path: "/chat",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: ChatRequestSchema } }
    }
  },
  responses: {
    200: { description: "Grounded answer", content: { "application/json": { schema: ChatResponseSchema } } },
    400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
    500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
  }
})

app.openapi(chatRoute, async (c) => {
  const body = (c.req as any).valid("json") as z.infer<typeof ChatRequestSchema>
  return c.json(await service.chat(body), 200)
})

app.openapi(
  looseRoute({
    method: "get",
    path: "/debug-runs",
    responses: {
      200: {
        description: "List persisted chat debug traces",
        content: { "application/json": { schema: DebugTraceListResponseSchema } }
      }
    }
  }),
  async (c) => c.json({ debugRuns: await service.listDebugRuns() }, 200)
)

app.openapi(
  looseRoute({
    method: "get",
    path: "/debug-runs/{runId}",
    request: {
      params: z.object({ runId: z.string().min(1) })
    },
    responses: {
      200: { description: "Get a persisted chat debug trace", content: { "application/json": { schema: DebugTraceSchema } } },
      404: { description: "Debug run not found", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    const { runId } = (c.req as any).valid("param") as { runId: string }
    const trace = await service.getDebugRun(runId)
    if (!trace) return c.json({ error: "Debug run not found" }, 404)
    return c.json(trace, 200)
  }
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/benchmark/query",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: BenchmarkQueryRequestSchema } }
      }
    },
    responses: {
      200: { description: "Benchmark query result", content: { "application/json": { schema: BenchmarkQueryResponseSchema } } }
    }
  }),
  async (c) => {
    const body = (c.req as any).valid("json") as z.infer<typeof BenchmarkQueryRequestSchema>
    const result = await service.chat({ ...body, includeDebug: body.includeDebug ?? true })
    return c.json({ id: body.id, ...result }, 200)
  }
)

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    version: "0.1.0",
    title: "MemoRAG Bedrock QA MVP API",
    description: "Grounded internal-document QA API. Answers only from uploaded documents; otherwise returns a no-answer response."
  }
})

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse()
  console.error(err)
  return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500)
})

export default app
