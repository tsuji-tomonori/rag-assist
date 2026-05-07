import { createRemoteJWKSet, jwtVerify } from "jose"
import type { MiddlewareHandler } from "hono"
import { HTTPException } from "hono/http-exception"
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { config } from "./config.js"

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
const adminLedgerKey = "admin/admin-ledger.json"
const s3Client = new S3Client({})

type LedgerUser = { userId: string; status: "active" | "suspended" | "deleted"; groups: string[] }
type AdminLedger = { users: LedgerUser[] }

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

  const tokenGroups = Array.isArray(payload["cognito:groups"]) ? payload["cognito:groups"].map(String) : []
  const userId = String(payload.sub)
  const effective = await resolveManagedUser(userId, tokenGroups)
  if (effective.status && effective.status !== "active") {
    throw new HTTPException(403, { message: "Forbidden: account is not active" })
  }

  c.set("user", {
    userId: String(payload.sub),
    email: payload.email ? String(payload.email) : undefined,
    cognitoGroups: effective.groups
  } as AppUser)

  await next()
}

async function resolveManagedUser(userId: string, tokenGroups: string[]): Promise<{ groups: string[]; status?: LedgerUser["status"] }> {
  try {
    const response = await s3Client.send(new GetObjectCommand({ Bucket: config.storageBucket, Key: adminLedgerKey }))
    const body = await response.Body?.transformToString()
    if (!body) return { groups: tokenGroups }
    const ledger = JSON.parse(body) as AdminLedger
    const managed = ledger.users.find((candidate) => candidate.userId === userId)
    if (!managed) return { groups: tokenGroups }
    return { groups: managed.groups, status: managed.status }
  } catch {
    return { groups: tokenGroups }
  }
}

declare module "hono" {
  interface ContextVariableMap {
    user: AppUser
  }
}
