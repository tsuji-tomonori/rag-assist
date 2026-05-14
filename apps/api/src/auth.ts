import { createRemoteJWKSet, jwtVerify } from "jose"
import type { MiddlewareHandler } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "./app-env.js"
import { config } from "./config.js"

export type AppUser = {
  userId: string
  email?: string
  cognitoGroups: string[]
  accountStatus?: "active" | "suspended" | "deleted"
}

const cognitoRegion = config.cognitoRegion
const cognitoUserPoolId = config.cognitoUserPoolId
const cognitoAppClientId = config.cognitoAppClientId
const localAuthGroups = process.env.LOCAL_AUTH_GROUPS?.split(",").map((group) => group.trim()).filter(Boolean)

const jwks =
  cognitoRegion && cognitoUserPoolId
    ? createRemoteJWKSet(new URL(`https://cognito-idp.${cognitoRegion}.amazonaws.com/${cognitoUserPoolId}/.well-known/jwks.json`))
    : null

export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!config.authEnabled) {
    c.set("user", {
      userId: process.env.LOCAL_AUTH_USER_ID ?? "local-dev",
      email: process.env.LOCAL_AUTH_EMAIL ?? "local-dev@example.com",
      cognitoGroups: localAuthGroups && localAuthGroups.length > 0 ? localAuthGroups : ["SYSTEM_ADMIN"],
      accountStatus: "active"
    } as AppUser)
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

  c.set("user", {
    userId: String(payload.sub),
    email: payload.email ? String(payload.email) : undefined,
    cognitoGroups: Array.isArray(payload["cognito:groups"]) ? payload["cognito:groups"].map(String) : [],
    accountStatus: parseAccountStatus(payload["custom:account_status"])
  } as AppUser)

  await next()
}

function parseAccountStatus(value: unknown): AppUser["accountStatus"] {
  if (value === "suspended" || value === "deleted") return value
  return "active"
}

declare module "hono" {
  interface ContextVariableMap {
    user: AppUser
  }
}
