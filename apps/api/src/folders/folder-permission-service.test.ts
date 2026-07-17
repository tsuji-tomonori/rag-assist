import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import type { AppUser } from "../auth.js"
import { LocalDocumentGroupStore } from "../adapters/local-document-group-store.js"
import { LocalFolderPolicyStore } from "../adapters/local-folder-policy-store.js"
import { LocalGroupMembershipStore } from "../adapters/local-group-membership-store.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalUserGroupStore } from "../adapters/local-user-group-store.js"
import type { ResourceUserPrincipal, ResourceUserPrincipalDirectory } from "../security/resource-group-membership-service.js"
import { ObjectStoreSecurityMutationAuditOutbox } from "../security/security-mutation-audit-outbox.js"
import type { DocumentGroup, FolderPolicy, GroupMembership, UserGroup } from "../types.js"
import { FolderPermissionService, FolderPolicyMutationError } from "./folder-permission-service.js"

test("personal admin principal is always full", async () => {
  const { documentGroupStore, service } = await fixture()
  await documentGroupStore.create(group({ groupId: "folder-1", adminPrincipalType: "user", adminPrincipalId: "owner-1", ownerUserId: "creator-1" }))

  assert.equal(await service.resolveEffectiveFolderPermission(user("owner-1"), "folder-1"), "full")
  assert.equal(await service.resolveEffectiveFolderPermission(user("other-1"), "folder-1"), "none")
})

test("group-managed folder uses membership permission capped by policy permission", async () => {
  const { documentGroupStore, folderPolicyStore, groupMembershipStore, userGroupStore, service } = await fixture()
  await userGroupStore.save(userGroup("admin-team"))
  await userGroupStore.save(userGroup("team-a"))
  await documentGroupStore.create(group({
    groupId: "folder-1",
    adminPrincipalType: "group",
    adminPrincipalId: "admin-team",
    ownerUserId: "creator-1",
    hasExplicitPolicy: true,
    policyId: "policy-1"
  }))
  await folderPolicyStore.save(policy("policy-1", "folder-1", [
    { principalType: "group", principalId: "team-a", permissionLevel: "full" }
  ]))
  await groupMembershipStore.save(membership("team-a", "user", "member-full", "full"))
  await groupMembershipStore.save(membership("team-a", "user", "member-read", "readOnly"))

  assert.equal(await service.resolveEffectiveFolderPermission(user("member-full"), "folder-1"), "full")
  assert.equal(await service.resolveEffectiveFolderPermission(user("member-read"), "folder-1"), "readOnly")

  await folderPolicyStore.save(policy("policy-1", "folder-1", [
    { principalType: "group", principalId: "team-a", permissionLevel: "readOnly" }
  ]))
  assert.equal(await service.resolveEffectiveFolderPermission(user("member-full"), "folder-1"), "readOnly")
})

test("direct user full wins over group readOnly in the same policy", async () => {
  const { documentGroupStore, folderPolicyStore, groupMembershipStore, userGroupStore, service } = await fixture()
  await userGroupStore.save(userGroup("team-a"))
  await groupMembershipStore.save(membership("team-a", "user", "user-1", "full"))
  await documentGroupStore.create(group({ groupId: "folder-1", ownerUserId: "owner-1", hasExplicitPolicy: true, policyId: "policy-1" }))
  await folderPolicyStore.save(policy("policy-1", "folder-1", [
    { principalType: "group", principalId: "team-a", permissionLevel: "readOnly" },
    { principalType: "user", principalId: "user-1", permissionLevel: "full" }
  ]))

  assert.equal(await service.resolveEffectiveFolderPermission(user("user-1"), "folder-1"), "full")
})

test("ordinary explicit deny overrides another allow path and is preserved in the versioned decision", async () => {
  const { documentGroupStore, folderPolicyStore, groupMembershipStore, userGroupStore, service } = await fixture()
  await userGroupStore.save(userGroup("team-a"))
  await groupMembershipStore.save(membership("team-a", "user", "reader-1", "full"))
  await documentGroupStore.create(group({ groupId: "folder-deny", ownerUserId: "owner-1", hasExplicitPolicy: true, policyId: "policy-deny" }))
  await folderPolicyStore.save(policy("policy-deny", "folder-deny", [
    { principalType: "user", principalId: "owner-1", permissionLevel: "full" },
    { principalType: "group", principalId: "team-a", permissionLevel: "readOnly" },
    { principalType: "user", principalId: "reader-1", permissionLevel: "deny" }
  ]))

  const decision = await service.resolveEffectiveFolderPermissionDecision(user("reader-1"), "folder-deny")
  assert.equal(decision.permission, "none")
  assert.equal(decision.reasonCode, "ordinary_policy_denied")
  assert.equal(decision.policyVersion, "resource-permission-decision-v1")
  assert.equal(decision.contributions[0]?.effect, "deny")
  assert.match(decision.contributions[0]?.policyVersion ?? "", /^folder-share-policy-v1:/)
})

