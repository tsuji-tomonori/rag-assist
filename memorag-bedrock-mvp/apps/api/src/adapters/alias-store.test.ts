import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import type { AppUser } from "../auth.js"
import { AliasStore } from "./alias-store.js"
import { LocalObjectStore } from "./local-object-store.js"

test("alias store persists scoped drafts, review lifecycle, disable, and audit log", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-alias-store-"))
  const objectStore = new LocalObjectStore(dataDir)
  const auditLogStore = new LocalObjectStore(path.join(dataDir, "audit-log-bucket"))
  const store = new AliasStore(objectStore, auditLogStore)

  const created = await store.create(
    {
      from: "pto",
      to: ["vacation", "paid time off"],
      scope: {
        tenantId: "tenant-a",
        source: "notion",
        docType: "policy",
        aclGroups: ["HR_POLICY_READER", "HR_POLICY_READER"],
        allowedUsers: ["user-2", "user-1"]
      },
      reason: "Employees search PTO, documents use vacation."
    },
    user("creator")
  )

  assert.equal(created.status, "draft")
  assert.equal(created.createdBy, "creator")
  assert.equal(created.updatedBy, "creator")
  assert.equal(created.type, "oneWay")
  assert.equal(created.weight, 1)
  assert.deepEqual(created.scope.aclGroups, ["HR_POLICY_READER"])
  assert.deepEqual(created.scope.allowedUsers, ["user-1", "user-2"])
  assert.match(created.version, /^alias-draft-/)

  const updated = await store.update(created.aliasId, { reason: "Reviewed by HR.", weight: 1.2 }, user("creator"))
  assert.equal(updated.status, "draft")
  assert.equal(updated.reason, "Reviewed by HR.")
  assert.equal(updated.updatedBy, "creator")
  assert.equal(updated.weight, 1.2)

  const reviewed = await store.review(created.aliasId, { decision: "approve", reason: "Safe scoped synonym." }, user("reviewer"))
  assert.equal(reviewed.status, "active")
  assert.equal(reviewed.updatedBy, "reviewer")
  assert.equal(reviewed.reviewedBy, "reviewer")
  assert.match(reviewed.version, /^alias-/)

  await assert.rejects(
    () => store.update(created.aliasId, { from: "vacation" }, user("creator")),
    /Only draft aliases can be updated/
  )

  const disabled = await store.disable(created.aliasId, { reason: "Superseded." }, user("reviewer"))
  assert.equal(disabled.status, "disabled")
  assert.ok(disabled.disabledAt)

  const listed = await store.list()
  assert.equal(listed.length, 1)
  assert.equal(listed[0]?.aliasId, created.aliasId)

  const auditLog = await store.auditLog()
  assert.deepEqual(auditLog.map((entry) => entry.action).sort(), ["created", "disabled", "reviewed", "updated"])
  assert.equal(auditLog.every((entry) => entry.aliasId === created.aliasId), true)
  assert.equal(auditLog.every((entry) => entry.scope.tenantId === "tenant-a"), true)
  assert.equal((await objectStore.listKeys("aliases/audit-log/")).length, 0)
  assert.equal((await auditLogStore.listKeys("aliases/audit-log/")).length, 4)
})

test("alias store keeps rejected aliases immutable and inactive", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-alias-reject-"))
  const store = new AliasStore(new LocalObjectStore(dataDir))

  const created = await store.create(
    {
      from: "approval",
      to: ["confidential-project-x"],
      scope: { tenantId: "tenant-a", source: "notion", docType: "policy" },
      reason: "Unsafe broad alias candidate.",
      source: "llmSuggestion"
    },
    user("creator")
  )
  const rejected = await store.review(created.aliasId, { decision: "reject", reason: "Leaky project alias." }, user("reviewer"))

  assert.equal(rejected.status, "rejected")
  assert.match(rejected.version, /^alias-rejected-/)
  await assert.rejects(
    () => store.disable(created.aliasId, { reason: "No active alias." }, user("reviewer")),
    /Only active aliases can be disabled/
  )
})

function user(userId: string): AppUser {
  return {
    userId,
    email: `${userId}@example.com`,
    cognitoGroups: ["RAG_GROUP_MANAGER"]
  }
}
