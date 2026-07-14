import assert from "node:assert/strict"
import test from "node:test"
import type { UserDirectory } from "../adapters/user-directory.js"
import type { ServerManagedIdentity, VerifiedIdentityProvider } from "../adapters/verified-identity-provider.js"
import type { ObjectStore } from "../adapters/object-store.js"
import type { Dependencies } from "../dependencies.js"
import { MemoRagService } from "../rag/memorag-service.js"
import type { DocumentGroup, ManagedUser } from "../types.js"
import {
  ObjectStoreAccountRevocationRegistry,
  RevocationAwareVerifiedIdentityProvider
} from "./account-revocation-registry.js"
import { ObjectStoreAdministrativePrincipalTransferFence } from "./administrative-principal-transfer-fence.js"
import {
  ObjectStoreRevocationCleanupRepairOutbox,
  type RevocationCleanupRepairIntent
} from "../rag/_shared/security/revocation-cleanup-repair-outbox.js"

test("suspend disables Cognito, globally revokes sessions, and only then reports the ledger transition", async () => {
  const fixture = lifecycleFixture()
  const suspended = await fixture.service.suspendManagedUser(fixture.actor, "target")

  assert.equal(suspended?.status, "suspended")
  assert.deepEqual(fixture.calls, ["disable:target-name", "signout:target-name"])
  assert.equal(fixture.identities.target?.accountStatus, "suspended")
  assert.equal(fixture.completedAuditResults().at(-1), "success")
  const cleanup = fixture.revocationCleanupManifests().at(-1)
  assert.equal(cleanup?.trigger, "account_revoked")
  assert.deepEqual(cleanup?.targets.map((target) => target.scope).sort(), ["cache", "evaluation_artifact", "grant", "queued_run", "session"])
})

test("denied account lifecycle mutation is audited before returning without changing account state", async () => {
  const fixture = lifecycleFixture()
  fixture.identities.actor = identity("actor", ["CHAT_USER"])

  await assert.rejects(fixture.service.suspendManagedUser(fixture.actor, "target"), /Forbidden/)

  assert.deepEqual(fixture.calls, [])
  assert.equal(fixture.identities.target?.accountStatus, "active")
  assert.equal(fixture.completedAuditResults().at(-1), "denied")
})

test("account lifecycle mutation does not touch authoritative state when the common audit intent cannot be persisted", async () => {
  const fixture = lifecycleFixture({ failAuditPrepare: true })

  await assert.rejects(fixture.service.suspendManagedUser(fixture.actor, "target"), /audit prepare failed/)

  assert.deepEqual(fixture.calls, [])
  assert.equal(fixture.identities.target?.accountStatus, "active")
})

test("account create provisions Cognito identity and roles before committing the managed ledger and common audit", async () => {
  const fixture = lifecycleFixture()

  const created = await fixture.service.createManagedUser(fixture.actor, {
    email: "New.Worker@Example.COM",
    displayName: "New Worker",
    groups: ["ANSWER_EDITOR"]
  })

  assert.equal(created.userId, "created-subject")
  assert.equal(created.email, "new.worker@example.com")
  assert.deepEqual(created.groups, ["ANSWER_EDITOR"])
  assert.equal(fixture.calls[0], "create:new.worker-example.com")
  assert.equal(fixture.calls[1], "groups:new.worker-example.com:ANSWER_EDITOR")
  assert.equal(fixture.identities[created.userId]?.accountStatus, "active")
  assert.equal(fixture.completedAuditResults().at(-1), "success")
})

test("account create role failure removes the authoritative identity and records failed without a ledger success", async () => {
  const fixture = lifecycleFixture({ failSetGroups: true })

  await assert.rejects(
    fixture.service.createManagedUser(fixture.actor, {
      email: "failed.worker@example.com",
      groups: ["ANSWER_EDITOR"]
    }),
    /group assignment failed/
  )

  assert.equal(fixture.calls[0], "create:failed.worker-example.com")
  assert.equal(fixture.calls[1], "groups:failed.worker-example.com:ANSWER_EDITOR")
  assert.equal(fixture.calls[2], "delete:failed.worker-example.com")
  assert.equal(fixture.identities["created-subject"], undefined)
  assert.equal((await fixture.service.listManagedUsers(fixture.actor)).some((user) => user.email === "failed.worker@example.com"), false)
  assert.equal(fixture.completedAuditResults().at(-1), "failed")
})

