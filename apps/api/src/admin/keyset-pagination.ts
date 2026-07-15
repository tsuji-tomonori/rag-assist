export type PageMetadata = {
  total: number
  nextCursor?: string
  truncated: boolean
  source: string
  asOf: string
  version?: string
}

type CursorPayload = {
  schemaVersion: 1
  sort: string
  values: string[]
}

export function pageByStableCursor<T>({
  items,
  limit,
  cursor,
  sort,
  cursorValues,
  isAfter
}: {
  items: T[]
  limit: number
  cursor?: string
  sort: string
  cursorValues: (item: T) => string[]
  isAfter: (item: T, values: string[]) => boolean
}): { items: T[]; nextCursor?: string; total: number; truncated: boolean } {
  const decoded = cursor ? decodePageCursor(cursor, sort) : undefined
  const remaining = decoded ? items.filter((item) => isAfter(item, decoded.values)) : items
  const page = remaining.slice(0, limit)
  const truncated = remaining.length > page.length
  const last = page.at(-1)
  return {
    items: page,
    nextCursor: truncated && last ? encodePageCursor(sort, cursorValues(last)) : undefined,
    total: items.length,
    truncated
  }
}

export function encodePageCursor(sort: string, values: string[]): string {
  const payload: CursorPayload = { schemaVersion: 1, sort, values }
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
}

export function decodePageCursor(cursor: string, expectedSort: string): CursorPayload {
  try {
    const payload = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<CursorPayload>
    if (
      payload.schemaVersion !== 1 ||
      payload.sort !== expectedSort ||
      !Array.isArray(payload.values) ||
      payload.values.length === 0 ||
      payload.values.some((value) => typeof value !== "string" || value.length === 0)
    ) throw new Error("invalid")
    return payload as CursorPayload
  } catch {
    throw new InvalidPageCursorError()
  }
}

export class InvalidPageCursorError extends Error {
  constructor() {
    super("Invalid or stale page cursor")
    this.name = "InvalidPageCursorError"
  }
}