test("child without explicit policy inherits nearest parent explicit policy", async () => {
  const { documentGroupStore, folderPolicyStore, service } = await fixture()
  await documentGroupStore.create(group({ groupId: "parent", ownerUserId: "owner-1", hasExplicitPolicy: true, policyId: "policy-parent" }))
  await documentGroupStore.create(group({ groupId: "child", ownerUserId: "owner-1", parentGroupId: "parent" }))
  await documentGroupStore.create(group({ groupId: "grandchild", ownerUserId: "owner-1", parentGroupId: "child" }))
  await folderPolicyStore.save(policy("policy-parent", "parent", [
    { principalType: "user", principalId: "reader-1", permissionLevel: "readOnly" },
    { principalType: "user", principalId: "owner-1", permissionLevel: "full" }
  ]))

  const child = await service.resolveEffectiveFolderPermissionDetail(user("reader-1"), "child")
  const grandchild = await service.resolveEffectiveFolderPermissionDetail(user("reader-1"), "grandchild")
  assert.equal(child.permission, "readOnly")
  assert.equal(child.policySource, "inherited")
  assert.equal(child.inheritedFromFolderId, "parent")
  assert.equal(grandchild.permission, "readOnly")
  assert.equal(grandchild.inheritedFromFolderId, "parent")
})

test("child explicit policy fully overrides inherited parent policy", async () => {
  const { documentGroupStore, folderPolicyStore, service } = await fixture()
  await documentGroupStore.create(group({ groupId: "parent", ownerUserId: "owner-1", hasExplicitPolicy: true, policyId: "policy-parent" }))
  await documentGroupStore.create(group({ groupId: "child", ownerUserId: "owner-1", parentGroupId: "parent", hasExplicitPolicy: true, policyId: "policy-child" }))
  await documentGroupStore.create(group({ groupId: "grandchild", ownerUserId: "owner-1", parentGroupId: "child" }))
  await folderPolicyStore.save(policy("policy-parent", "parent", [
    { principalType: "user", principalId: "reader-1", permissionLevel: "readOnly" },
    { principalType: "user", principalId: "owner-1", permissionLevel: "full" }
  ]))
  await folderPolicyStore.save(policy("policy-child", "child", [
    { principalType: "user", principalId: "owner-1", permissionLevel: "full" }
  ]))

  assert.equal(await service.resolveEffectiveFolderPermission(user("reader-1"), "child"), "none")
  assert.equal(await service.resolveEffectiveFolderPermission(user("reader-1"), "grandchild"), "none")
})

test("folder permission service does not inherit parent FolderPolicy when child has legacy explicit private policy", async () => {
  const { documentGroupStore, folderPolicyStore, service } = await fixture()
  const reader = user("reader-1")

  await documentGroupStore.create(group({
    groupId: "parent",
    ownerUserId: "owner-1",
    hasExplicitPolicy: true,
    policyId: "policy-parent"
  }))
  await folderPolicyStore.save(policy("policy-parent", "parent", [
    { principalType: "user", principalId: "owner-1", permissionLevel: "full" },
    { principalType: "user", principalId: "reader-1", permissionLevel: "readOnly" }
  ]))
  await documentGroupStore.create(group({
    groupId: "child-private",
    parentGroupId: "parent",
    ownerUserId: "owner-1",
    hasExplicitPolicy: true,
    policyId: undefined,
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: ["owner-1"]
  }))

  assert.equal(await service.resolveEffectiveFolderPermission(reader, "child-private"), "none")
})

test("folder permission service treats hasExplicitPolicy false as legacy explicit child boundary", async () => {
  const { documentGroupStore, folderPolicyStore, service } = await fixture()
  const reader = user("reader-1")

  await documentGroupStore.create(group({
    groupId: "parent",
    ownerUserId: "owner-1",
    hasExplicitPolicy: true,
    policyId: "policy-parent"
  }))
  await folderPolicyStore.save(policy("policy-parent", "parent", [
    { principalType: "user", principalId: "owner-1", permissionLevel: "full" },
    { principalType: "user", principalId: "reader-1", permissionLevel: "readOnly" }
  ]))
  await documentGroupStore.create(group({
    groupId: "child-private",
    parentGroupId: "parent",
    ownerUserId: "owner-1",
    hasExplicitPolicy: false,
    policyId: undefined,
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: ["owner-1"]
  }))

  assert.equal(await service.resolveEffectiveFolderPermission(reader, "child-private"), "none")
})

