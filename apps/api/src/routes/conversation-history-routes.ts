import { z } from "@hono/zod-openapi"
import { requirePermission } from "../authorization.js"
import { ConversationHistoryItemSchema, ConversationHistoryListResponseSchema, ErrorResponseSchema } from "../schemas.js"
import type { ApiRouteContext } from "./route-context.js"
import { looseRoute, routeAuthorization, validJson, validParam } from "./route-utils.js"

export function registerConversationHistoryRoutes({ app, service }: ApiRouteContext) {
  app.openapi(
    looseRoute({
      method: "get",
      path: "/conversation-history",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "chat:read:own", operationKey: "history.read.self", resourceCondition: "self", notes: ["実行者自身の会話履歴だけ返します。"] }),
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
      const history = (await service.listConversationHistory(user.userId)).map((item) => ConversationHistoryItemSchema.parse(item))
      return c.json({ history }, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/conversation-history",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "chat:create", operationKey: "history.update.self", resourceCondition: "self", notes: ["実行者自身の会話履歴として保存します。"] }),
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
      const body = validJson<z.infer<typeof ConversationHistoryItemSchema>>(c)
      return c.json(ConversationHistoryItemSchema.parse(await service.saveConversationHistory(user.userId, body)), 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "delete",
      path: "/conversation-history/{id}",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "chat:delete:own", operationKey: "history.delete.self", resourceCondition: "self", notes: ["実行者自身の会話履歴だけ削除できます。"] }),
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
      const { id } = validParam<{ id: string }>(c)
      await service.deleteConversationHistory(user.userId, id)
      return c.json({ id }, 200)
    }
  )
}
