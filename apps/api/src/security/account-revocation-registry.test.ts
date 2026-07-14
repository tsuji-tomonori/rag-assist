import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import type { ServerManagedIdentity, VerifiedIdentityProvider } from "../adapters/verified-identity-provider.js"
import {
  ObjectStoreAccountRevocationRegistry,
  RevocationAwareVerifiedIdentityProvider
} from "./account-revocation-registry.js"
import { ObjectStoreAdministrativePrincipalTransferFence } from "./administrative-principal-transfer-fence.js"

test("FR-058 durable deny overrides an active IdP identity until an audited clear", async () => {
  const objectStore = new LocalObjectStore(await mkdtemp(path.join(tmpdir(), "account-revocation-")))
  const registry = new ObjectStoreAccountRevocationRegistry(objectStore, sequenceClock())
  const identity = activeIdentity()
  const provider = new RevocationAwareVerifiedIdentityProvider(staticProvider(identity), registry)

  assert.equal((await provider.getCurrentIdentity(identity.username))?.accountStatus, "active")
  const denied = await registry.deny({
    tenantId: identity.tenantId,
    userId: identity.userId,
    username: identity.username,
    desiredStatus: "suspended",
    auditIntentId: "audit-suspend",
    reason: "administrative suspension"
  })
  assert.equal(denied.state, "denied")
  assert.equal((await provider.getCurrentIdentityBySubject(identity.userId))?.accountStatus, "suspended")

  const cleared = await registry.clear({
    tenantId: identity.tenantId,
    userId: identity.userId,
    username: identity.username,
    auditIntentId: "audit-restore",
    reason: "administrative restoration"
  })
  assert.equal(cleared.revision, denied.revision + 1)
  assert.equal((await provider.getCurrentIdentity(identity.username))?.accountStatus, "active")
})

test("FR-060 account deny registry physically partitions the same subject by tenant", async () => {
  const objectStore = new LocalObjectStore(await mkdtemp(path.join(tmpdir(), "account-revocation-tenants-")))
  const registry = new ObjectStoreAccountRevocationRegistry(objectStore)
  await registry.deny({
    tenantId: "tenant-a",
    userId: "same-subject",
    username: "same-a",
    desiredStatus: "deleted",
    auditIntentId: "audit-a",
    reason: "tenant a deletion"
  })

  assert.equal((await registry.get("tenant-a", "same-subject"))?.state, "denied")
  assert.equal(await registry.get("tenant-b", "same-subject"), undefined)
  const keys = await objectStore.listKeys("security/account-revocations/")
  assert.equal(keys.length, 1)
  assert.doesNotMatch(keys[0]!, /tenant-a/)
})

test("FR-078 transfer fence denies the source identity before account deny and remains fail-closed across lease expiry", async () => {
  const objectStore = new LocalObjectStore(await mkdtemp(path.join(tmpdir(), "principal-transfer-fence-")))
  const registry = new ObjectStoreAccountRevocationRegistry(objectStore)
  let nowMs = Date.parse("2026-07-11T00:00:00.000Z")
  const transferFence = new ObjectStoreAdministrativePrincipalTransferFence(
    objectStore,
    () => new Date(nowMs),
    50
  )
  const identity = activeIdentity()
  const provider = new RevocationAwareVerifiedIdentityProvider(staticProvider(identity), registry, transferFence)
  const acquired = await transferFence.acquire({
    tenantId: identity.tenantId,
    sourceUserId: identity.userId,
    successorUserId: "successor-subject",
    mode: "permanent_delete"
  })

  assert.equal((await provider.getCurrentIdentityBySubject(identity.userId))?.accountStatus, "suspended")
  nowMs += 1_000
  assert.equal((await provider.getCurrentIdentity(identity.username))?.accountStatus, "suspended")
  const recovered = await transferFence.acquire({
    tenantId: identity.tenantId,
    sourceUserId: identity.userId,
    successorUserId: "successor-subject",
    operationId: acquired.operationId,
    mode: "permanent_delete"
  })
  assert.equal(recovered.operationId, acquired.operationId)
  assert.notEqual(recovered.fencingToken, acquired.fencingToken)
  await assert.rejects(() => transferFence.renew({
    tenantId: identity.tenantId,
    sourceUserId: identity.userId,
    operationId: acquired.operationId,
    fencingToken: acquired.fencingToken
  }), /fencing token changed/)

  await transferFence.confirmAccountDeny({
    tenantId: identity.tenantId,
    sourceUserId: identity.userId,
    operationId: acquired.operationId
  })
  await transferFence.releaseAfterAccountRestore({ tenantId: identity.tenantId, sourceUserId: identity.userId })
  assert.equal((await provider.getCurrentIdentity(identity.username))?.accountStatus, "active")
})

function activeIdentity(): ServerManagedIdentity {
  return {
    username: "target-name",
    userId: "target-subject",
    email: "target@example.com",
    accountStatus: "active",
    cognitoGroups: ["CHAT_USER"],
    tenantId: "tenant-a"
  }
}

function staticProvider(identity: ServerManagedIdentity): VerifiedIdentityProvider {
  return {
    async getCurrentIdentity(username) {
      return username === identity.username ? identity : undefined
    },
    async getCurrentIdentityBySubject(subject) {
      return subject === identity.userId ? identity : undefined
    }
  }
}

function sequenceClock(): () => Date {
  let index = 0
  return () => new Date(`2026-07-11T00:00:0${index++}.000Z`)
}
