import {
  DynamoDbWebSocketConnectionStore,
  type WebSocketConnectionStore
} from "./adapters/dynamodb-websocket-connection-store.js"
import { config } from "./config.js"
import { WEB_SOCKET_PROTOCOL, parseWebSocketSubprotocolHeader } from "./websocket-ticket-service.js"

type WebSocketLifecycleEvent = {
  headers?: Record<string, string | undefined> | null
  requestContext?: {
    authorizer?: Record<string, unknown>
    connectionId?: string
    eventType?: string
    requestId?: string
    routeKey?: string
  }
}

type WebSocketLifecycleResponse = {
  statusCode: number
  headers?: Record<string, string>
}

type SafeLifecycleLog = (entry: Readonly<{
  component: "websocket-lifecycle"
  outcome: "connected" | "disconnected" | "rejected"
  reason: string
  requestId?: string
  connectionId?: string
  routeKey?: string
  ticketId?: string
}>) => void

export function createWebSocketConnectionHandler(options: {
  store: WebSocketConnectionStore
  now?: () => number
  log?: SafeLifecycleLog
}) {
  const now = options.now ?? Date.now
  const log: SafeLifecycleLog = options.log ?? ((entry) => console.info(JSON.stringify(entry)))
  return async (event: WebSocketLifecycleEvent): Promise<WebSocketLifecycleResponse> => {
    const requestId = canonicalOptional(event.requestContext?.requestId)
    const connectionId = canonicalOptional(event.requestContext?.connectionId)
    const routeKey = canonicalOptional(event.requestContext?.routeKey)
    const eventType = event.requestContext?.eventType
    if (eventType === "DISCONNECT") {
      if (!connectionId) return reject(log, { requestId, routeKey }, "connection_context_invalid")
      try {
        await options.store.disconnect(connectionId)
        log({ component: "websocket-lifecycle", outcome: "disconnected", reason: "disconnect", requestId, connectionId, routeKey })
        return { statusCode: 200 }
      } catch {
        return reject(log, { requestId, connectionId, routeKey }, "disconnect_store_unavailable")
      }
    }
    if (eventType !== "CONNECT") return reject(log, { requestId, connectionId, routeKey }, "unsupported_message")

    const protocol = parseWebSocketSubprotocolHeader(header(event.headers, "sec-websocket-protocol"))
    const authorizer = event.requestContext?.authorizer
    const userId = contextString(authorizer, "userId")
    const tenantId = contextString(authorizer, "tenantId")
    const sessionId = contextString(authorizer, "sessionId")
    const tokenId = contextString(authorizer, "tokenId")
    const ticketId = contextString(authorizer, "ticketId")
    const expiresAtEpochMs = contextEpoch(authorizer, "tokenExpiresAtEpochMs")
    const connectedAtEpochMs = now()
    if (
      !connectionId || !protocol || !userId || !tenantId || !sessionId || !tokenId || !ticketId
      || expiresAtEpochMs === undefined || !Number.isSafeInteger(connectedAtEpochMs)
      || connectedAtEpochMs < 0 || expiresAtEpochMs <= connectedAtEpochMs
    ) return reject(log, { requestId, connectionId, routeKey, ticketId }, "connect_context_invalid")

    try {
      await options.store.connect({
        schemaVersion: 1,
        connectionId,
        userId,
        tenantId,
        sessionId,
        tokenId,
        ticketId,
        connectedAtEpochMs,
        expiresAtEpochMs,
        ttl: Math.ceil(expiresAtEpochMs / 1000)
      })
      log({ component: "websocket-lifecycle", outcome: "connected", reason: "connect", requestId, connectionId, routeKey, ticketId })
      return { statusCode: 200, headers: { "Sec-WebSocket-Protocol": WEB_SOCKET_PROTOCOL } }
    } catch {
      return reject(log, { requestId, connectionId, routeKey, ticketId }, "connect_store_unavailable")
    }
  }
}

let defaultHandler: ReturnType<typeof createWebSocketConnectionHandler> | undefined

export async function handler(event: WebSocketLifecycleEvent): Promise<WebSocketLifecycleResponse> {
  defaultHandler ??= createWebSocketConnectionHandler({
    store: new DynamoDbWebSocketConnectionStore(config.webSocketConnectionsTableName)
  })
  return defaultHandler(event)
}

function reject(
  log: SafeLifecycleLog,
  context: { requestId?: string; connectionId?: string; routeKey?: string; ticketId?: string },
  reason: string
): WebSocketLifecycleResponse {
  log({ component: "websocket-lifecycle", outcome: "rejected", reason, ...context })
  return { statusCode: 400 }
}

function header(headers: WebSocketLifecycleEvent["headers"], name: string): string | undefined {
  if (!headers) return undefined
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name)
  return canonicalOptional(entry?.[1])
}

function contextString(context: Record<string, unknown> | undefined, key: string): string | undefined {
  return canonicalOptional(typeof context?.[key] === "string" ? context[key] as string : undefined)
}

function contextEpoch(context: Record<string, unknown> | undefined, key: string): number | undefined {
  const raw = contextString(context, key)
  if (!raw) return undefined
  const value = Number(raw)
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

function canonicalOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized || undefined
}
