import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { PutItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb"
import { DynamoDbFolderPolicyStore } from "./dynamodb-folder-policy-store.js"
import { DynamoDbGroupMembershipStore } from "./dynamodb-group-membership-store.js"
import { DynamoDbUserGroupStore } from "./dynamodb-user-group-store.js"
import { LocalFolderPolicyStore } from "./local-folder-policy-store.js"
import { LocalGroupMembershipStore } from "./local-group-membership-store.js"
import { LocalUserGroupStore } from "./local-user-group-store.js"
import type { FolderPolicy, GroupMembership, UserGroup } from "../types.js"

test("local folder permission stores persist policies, groups, and memberships", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-folder-stores-test-"))
  const policyStore = new LocalFolderPolicyStore(dataDir)
  const groupStore = new LocalUserGroupStore(dataDir)
  const membershipStore = new LocalGroupMembershipStore(dataDir)

  const savedPolicy = await policyStore.save(policy("policy-1", "folder-1"))
  const savedGroup = await groupStore.save(userGroup("team-a"))
  const savedMembership = await membershipStore.save(membership("team-a", "user", "user-1"))

  assert.deepEqual(await policyStore.get("policy-1"), savedPolicy)
  assert.deepEqual(await policyStore.findByFolderId("folder-1"), savedPolicy)
  assert.deepEqual(await groupStore.get("team-a"), savedGroup)
  assert.equal((await groupStore.archive("team-a", "2026-05-17T00:00:01.000Z")).status, "archived")
  assert.deepEqual(await membershipStore.listByGroupId("team-a"), [savedMembership])
  assert.deepEqual(await membershipStore.listByMember("user", "user-1"), [savedMembership])
  await membershipStore.delete("team-a", "user", "user-1")
  assert.deepEqual(await membershipStore.listByGroupId("team-a"), [])
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

  assert.ok(commands[0] instanceof PutItemCommand)
  assert.ok(commands[1] instanceof PutItemCommand)
  assert.ok(commands[2] instanceof PutItemCommand)
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
    groupId,
    memberType,
    memberId,
    permissionLevel: "full",
    source: "manual",
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z"
  }
}
