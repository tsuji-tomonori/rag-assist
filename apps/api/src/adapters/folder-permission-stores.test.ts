import assert from "node:assert/strict"
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { GetItemCommand, PutItemCommand, QueryCommand, ScanCommand, TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb"
import { DynamoDbFolderPolicyStore } from "./dynamodb-folder-policy-store.js"
import { DynamoDbGroupMembershipStore } from "./dynamodb-group-membership-store.js"
import { DynamoDbUserGroupStore } from "./dynamodb-user-group-store.js"
import { LocalFolderPolicyStore } from "./local-folder-policy-store.js"
import { LocalGroupMembershipStore } from "./local-group-membership-store.js"
import { LocalUserGroupStore } from "./local-user-group-store.js"
import type { FolderPolicy, GroupMembership, UserGroup } from "../types.js"
import { TENANT_ITEM_INDEX_NAME, tenantPartitionId } from "../security/tenant-partition.js"

test("local folder permission stores persist policies, groups, and memberships", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-folder-stores-test-"))
  const policyStore = new LocalFolderPolicyStore(dataDir)
  const groupStore = new LocalUserGroupStore(dataDir)
  const membershipStore = new LocalGroupMembershipStore(dataDir)

  const savedPolicy = await policyStore.save(policy("policy-1", "folder-1"))
  const savedGroup = await groupStore.save(userGroup("team-a"))
  const savedMembership = await membershipStore.save(membership("team-a", "user", "user-1"))

  assert.deepEqual(await policyStore.get("default", "policy-1"), savedPolicy)
  assert.deepEqual(await policyStore.findByFolderId("default", "folder-1"), savedPolicy)
  const tenantBPolicy = await policyStore.save({ ...policy("policy-1", "folder-1"), tenantId: "tenant-b" })
  assert.deepEqual(await policyStore.get("tenant-b", "policy-1"), tenantBPolicy)
  assert.deepEqual(await policyStore.get("default", "policy-1"), savedPolicy)
  assert.deepEqual(await groupStore.get("default", "team-a"), savedGroup)
  assert.equal((await groupStore.archive("default", "team-a", "2026-05-17T00:00:01.000Z")).status, "archived")
  assert.deepEqual(await membershipStore.listByGroupId("default", "team-a"), [savedMembership])
  assert.deepEqual(await membershipStore.listByMember("default", "user", "user-1"), [savedMembership])
  await membershipStore.delete("default", "team-a", "user", "user-1")
  assert.deepEqual(await membershipStore.listByGroupId("default", "team-a"), [])
})

test("local resource groups and memberships allow the same raw IDs in isolated tenant partitions", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-resource-group-tenant-test-"))
  const groups = new LocalUserGroupStore(dataDir)
  const memberships = new LocalGroupMembershipStore(dataDir)
  const tenantAGroup = { ...userGroup("shared-id"), tenantId: "tenant-a", name: "Tenant A" }
  const tenantBGroup = { ...userGroup("shared-id"), tenantId: "tenant-b", name: "Tenant B" }
  const tenantAMembership = { ...membership("shared-id", "user", "same-user"), tenantId: "tenant-a", permissionLevel: "readOnly" as const }
  const tenantBMembership = { ...membership("shared-id", "user", "same-user"), tenantId: "tenant-b", permissionLevel: "full" as const }

  await groups.save(tenantAGroup)
  await groups.save(tenantBGroup)
  const savedTenantAMembership = await memberships.save(tenantAMembership)
  const savedTenantBMembership = await memberships.save(tenantBMembership)

  assert.equal((await groups.get("tenant-a", "shared-id"))?.name, "Tenant A")
  assert.equal((await groups.get("tenant-b", "shared-id"))?.name, "Tenant B")
  assert.deepEqual((await memberships.getVersionedGroupState("tenant-a", "shared-id")).memberships, [savedTenantAMembership])
  assert.deepEqual((await memberships.getVersionedGroupState("tenant-b", "shared-id")).memberships, [savedTenantBMembership])
  await groups.archive("tenant-a", "shared-id", "2026-05-17T00:00:01.000Z")
  assert.equal((await groups.get("tenant-a", "shared-id"))?.status, "archived")
  assert.equal((await groups.get("tenant-b", "shared-id"))?.status, "active")
})