test("account create persists denied audit before rejecting a currently unauthorized actor", async () => {
  const fixture = lifecycleFixture()
  fixture.identities.actor = identity("actor", ["CHAT_USER"])

  await assert.rejects(
    fixture.service.createManagedUser(fixture.actor, { email: "denied@example.com" }),
    /Forbidden/
  )

  assert.deepEqual(fixture.calls, [])
  assert.equal(fixture.completedAuditResults().at(-1), "denied")
})

test("session revoke failure keeps a deny-first suspended ledger and records reconciliation", async () => {
  const fixture = lifecycleFixture({ failSignOut: true })

  await assert.rejects(fixture.service.suspendManagedUser(fixture.actor, "target"), /signout failed/)
  assert.equal(fixture.identities.target?.accountStatus, "suspended")
  const users = await fixture.service.listManagedUsers(fixture.actor)
  assert.equal(users.find((user) => user.userId === "target")?.status, "suspended")
  assert.equal(fixture.completedAuditResults().at(-1), "failed")
})

test("identity disable failure still leaves a durable application deny and suspended reconciliation ledger", async () => {
  const fixture = lifecycleFixture({ failDisable: true })

  await assert.rejects(fixture.service.suspendManagedUser(fixture.actor, "target"), /disable failed/)

  assert.equal(fixture.identities.target?.accountStatus, "active", "the simulated external IdP mutation failed")
  assert.equal((await fixture.currentIdentityProvider.getCurrentIdentityBySubject("target"))?.accountStatus, "suspended")
  const users = await fixture.service.listManagedUsers(fixture.actor)
  assert.equal(users.find((user) => user.userId === "target")?.status, "suspended")
  assert.deepEqual(fixture.calls, ["disable:target-name"])
  assert.equal(fixture.completedAuditResults().at(-1), "failed")
})

test("restore revokes stale sessions and clears the application deny only after the IdP is enabled", async () => {
  const fixture = lifecycleFixture()
  await fixture.service.suspendManagedUser(fixture.actor, "target")

  await assert.rejects(
    fixture.service.unsuspendManagedUser(fixture.actor, "target"),
    /revocation cleanup resource fence is active/i
  )
  const repair = fixture.revocationCleanupRepairIntents().find((intent) => intent.status === "cleanup_registered")
  assert.ok(repair)
  await new ObjectStoreRevocationCleanupRepairOutbox(fixture.objectStore as unknown as ObjectStore)
    .markCleanupCompleted(repair, new Date().toISOString())

  const restored = await fixture.service.unsuspendManagedUser(fixture.actor, "target")

  assert.equal(restored?.status, "active")
  assert.equal((await fixture.currentIdentityProvider.getCurrentIdentityBySubject("target"))?.accountStatus, "active")
  assert.deepEqual(fixture.calls, [
    "disable:target-name",
    "signout:target-name",
    "enable:target-name",
    "signout:target-name"
  ])
  assert.equal(fixture.completedAuditResults().at(-1), "success")
})

test("delete is deny-first and signs out before authoritative deletion", async () => {
  const fixture = lifecycleFixture()
  const deleted = await fixture.service.deleteManagedUser(fixture.actor, "target")

  assert.equal(deleted?.status, "deleted")
  assert.deepEqual(fixture.calls, ["disable:target-name", "signout:target-name", "delete:target-name"])
  assert.equal(fixture.identities.target, undefined)
  assert.equal((await fixture.service.listManagedUsers(fixture.actor)).some((user) => user.userId === "target"), false)
})

