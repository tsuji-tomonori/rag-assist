import assert from "node:assert/strict"
import test from "node:test"
import type { ServerManagedIdentity, VerifiedIdentityProvider } from "../adapters/verified-identity-provider.js"
import type { WorkerTargetType } from "../types.js"
import {
  CurrentWorkerAuthorization,
  PermissionRevokedError,
  runCurrentAuthorizedWorkerPhases,
  type WorkerAuthorizationBoundary
} from "./current-worker-authorization.js"

const targetPermission = {
  chat_run: "chat:create",
  document_ingest_run: "rag:doc:write:group",
  benchmark_run: "benchmark:run",
  async_agent_run: "agent:read:self"
} as const

for (const targetType of Object.keys(targetPermission) as WorkerTargetType[]) {
  for (const revokedAt of ["start", "protected_read", "external_side_effect", "durable_commit"] as const) {
    test(`${targetType} denies at ${revokedAt} and performs no later protected phase`, async () => {
      const phaseOrder: WorkerAuthorizationBoundary[] = ["start", "protected_read", "external_side_effect", "durable_commit"]
      const performed: string[] = []
      let providerCalls = 0
      const provider = mutableProvider(() => {
        const boundary = phaseOrder[providerCalls++]
        return currentIdentity({
          cognitoGroups: boundary === revokedAt ? [] : rolesFor(targetType)
        })
      })
      const guard = new CurrentWorkerAuthorization(provider)
      const authorize = (boundary: WorkerAuthorizationBoundary) => guard.assertAuthorized({
        runId: `run-${targetType}`,
        targetType,
        subject: "subject-1",
        tenantId: "tenant-1",
        requiredPermissions: [targetPermission[targetType]],
        authorizeResource: () => true
      }, boundary)

      await assert.rejects(runCurrentAuthorizedWorkerPhases({
        authorize,
        protectedRead: async () => { performed.push("protected_read"); return "read" },
        externalSideEffect: async () => { performed.push("external_side_effect"); return "effect" },
        durableCommit: async () => { performed.push("durable_commit"); return "done" }
      }), (error) => error instanceof PermissionRevokedError && error.message === "permission_revoked")

      const revokedIndex = phaseOrder.indexOf(revokedAt)
      assert.deepEqual(performed, phaseOrder.slice(1, revokedIndex).map(String))
    })
  }
}

test("resource grant removal is re-read at every boundary", async () => {
  let resourceAllowed = true
  const guard = new CurrentWorkerAuthorization(mutableProvider(() => currentIdentity()))
  const request = {
    runId: "run-chat",
    targetType: "chat_run" as const,
    subject: "subject-1",
    tenantId: "tenant-1",
    requiredPermissions: ["chat:create"] as const,
    authorizeResource: () => resourceAllowed
  }

  await guard.assertAuthorized(request, "start")
  resourceAllowed = false
  await assert.rejects(
    guard.assertAuthorized(request, "protected_read"),
    (error) => error instanceof PermissionRevokedError && error.denialReason === "resource_policy_revoked"
  )
})

test("suspension, deletion, tenant removal, and identity lookup failure fail closed", async () => {
  const identities: Array<ServerManagedIdentity | undefined | Error> = [
    currentIdentity({ accountStatus: "suspended" }),
    undefined,
    currentIdentity({ tenantId: "other-tenant" }),
    new Error("directory unavailable")
  ]
  for (const state of identities) {
    const guard = new CurrentWorkerAuthorization(mutableProvider(() => state))
    await assert.rejects(guard.assertAuthorized({
      runId: "run-chat",
      targetType: "chat_run",
      subject: "subject-1",
      tenantId: "tenant-1",
      requiredPermissions: ["chat:create"],
      authorizeResource: () => true
    }, "start"), PermissionRevokedError)
  }
})

function rolesFor(targetType: WorkerTargetType): string[] {
  if (targetType === "chat_run") return ["CHAT_USER"]
  if (targetType === "document_ingest_run") return ["RAG_GROUP_MANAGER"]
  if (targetType === "benchmark_run") return ["BENCHMARK_OPERATOR"]
  return ["ASYNC_AGENT_USER"]
}

function currentIdentity(overrides: Partial<ServerManagedIdentity> = {}): ServerManagedIdentity {
  return {
    username: "cognito-user",
    userId: "subject-1",
    email: "user@example.com",
    accountStatus: "active",
    cognitoGroups: ["CHAT_USER"],
    tenantId: "tenant-1",
    ...overrides
  }
}

function mutableProvider(resolve: () => ServerManagedIdentity | undefined | Error): VerifiedIdentityProvider {
  const lookup = async () => {
    const result = resolve()
    if (result instanceof Error) throw result
    return result
  }
  return {
    getCurrentIdentity: lookup,
    getCurrentIdentityBySubject: lookup
  }
}