test("dynamodb folder permission stores write discriminated items to the shared table", async () => {
  const commands: unknown[] = []
  const client = { send: async (command: unknown) => {
    commands.push(command)
    return command instanceof ScanCommand ? { Items: [] } : {}
  } }

  await new DynamoDbFolderPolicyStore("DocumentGroups", client as never).save(policy("policy-1", "folder-1"))
  await new DynamoDbUserGroupStore("DocumentGroups", client as never).save(userGroup("team-a"))
  await new DynamoDbGroupMembershipStore("DocumentGroups", client as never).save(membership("team-a", "user", "user-1"))

  assert.ok(commands.filter((command) => command instanceof TransactWriteItemsCommand).length >= 2)
  assert.equal(commands.filter((command) => command instanceof PutItemCommand).length, 1)
})

test("dynamodb resource-group physical keys include the tenant partition for identical raw IDs", async () => {
  const groupCommands: PutItemCommand[] = []
  const groupClient = { send: async (command: unknown) => {
    if (command instanceof PutItemCommand) groupCommands.push(command)
    return {}
  } }
  const groups = new DynamoDbUserGroupStore("DocumentGroups", groupClient as never)
  await groups.save({ ...userGroup("shared-id"), tenantId: "tenant-a" })
  await groups.save({ ...userGroup("shared-id"), tenantId: "tenant-b" })
  const groupKeys = groupCommands.map((command) => command.input.Item?.groupId?.S)
  assert.equal(new Set(groupKeys).size, 2)
  assert.ok(groupKeys.every((key) => key?.startsWith("tenant:")))

  const membershipCommands: unknown[] = []
  const membershipClient = { send: async (command: unknown) => {
    membershipCommands.push(command)
    if (command instanceof ScanCommand) return { Items: [] }
    if (command instanceof GetItemCommand) return {}
    return {}
  } }
  const membershipStore = new DynamoDbGroupMembershipStore("DocumentGroups", membershipClient as never)
  await membershipStore.save({ ...membership("shared-id", "user", "same-user"), tenantId: "tenant-a" })
  await membershipStore.save({ ...membership("shared-id", "user", "same-user"), tenantId: "tenant-b" })
  const membershipKeys = membershipCommands
    .filter((command): command is TransactWriteItemsCommand => command instanceof TransactWriteItemsCommand)
    .flatMap((command) => command.input.TransactItems ?? [])
    .map((item) => item.Put?.Item)
    .filter((item) => item?.itemType?.S === "groupMembership")
    .map((item) => item?.groupId?.S)
  assert.equal(new Set(membershipKeys).size, 2)
  assert.ok(membershipKeys.every((key) => key?.startsWith("tenant:")))
})

test("dynamodb resource-group stores use tenant-index queries and contain no Scan command", async () => {
  const commands: unknown[] = []
  const client = { send: async (command: unknown) => {
    commands.push(command)
    return { Items: [] }
  } }
  const groups = new DynamoDbUserGroupStore("DocumentGroups", client as never)
  const memberships = new DynamoDbGroupMembershipStore("DocumentGroups", client as never)

  await groups.list("tenant-a")
  await memberships.list("tenant-a")
  await memberships.listByGroupId("tenant-a", "team-a")

  const queries = commands.filter((command): command is QueryCommand => command instanceof QueryCommand)
  assert.equal(queries.length, 3)
  assert.ok(queries.every((command) => command.input.IndexName === TENANT_ITEM_INDEX_NAME))
  assert.ok(queries.every((command) => command.input.KeyConditionExpression === (
    "tenantPartitionId = :tenantPartitionId AND begins_with(tenantItemId, :itemPrefix)"
  )))
  assert.ok(queries.every((command) => (
    command.input.ExpressionAttributeValues?.[":tenantPartitionId"]?.S === tenantPartitionId("tenant-a")
  )))
  assert.deepEqual(queries.map((command) => command.input.ExpressionAttributeValues?.[":itemPrefix"]?.S), [
    "userGroup#",
    "groupMembership#membership#",
    "groupMembership#membership#team-a#"
  ])
  assert.equal(commands.some((command) => command instanceof ScanCommand), false)

  const sources = await Promise.all([
    readFile(new URL("./dynamodb-user-group-store.ts", import.meta.url), "utf-8"),
    readFile(new URL("./dynamodb-group-membership-store.ts", import.meta.url), "utf-8")
  ])
  for (const source of sources) assert.doesNotMatch(source, /\bScanCommand\b/u)
})