test("policy save rejects zero full principals and accepts active full group", async () => {
  const { service, userGroupStore, folderPolicyStore } = await fixture()

  await assert.rejects(() => service.saveFolderPolicy(policy("policy-empty", "folder-1", [
    { principalType: "user", principalId: "reader-1", permissionLevel: "readOnly" }
  ])), /at least one active full principal/)

  await assert.rejects(() => service.saveFolderPolicy(policy("policy-missing-group", "folder-1", [
    { principalType: "group", principalId: "missing-group", permissionLevel: "full" }
  ])), /at least one active full principal/)

  await userGroupStore.save(userGroup("team-a"))
  await assert.doesNotReject(() => service.saveFolderPolicy(policy("policy-team-a", "folder-1", [
    { principalType: "group", principalId: "team-a", permissionLevel: "full" }
  ])))
  assert.equal((await folderPolicyStore.get("default", "policy-team-a"))?.policyId, "policy-team-a")
})

test("archived folder resolves to none even for owner", async () => {
  const { documentGroupStore, service } = await fixture()
  await documentGroupStore.create(group({ groupId: "folder-1", adminPrincipalId: "owner-1", ownerUserId: "owner-1", status: "archived" }))

  assert.equal(await service.resolveEffectiveFolderPermission(user("owner-1"), "folder-1"), "none")
})

test("tenant mismatch and broken folder ancestry are mandatory deny even for admin principal", async () => {
  const { documentGroupStore, service } = await fixture()
  await documentGroupStore.create(group({ groupId: "folder-1", ownerUserId: "owner-1" }))
  await documentGroupStore.create(group({ groupId: "cycle-a", ownerUserId: "owner-1", parentGroupId: "cycle-b" }))
  await documentGroupStore.create(group({ groupId: "cycle-b", ownerUserId: "owner-1", parentGroupId: "cycle-a" }))

  assert.equal(await service.resolveEffectiveFolderPermission({ ...user("owner-1"), tenantId: "tenant-b" }, "folder-1"), "none")
  assert.equal(await service.resolveEffectiveFolderPermission(user("owner-1"), "cycle-a"), "none")
})

test("parent integrity mandatory deny precedes administrative principal full", async () => {
  const { documentGroupStore, service } = await fixture()
  await documentGroupStore.create(group({
    groupId: "missing-parent-child",
    ownerUserId: "owner-1",
    parentGroupId: "missing-parent"
  }))
  await documentGroupStore.create(group({ groupId: "archived-parent", ownerUserId: "owner-1", status: "archived" }))
  await documentGroupStore.create(group({
    groupId: "archived-parent-child",
    ownerUserId: "owner-1",
    parentGroupId: "archived-parent"
  }))
  await documentGroupStore.create(group({ groupId: "active-parent", ownerUserId: "owner-1" }))
  await documentGroupStore.create(group({
    groupId: "active-parent-child",
    ownerUserId: "owner-1",
    parentGroupId: "active-parent"
  }))
  await documentGroupStore.create(group({ groupId: "root-folder", ownerUserId: "owner-1" }))

  for (const folderId of ["missing-parent-child", "archived-parent-child"]) {
    const denied = await service.resolveEffectiveFolderPermissionDetail(user("owner-1"), folderId)
    assert.equal(denied.permission, "none")
    assert.equal(denied.decision.reasonCode, "resource_integrity_unverified")
  }

  for (const folderId of ["active-parent-child", "root-folder"]) {
    const allowed = await service.resolveEffectiveFolderPermissionDetail(user("owner-1"), folderId)
    assert.equal(allowed.permission, "full")
    assert.equal(allowed.decision.reasonCode, "administrative_principal")
  }
})

test("cross-tenant parent integrity denies administrative principal before full", async () => {
  const { documentGroupStore, folderPolicyStore, groupMembershipStore, userGroupStore } = await fixture()
  const crossTenantParent = group({ groupId: "cross-tenant-parent", ownerUserId: "owner-1", tenantId: "tenant-b" })
  const child = group({ groupId: "cross-tenant-child", ownerUserId: "owner-1", parentGroupId: crossTenantParent.groupId })
  const service = new FolderPermissionService({
    documentGroupStore: {
      ...documentGroupStore,
      list: async () => [crossTenantParent, child],
      get: async (_tenantId: string, groupId: string) => [crossTenantParent, child].find((group) => group.groupId === groupId)
    } as unknown as typeof documentGroupStore,
    folderPolicyStore,
    groupMembershipStore,
    userGroupStore
  })

  const denied = await service.resolveEffectiveFolderPermissionDetail(user("owner-1"), child.groupId)

  assert.equal(denied.permission, "none")
  assert.equal(denied.decision.reasonCode, "resource_integrity_unverified")
})

test("folder with no authoritative tenant fails closed instead of inheriting the default tenant", async () => {
  const { documentGroupStore, folderPolicyStore, groupMembershipStore, userGroupStore } = await fixture()
  const missingTenantFolder = {
    ...group({ groupId: "missing-tenant", ownerUserId: "owner-1" }),
    tenantId: undefined
  } as unknown as DocumentGroup
  const service = new FolderPermissionService({
    documentGroupStore: {
      ...documentGroupStore,
      list: async () => [missingTenantFolder],
      get: async () => missingTenantFolder
    } as unknown as typeof documentGroupStore,
    folderPolicyStore,
    groupMembershipStore,
    userGroupStore
  })

  const decision = await service.resolveEffectiveFolderPermissionDecision(user("owner-1"), missingTenantFolder.groupId)

  assert.equal(decision.permission, "none")
  assert.equal(decision.reasonCode, "resource_tenant_unresolved")
})

