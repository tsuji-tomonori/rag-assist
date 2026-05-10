import { z } from "@hono/zod-openapi"
import { streamSSE } from "hono/streaming"
import { eventPayload } from "../chat-run-events-stream.js"
import { getPermissionsForGroups, requirePermission } from "../authorization.js"
import {
  ChatRequestSchema,
  ChatResponseSchema,
  ChatRunStartResponseSchema,
  ErrorResponseSchema,
  SearchRequestSchema,
  SearchResponseSchema
} from "../schemas.js"
import type { ApiRouteContext } from "./route-context.js"
import { looseRoute, routeAuthorization, sleep, validJson } from "./route-utils.js"

export function registerChatRoutes({ app, deps, service }: ApiRouteContext) {
  const chatRoute = looseRoute({
    method: "post",
    path: "/chat",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "chat:create", conditionalPermissions: ["chat:admin:read_all"], notes: ["includeDebug または debug が true の場合は chat:admin:read_all も必要です。"] }),
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
    const user = c.get("user")
    requirePermission(user, "chat:create")
    const body = validJson<z.infer<typeof ChatRequestSchema>>(c)
    if ((body.includeDebug ?? body.debug ?? false) === true) {
      requirePermission(user, "chat:admin:read_all")
    }
    return c.json(await service.chat(body, user), 200)
  })

  app.openapi(
    looseRoute({
      method: "post",
      path: "/chat-runs",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "chat:create", conditionalPermissions: ["chat:admin:read_all"], notes: ["includeDebug または debug が true の場合は chat:admin:read_all も必要です。"] }),
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: ChatRequestSchema } }
        }
      },
      responses: {
        200: { description: "Started asynchronous chat run", content: { "application/json": { schema: ChatRunStartResponseSchema } } },
        400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
        500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "chat:create")
      const body = validJson<z.infer<typeof ChatRequestSchema>>(c)
      if ((body.includeDebug ?? body.debug ?? false) === true) {
        requirePermission(user, "chat:admin:read_all")
      }
      return c.json(await service.startChatRun(body, user), 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/chat-runs/{runId}/events",
      "x-memorag-authorization": routeAuthorization({ mode: "ownedRun", permission: "chat:read:own", conditionalPermissions: ["chat:admin:read_all"], notes: ["chat:read:own は自分が作成した run のみ購読できます。chat:admin:read_all は他ユーザーの run も購読できます。"] }),
      request: {
        params: z.object({ runId: z.string().min(1) })
      },
      responses: {
        200: { description: "Asynchronous chat run events", content: { "text/event-stream": { schema: z.string() } } },
        403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
        404: { description: "Chat run not found", content: { "application/json": { schema: ErrorResponseSchema } } },
        500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "chat:read:own")
      const runId = c.req.param("runId") ?? ""
      const run = await deps.chatRunStore.get(runId)
      if (!run) return c.json({ error: "Chat run not found" }, 404)

      const canReadAll = getPermissionsForGroups(user.cognitoGroups).includes("chat:admin:read_all")
      if (run.createdBy !== user.userId && !canReadAll) return c.json({ error: "Forbidden" }, 403)

      return streamSSE(c, async (stream) => {
        const lastEventId = Number(c.req.header("Last-Event-ID") ?? 0)
        let afterSeq = Number.isFinite(lastEventId) ? lastEventId : 0
        const deadline = Date.now() + 14 * 60 * 1000
        let lastHeartbeat = 0

        while (Date.now() < deadline) {
          const events = await deps.chatRunEventStore.listAfter(runId, afterSeq)
          for (const item of events) {
            await stream.writeSSE({
              id: String(item.seq),
              event: item.type,
              data: JSON.stringify(eventPayload(item))
            })
            afterSeq = item.seq
            if (item.type === "final" || item.type === "error") return
          }

          if (Date.now() - lastHeartbeat > 15_000) {
            await stream.writeSSE({
              event: "heartbeat",
              data: JSON.stringify({ ts: new Date().toISOString(), nextSeq: afterSeq + 1 })
            })
            lastHeartbeat = Date.now()
          }

          await sleep(1000)
        }

        await stream.writeSSE({
          event: "timeout",
          data: JSON.stringify({
            message: "stream timeout. reconnect with Last-Event-ID.",
            nextSeq: afterSeq + 1
          })
        })
      })
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/search",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:doc:read" }),
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: SearchRequestSchema } }
        }
      },
      responses: {
        200: { description: "Hybrid lexical and vector search results", content: { "application/json": { schema: SearchResponseSchema } } },
        400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
        500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "rag:doc:read")
      const body = validJson<z.infer<typeof SearchRequestSchema>>(c)
      return c.json(await service.search(body, user), 200)
    }
  )
}
