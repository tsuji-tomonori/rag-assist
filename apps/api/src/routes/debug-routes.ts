import { z } from "@hono/zod-openapi"
import { requirePermission } from "../authorization.js"
import { DebugDownloadResponseSchema, DebugTraceListResponseSchema, DebugTraceSchema, ErrorResponseSchema } from "../schemas.js"
import type { ApiRouteContext } from "./route-context.js"
import { looseRoute, routeAuthorization, validParam } from "./route-utils.js"

export function registerDebugRoutes({ app, service }: ApiRouteContext) {
  app.openapi(
    looseRoute({
      method: "get",
      path: "/debug-runs",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "chat:admin:read_all", operationKey: "debug.trace.read.sanitized", resourceCondition: "ownedRun" }),
      responses: {
        200: {
          description: "List persisted chat debug traces",
          content: { "application/json": { schema: DebugTraceListResponseSchema } }
        }
      }
    }),
    async (c) => {
      requirePermission(c.get("user"), "chat:admin:read_all")
      return c.json({ debugRuns: await service.listDebugRuns() }, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/debug-runs/{runId}",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "chat:admin:read_all", operationKey: "debug.trace.read.sanitized", resourceCondition: "ownedRun" }),
      request: {
        params: z.object({ runId: z.string().min(1) })
      },
      responses: {
        200: { description: "Get a persisted chat debug trace", content: { "application/json": { schema: DebugTraceSchema } } },
        404: { description: "Debug run not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      requirePermission(c.get("user"), "chat:admin:read_all")
      const { runId } = validParam<{ runId: string }>(c)
      const trace = await service.getDebugRun(runId)
      if (!trace) return c.json({ error: "Debug run not found" }, 404)
      return c.json(trace, 200)
    }
  )


  app.openapi(
    looseRoute({
      method: "post",
      path: "/debug-runs/{runId}/download",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "chat:admin:read_all", operationKey: "debug.trace.export", resourceCondition: "ownedRun" }),
      request: { params: z.object({ runId: z.string().min(1) }) },
      responses: {
        200: { description: "Create signed download URL for debug JSON", content: { "application/json": { schema: DebugDownloadResponseSchema } } },
        404: { description: "Debug run not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      requirePermission(c.get("user"), "chat:admin:read_all")
      const { runId } = validParam<{ runId: string }>(c)
      const download = await service.createDebugTraceDownloadUrl(runId)
      if (!download) return c.json({ error: "Debug run not found" }, 404)
      return c.json(download, 200)
    }
  )
}