test("delete blocks orphan creation and transfers owned folders before authoritative account deletion", async () => {
  const fixture = lifecycleFixture({ ownedFolder: true })

  await assert.rejects(() => fixture.service.deleteManagedUser(fixture.actor, "target"), /successor/)
  assert.deepEqual(fixture.calls, [])
  const deleted = await fixture.service.deleteManagedUser(fixture.actor, "target", { successorUserId: "successor" })

  assert.equal(deleted?.status, "deleted")
  assert.equal(fixture.folders[0]?.ownerUserId, "successor")
  assert.equal(fixture.folders[0]?.adminPrincipalId, "successor")
  assert.deepEqual(fixture.calls, ["disable:target-name", "signout:target-name", "delete:target-name"])
})

test("deletion preflight returns real ownership counts and only current active same-tenant successors", async () => {
  const fixture = lifecycleFixture({ ownedFolder: true })
  fixture.identities.inactive = { ...identity("inactive", ["CHAT_USER"]), accountStatus: "suspended" }
  fixture.identities.crossTenant = { ...identity("crossTenant", ["CHAT_USER"]), tenantId: "tenant-2" }
  fixture.managed.inactive = { ...managedUser("inactive", ["CHAT_USER"]), status: "suspended" }
  fixture.managed.crossTenant = managedUser("crossTenant", ["CHAT_USER"])

  const preflight = await fixture.service.getManagedUserDeletionPreflight(fixture.actor, "target")

  assert.deepEqual(preflight?.ownedResources, { folders: 1, resourceGroups: 0, documents: 0, total: 1 })
  assert.equal(preflight?.requiresSuccessor, true)
  assert.deepEqual(preflight?.eligibleSuccessors.map((candidate) => candidate.userId), ["actor", "successor"])
  assert.ok(preflight?.eligibleSuccessors.every((candidate) => candidate.status === "active"))
})

test("administrative-principal change endpoint service transfers ownership without deleting the account", async () => {
  const fixture = lifecycleFixture({ ownedFolder: true })

  const result = await fixture.service.transferManagedUserAdministrativePrincipal(
    fixture.actor,
    "target",
    { successorUserId: "successor", reason: "tenant exit preparation" }
  )

  assert.deepEqual(result, {
    operationId: result?.operationId,
    transferredFolders: 1,
    transferredResourceGroups: 0,
    transferredDocuments: 0
  })
  assert.equal(fixture.folders[0]?.ownerUserId, "successor")
  assert.equal(fixture.folders[0]?.adminPrincipalId, "successor")
  assert.deepEqual(fixture.calls, [])
  assert.equal(fixture.identities.target?.accountStatus, "active")
})

test("administrative-principal change records a denied audit before rejecting a stale cross-tenant successor", async () => {
  const fixture = lifecycleFixture({ ownedFolder: true })
  fixture.identities.crossTenant = { ...identity("crossTenant", ["CHAT_USER"]), tenantId: "tenant-2" }
  fixture.managed.crossTenant = managedUser("crossTenant", ["CHAT_USER"])

  await assert.rejects(
    fixture.service.transferManagedUserAdministrativePrincipal(
      fixture.actor,
      "target",
      { successorUserId: "crossTenant", reason: "invalid tenant exit successor" }
    ),
    /Forbidden/
  )

  assert.equal(fixture.folders[0]?.ownerUserId, "target")
  assert.equal(fixture.securityMutationResults("administrativePrincipal").at(-1), "denied")
})

