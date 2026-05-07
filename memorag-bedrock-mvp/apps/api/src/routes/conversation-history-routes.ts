import { z } from "@hono/zod-openapi"
import { requirePermission } from "../authorization.js"
import { ConversationHistoryItemSchema, ConversationHistoryListResponseSchema, ErrorResponseSchema } from "../schemas.js"
import type { ApiRouteContext } from "./route-context.js"
import { looseRoute } from "./route-utils.js"

export function registerConversationHistoryRoutes({ app, service }: ApiRouteContext) {
  app.openapi(
    looseRoute({
      method: "get",
      path: "/conversation-history",
      responses: {
        200: {
          description: "List persisted conversation history for the current user",
          content: { "application/json": { schema: ConversationHistoryListResponseSchema } }
        },
        500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "chat:read:own")
      return c.json({ history: await service.listConversationHistory(user.userId) }, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/conversation-history",
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: ConversationHistoryItemSchema } }
        }
      },
      responses: {
        200: { description: "Saved conversation history", content: { "application/json": { schema: ConversationHistoryItemSchema } } },
        400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
        500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "chat:create")
      const body = (c.req as any).valid("json") as z.infer<typeof ConversationHistoryItemSchema>
      return c.json(await service.saveConversationHistory(user.userId, body), 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "delete",
      path: "/conversation-history/{id}",
      request: {
        params: z.object({ id: z.string().min(1) })
      },
      responses: {
        200: { description: "Deleted conversation history", content: { "application/json": { schema: z.object({ id: z.string() }) } } },
        404: { description: "Conversation history not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "chat:delete:own")
      const { id } = (c.req as any).valid("param") as { id: string }
      await service.deleteConversationHistory(user.userId, id)
      return c.json({ id }, 200)
    }
  )
}
