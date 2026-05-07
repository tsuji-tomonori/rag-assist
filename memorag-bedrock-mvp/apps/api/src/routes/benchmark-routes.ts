import { z } from "@hono/zod-openapi"
import { HTTPException } from "hono/http-exception"
import type { AppUser } from "../auth.js"
import { requirePermission } from "../authorization.js"
import {
  BenchmarkQueryRequestSchema,
  BenchmarkQueryResponseSchema,
  BenchmarkRunListResponseSchema,
  BenchmarkRunSchema,
  BenchmarkSearchRequestSchema,
  BenchmarkSuiteListResponseSchema,
  CreateBenchmarkRunRequestSchema,
  DebugDownloadResponseSchema,
  ErrorResponseSchema,
  SearchResponseSchema
} from "../schemas.js"
import type { ApiRouteContext } from "./route-context.js"
import { looseRoute } from "./route-utils.js"

function benchmarkSearchUser(runnerUser: AppUser, requestUser: z.infer<typeof BenchmarkSearchRequestSchema>["user"]): AppUser {
  if (!requestUser) return runnerUser
  throw new HTTPException(400, { message: "Benchmark search user override is not supported" })
}

export function registerBenchmarkRoutes({ app, service }: ApiRouteContext) {
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
      requirePermission(c.get("user"), "benchmark:query")
      const body = (c.req as any).valid("json") as z.infer<typeof BenchmarkQueryRequestSchema>
      const result = await service.chat({
        ...body,
        includeDebug: body.includeDebug ?? true,
        searchFilters: {
          source: "benchmark-runner",
          docType: "benchmark-corpus",
          benchmarkSuiteId: body.benchmarkSuiteId
        }
      }, c.get("user"))
      return c.json({ id: body.id, ...result }, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/benchmark/search",
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: BenchmarkSearchRequestSchema } }
        }
      },
      responses: {
        200: { description: "Benchmark search result", content: { "application/json": { schema: SearchResponseSchema } } },
        400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
        500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "benchmark:query")
      const body = (c.req as any).valid("json") as z.infer<typeof BenchmarkSearchRequestSchema>
      const { user: requestUser, benchmarkSuiteId, ...searchInput } = body
      const benchmarkFilterSuiteId = benchmarkSuiteId ?? searchInput.filters?.benchmarkSuiteId
      if (benchmarkFilterSuiteId) {
        searchInput.filters = {
          ...(searchInput.filters ?? {}),
          source: "benchmark-runner",
          docType: "benchmark-corpus",
          benchmarkSuiteId: benchmarkFilterSuiteId
        }
      }
      return c.json(await service.search(searchInput, benchmarkSearchUser(user, requestUser)), 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/benchmark-suites",
      responses: {
        200: { description: "List benchmark suites available for asynchronous runs", content: { "application/json": { schema: BenchmarkSuiteListResponseSchema } } }
      }
    }),
    (c) => {
      requirePermission(c.get("user"), "benchmark:read")
      return c.json({ suites: service.listBenchmarkSuites() }, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/benchmark-runs",
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateBenchmarkRunRequestSchema } }
        }
      },
      responses: {
        200: { description: "Queued benchmark run", content: { "application/json": { schema: BenchmarkRunSchema } } },
        400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "benchmark:run")
      const body = (c.req as any).valid("json") as z.infer<typeof CreateBenchmarkRunRequestSchema>
      return c.json(await service.createBenchmarkRun(user, body), 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/benchmark-runs",
      responses: {
        200: { description: "List benchmark runs", content: { "application/json": { schema: BenchmarkRunListResponseSchema } } }
      }
    }),
    async (c) => {
      requirePermission(c.get("user"), "benchmark:read")
      return c.json({ benchmarkRuns: await service.listBenchmarkRuns() }, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/benchmark-runs/{runId}",
      request: {
        params: z.object({ runId: z.string().min(1) })
      },
      responses: {
        200: { description: "Get benchmark run", content: { "application/json": { schema: BenchmarkRunSchema } } },
        404: { description: "Benchmark run not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      requirePermission(c.get("user"), "benchmark:read")
      const { runId } = (c.req as any).valid("param") as { runId: string }
      const run = await service.getBenchmarkRun(runId)
      if (!run) return c.json({ error: "Benchmark run not found" }, 404)
      return c.json(run, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/benchmark-runs/{runId}/cancel",
      request: {
        params: z.object({ runId: z.string().min(1) })
      },
      responses: {
        200: { description: "Cancelled benchmark run", content: { "application/json": { schema: BenchmarkRunSchema } } },
        404: { description: "Benchmark run not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      requirePermission(c.get("user"), "benchmark:cancel")
      const { runId } = (c.req as any).valid("param") as { runId: string }
      const run = await service.cancelBenchmarkRun(runId)
      if (!run) return c.json({ error: "Benchmark run not found" }, 404)
      return c.json(run, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/benchmark-runs/{runId}/download",
      request: {
        params: z.object({ runId: z.string().min(1) }),
        body: {
          required: false,
          content: { "application/json": { schema: z.object({ artifact: z.enum(["report", "summary", "results", "logs"]).optional() }) } }
        }
      },
      responses: {
        200: { description: "Create signed download URL for benchmark artifact", content: { "application/json": { schema: DebugDownloadResponseSchema } } },
        404: { description: "Benchmark run not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      requirePermission(c.get("user"), "benchmark:download")
      const { runId } = (c.req as any).valid("param") as { runId: string }
      const body = ((c.req as any).valid("json") ?? {}) as { artifact?: "report" | "summary" | "results" | "logs" }
      const download = await service.createBenchmarkArtifactDownloadUrl(runId, body.artifact ?? "report")
      if (!download) return c.json({ error: "Benchmark run not found" }, 404)
      return c.json(download, 200)
    }
  )
}