test("admin principal full does not depend on ordinary policy readability", async () => {
  const { documentGroupStore, groupMembershipStore, userGroupStore } = await fixture()
  await documentGroupStore.create(group({
    groupId: "folder-1",
    ownerUserId: "owner-1",
    hasExplicitPolicy: true,
    policyId: "unreadable-policy"
  }))
  const service = new FolderPermissionService({
    documentGroupStore,
    groupMembershipStore,
    userGroupStore,
    folderPolicyStore: {
      list: async () => { throw new Error("unavailable") },
      get: async () => { throw new Error("unavailable") },
      findByFolderId: async () => { throw new Error("unavailable") },
      save: async (value) => value,
      delete: async () => undefined,
      getVersionedByFolderId: async () => { throw new Error("unavailable") },
      replaceForFolder: async () => { throw new Error("unavailable") }
    }
  })

  assert.equal(await service.resolveEffectiveFolderPermission(user("owner-1"), "folder-1"), "full")
  const readerDecision = await service.resolveEffectiveFolderPermissionDecision(user("reader-1"), "folder-1")
  assert.equal(readerDecision.permission, "none")
  assert.equal(readerDecision.reasonCode, "ordinary_policy_unavailable")
  assert.equal(readerDecision.contributions[0]?.effect, "unavailable")
})

test("dangling or cross-tenant resource-group policy fails closed", async () => {
  const { documentGroupStore, folderPolicyStore, groupMembershipStore, userGroupStore, service } = await fixture()
  await documentGroupStore.create(group({ groupId: "folder-1", ownerUserId: "owner-1", hasExplicitPolicy: true, policyId: "policy-1" }))
  await folderPolicyStore.save(policy("policy-1", "folder-1", [
    { principalType: "user", principalId: "reader-1", permissionLevel: "readOnly" },
    { principalType: "group", principalId: "missing-group", permissionLevel: "readOnly" },
    { principalType: "user", principalId: "owner-1", permissionLevel: "full" }
  ]))
  assert.equal(await service.resolveEffectiveFolderPermission(user("reader-1"), "folder-1"), "none")

  await userGroupStore.save(userGroup("other-tenant", { tenantId: "tenant-b" }))
  await groupMembershipStore.save({ ...membership("other-tenant", "user", "reader-1", "full"), tenantId: "tenant-b" })
  await folderPolicyStore.save(policy("policy-1", "folder-1", [
    { principalType: "group", principalId: "other-tenant", permissionLevel: "readOnly" },
    { principalType: "user", principalId: "owner-1", permissionLevel: "full" }
  ]))
  assert.equal(await service.resolveEffectiveFolderPermission(user("reader-1"), "folder-1"), "none")
})

test("group membership nesting is resolved with cycle guard", async () => {
  const { documentGroupStore, folderPolicyStore, groupMembershipStore, userGroupStore, service } = await fixture()
  await userGroupStore.save(userGroup("parent-group"))
  await userGroupStore.save(userGroup("child-group"))
  await groupMembershipStore.save(membership("parent-group", "group", "child-group", "readOnly"))
  await groupMembershipStore.save(membership("child-group", "group", "parent-group", "full"))
  await groupMembershipStore.save(membership("child-group", "user", "user-1", "full"))
  await documentGroupStore.create(group({ groupId: "folder-1", ownerUserId: "owner-1", hasExplicitPolicy: true, policyId: "policy-1" }))
  await folderPolicyStore.save(policy("policy-1", "folder-1", [
    { principalType: "group", principalId: "parent-group", permissionLevel: "full" },
    { principalType: "user", principalId: "owner-1", permissionLevel: "full" }
  ]))

  assert.equal(await service.resolveEffectiveFolderPermission(user("user-1"), "folder-1"), "none")
})

test("inactive users and archived groups do not receive folder grants", async () => {
  const { documentGroupStore, folderPolicyStore, groupMembershipStore, userGroupStore, service } = await fixture()
  await userGroupStore.save(userGroup("archived-team", { status: "archived" }))
  await groupMembershipStore.save(membership("archived-team", "user", "user-1", "full"))
  await documentGroupStore.create(group({ groupId: "folder-1", ownerUserId: "owner-1", hasExplicitPolicy: true, policyId: "policy-1" }))
  await folderPolicyStore.save(policy("policy-1", "folder-1", [
    { principalType: "group", principalId: "archived-team", permissionLevel: "full" },
    { principalType: "user", principalId: "owner-1", permissionLevel: "full" }
  ]))

  assert.equal(await service.resolveEffectiveFolderPermission(user("owner-1", [], "suspended"), "folder-1"), "none")
  assert.equal(await service.resolveEffectiveFolderPermission(user("user-1"), "folder-1"), "none")
})

