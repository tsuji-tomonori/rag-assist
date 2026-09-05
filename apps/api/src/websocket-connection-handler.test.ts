import assert from "node:assert/strict"
import test from "node:test"
import type { WebSocketConnectionRecord, WebSocketConnectionStore } from "./adapters/dynamodb-websocket-connection-store.js"
import { createWebSocketConnectionHandler } from "./websocket-connection-handler.js"

const now = 1_783_728_000_000
const ticket = `memorag-ticket.${Buffer.alloc(32, 4).toString("base64url")}`

test("connect stores only authorizer binding and echoes the product subprotocol", async () => {
  const store = new MemoryConnectionStore()
  const logs: unknown[] = []
  const handle = createWebSocketConnectionHandler({ store, now: () => now, log: (entry) => logs.push(entry) })
  const response = await handle({
    headers: { "sec-websocket-protocol": `memorag.v1, ${ticket}` },
    requestContext: {
      eventType: "CONNECT",
      routeKey: "$connect",
      requestId: "request-1",
      connectionId: "connection-1",
      authorizer: {
        userId: "user-1",
        tenantId: "tenant-1",
        sessionId: "session-1",
        tokenId: "token-1",
        ticketId: "ticket-id-1",
        tokenExpiresAtEpochMs: String(now + 60_000)
      }
    }
  })
  assert.deepEqual(response, { statusCode: 200, headers: { "Sec-WebSocket-Protocol": "memorag.v1" } })
  assert.equal(store.connected.length, 1)
  assert.equal(JSON.stringify(store.connected).includes(ticket), false)
  assert.equal(JSON.stringify(logs).includes(ticket), false)
})

test("disconnect is idempotent and reconnect with missing fresh authorizer context is rejected", async () => {
  const store = new MemoryConnectionStore()
  const handle = createWebSocketConnectionHandler({ store, now: () => now, log: () => {} })
  for (let index = 0; index < 2; index += 1) {
    assert.deepEqual(await handle({ requestContext: { eventType: "DISCONNECT", connectionId: "connection-1" } }), { statusCode: 200 })
  }
  assert.deepEqual(store.disconnected, ["connection-1", "connection-1"])
  assert.equal((await handle({
    headers: { "sec-websocket-protocol": `memorag.v1, ${ticket}` },
    requestContext: { eventType: "CONNECT", connectionId: "connection-2" }
  })).statusCode, 400)
})

test("unsupported message and malformed upgrade fail closed", async () => {
  const handle = createWebSocketConnectionHandler({ store: new MemoryConnectionStore(), now: () => now, log: () => {} })
  assert.equal((await handle({ requestContext: { eventType: "MESSAGE", routeKey: "$default" } })).statusCode, 400)
  assert.equal((await handle({ requestContext: { eventType: "CONNECT", connectionId: "connection-1", authorizer: {} } })).statusCode, 400)
})

class MemoryConnectionStore implements WebSocketConnectionStore {
  connected: WebSocketConnectionRecord[] = []
  disconnected: string[] = []
  async connect(record: WebSocketConnectionRecord): Promise<void> { this.connected.push(structuredClone(record)) }
  async disconnect(connectionId: string): Promise<void> { this.disconnected.push(connectionId) }
}
