export const WEB_SOCKET_TICKET_SCHEMA_VERSION = 1 as const

export type WebSocketTicketRecord = {
  schemaVersion: typeof WEB_SOCKET_TICKET_SCHEMA_VERSION
  ticketHash: string
  ticketId: string
  state: "issued" | "consumed" | "revoked"
  userId: string
  identityUsername: string
  tenantId: string
  sessionId: string
  tokenId: string
  tokenIssuedAtEpochMs: number
  tokenExpiresAtEpochMs: number
  issuedAtEpochMs: number
  expiresAtEpochMs: number
  consumedAtEpochMs?: number
  revokedAtEpochMs?: number
  ttl: number
}

export interface WebSocketTicketStore {
  issue(record: WebSocketTicketRecord): Promise<void>
  consume(ticketHash: string, consumedAtEpochMs: number): Promise<WebSocketTicketRecord | undefined>
  revoke(ticketHash: string, revokedAtEpochMs: number): Promise<boolean>
}
