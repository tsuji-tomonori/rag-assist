import assert from "node:assert/strict"
import test from "node:test"
import type { JWTPayload } from "jose"
import { HTTPException } from "hono/http-exception"
import type {
  ServerManagedIdentity,
  VerifiedIdentityProvider
} from "./adapters/verified-identity-provider.js"
import { resolveExplicitLocalAppUser, resolveVerifiedAppUser } from "./auth.js"

test("resolveVerifiedAppUser uses server-managed subject, email, status, and tenant", async () => {
  let lookedUpUsername = ""
  const provider = providerReturning({
    username: "cognito-user",
    userId: "subject-1",
    email: "directory@example.com",
    accountStatus: "active",
    cognitoGroups: ["ANSWER_EDITOR"],
    tenantId: "server-tenant"
  }, (username) => {
    lookedUpUsername = username
  })
  const payload: JWTPayload = {
    sub: "subject-1",
    email: "request-controlled@example.com",
    "cognito:username": "cognito-user",
    "cognito:groups": ["CHAT_USER"],
    "custom:account_status": "active",
    "custom:tenant_id": "request-tenant",
    tenantId: "request-tenant"
  }

  assert.deepEqual(await resolveVerifiedAppUser(payload, {
    provider,
    tenantId: " server-tenant "
  }), {
    userId: "subject-1",
    identityUsername: "cognito-user",
    email: "directory@example.com",
    cognitoGroups: ["ANSWER_EDITOR"],
    accountStatus: "active",
    tenantId: "server-tenant"
  })
  assert.equal(lookedUpUsername, "cognito-user")
})

test("resolveVerifiedAppUser rejects missing or mismatched verified identity fields", async () => {
  const activeProvider = providerReturning(identity("subject-1"))

  await rejectsWithStatus(resolveVerifiedAppUser({ "cognito:username": "user" }, {
    provider: activeProvider,
    tenantId: "tenant-1"
  }), 401)
  await rejectsWithStatus(resolveVerifiedAppUser({ sub: "subject-1" }, {
    provider: activeProvider,
    tenantId: "tenant-1"
  }), 401)
  await rejectsWithStatus(resolveVerifiedAppUser({ sub: "subject-1", "cognito:username": "user" }, {
    provider: activeProvider,
    tenantId: ""
  }), 500)
  await rejectsWithStatus(resolveVerifiedAppUser({ sub: "subject-1", "cognito:username": "user" }, {
    tenantId: "tenant-1"
  }), 500)
  await rejectsWithStatus(resolveVerifiedAppUser({ sub: "subject-1", "cognito:username": "user" }, {
    provider: providerReturning(identity("different-subject")),
    tenantId: "tenant-1"
  }), 401)
})

test("resolveVerifiedAppUser rejects suspended and deleted accounts before the request proceeds", async () => {
  const claims = { sub: "subject-1", "cognito:username": "user" }

  await rejectsWithStatus(resolveVerifiedAppUser(claims, {
    provider: providerReturning({ ...identity("subject-1"), accountStatus: "suspended" }),
    tenantId: "tenant-1"
  }), 403)
  await rejectsWithStatus(resolveVerifiedAppUser(claims, {
    provider: providerReturning(undefined),
    tenantId: "tenant-1"
  }), 403)
})

test("resolveVerifiedAppUser rejects a JWT issued before the authoritative session revocation epoch", async () => {
  const provider = providerReturning({
    ...identity("subject-1"),
    sessionInvalidAfterEpochMs: 1_783_728_000_123
  })
  await rejectsWithStatus(resolveVerifiedAppUser({
    sub: "subject-1",
    "cognito:username": "user",
    iat: 1_783_728_000
  }, { provider, tenantId: "tenant-1" }), 401)

  const accepted = await resolveVerifiedAppUser({
    sub: "subject-1",
    "cognito:username": "user",
    iat: 1_783_728_001
  }, { provider, tenantId: "tenant-1" })
  assert.equal(accepted.userId, "subject-1")
})

test("resolveVerifiedAppUser fails closed when the identity provider is unavailable", async () => {
  const provider: VerifiedIdentityProvider = {
    async getCurrentIdentity() {
      throw new Error("Cognito unavailable")
    },
    async getCurrentIdentityBySubject() {
      throw new Error("Cognito unavailable")
    }
  }

  await rejectsWithStatus(resolveVerifiedAppUser({ sub: "subject-1", "cognito:username": "user" }, {
    provider,
    tenantId: "tenant-1"
  }), 503)
})

test("resolveExplicitLocalAppUser accepts only an explicitly configured active identity", () => {
  assert.deepEqual(resolveExplicitLocalAppUser({
    userId: " local-user ",
    email: " local@example.com ",
    cognitoGroups: ["SYSTEM_ADMIN"],
    accountStatus: "active",
    tenantId: " local-tenant "
  }), {
    userId: "local-user",
    identityUsername: "local-user",
    email: "local@example.com",
    cognitoGroups: ["SYSTEM_ADMIN"],
    accountStatus: "active",
    tenantId: "local-tenant"
  })

  assert.throws(() => resolveExplicitLocalAppUser({
    userId: "",
    cognitoGroups: [],
    accountStatus: "active",
    tenantId: "local-tenant"
  }), (error) => isHttpStatus(error, 500))
  assert.throws(() => resolveExplicitLocalAppUser({
    userId: "local-user",
    cognitoGroups: [],
    accountStatus: "",
    tenantId: "local-tenant"
  }), (error) => isHttpStatus(error, 500))
  assert.throws(() => resolveExplicitLocalAppUser({
    userId: "local-user",
    cognitoGroups: [],
    accountStatus: "active",
    tenantId: ""
  }), (error) => isHttpStatus(error, 500))
  for (const accountStatus of ["suspended", "deleted"]) {
    assert.throws(() => resolveExplicitLocalAppUser({
      userId: "local-user",
      cognitoGroups: [],
      accountStatus,
      tenantId: "local-tenant"
    }), (error) => isHttpStatus(error, 403))
  }
})

function providerReturning(
  identity: ServerManagedIdentity | undefined,
  onLookup?: (username: string) => void
): VerifiedIdentityProvider {
  return {
    async getCurrentIdentity(username) {
      onLookup?.(username)
      return identity
    },
    async getCurrentIdentityBySubject() {
      return identity
    }
  }
}

function identity(userId: string): ServerManagedIdentity {
  return {
    username: "cognito-user",
    userId,
    accountStatus: "active",
    cognitoGroups: ["CHAT_USER"],
    tenantId: "tenant-1"
  }
}

async function rejectsWithStatus(promise: Promise<unknown>, status: number): Promise<void> {
  await assert.rejects(promise, (error) => isHttpStatus(error, status))
}

function isHttpStatus(error: unknown, status: number): boolean {
  return error instanceof HTTPException && error.status === status
}
