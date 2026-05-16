import { z } from "@hono/zod-openapi"
import { requirePermission } from "../authorization.js"
import { DebugDownloadResponseSchema, DebugReplayPlanSchema, DebugTraceListResponseSchema, DebugTraceSchema, ErrorResponseSchema } from "../schemas.js"
import type { ApiRouteContext } from "./route-context.js"
import { looseRoute, routeAuthorization, validParam } from "./route-utils.js"

const debugReadAuthorization = routeAuthorization({
  mode: "required",
  permission: "chat:admin:read_all",
  operationKey: "debug.trace.read.sanitized",
  resourceCondition: "ownedRun",
  notes: [
    "現行 gate は chat:admin:read_all です。debug:trace:read:sanitized は 14A の移行先 permission として role mapping に追加済みですが、既存管理者可視性を壊さないためこの route では chat:admin:read_all を alias gate として維持します。",
    "返却 trace は operator_sanitized 以下の sanitize 済み DebugTrace contract です。debug 権限は文書閲覧権限を拡張しません。"
  ]
})

const debugExportAuthorization = routeAuthorization({
  mode: "required",
  permission: "chat:admin:read_all",
  conditionalPermissions: ["debug:trace:export"],
  operationKey: "debug.trace.export",
  resourceCondition: "ownedRun",
  notes: [
    "現行 gate は chat:admin:read_all です。debug:trace:export は 14A の移行先 permission として metadata に明記し、既存管理者の export 可視性を維持します。",
    "download artifact は DebugTrace.exportRedaction の policy version と redaction metadata を含む sanitize 済み JSON に限定します。"
  ]
})

export function registerDebugRoutes({ app, service }: ApiRouteContext) {
  app.openapi(
    looseRoute({
      method: "get",
      path: "/debug-runs",
      "x-memorag-authorization": debugReadAuthorization,
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
      "x-memorag-authorization": debugReadAuthorization,
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
      path: "/debug-runs/{runId}/replay-plan",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "chat:admin:read_all",
        conditionalPermissions: ["debug:replay"],
        operationKey: "debug.trace.replay_plan",
        resourceCondition: "ownedRun",
        notes: [
          "現行 gate は chat:admin:read_all です。debug:replay は移行先 permission として metadata に明記します。",
          "replay-plan は sanitize 済み入力概要のみを返し、モデル/tool 再実行は行いません。"
        ]
      }),
      request: { params: z.object({ runId: z.string().min(1) }) },
      responses: {
        200: { description: "Create sanitized debug replay plan metadata without execution", content: { "application/json": { schema: DebugReplayPlanSchema } } },
        403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
        404: { description: "Debug run not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      requirePermission(c.get("user"), "chat:admin:read_all")
      const { runId } = validParam<{ runId: string }>(c)
      const plan = await service.createDebugReplayPlan(runId)
      if (!plan) return c.json({ error: "Debug run not found" }, 404)
      return c.json(plan, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/debug-runs/{runId}/download",
      "x-memorag-authorization": debugExportAuthorization,
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
