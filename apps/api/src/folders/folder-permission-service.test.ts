import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import type { AppUser } from "../auth.js"
import { LocalDocumentGroupStore } from "../adapters/local-document-group-store.js"
import { LocalFolderPolicyStore } from "../adapters/local-folder-policy-store.js"
import { LocalGroupMembershipStore } from "../adapters/local-group-membership-store.js"
import { LocalUserGroupStore } from "../adapters/local-user-group-store.js"
import type { DocumentGroup, FolderPolicy, GroupMembership, UserGroup } from "../types.js"
import { FolderPermissionService } from "./folder-permission-service.js"

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
  assert.equal((await folderPolicyStore.get("policy-team-a"))?.policyId, "policy-team-a")
})

test("archived folder resolves to none even for owner", async () => {
  const { documentGroupStore, service } = await fixture()
  await documentGroupStore.create(group({ groupId: "folder-1", adminPrincipalId: "owner-1", ownerUserId: "owner-1", status: "archived" }))

  assert.equal(await service.resolveEffectiveFolderPermission(user("owner-1"), "folder-1"), "none")
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

  assert.equal(await service.resolveEffectiveFolderPermission(user("user-1"), "folder-1"), "readOnly")
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

function user(userId: string, cognitoGroups: string[] = []): AppUser {
  return { userId, email: `${userId}@example.com`, cognitoGroups, accountStatus: "active" }
}

function group(input: Partial<DocumentGroup> & Pick<DocumentGroup, "groupId" | "ownerUserId">): DocumentGroup {
  const now = "2026-05-17T00:00:00.000Z"
  const name = input.name ?? input.groupId
  return {
    groupId: input.groupId,
    schemaVersion: 2,
    itemType: "documentGroup",
    tenantId: "default",
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

function userGroup(groupId: string): UserGroup {
  return {
    groupId,
    itemType: "userGroup",
    tenantId: "default",
    name: groupId,
    type: "team",
    ancestorGroupIds: [],
    status: "active",
    createdBy: "owner-1",
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z"
  }
}

function membership(groupId: string, memberType: GroupMembership["memberType"], memberId: string, permissionLevel: GroupMembership["permissionLevel"]): GroupMembership {
  return {
    groupId,
    memberType,
    memberId,
    permissionLevel,
    source: "manual",
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z"
  }
}
