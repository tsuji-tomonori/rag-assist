import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose"
import type { MiddlewareHandler } from "hono"
import { HTTPException } from "hono/http-exception"
import type {
  AccountStatus,
  VerifiedIdentityProvider
} from "./adapters/verified-identity-provider.js"
import type { AppEnv } from "./app-env.js"
import { config } from "./config.js"

export type AppUser = {
  userId: string
  identityUsername?: string
  email?: string
  cognitoGroups: string[]
  accountStatus?: AccountStatus
  tenantId?: string
}

export type AppAuthSession = {
  sessionId: string
  tokenId: string
  issuedAtEpochMs: number
  expiresAtEpochMs: number
}

const cognitoRegion = config.cognitoRegion
const cognitoUserPoolId = config.cognitoUserPoolId
const cognitoAppClientId = config.cognitoAppClientId
let verifiedIdentityProvider: VerifiedIdentityProvider | undefined

const jwks =
  cognitoRegion && cognitoUserPoolId
    ? createRemoteJWKSet(new URL(`https://cognito-idp.${cognitoRegion}.amazonaws.com/${cognitoUserPoolId}/.well-known/jwks.json`))
    : null

export function configureVerifiedIdentityProvider(provider: VerifiedIdentityProvider | undefined): void {
  verifiedIdentityProvider = provider
}

export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!config.authEnabled) {
    const user = resolveExplicitLocalAppUser({
      userId: config.localAuthUserId,
      email: config.localAuthEmail,
      cognitoGroups: config.localAuthGroups,
      accountStatus: config.localAuthAccountStatus,
      tenantId: config.localAuthTenantId
    })
    c.set("user", user)
    c.set("authSession", resolveExplicitLocalAuthSession(user.userId))
    return next()
  }

  const authorization = c.req.header("Authorization")
  if (!authorization?.startsWith("Bearer ")) throw new HTTPException(401, { message: "Unauthorized" })
  if (!jwks || !cognitoAppClientId || !cognitoRegion || !cognitoUserPoolId) {
    throw new HTTPException(500, { message: "Auth is not configured" })
  }

  const token = authorization.replace("Bearer ", "")
  const issuer = `https://cognito-idp.${cognitoRegion}.amazonaws.com/${cognitoUserPoolId}`

  let payload
  try {
    ;({ payload } = await jwtVerify(token, jwks, { issuer, audience: cognitoAppClientId }))
  } catch {
    throw new HTTPException(401, { message: "Unauthorized" })
  }

  const authSession = resolveVerifiedAuthSession(payload)
  c.set("user", await resolveVerifiedAppUser(payload, {
    provider: verifiedIdentityProvider,
    tenantId: config.authTenantId
  }))
  c.set("authSession", authSession)

  await next()
}

export function resolveVerifiedAuthSession(payload: JWTPayload): AppAuthSession {
  const sessionId = nonEmptyString(payload.origin_jti)
  const tokenId = nonEmptyString(payload.jti)
  const issuedAtEpochMs = epochSecondsToMs(payload.iat)
  const expiresAtEpochMs = epochSecondsToMs(payload.exp)
  if (!sessionId || !tokenId || issuedAtEpochMs === undefined || expiresAtEpochMs === undefined) {
    throw new HTTPException(401, { message: "Unauthorized" })
  }
  if (expiresAtEpochMs <= issuedAtEpochMs) throw new HTTPException(401, { message: "Unauthorized" })
  return { sessionId, tokenId, issuedAtEpochMs, expiresAtEpochMs }
}

export function resolveExplicitLocalAuthSession(userId: string): AppAuthSession {
  const canonicalUserId = userId.trim()
  if (!canonicalUserId) throw new HTTPException(500, { message: "Local auth identity is not configured" })
  return {
    sessionId: `local-session:${canonicalUserId}`,
    tokenId: `local-token:${canonicalUserId}`,
    issuedAtEpochMs: 0,
    expiresAtEpochMs: Number.MAX_SAFE_INTEGER
  }
}

export async function resolveVerifiedAppUser(
  payload: JWTPayload,
  options: { provider?: VerifiedIdentityProvider; tenantId: string }
): Promise<AppUser> {
  const subject = nonEmptyString(payload.sub)
  const username = nonEmptyString(payload["cognito:username"] ?? payload.username)
  const tenantId = options.tenantId.trim()
  if (!subject || !username) throw new HTTPException(401, { message: "Unauthorized" })
  if (!tenantId || !options.provider) throw new HTTPException(500, { message: "Auth is not configured" })

  let identity
  try {
    identity = await options.provider.getCurrentIdentity(username)
  } catch {
    throw new HTTPException(503, { message: "Identity verification unavailable" })
  }

  if (!identity) throw new HTTPException(403, { message: "Forbidden" })
  if (identity.userId !== subject) throw new HTTPException(401, { message: "Unauthorized" })
  if (identity.accountStatus !== "active") throw new HTTPException(403, { message: "Forbidden" })
  if (identity.tenantId !== tenantId) throw new HTTPException(403, { message: "Forbidden" })
  if (
    identity.sessionInvalidAfterEpochMs !== undefined &&
    (typeof payload.iat !== "number" || payload.iat * 1000 <= identity.sessionInvalidAfterEpochMs)
  ) throw new HTTPException(401, { message: "Unauthorized" })

  return {
    userId: identity.userId,
    identityUsername: identity.username,
    email: identity.email,
    cognitoGroups: [...identity.cognitoGroups],
    accountStatus: identity.accountStatus,
    tenantId
  }
}

export function resolveExplicitLocalAppUser(input: {
  userId: string
  email?: string
  cognitoGroups: readonly string[]
  accountStatus: string
  tenantId: string
}): AppUser {
  const userId = input.userId.trim()
  const tenantId = input.tenantId.trim()
  const accountStatus = parseExplicitAccountStatus(input.accountStatus)
  if (!userId || !tenantId || !accountStatus) {
    throw new HTTPException(500, { message: "Local auth identity is not configured" })
  }
  if (accountStatus !== "active") throw new HTTPException(403, { message: "Forbidden" })

  const email = input.email?.trim()
  return {
    userId,
    identityUsername: userId,
    email: email || undefined,
    cognitoGroups: [...input.cognitoGroups],
    accountStatus,
    tenantId
  }
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const normalized = value.trim()
  return normalized || undefined
}

function epochSecondsToMs(value: unknown): number | undefined {
  if (!Number.isSafeInteger(value) || (value as number) < 0) return undefined
  const epochMs = (value as number) * 1000
  return Number.isSafeInteger(epochMs) ? epochMs : undefined
}

function parseExplicitAccountStatus(value: string): AccountStatus | undefined {
  if (value === "active" || value === "suspended" || value === "deleted") return value
  return undefined
}

declare module "hono" {
  interface ContextVariableMap {
    authSession: AppAuthSession
    user: AppUser
  }
}