test("legacy compatibility grants manager shared user shared group and org visibility permissions", async () => {
  const { documentGroupStore, groupMembershipStore, userGroupStore, service } = await fixture()
  await userGroupStore.save(userGroup("team-a"))
  await groupMembershipStore.save(membership("team-a", "user", "group-user", "full"))
  await documentGroupStore.create(group({
    groupId: "folder-1",
    ownerUserId: "owner-1",
    managerUserIds: ["owner-1", "manager-1"],
    sharedUserIds: ["reader-1"],
    sharedGroups: ["team-a"],
    visibility: "org"
  }))

  assert.equal(await service.resolveEffectiveFolderPermission(user("manager-1"), "folder-1"), "full")
  assert.equal(await service.resolveEffectiveFolderPermission(user("reader-1"), "folder-1"), "readOnly")
  assert.equal(await service.resolveEffectiveFolderPermission(user("group-user"), "folder-1"), "readOnly")
  assert.equal(await service.resolveEffectiveFolderPermission(user("org-user"), "folder-1"), "readOnly")
})

test("application role/group labels do not substitute resource-group membership", async () => {
  const { documentGroupStore, groupMembershipStore, userGroupStore, service } = await fixture()
  await userGroupStore.save(userGroup("admin-team"))
  await documentGroupStore.create(group({ groupId: "folder-1", ownerUserId: "creator-1", adminPrincipalType: "group", adminPrincipalId: "admin-team" }))

  assert.equal(await service.resolveEffectiveFolderPermission(user("member-1", ["CHAT_USER", "admin-team"]), "folder-1"), "none")
  await groupMembershipStore.save(membership("admin-team", "user", "member-1", "full"))
  assert.equal(await service.resolveEffectiveFolderPermission(user("member-1", ["CHAT_USER", "admin-team"]), "folder-1"), "full")
})

test("folder permission helpers expose bulk resolution and enforce required access", async () => {
  const { documentGroupStore, service } = await fixture()
  await documentGroupStore.create(group({ groupId: "full-folder", ownerUserId: "owner-1" }))
  await documentGroupStore.create(group({ groupId: "read-folder", ownerUserId: "owner-2", sharedUserIds: ["owner-1"] }))
  await documentGroupStore.create(group({ groupId: "hidden-folder", ownerUserId: "owner-3" }))

  assert.deepEqual(await service.resolveEffectiveFolderPermissions(user("owner-1"), ["full-folder", "read-folder", "hidden-folder"]), {
    "full-folder": "full",
    "read-folder": "readOnly",
    "hidden-folder": "none"
  })
  assert.deepEqual((await service.listReadableFolderIds(user("owner-1"))).sort(), ["full-folder", "read-folder"])
  assert.deepEqual(await service.listManageableFolderIds(user("owner-1")), ["full-folder"])
  await assert.doesNotReject(() => service.assertFolderPermission(user("owner-1"), "read-folder", "readOnly"))
  await assert.rejects(() => service.assertFolderPermission(user("owner-1"), "read-folder", "full"), /Forbidden/)
})

test("versioned folder policy replacement validates principals, replaces complete state, and writes common audit", async () => {
  const fixture = await secureFixture()
  fixture.directory.set({ userId: "owner-1", tenantId: "default", status: "active" })
  fixture.directory.set({ userId: "reader-1", tenantId: "default", status: "active" })
  await fixture.documentGroupStore.create(group({
    groupId: "folder-1",
    ownerUserId: "owner-1"
  }))
  const initial = await fixture.service.getVersionedFolderPolicy("default", "folder-1")
  const replaced = await fixture.service.replaceVersionedFolderPolicy(secureFolderOwner(), "folder-1", {
    expectedVersion: initial.version,
    entries: [
      { principalType: "user", principalId: "owner-1", permissionLevel: "full" },
      { principalType: "user", principalId: "reader-1", permissionLevel: "readOnly" }
    ],
    reason: "閲覧共有"
  })

  assert.notEqual(replaced.version, initial.version)
  assert.deepEqual(replaced.policy.entries.map((entry) => entry.principalId), ["owner-1", "reader-1"])
  assert.equal((await fixture.objectStore.listKeys("security-audit/intents/")).length, 1)
  assert.equal(await fixture.service.resolveEffectiveFolderPermission(user("reader-1"), "folder-1"), "readOnly")
})