test("local folder policy complete-state replace is atomic and rejects stale versions", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-folder-policy-version-test-"))
  const store = new LocalFolderPolicyStore(dataDir)
  const initial = await store.getVersionedByFolderId("default", "folder-1")
  const first = await store.replaceForFolder(policy("policy-1", "folder-1"), initial.version)
  assert.equal(first.policy?.policyId, "policy-1")
  assert.notEqual(first.version, initial.version)

  await assert.rejects(
    () => store.replaceForFolder(policy("policy-stale", "folder-1"), initial.version),
    (error: unknown) => error instanceof Error && (error as Error & { code?: string }).code === "PRECONDITION_FAILED"
  )
  const currentVersion = (await store.getVersionedByFolderId("default", "folder-1")).version
  const results = await Promise.allSettled([
    store.replaceForFolder({ ...policy("policy-a", "folder-1"), updatedAt: "2026-05-17T00:00:01.000Z" }, currentVersion),
    store.replaceForFolder({ ...policy("policy-b", "folder-1"), updatedAt: "2026-05-17T00:00:02.000Z" }, currentVersion)
  ])
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1)
  assert.equal(results.filter((result) => result.status === "rejected").length, 1)
})

test("dynamodb folder policy complete-state replace uses a transaction and version marker", async () => {
  const commands: unknown[] = []
  const client = { send: async (command: unknown) => {
    commands.push(command)
    if (command instanceof ScanCommand) return { Items: [] }
    if (command instanceof GetItemCommand) return {}
    return {}
  } }
  const store = new DynamoDbFolderPolicyStore("DocumentGroups", client as never)
  const initial = await store.getVersionedByFolderId("default", "folder-1")
  const replaced = await store.replaceForFolder(policy("policy-1", "folder-1"), initial.version)
  assert.equal(replaced.policy?.folderId, "folder-1")
  assert.ok(commands.some((command) => command instanceof TransactWriteItemsCommand))
})

test("local membership complete-state replace is atomic and rejects stale versions", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-membership-version-test-"))
  const store = new LocalGroupMembershipStore(dataDir)
  const initial = await store.getVersionedGroupState("default", "team-a")
  const first = await store.replaceGroupState("default", "team-a", [membership("team-a", "user", "user-1")], initial.version)
  assert.equal(first.memberships.length, 1)
  assert.notEqual(first.version, initial.version)

  await assert.rejects(
    () => store.replaceGroupState("default", "team-a", [membership("team-a", "user", "user-2")], initial.version),
    (error: unknown) => error instanceof Error && (error as Error & { code?: string }).code === "PRECONDITION_FAILED"
  )

  const concurrentVersion = (await store.getVersionedGroupState("default", "team-a")).version
  const results = await Promise.allSettled([
    store.replaceGroupState("default", "team-a", [membership("team-a", "user", "user-2")], concurrentVersion),
    store.replaceGroupState("default", "team-a", [membership("team-a", "user", "user-3")], concurrentVersion)
  ])
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1)
  assert.equal(results.filter((result) => result.status === "rejected").length, 1)
})

test("local resource-group owner replacement rejects stale updatedAt", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-user-group-owner-cas-test-"))
  const store = new LocalUserGroupStore(dataDir)
  const initial = await store.save(userGroup("team-owner"))
  const replaced = await store.replace({ ...initial, createdBy: "successor-1", updatedAt: "2026-05-17T00:00:01.000Z" }, initial.updatedAt)
  assert.equal(replaced.createdBy, "successor-1")
  await assert.rejects(
    () => store.replace({ ...initial, createdBy: "stale-1", updatedAt: "2026-05-17T00:00:02.000Z" }, initial.updatedAt),
    (error: unknown) => error instanceof Error && (error as Error & { code?: string }).code === "PRECONDITION_FAILED"
  )
})

test("dynamodb membership complete-state replace uses a transaction and version marker", async () => {
  const commands: unknown[] = []
  const client = { send: async (command: unknown) => {
    commands.push(command)
    if (command instanceof ScanCommand) return { Items: [] }
    if (command instanceof GetItemCommand) return {}
    return {}
  } }
  const store = new DynamoDbGroupMembershipStore("DocumentGroups", client as never)
  const initial = await store.getVersionedGroupState("default", "team-a")
  await store.replaceGroupState("default", "team-a", [membership("team-a", "user", "user-1")], initial.version)
  assert.ok(commands.some((command) => command instanceof TransactWriteItemsCommand))
})

function policy(policyId: string, folderId: string): FolderPolicy {
  return {
    policyId,
    itemType: "folderPolicy",
    tenantId: "default",
    folderId,
    entries: [{ principalType: "user", principalId: "owner-1", permissionLevel: "full" }],
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

function membership(groupId: string, memberType: GroupMembership["memberType"], memberId: string): GroupMembership {
  return {
    tenantId: "default",
    groupId,
    memberType,
    memberId,
    permissionLevel: "full",
    source: "manual",
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z"
  }
}
