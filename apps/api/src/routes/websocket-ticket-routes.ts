import { ErrorResponseSchema, WebSocketTicketResponseSchema } from "../schemas.js"
import { WebSocketTicketService } from "../websocket-ticket-service.js"
import type { ApiRouteContext } from "./route-context.js"
import { looseRoute, routeAuthorization } from "./route-utils.js"

export function registerWebSocketTicketRoutes({ app, deps }: ApiRouteContext): void {
  app.openapi(
    looseRoute({
      method: "post",
      path: "/websocket/tickets",
      summary: "WebSocket接続ticketを発行する",
      description: "認証済みsessionへbindingした60秒・single-useのWebSocket接続ticketを発行します。",
      "x-memorag-authorization": routeAuthorization({
        mode: "authenticated",
        operationKey: "realtime.connect",
        notes: ["認証済みsessionへbindingした短命single-use WebSocket ticketだけを発行します。"]
      }),
      responses: {
        201: {
          description: "短命・single-useのWebSocket接続ticket",
          content: { "application/json": { schema: WebSocketTicketResponseSchema } }
        },
        401: { description: "認証が必要です", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "WebSocket接続ticketを発行できません", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      try {
        if (!deps.webSocketTicketStore) throw new Error("WebSocket ticket store is unavailable")
        const ticketService = new WebSocketTicketService(deps.webSocketTicketStore)
        const ticket = await ticketService.issue(c.get("user"), c.get("authSession"))
        c.header("Cache-Control", "no-store")
        return c.json(ticket, 201)
      } catch {
        return c.json({ error: "WebSocket ticket unavailable" }, 503)
      }
    }
  )
}