function lifecycleFixture(options: { failSignOut?: boolean; failDisable?: boolean; failSetGroups?: boolean; ownedFolder?: boolean; failAuditPrepare?: boolean } = {}) {
  const calls: string[] = []
  const objectStore = new VersionedMemoryObjectStore()
  const identities: Record<string, ServerManagedIdentity | undefined> = {
    actor: identity("actor", ["SYSTEM_ADMIN"]),
    target: identity("target", ["CHAT_USER"]),
    successor: identity("successor", ["RAG_GROUP_MANAGER"])
  }
  const managed: Record<string, ManagedUser> = {
    actor: managedUser("actor", ["SYSTEM_ADMIN"]),
    target: managedUser("target", ["CHAT_USER"]),
    successor: managedUser("successor", ["RAG_GROUP_MANAGER"])
  }
  const folders = options.ownedFolder ? [ownedFolder("folder-1", "target")] : []
  const baseProvider: VerifiedIdentityProvider = {
    async getCurrentIdentity(username) {
      return Object.values(identities).find((candidate) => candidate?.username === username)
    },
    async getCurrentIdentityBySubject(subject) {
      return identities[subject]
    }
  }
  const accountRevocationRegistry = new ObjectStoreAccountRevocationRegistry(objectStore as unknown as ObjectStore)
  const administrativePrincipalTransferFence = new ObjectStoreAdministrativePrincipalTransferFence(objectStore as unknown as ObjectStore)
  const provider = new RevocationAwareVerifiedIdentityProvider(
    baseProvider,
    accountRevocationRegistry,
    administrativePrincipalTransferFence
  )
  const directory: UserDirectory = {
    async listUsers() { return Object.values(managed) },
    async createUser(input) {
      calls.push(`create:${input.username}`)
      const created = {
        username: input.username,
        userId: "created-subject",
        email: input.email,
        displayName: input.displayName,
        status: "active" as const,
        groups: [],
        createdAt: "2026-07-11T00:00:00.000Z",
        updatedAt: "2026-07-11T00:00:00.000Z"
      }
      identities[created.userId] = {
        username: created.username,
        userId: created.userId,
        email: created.email,
        accountStatus: "active",
        cognitoGroups: [],
        tenantId: "tenant-1"
      }
      managed[created.userId] = { ...created }
      return created
    },
    async setUserGroups(username, groups) {
      calls.push(`groups:${username}:${groups.join(",")}`)
      if (options.failSetGroups) throw new Error("group assignment failed")
      const entry = Object.values(identities).find((candidate) => candidate?.username === username)
      if (entry) entry.cognitoGroups = [...groups]
      const directoryUser = Object.values(managed).find((candidate) => identities[candidate.userId]?.username === username)
      if (directoryUser) directoryUser.groups = [...groups]
    },
    async disableUser(username) {
      calls.push(`disable:${username}`)
      if (options.failDisable) throw new Error("disable failed")
      const entry = Object.entries(identities).find(([, candidate]) => candidate?.username === username)
      if (entry?.[1]) identities[entry[0]] = { ...entry[1], accountStatus: "suspended" }
      if (entry?.[0] && managed[entry[0]]) managed[entry[0]]!.status = "suspended"
    },
    async enableUser(username) {
      calls.push(`enable:${username}`)
      identities.target = identities.target ? { ...identities.target, accountStatus: "active" } : undefined
      if (managed.target) managed.target.status = "active"
    },
    async revokeSessions(username) {
      calls.push(`signout:${username}`)
      if (options.failSignOut) throw new Error("signout failed")
    },
    async deleteUser(username) {
      calls.push(`delete:${username}`)
      const entry = Object.entries(identities).find(([, candidate]) => candidate?.username === username)
      if (entry) {
        delete identities[entry[0]]
        delete managed[entry[0]]
      }
    }
  }
  const deps = {
    objectStore,
    userDirectory: directory,
    verifiedIdentityProvider: provider,
    accountRevocationRegistry,
    administrativePrincipalTransferFence,
    securityAuditOutbox: options.failAuditPrepare
      ? {
          prepare: async () => { throw new Error("audit prepare failed") },
          complete: async () => { throw new Error("audit complete must not run") }
        }
      : undefined,
    documentGroupStore: {
      list: async () => folders,
      get: async (_tenantId: string, groupId: string) => folders.find((folder) => folder.groupId === groupId),
      updateWithPathLocks: async (_tenantId: string, updates: Array<{ current: DocumentGroup; next: DocumentGroup }>) => {
        for (const update of updates) {
          const index = folders.findIndex((folder) => folder.groupId === update.current.groupId)
          if (index < 0 || folders[index]?.updatedAt !== update.current.updatedAt) throw new Error("folder conflict")
          folders[index] = update.next
        }
        return updates.map((update) => update.next)
      }
    },
    userGroupStore: { list: async () => [] },
    evidenceVectorStore: { put: async () => undefined, query: async () => [], delete: async () => undefined },
    memoryVectorStore: { put: async () => undefined, query: async () => [], delete: async () => undefined }
  } as unknown as Dependencies
  return {
    service: new MemoRagService(deps),
    objectStore,
    actor: {
      userId: "actor",
      identityUsername: "actor-name",
      email: "actor@example.com",
      cognitoGroups: ["SYSTEM_ADMIN"],
      accountStatus: "active" as const,
      tenantId: "tenant-1"
    },
    calls,
    identities,
    currentIdentityProvider: provider,
    managed,
    folders,
    revocationCleanupManifests: () => objectStore.values()
      .filter((value) => value.includes('"policyVersion": "revocation-cleanup-v1"'))
      .map((value) => JSON.parse(value) as { trigger: string; targets: Array<{ scope: string }> }),
    revocationCleanupRepairIntents: () => objectStore.values()
      .filter((value) => value.includes('"schemaVersion": 1') && value.includes('"cleanupRegistration"'))
      .map((value) => JSON.parse(value) as RevocationCleanupRepairIntent),
    completedAuditResults: () => objectStore.values()
      .filter((value) => value.includes('"targetType": "account"') && value.includes('"status": "completed"'))
      .map((value) => (JSON.parse(value) as { result: string }).result),
    securityMutationResults: (targetType: string) => objectStore.values()
      .filter((value) => value.includes(`"targetType": "${targetType}"`) && value.includes('"status": "completed"'))
      .map((value) => (JSON.parse(value) as { result: string }).result)
  }
}

