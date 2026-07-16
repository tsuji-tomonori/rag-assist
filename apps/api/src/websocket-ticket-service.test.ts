import assert from "node:assert/strict"
import test from "node:test"
import type { WebSocketTicketRecord, WebSocketTicketStore } from "./adapters/websocket-ticket-store.js"
import {
  WEB_SOCKET_PROTOCOL,
  WEB_SOCKET_TICKET_TTL_MS,
  WebSocketTicketService,
  hashWebSocketTicket,
  parseWebSocketSubprotocolHeader
} from "./websocket-ticket-service.js"

test("ticket issuance stores only a hash with user, tenant, session, and token binding", async () => {
  const store = new MemoryTicketStore()
  const now = 1_783_728_000_000
  const service = new WebSocketTicketService(
    store,
    () => now,
    () => Buffer.alloc(32, 7),
    () => "ticket-id-1"
  )
  const issued = await service.issue({
    userId: "user-1",
    identityUsername: "cognito-user",
    cognitoGroups: ["CHAT_USER"],
    accountStatus: "active",
    tenantId: "tenant-1"
  }, {
    sessionId: "session-1",
    tokenId: "token-1",
    issuedAtEpochMs: now - 1000,
    expiresAtEpochMs: now + 3_600_000
  })

  assert.equal(issued.protocol, WEB_SOCKET_PROTOCOL)
  assert.equal(issued.expiresAt, new Date(now + WEB_SOCKET_TICKET_TTL_MS).toISOString())
  assert.match(issued.ticket, /^memorag-ticket\.[A-Za-z0-9_-]{43}$/)
  assert.equal(store.records.length, 1)
  const stored = store.records[0]!
  assert.equal(stored.ticketHash, hashWebSocketTicket(issued.ticket))
  assert.equal(JSON.stringify(stored).includes(issued.ticket), false)
  assert.deepEqual({
    userId: stored.userId,
    tenantId: stored.tenantId,
    sessionId: stored.sessionId,
    tokenId: stored.tokenId,
    ticketId: stored.ticketId,
    ttl: stored.ttl
  }, {
    userId: "user-1",
    tenantId: "tenant-1",
    sessionId: "session-1",
    tokenId: "token-1",
    ticketId: "ticket-id-1",
    ttl: Math.ceil((now + WEB_SOCKET_TICKET_TTL_MS) / 1000)
  })
})

test("ticket issuance fails closed for incomplete or expired auth binding", async () => {
  const service = new WebSocketTicketService(new MemoryTicketStore(), () => 1000, () => Buffer.alloc(32, 1))
  await assert.rejects(() => service.issue({
    userId: "user-1",
    cognitoGroups: [],
    tenantId: "tenant-1"
  }, {
    sessionId: "session-1",
    tokenId: "token-1",
    issuedAtEpochMs: 0,
    expiresAtEpochMs: 1000
  }))
})

test("subprotocol parser accepts exactly the product protocol and one ticket", () => {
  const ticket = `memorag-ticket.${Buffer.alloc(32, 2).toString("base64url")}`
  assert.deepEqual(parseWebSocketSubprotocolHeader(`memorag.v1, ${ticket}`), { ticket })
  assert.deepEqual(parseWebSocketSubprotocolHeader(`${ticket}, memorag.v1`), { ticket })
  for (const value of [
    undefined,
    ticket,
    `memorag.v1, ${ticket}, another`,
    `memorag.v1, memorag.v1`,
    "memorag.v1, memorag-ticket.invalid"
  ]) assert.equal(parseWebSocketSubprotocolHeader(value), undefined)
})

class MemoryTicketStore implements WebSocketTicketStore {
  records: WebSocketTicketRecord[] = []
  async issue(record: WebSocketTicketRecord): Promise<void> {
    this.records.push(structuredClone(record))
  }
  async consume(): Promise<WebSocketTicketRecord | undefined> {
    return undefined
  }
  async revoke(): Promise<boolean> {
    return false
  }
}