test("versioned folder share revocation registers durable principal cleanup", async () => {
  const fixture = await secureFixture()
  fixture.directory.set({ userId: "owner-1", tenantId: "default", status: "active" })
  fixture.directory.set({ userId: "reader-1", tenantId: "default", status: "active" })
  await fixture.documentGroupStore.create(group({ groupId: "folder-revoke", ownerUserId: "owner-1" }))
  const initial = await fixture.service.getVersionedFolderPolicy("default", "folder-revoke")
  const granted = await fixture.service.replaceVersionedFolderPolicy(secureFolderOwner(), "folder-revoke", {
    expectedVersion: initial.version,
    entries: [
      { principalType: "user", principalId: "owner-1", permissionLevel: "full" },
      { principalType: "user", principalId: "reader-1", permissionLevel: "readOnly" }
    ],
    reason: "temporary access"
  })
  await fixture.service.replaceVersionedFolderPolicy(secureFolderOwner(), "folder-revoke", {
    expectedVersion: granted.version,
    entries: [{ principalType: "user", principalId: "owner-1", permissionLevel: "full" }],
    reason: "access revoked"
  })

  const keys = await fixture.objectStore.listKeys("security/revocation-cleanup/")
  assert.equal(keys.length, 1)
  const manifest = JSON.parse(await fixture.objectStore.getText(keys[0]!)) as {
    resourceType: string
    resourceId: string
    trigger: string
    targets: Array<{ scope: string; reference: string }>
  }
  assert.equal(manifest.resourceType, "folder")
  assert.equal(manifest.resourceId, "folder-revoke")
  assert.equal(manifest.trigger, "share_revoked")
  assert.deepEqual(manifest.targets.map((target) => target.scope).sort(), ["cache", "grant", "queued_run", "session"])
})

test("folder full-to-readOnly downgrade records the surviving permission ceiling", async () => {
  const fixture = await secureFixture()
  fixture.directory.set({ userId: "owner-1", tenantId: "default", status: "active" })
  fixture.directory.set({ userId: "reader-1", tenantId: "default", status: "active" })
  await fixture.documentGroupStore.create(group({ groupId: "folder-downgrade", ownerUserId: "owner-1" }))
  const initial = await fixture.service.getVersionedFolderPolicy("default", "folder-downgrade")
  const granted = await fixture.service.replaceVersionedFolderPolicy(secureFolderOwner(), "folder-downgrade", {
    expectedVersion: initial.version,
    entries: [
      { principalType: "user", principalId: "owner-1", permissionLevel: "full" },
      { principalType: "user", principalId: "reader-1", permissionLevel: "full" }
    ],
    reason: "temporary edit access"
  })
  await fixture.service.replaceVersionedFolderPolicy(secureFolderOwner(), "folder-downgrade", {
    expectedVersion: granted.version,
    entries: [
      { principalType: "user", principalId: "owner-1", permissionLevel: "full" },
      { principalType: "user", principalId: "reader-1", permissionLevel: "readOnly" }
    ],
    reason: "retain read access only"
  })

  const [key] = await fixture.objectStore.listKeys("security/revocation-cleanup/")
  assert.ok(key)
  const manifest = JSON.parse(await fixture.objectStore.getText(key)) as {
    targets: Array<{ scope: string; reference: string }>
  }
  assert.ok(manifest.targets.some((target) => (
    target.scope === "grant"
    && target.reference === "folder:folder-downgrade:principal:user:reader-1:ceiling:readOnly"
  )))
})

test("missing folder share mutation persists a completed non-enumerating denial audit", async () => {
  const fixture = await secureFixture()
  await assert.rejects(() => fixture.service.replaceVersionedFolderPolicy(secureFolderOwner(), "missing-folder", {
    expectedVersion: "absent",
    entries: [{ principalType: "user", principalId: "owner-1", permissionLevel: "full" }],
    reason: "missing target attempt"
  }), (error: unknown) => error instanceof FolderPolicyMutationError && error.result === "denied")

  const [auditKey] = await fixture.objectStore.listKeys("security-audit/intents/")
  assert.ok(auditKey)
  const audit = JSON.parse(await fixture.objectStore.getText(auditKey)) as {
    status: string
    result?: string
    draft: { targetId: string; reason: string }
  }
  assert.equal(audit.status, "completed")
  assert.equal(audit.result, "denied")
  assert.equal(audit.draft.targetId, "missing-folder")
  assert.equal(audit.draft.reason, "missing target attempt")
})