function ownedFolder(groupId: string, ownerUserId: string): DocumentGroup {
  const now = "2026-07-11T00:00:00.000Z"
  return {
    groupId,
    tenantId: "tenant-1",
    adminPrincipalType: "user",
    adminPrincipalId: ownerUserId,
    name: groupId,
    normalizedName: groupId,
    canonicalPath: `/${groupId}`,
    normalizedCanonicalPath: `/${groupId}`,
    adminPathPk: `tenant-1#user#${ownerUserId}`,
    parentPathPk: `tenant-1#user#${ownerUserId}#ROOT`,
    ancestorGroupIds: [],
    ownerUserId,
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: [ownerUserId],
    status: "active",
    createdBy: ownerUserId,
    createdAt: now,
    updatedAt: now
  }
}

class VersionedMemoryObjectStore {
  private readonly valuesByKey = new Map<string, { text: string; version: string }>()
  private version = 0

  values() { return [...this.valuesByKey.values()].map((entry) => entry.text) }

  async listKeys(prefix: string) {
    return [...this.valuesByKey.keys()].filter((key) => key.startsWith(prefix))
  }

  async getText(key: string) {
    const value = this.valuesByKey.get(key)
    if (!value) throw Object.assign(new Error("NoSuchKey"), { name: "NoSuchKey" })
    return value.text
  }

  async putText(key: string, text: string) {
    this.valuesByKey.set(key, { text, version: String(++this.version) })
  }

  async getTextWithVersion(key: string) {
    const value = this.valuesByKey.get(key)
    if (!value) throw Object.assign(new Error("NoSuchKey"), { name: "NoSuchKey" })
    return value
  }

  async putTextIfVersion(key: string, text: string, expectedVersion?: string) {
    const current = this.valuesByKey.get(key)
    if (expectedVersion !== undefined && current?.version !== expectedVersion) throw new Error("version conflict")
    if (expectedVersion === undefined && current) throw new Error("version conflict")
    const version = String(++this.version)
    this.valuesByKey.set(key, { text, version })
    return version
  }
}

function identity(userId: string, cognitoGroups: string[]): ServerManagedIdentity {
  return {
    username: `${userId}-name`,
    userId,
    email: `${userId}@example.com`,
    accountStatus: "active",
    cognitoGroups,
    tenantId: "tenant-1"
  }
}

function managedUser(userId: string, groups: string[]): ManagedUser {
  return {
    userId,
    email: `${userId}@example.com`,
    status: "active",
    groups,
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z"
  }
}
