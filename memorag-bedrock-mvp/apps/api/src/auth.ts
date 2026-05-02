import { createRemoteJWKSet, jwtVerify } from "jose"
import type { MiddlewareHandler } from "hono"
import { HTTPException } from "hono/http-exception"

export type AppUser = {
  userId: string
  email?: string
  cognitoGroups: string[]
}

const cognitoRegion = process.env.COGNITO_REGION
const cognitoUserPoolId = process.env.COGNITO_USER_POOL_ID
const cognitoAppClientId = process.env.COGNITO_APP_CLIENT_ID
const authEnabled = process.env.AUTH_ENABLED === "true"
const localAuthGroups = process.env.LOCAL_AUTH_GROUPS?.split(",").map((group) => group.trim()).filter(Boolean)

const jwks =
  cognitoRegion && cognitoUserPoolId
    ? createRemoteJWKSet(new URL(`https://cognito-idp.${cognitoRegion}.amazonaws.com/${cognitoUserPoolId}/.well-known/jwks.json`))
    : null

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  if (!authEnabled) {
    c.set("user", {
      userId: process.env.LOCAL_AUTH_USER_ID ?? "local-dev",
      email: process.env.LOCAL_AUTH_EMAIL ?? "local-dev@example.com",
      cognitoGroups: localAuthGroups && localAuthGroups.length > 0 ? localAuthGroups : ["SYSTEM_ADMIN"]
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
    cognitoGroups: Array.isArray(payload["cognito:groups"]) ? payload["cognito:groups"].map(String) : []
  } as AppUser)

  await next()
}

declare module "hono" {
  interface ContextVariableMap {
    user: AppUser
  }
}