test("versioned folder policy replacement rejects stale writers without changing state", async () => {
  const fixture = await secureFixture()
  fixture.directory.set({ userId: "owner-1", tenantId: "default", status: "active" })
  fixture.directory.set({ userId: "reader-1", tenantId: "default", status: "active" })
  fixture.directory.set({ userId: "reader-2", tenantId: "default", status: "active" })
  await fixture.documentGroupStore.create(group({ groupId: "folder-1", ownerUserId: "owner-1", hasExplicitPolicy: true, policyId: "policy-1" }))
  const initial = await fixture.service.getVersionedFolderPolicy("default", "folder-1")
  await fixture.service.replaceVersionedFolderPolicy(secureFolderOwner(), "folder-1", {
    expectedVersion: initial.version,
    entries: [
      { principalType: "user", principalId: "owner-1", permissionLevel: "full" },
      { principalType: "user", principalId: "reader-1", permissionLevel: "readOnly" }
    ],
    reason: "first writer"
  })
  await assert.rejects(() => fixture.service.replaceVersionedFolderPolicy(secureFolderOwner(), "folder-1", {
    expectedVersion: initial.version,
    entries: [
      { principalType: "user", principalId: "owner-1", permissionLevel: "full" },
      { principalType: "user", principalId: "reader-2", permissionLevel: "readOnly" }
    ],
    reason: "stale writer"
  }), (error: unknown) => error instanceof FolderPolicyMutationError && error.result === "conflict")

  const current = await fixture.service.getVersionedFolderPolicy("default", "folder-1")
  assert.deepEqual(current.policy?.entries.map((entry) => entry.principalId), ["owner-1", "reader-1"])
  assert.equal((await fixture.objectStore.listKeys("security-audit/intents/")).length, 2)
})

test("versioned folder policy replacement requires feature plus target full and active same-tenant principals", async () => {
  const fixture = await secureFixture()
  fixture.directory.set({ userId: "owner-1", tenantId: "default", status: "active" })
  fixture.directory.set({ userId: "inactive-1", tenantId: "default", status: "suspended" })
  fixture.directory.set({ userId: "cross-tenant-1", tenantId: "tenant-b", status: "active" })
  await fixture.documentGroupStore.create(group({ groupId: "folder-1", ownerUserId: "owner-1", hasExplicitPolicy: true, policyId: "policy-1" }))
  const entries = [{ principalType: "user", principalId: "owner-1", permissionLevel: "full" }] as const

  for (const actor of [
    { ...secureFolderOwner(), cognitoGroups: ["CHAT_USER"] },
    { ...secureFolderOwner(), userId: "outsider-1" }
  ]) {
    const current = await fixture.service.getVersionedFolderPolicy("default", "folder-1")
    await assert.rejects(() => fixture.service.replaceVersionedFolderPolicy(actor, "folder-1", {
      expectedVersion: current.version,
      entries,
      reason: "unauthorized"
    }), (error: unknown) => error instanceof FolderPolicyMutationError && error.result === "denied")
  }

  for (const principalId of ["missing-1", "inactive-1", "cross-tenant-1"]) {
    const current = await fixture.service.getVersionedFolderPolicy("default", "folder-1")
    await assert.rejects(() => fixture.service.replaceVersionedFolderPolicy(secureFolderOwner(), "folder-1", {
      expectedVersion: current.version,
      entries: [
        ...entries,
        { principalType: "user", principalId, permissionLevel: "readOnly" }
      ],
      reason: "invalid principal"
    }), (error: unknown) => error instanceof FolderPolicyMutationError && error.result === "denied")
  }

  const current = await fixture.service.getVersionedFolderPolicy("default", "folder-1")
  await assert.rejects(() => fixture.service.replaceVersionedFolderPolicy(secureFolderOwner(), "folder-1", {
    expectedVersion: current.version,
    entries: [
      ...entries,
      { principalType: "group", principalId: "SYSTEM_ADMIN", permissionLevel: "readOnly" }
    ],
    reason: "role namespace"
  }), (error: unknown) => error instanceof FolderPolicyMutationError && error.result === "denied")
})

test("versioned folder policy rejects admin downgrade and cyclic retained resource-group principals", async () => {
  const fixture = await secureFixture()
  fixture.directory.set({ userId: "owner-1", tenantId: "default", status: "active" })
  await fixture.documentGroupStore.create(group({ groupId: "folder-1", ownerUserId: "owner-1", hasExplicitPolicy: true, policyId: "policy-1" }))
  await fixture.userGroupStore.save(userGroup("group-a"))
  await fixture.userGroupStore.save(userGroup("group-b"))
  await fixture.groupMembershipStore.save(membership("group-a", "group", "group-b", "full"))
  await fixture.groupMembershipStore.save(membership("group-b", "group", "group-a", "full"))

  for (const entries of [
    [
      { principalType: "user", principalId: "owner-1", permissionLevel: "readOnly" },
      { principalType: "group", principalId: "group-a", permissionLevel: "full" }
    ],
    [
      { principalType: "user", principalId: "owner-1", permissionLevel: "full" },
      { principalType: "group", principalId: "group-a", permissionLevel: "readOnly" }
    ]
  ] as const) {
    const current = await fixture.service.getVersionedFolderPolicy("default", "folder-1")
    await assert.rejects(() => fixture.service.replaceVersionedFolderPolicy(secureFolderOwner(), "folder-1", {
      expectedVersion: current.version,
      entries,
      reason: "invalid policy"
    }), (error: unknown) => error instanceof FolderPolicyMutationError && error.result === "denied")
  }
})

