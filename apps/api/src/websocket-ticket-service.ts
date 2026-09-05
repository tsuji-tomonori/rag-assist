import { createHash, randomBytes, randomUUID } from "node:crypto"
import type { AppAuthSession, AppUser } from "./auth.js"
import {
  WEB_SOCKET_TICKET_SCHEMA_VERSION,
  type WebSocketTicketRecord,
  type WebSocketTicketStore
} from "./adapters/websocket-ticket-store.js"

export const WEB_SOCKET_PROTOCOL = "memorag.v1"
export const WEB_SOCKET_TICKET_PREFIX = "memorag-ticket."
export const WEB_SOCKET_TICKET_TTL_MS = 60_000
const ticketPattern = /^memorag-ticket\.[A-Za-z0-9_-]{43}$/

export type IssuedWebSocketTicket = {
  ticket: string
  protocol: typeof WEB_SOCKET_PROTOCOL
  expiresAt: string
}

export class WebSocketTicketService {
  constructor(
    private readonly store: WebSocketTicketStore,
    private readonly now: () => number = Date.now,
    private readonly createSecret: () => Buffer = () => randomBytes(32),
    private readonly createTicketId: () => string = randomUUID
  ) {}

  async issue(user: AppUser, session: AppAuthSession): Promise<IssuedWebSocketTicket> {
    const identityUsername = user.identityUsername?.trim()
    const tenantId = user.tenantId?.trim()
    validateBinding(user.userId, identityUsername, tenantId, session)

    const issuedAtEpochMs = this.now()
    if (!Number.isSafeInteger(issuedAtEpochMs) || issuedAtEpochMs < 0) throw new Error("WebSocket ticket clock is invalid")
    if (session.expiresAtEpochMs <= issuedAtEpochMs) throw new Error("Authenticated session has expired")
    const expiresAtEpochMs = Math.min(issuedAtEpochMs + WEB_SOCKET_TICKET_TTL_MS, session.expiresAtEpochMs)
    if (expiresAtEpochMs <= issuedAtEpochMs) throw new Error("Authenticated session is too close to expiry")

    const ticket = `${WEB_SOCKET_TICKET_PREFIX}${this.createSecret().toString("base64url")}`
    if (!isWebSocketTicketProtocol(ticket)) throw new Error("WebSocket ticket entropy source is invalid")
    const record: WebSocketTicketRecord = {
      schemaVersion: WEB_SOCKET_TICKET_SCHEMA_VERSION,
      ticketHash: hashWebSocketTicket(ticket),
      ticketId: this.createTicketId(),
      state: "issued",
      userId: user.userId,
      identityUsername: identityUsername!,
      tenantId: tenantId!,
      sessionId: session.sessionId,
      tokenId: session.tokenId,
      tokenIssuedAtEpochMs: session.issuedAtEpochMs,
      tokenExpiresAtEpochMs: session.expiresAtEpochMs,
      issuedAtEpochMs,
      expiresAtEpochMs,
      ttl: Math.ceil(expiresAtEpochMs / 1000)
    }
    await this.store.issue(record)
    return {
      ticket,
      protocol: WEB_SOCKET_PROTOCOL,
      expiresAt: new Date(expiresAtEpochMs).toISOString()
    }
  }
}

export function hashWebSocketTicket(ticket: string): string {
  if (!isWebSocketTicketProtocol(ticket)) throw new Error("WebSocket ticket is malformed")
  return createHash("sha256").update(ticket, "utf8").digest("hex")
}

export function isWebSocketTicketProtocol(value: string): boolean {
  return ticketPattern.test(value)
}

export function parseWebSocketSubprotocolHeader(value: string | undefined): { ticket: string } | undefined {
  if (!value) return undefined
  const protocols = value.split(",").map((item) => item.trim()).filter(Boolean)
  if (protocols.length !== 2 || protocols[0] === protocols[1]) return undefined
  if (!protocols.includes(WEB_SOCKET_PROTOCOL)) return undefined
  const tickets = protocols.filter(isWebSocketTicketProtocol)
  return tickets.length === 1 ? { ticket: tickets[0]! } : undefined
}

function validateBinding(
  userId: string,
  identityUsername: string | undefined,
  tenantId: string | undefined,
  session: AppAuthSession
): void {
  for (const value of [userId, identityUsername, tenantId, session.sessionId, session.tokenId]) {
    if (!value || value.trim() !== value) throw new Error("WebSocket ticket identity binding is incomplete")
  }
  if (
    !Number.isSafeInteger(session.issuedAtEpochMs)
    || !Number.isSafeInteger(session.expiresAtEpochMs)
    || session.issuedAtEpochMs < 0
    || session.expiresAtEpochMs <= session.issuedAtEpochMs
  ) throw new Error("WebSocket ticket session binding is invalid")
}
