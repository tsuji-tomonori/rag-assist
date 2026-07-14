import { HTTPException } from "hono/http-exception"
import type { JsonValue } from "../types.js"

export const RESOURCE_NON_ENUMERATION_PROFILE_VERSION = "resource-non-enumeration-v1" as const
export const RESOURCE_NON_ENUMERATION_MINIMUM_DELAY_MS = 50

export const RESOURCE_UNAVAILABLE_BODY = Object.freeze({
  error: "Resource unavailable",
  code: "RESOURCE_UNAVAILABLE",
  responseProfileVersion: RESOURCE_NON_ENUMERATION_PROFILE_VERSION
})

export const RESOURCE_UNAVAILABLE_HEADERS = Object.freeze({
  "cache-control": "no-store",
  "x-resource-response-profile": RESOURCE_NON_ENUMERATION_PROFILE_VERSION
})

export class ResourceUnavailableError extends HTTPException {
  readonly responseProfileVersion = RESOURCE_NON_ENUMERATION_PROFILE_VERSION

  constructor() {
    super(404, { message: RESOURCE_UNAVAILABLE_BODY.error })
    this.name = "ResourceUnavailableError"
  }
}

export function publicResourceUnavailable(): {
  status: 404
  headers: typeof RESOURCE_UNAVAILABLE_HEADERS
  body: typeof RESOURCE_UNAVAILABLE_BODY
} {
  return {
    status: 404,
    headers: RESOURCE_UNAVAILABLE_HEADERS,
    body: RESOURCE_UNAVAILABLE_BODY
  }
}

/** Lower-bound timing class shared by absent and unauthorized resource paths. */
export async function settleNonEnumerationTiming(startedAtMs: number, minimumDelayMs = RESOURCE_NON_ENUMERATION_MINIMUM_DELAY_MS): Promise<void> {
  const remaining = Math.max(0, minimumDelayMs - (Date.now() - startedAtMs))
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
}

export type AuthorizedCollectionPage<T> = {
  items: T[]
  count: number
  nextCursor?: string
  responseProfileVersion: typeof RESOURCE_NON_ENUMERATION_PROFILE_VERSION
}

/**
 * Applies filtering before slicing/counting, so pagination metadata cannot
 * reveal candidates that the current actor may not read.
 */
export function authorizedOnlyPage<T, U>(input: {
  candidates: readonly T[]
  authorized: (candidate: T) => boolean
  project: (candidate: T) => U
  offset?: number
  limit: number
}): AuthorizedCollectionPage<U> {
  const authorized = input.candidates.filter(input.authorized)
  const offset = Math.max(0, input.offset ?? 0)
  const limit = Math.max(1, input.limit)
  const page = authorized.slice(offset, offset + limit)
  const nextOffset = offset + page.length
  return {
    items: page.map(input.project),
    count: page.length,
    nextCursor: nextOffset < authorized.length ? Buffer.from(String(nextOffset)).toString("base64url") : undefined,
    responseProfileVersion: RESOURCE_NON_ENUMERATION_PROFILE_VERSION
  }
}

const READER_METADATA_KEYS = new Set([
  "source",
  "docType",
  "department",
  "drawingSourceType",
  "pageOrSheet",
  "drawingNo",
  "sheetTitle",
  "scale",
  "sourceType",
  "groupId",
  "groupIds"
])

const BENCHMARK_METADATA_KEYS = new Set([...READER_METADATA_KEYS, "benchmarkSuiteId"])

export function sanitizeAuthorizedResourceMetadata(
  metadata: Record<string, JsonValue> | undefined,
  audience: "reader" | "benchmark" = "reader"
): Record<string, JsonValue> | undefined {
  if (!metadata) return undefined
  const allowed = audience === "benchmark" ? BENCHMARK_METADATA_KEYS : READER_METADATA_KEYS
  const result: Record<string, JsonValue> = {}
  for (const key of allowed) {
    const value = metadata[key]
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) result[key] = value
    if ((key === "groupIds") && Array.isArray(value) && value.every((item) => typeof item === "string")) result[key] = value
  }
  return Object.keys(result).length > 0 ? result : undefined
}

export function minimizedRevokedWorkerResult(): {
  status: "permission_revoked"
  responseProfileVersion: typeof RESOURCE_NON_ENUMERATION_PROFILE_VERSION
} {
  return { status: "permission_revoked", responseProfileVersion: RESOURCE_NON_ENUMERATION_PROFILE_VERSION }
}