async function fixture() {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-folder-permission-test-"))
  const documentGroupStore = new LocalDocumentGroupStore(dataDir)
  const folderPolicyStore = new LocalFolderPolicyStore(dataDir)
  const userGroupStore = new LocalUserGroupStore(dataDir)
  const groupMembershipStore = new LocalGroupMembershipStore(dataDir)
  const service = new FolderPermissionService({ documentGroupStore, folderPolicyStore, userGroupStore, groupMembershipStore })
  return { documentGroupStore, folderPolicyStore, userGroupStore, groupMembershipStore, service }
}

async function secureFixture() {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-secure-folder-permission-test-"))
  const documentGroupStore = new LocalDocumentGroupStore(dataDir)
  const folderPolicyStore = new LocalFolderPolicyStore(dataDir)
  const userGroupStore = new LocalUserGroupStore(dataDir)
  const groupMembershipStore = new LocalGroupMembershipStore(dataDir)
  const objectStore = new LocalObjectStore(dataDir)
  const directory = new TestResourcePrincipalDirectory()
  const service = new FolderPermissionService({
    documentGroupStore,
    folderPolicyStore,
    userGroupStore,
    groupMembershipStore,
    resourceUserPrincipalDirectory: directory,
    securityAuditOutbox: new ObjectStoreSecurityMutationAuditOutbox(objectStore),
    objectStore
  })
  return { documentGroupStore, folderPolicyStore, userGroupStore, groupMembershipStore, objectStore, directory, service }
}

class TestResourcePrincipalDirectory implements ResourceUserPrincipalDirectory {
  private readonly users = new Map<string, ResourceUserPrincipal>()

  set(userPrincipal: ResourceUserPrincipal): void {
    this.users.set(userPrincipal.userId, userPrincipal)
  }

  async getUser(userId: string): Promise<ResourceUserPrincipal | undefined> {
    return this.users.get(userId)
  }
}

function secureFolderOwner(): AppUser {
  return { userId: "owner-1", cognitoGroups: ["RAG_GROUP_MANAGER"], accountStatus: "active", tenantId: "default" }
}

function user(userId: string, cognitoGroups: string[] = ["CHAT_USER"], accountStatus: AppUser["accountStatus"] = "active"): AppUser {
  return { userId, email: `${userId}@example.com`, cognitoGroups, accountStatus, tenantId: "default" }
}

function group(input: Partial<DocumentGroup> & Pick<DocumentGroup, "groupId" | "ownerUserId">): DocumentGroup {
  const now = "2026-05-17T00:00:00.000Z"
  const name = input.name ?? input.groupId
  return {
    groupId: input.groupId,
    schemaVersion: 2,
    itemType: "documentGroup",
    tenantId: input.tenantId ?? "default",
    adminPrincipalType: input.adminPrincipalType ?? "user",
    adminPrincipalId: input.adminPrincipalId ?? input.ownerUserId,
    name,
    normalizedName: name.toLocaleLowerCase("ja-JP"),
    canonicalPath: `/${name}`,
    normalizedCanonicalPath: `/${name.toLocaleLowerCase("ja-JP")}`,
    adminPathPk: `default#${input.adminPrincipalType ?? "user"}#${input.adminPrincipalId ?? input.ownerUserId}`,
    parentPathPk: "default#user#owner-1#ROOT",
    description: input.description,
    parentGroupId: input.parentGroupId,
    ancestorGroupIds: input.ancestorGroupIds ?? [],
    ownerUserId: input.ownerUserId,
    visibility: input.visibility ?? "private",
    sharedUserIds: input.sharedUserIds ?? [],
    sharedGroups: input.sharedGroups ?? [],
    managerUserIds: input.managerUserIds ?? [input.ownerUserId],
    hasExplicitPolicy: input.hasExplicitPolicy,
    policyId: input.policyId,
    status: input.status ?? "active",
    createdBy: input.createdBy ?? input.ownerUserId,
    createdAt: now,
    updatedAt: now
  }
}

function policy(policyId: string, folderId: string, entries: FolderPolicy["entries"]): FolderPolicy {
  return {
    policyId,
    itemType: "folderPolicy",
    tenantId: "default",
    folderId,
    entries,
    createdBy: "owner-1",
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z"
  }
}

function userGroup(groupId: string, input: Partial<UserGroup> = {}): UserGroup {
  return {
    groupId,
    itemType: "userGroup",
    tenantId: "default",
    name: groupId,
    type: "team",
    ancestorGroupIds: [],
    status: input.status ?? "active",
    createdBy: "owner-1",
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z"
  }
}

function membership(groupId: string, memberType: GroupMembership["memberType"], memberId: string, permissionLevel: GroupMembership["permissionLevel"]): GroupMembership {
  return {
    tenantId: "default",
    groupId,
    memberType,
    memberId,
    permissionLevel,
    source: "manual",
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z"
  }
}
