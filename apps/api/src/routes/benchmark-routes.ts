import { z } from "@hono/zod-openapi"
import { HTTPException } from "hono/http-exception"
import { requirePermission } from "../authorization.js"
import {
  BenchmarkEvaluationContextError,
  prepareBenchmarkQueryInvocation,
  prepareBenchmarkSearchInvocation
} from "../benchmark/evaluation-context.js"
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
import { looseRoute, routeAuthorization, validJson, validParam } from "./route-utils.js"
import { ResourceUnavailableError, settleNonEnumerationTiming } from "../security/public-resource-response.js"

export function registerBenchmarkRoutes({ app, service }: ApiRouteContext) {
  app.openapi(
    looseRoute({
      method: "post",
      path: "/benchmark/query",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "benchmark:query",
        allowedRoles: ["BENCHMARK_RUNNER"],
        operationKey: "benchmark.query",
        resourceCondition: "benchmarkEvaluationScope",
        notes: ["suiteId は server-side allowlist で simulated subject と isolated tenant/corpus scope に解決する。"]
      }),
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: BenchmarkQueryRequestSchema } }
        }
      },
      responses: {
        200: { description: "Benchmark query result", content: { "application/json": { schema: BenchmarkQueryResponseSchema } } },
        400: { description: "Validation error or unknown suite", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "benchmark 評価が無効または設定不備のため利用できません", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const runner = c.get("user")
      requirePermission(runner, "benchmark:query")
      const body = validJson<z.infer<typeof BenchmarkQueryRequestSchema>>(c)
      const invocation = benchmarkHttp(() => prepareBenchmarkQueryInvocation(body, runner))
      const result = await service.chat(invocation.serviceInput, invocation.subject)
      return c.json({ id: invocation.id, ...result }, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/benchmark/search",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "benchmark:query",
        allowedRoles: ["BENCHMARK_RUNNER"],
        operationKey: "benchmark.search",
        resourceCondition: "benchmarkEvaluationScope",
        notes: ["request の user/group/tenant/filter override は拒否し、suite registry の scope だけを使う。"]
      }),
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: BenchmarkSearchRequestSchema } }
        }
      },
      responses: {
        200: { description: "Benchmark search result", content: { "application/json": { schema: SearchResponseSchema } } },
        400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "benchmark 評価が無効または設定不備のため利用できません", content: { "application/json": { schema: ErrorResponseSchema } } },
        500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "benchmark:query")
      const body = validJson<z.infer<typeof BenchmarkSearchRequestSchema>>(c)
      const invocation = benchmarkHttp(() => prepareBenchmarkSearchInvocation(body, user))
      return c.json(await service.search(invocation.serviceInput, invocation.subject), 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/benchmark-suites",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "benchmark:read", operationKey: "benchmark.suite.read", resourceCondition: "none" }),
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
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "benchmark:run", operationKey: "benchmark.run", resourceCondition: "documentGroupRead" }),
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
      const body = validJson<z.infer<typeof CreateBenchmarkRunRequestSchema>>(c)
      return c.json(await service.createBenchmarkRun(user, body), 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/benchmark-runs",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "benchmark:read", operationKey: "benchmark.run.read", resourceCondition: "tenantCollection" }),
      responses: {
        200: { description: "List benchmark runs", content: { "application/json": { schema: BenchmarkRunListResponseSchema } } }
      }
    }),
    async (c) => {
      const actor = c.get("user")
      requirePermission(actor, "benchmark:read")
      return c.json({ benchmarkRuns: await service.listBenchmarkRuns(actor) }, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/benchmark-runs/{runId}",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "benchmark:read", operationKey: "benchmark.run.read", resourceCondition: "tenantRun", errorDisclosure: "resource-hidden" }),
      request: {
        params: z.object({ runId: z.string().min(1) })
      },
      responses: {
        200: { description: "Get benchmark run", content: { "application/json": { schema: BenchmarkRunSchema } } },
        404: { description: "Benchmark run not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const lookupStartedAt = Date.now()
      const actor = c.get("user")
      requirePermission(actor, "benchmark:read")
      const { runId } = validParam<{ runId: string }>(c)
      const run = await service.getBenchmarkRun(actor, runId)
      if (!run) return resourceUnavailable(lookupStartedAt)
      return c.json(run, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/benchmark-runs/{runId}/cancel",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "benchmark:cancel", operationKey: "benchmark.run.cancel", resourceCondition: "tenantRun", errorDisclosure: "resource-hidden" }),
      request: {
        params: z.object({ runId: z.string().min(1) })
      },
      responses: {
        200: { description: "Cancelled benchmark run", content: { "application/json": { schema: BenchmarkRunSchema } } },
        404: { description: "Benchmark run not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const lookupStartedAt = Date.now()
      const actor = c.get("user")
      requirePermission(actor, "benchmark:cancel")
      const { runId } = validParam<{ runId: string }>(c)
      const run = await service.cancelBenchmarkRun(actor, runId)
      if (!run) return resourceUnavailable(lookupStartedAt)
      return c.json(run, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/benchmark-runs/{runId}/download",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "benchmark:download", operationKey: "benchmark.artifact.download", resourceCondition: "tenantRun", errorDisclosure: "resource-hidden" }),
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
      const lookupStartedAt = Date.now()
      const actor = c.get("user")
      requirePermission(actor, "benchmark:download")
      const { runId } = validParam<{ runId: string }>(c)
      const body = (validJson<{ artifact?: "report" | "summary" | "results" | "logs" } | undefined>(c) ?? {})
      const download = await service.createBenchmarkArtifactDownloadUrl(actor, runId, body.artifact ?? "report")
      if (!download) return resourceUnavailable(lookupStartedAt)
      return c.json(download, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/benchmark-runs/{runId}/logs",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "benchmark:download", operationKey: "benchmark.artifact.download", resourceCondition: "tenantRun", errorDisclosure: "resource-hidden" }),
      request: {
        params: z.object({ runId: z.string().min(1) })
      },
      responses: {
        200: { description: "Download benchmark CodeBuild logs as text", content: { "text/plain": { schema: z.string() } } },
        404: { description: "Benchmark run or CodeBuild logs not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const lookupStartedAt = Date.now()
      const actor = c.get("user")
      requirePermission(actor, "benchmark:download")
      const { runId } = validParam<{ runId: string }>(c)
      const download = await service.getBenchmarkCodeBuildLogText(actor, runId)
      if (!download) return resourceUnavailable(lookupStartedAt)
      return c.text(download.text, 200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": download.contentDisposition
      })
    }
  )
}

async function resourceUnavailable(startedAtMs: number): Promise<never> {
  await settleNonEnumerationTiming(startedAtMs)
  throw new ResourceUnavailableError()
}

function benchmarkHttp<T>(resolve: () => T): T {
  try {
    return resolve()
  } catch (error) {
    if (error instanceof BenchmarkEvaluationContextError) {
      throw new HTTPException(error.status, { message: error.message })
    }
    throw error
  }
}
