import type { APIGatewayAuthorizerResult } from "aws-lambda"
import type { VerifiedIdentityProvider } from "./adapters/verified-identity-provider.js"
import { CognitoVerifiedIdentityProvider } from "./adapters/verified-identity-provider.js"
import { DynamoDbWebSocketTicketStore } from "./adapters/dynamodb-websocket-ticket-store.js"
import type { WebSocketTicketRecord, WebSocketTicketStore } from "./adapters/websocket-ticket-store.js"
import { S3ObjectStore } from "./adapters/s3-object-store.js"
import { config } from "./config.js"
import { ObjectStoreAccountRevocationRegistry, RevocationAwareVerifiedIdentityProvider } from "./security/account-revocation-registry.js"
import { ObjectStoreAdministrativePrincipalTransferFence } from "./security/administrative-principal-transfer-fence.js"
import { hashWebSocketTicket, parseWebSocketSubprotocolHeader } from "./websocket-ticket-service.js"

type WebSocketAuthorizerEvent = {
  methodArn?: string
  headers?: Record<string, string | undefined> | null
  queryStringParameters?: Record<string, string | undefined> | null
  requestContext?: { requestId?: string }
}

type SafeLog = (entry: Readonly<{
  component: "websocket-authorizer"
  outcome: "allow" | "deny"
  reason: string
  requestId?: string
  ticketId?: string
}>) => void

export function createWebSocketAuthorizerHandler(options: {
  store: WebSocketTicketStore
  identityProvider: VerifiedIdentityProvider
  now?: () => number
  log?: SafeLog
}) {
  const now = options.now ?? Date.now
  const log: SafeLog = options.log ?? ((entry) => console.info(JSON.stringify(entry)))
  return async (event: WebSocketAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
    const requestId = canonicalOptional(event.requestContext?.requestId)
    const methodArn = canonicalOptional(event.methodArn) ?? "*"
    let ticketId: string | undefined
    try {
      if (containsCredentialQuery(event.queryStringParameters)) throw new WebSocketAuthorizationDenied("credential_query")
      const parsed = parseWebSocketSubprotocolHeader(header(event.headers, "sec-websocket-protocol"))
      if (!parsed) throw new WebSocketAuthorizationDenied("protocol_invalid")
      const consumedAtEpochMs = now()
      if (!Number.isSafeInteger(consumedAtEpochMs) || consumedAtEpochMs < 0) throw new Error("clock_invalid")
      const record = await options.store.consume(hashWebSocketTicket(parsed.ticket), consumedAtEpochMs)
      if (!record) throw new WebSocketAuthorizationDenied("ticket_unavailable")
      ticketId = record.ticketId
      const identity = await options.identityProvider.getCurrentIdentity(record.identityUsername)
      assertCurrentBinding(record, identity, consumedAtEpochMs)
      log({ component: "websocket-authorizer", outcome: "allow", reason: "ticket_consumed", requestId, ticketId })
      return policy(record.userId, "Allow", methodArn, {
        userId: record.userId,
        tenantId: record.tenantId,
        sessionId: record.sessionId,
        tokenId: record.tokenId,
        tokenExpiresAtEpochMs: String(record.tokenExpiresAtEpochMs),
        ticketId: record.ticketId
      })
    } catch (error) {
      const reason = error instanceof WebSocketAuthorizationDenied ? error.reason : "dependency_unavailable"
      log({ component: "websocket-authorizer", outcome: "deny", reason, requestId, ticketId })
      return policy("unauthorized", "Deny", methodArn)
    }
  }
}

let defaultHandler: ReturnType<typeof createWebSocketAuthorizerHandler> | undefined

export async function handler(event: WebSocketAuthorizerEvent): Promise<APIGatewayAuthorizerResult> {
  defaultHandler ??= createWebSocketAuthorizerHandler({
    store: new DynamoDbWebSocketTicketStore(config.webSocketTicketsTableName),
    identityProvider: createRevocationAwareIdentityProvider()
  })
  return defaultHandler(event)
}

function createRevocationAwareIdentityProvider(): VerifiedIdentityProvider {
  const objectStore = new S3ObjectStore(config.docsBucketName)
  return new RevocationAwareVerifiedIdentityProvider(
    new CognitoVerifiedIdentityProvider(),
    new ObjectStoreAccountRevocationRegistry(objectStore),
    new ObjectStoreAdministrativePrincipalTransferFence(objectStore)
  )
}

function assertCurrentBinding(
  record: WebSocketTicketRecord,
  identity: Awaited<ReturnType<VerifiedIdentityProvider["getCurrentIdentity"]>>,
  nowEpochMs: number
): void {
  if (!identity) throw new WebSocketAuthorizationDenied("identity_missing")
  if (identity.accountStatus !== "active") throw new WebSocketAuthorizationDenied("identity_inactive")
  if (
    identity.userId !== record.userId
    || identity.username !== record.identityUsername
    || identity.tenantId !== record.tenantId
  ) throw new WebSocketAuthorizationDenied("identity_mismatch")
  if (record.tokenExpiresAtEpochMs <= nowEpochMs) throw new WebSocketAuthorizationDenied("session_expired")
  if (
    identity.sessionInvalidAfterEpochMs !== undefined
    && record.tokenIssuedAtEpochMs <= identity.sessionInvalidAfterEpochMs
  ) throw new WebSocketAuthorizationDenied("session_revoked")
}

function policy(
  principalId: string,
  effect: "Allow" | "Deny",
  resource: string,
  context?: Record<string, string>
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [{ Action: "execute-api:Invoke", Effect: effect, Resource: resource }]
    },
    ...(context ? { context } : {})
  }
}

function header(headers: WebSocketAuthorizerEvent["headers"], name: string): string | undefined {
  if (!headers) return undefined
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name)
  return canonicalOptional(entry?.[1])
}

function containsCredentialQuery(query: WebSocketAuthorizerEvent["queryStringParameters"]): boolean {
  if (!query) return false
  return Object.keys(query).some((key) => ["ticket", "token", "authorization", "jwt"].includes(key.toLowerCase()))
}

function canonicalOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized || undefined
}

class WebSocketAuthorizationDenied extends Error {
  constructor(readonly reason: string) {
    super("WebSocket authorization denied")
  }
}
