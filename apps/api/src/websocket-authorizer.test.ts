import assert from "node:assert/strict"
import test from "node:test"
import type { ServerManagedIdentity, VerifiedIdentityProvider } from "./adapters/verified-identity-provider.js"
import type { WebSocketTicketRecord, WebSocketTicketStore } from "./adapters/websocket-ticket-store.js"
import { createWebSocketAuthorizerHandler } from "./websocket-authorizer.js"

const now = 1_783_728_000_000
const ticket = `memorag-ticket.${Buffer.alloc(32, 3).toString("base64url")}`

test("authorizer atomically consumes once and binds allow context", async () => {
  const store = new AtomicMemoryStore(record())
  const logs: unknown[] = []
  const authorize = createWebSocketAuthorizerHandler({
    store,
    identityProvider: provider(identity()),
    now: () => now,
    log: (entry) => logs.push(entry)
  })
  const event = connectEvent()
  const [first, second] = await Promise.all([authorize(event), authorize(event)])
  const effects = [first, second].map((result) => result.policyDocument.Statement[0]!.Effect).sort()
  assert.deepEqual(effects, ["Allow", "Deny"])
  const allowed = [first, second].find((result) => result.policyDocument.Statement[0]!.Effect === "Allow")!
  assert.deepEqual(allowed.context, {
    userId: "user-1",
    tenantId: "tenant-1",
    sessionId: "session-1",
    tokenId: "token-1",
    tokenExpiresAtEpochMs: String(now + 60_000),
    ticketId: "ticket-id-1"
  })
  assert.equal(JSON.stringify(logs).includes(ticket), false)
})

test("authorizer rejects credential query without consuming the ticket", async () => {
  const store = new AtomicMemoryStore(record())
  const authorize = createWebSocketAuthorizerHandler({ store, identityProvider: provider(identity()), now: () => now, log: () => {} })
  const result = await authorize({ ...connectEvent(), queryStringParameters: { ticket } })
  assert.equal(result.policyDocument.Statement[0]!.Effect, "Deny")
  assert.equal(store.consumeCount, 0)
})

test("authorizer fails closed for expiry, revocation, mismatch, and provider failure", async () => {
  const cases: Array<{ name: string; record?: WebSocketTicketRecord; identityProvider: VerifiedIdentityProvider }> = [
    { name: "expired", record: record({ tokenExpiresAtEpochMs: now }), identityProvider: provider(identity()) },
    { name: "revoked", identityProvider: provider(identity({ sessionInvalidAfterEpochMs: now - 1 })) },
    { name: "tenant mismatch", identityProvider: provider(identity({ tenantId: "other" })) },
    { name: "inactive", identityProvider: provider(identity({ accountStatus: "suspended" })) },
    { name: "missing", identityProvider: provider(undefined) },
    { name: "unavailable", identityProvider: failingProvider() }
  ]
  for (const scenario of cases) {
    const authorize = createWebSocketAuthorizerHandler({
      store: new AtomicMemoryStore(scenario.record ?? record()),
      identityProvider: scenario.identityProvider,
      now: () => now,
      log: () => {}
    })
    const result = await authorize(connectEvent())
    assert.equal(result.policyDocument.Statement[0]!.Effect, "Deny", scenario.name)
  }
})

function connectEvent() {
  return {
    methodArn: "arn:aws:execute-api:ap-northeast-1:123456789012:api/prod/$connect",
    headers: { "Sec-WebSocket-Protocol": `memorag.v1, ${ticket}` },
    requestContext: { requestId: "request-1" }
  }
}

function record(overrides: Partial<WebSocketTicketRecord> = {}): WebSocketTicketRecord {
  return {
    schemaVersion: 1,
    ticketHash: "a".repeat(64),
    ticketId: "ticket-id-1",
    state: "consumed",
    userId: "user-1",
    identityUsername: "cognito-user",
    tenantId: "tenant-1",
    sessionId: "session-1",
    tokenId: "token-1",
    tokenIssuedAtEpochMs: now - 60_000,
    tokenExpiresAtEpochMs: now + 60_000,
    issuedAtEpochMs: now - 1000,
    expiresAtEpochMs: now + 59_000,
    consumedAtEpochMs: now,
    ttl: Math.ceil((now + 59_000) / 1000),
    ...overrides
  }
}

function identity(overrides: Partial<ServerManagedIdentity> = {}): ServerManagedIdentity {
  return {
    username: "cognito-user",
    userId: "user-1",
    accountStatus: "active",
    cognitoGroups: ["CHAT_USER"],
    tenantId: "tenant-1",
    ...overrides
  }
}

function provider(value: ServerManagedIdentity | undefined): VerifiedIdentityProvider {
  return {
    async getCurrentIdentity() { return value },
    async getCurrentIdentityBySubject() { return value }
  }
}

function failingProvider(): VerifiedIdentityProvider {
  return {
    async getCurrentIdentity() { throw new Error("unavailable") },
    async getCurrentIdentityBySubject() { throw new Error("unavailable") }
  }
}

class AtomicMemoryStore implements WebSocketTicketStore {
  consumeCount = 0
  private available = true
  constructor(private readonly value: WebSocketTicketRecord) {}
  async issue(): Promise<void> {}
  async consume(): Promise<WebSocketTicketRecord | undefined> {
    this.consumeCount += 1
    if (!this.available) return undefined
    this.available = false
    return structuredClone(this.value)
  }
  async revoke(): Promise<boolean> { return false }
}
