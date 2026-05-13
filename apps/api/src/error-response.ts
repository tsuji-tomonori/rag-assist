import type { Context } from "hono"

export type SafeUnhandledErrorResponse = {
  status: 400 | 401 | 403 | 404 | 409 | 429 | 500
  body: { error: string }
}

const safeClientStatuses = new Set([400, 401, 403, 404, 409, 429])

export function safeUnhandledErrorResponse(err: unknown): SafeUnhandledErrorResponse {
  const status = statusFromError(err)
  if (status && safeClientStatuses.has(status)) {
    return { status: status as SafeUnhandledErrorResponse["status"], body: { error: "Request failed" } }
  }
  return { status: 500, body: { error: "Internal server error" } }
}

export function logUnhandledApiError(err: unknown, c: Context): void {
  console.error("Unhandled API error", {
    method: c.req.method,
    path: c.req.path,
    error: err
  })
}

function statusFromError(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null || !("status" in err)) return undefined
  const status = Number((err as { status?: unknown }).status)
  if (!Number.isInteger(status) || status < 400 || status > 599) return undefined
  return status
}
