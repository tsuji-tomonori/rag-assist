import assert from "node:assert/strict"
import test from "node:test"
import { OpenAPIHono } from "@hono/zod-openapi"
import type { AppEnv } from "../app-env.js"
import type { Dependencies } from "../dependencies.js"
import type { MemoRagService } from "../rag/memorag-service.js"
import type { WebSocketTicketRecord, WebSocketTicketStore } from "../adapters/websocket-ticket-store.js"
import { registerWebSocketTicketRoutes } from "./websocket-ticket-routes.js"

test("ticket route is no-store and issues from middleware-verified user/session context", async () => {
  const store = new RecordingStore()
  const app = routeApp(store)
  const response = await app.request("/websocket/tickets", { method: "POST" })
  assert.equal(response.status, 201)
  assert.equal(response.headers.get("cache-control"), "no-store")
  const body = await response.json() as { ticket: string; protocol: string; expiresAt: string }
  assert.match(body.ticket, /^memorag-ticket\.[A-Za-z0-9_-]{43}$/)
  assert.equal(body.protocol, "memorag.v1")
  assert.equal(store.records.length, 1)
  assert.deepEqual({
    userId: store.records[0]!.userId,
    tenantId: store.records[0]!.tenantId,
    sessionId: store.records[0]!.sessionId,
    tokenId: store.records[0]!.tokenId
  }, { userId: "user-1", tenantId: "tenant-1", sessionId: "session-1", tokenId: "token-1" })
})

test("ticket route fails closed when the production store dependency is absent", async () => {
  const response = await routeApp(undefined).request("/websocket/tickets", { method: "POST" })
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: "WebSocket ticket unavailable" })
})

function routeApp(store: WebSocketTicketStore | undefined): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>()
  app.use("*", async (c, next) => {
    c.set("user", {
      userId: "user-1",
      identityUsername: "cognito-user",
      cognitoGroups: ["CHAT_USER"],
      accountStatus: "active",
      tenantId: "tenant-1"
    })
    c.set("authSession", {
      sessionId: "session-1",
      tokenId: "token-1",
      issuedAtEpochMs: Date.now() - 1000,
      expiresAtEpochMs: Date.now() + 3_600_000
    })
    await next()
  })
  registerWebSocketTicketRoutes({
    app,
    deps: { webSocketTicketStore: store } as Dependencies,
    service: {} as MemoRagService
  })
  return app
}

class RecordingStore implements WebSocketTicketStore {
  records: WebSocketTicketRecord[] = []
  async issue(record: WebSocketTicketRecord): Promise<void> { this.records.push(structuredClone(record)) }
  async consume(): Promise<WebSocketTicketRecord | undefined> { return undefined }
  async revoke(): Promise<boolean> { return false }
}
