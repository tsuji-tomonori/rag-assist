import assert from "node:assert/strict"
import test from "node:test"
import { QueryCommand, TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb"
import { marshall } from "@aws-sdk/util-dynamodb"
import { DynamoDbDocumentGroupStore } from "./dynamodb-document-group-store.js"
import type { DocumentGroup } from "../types.js"

test("dynamodb document group store creates groups with a path lock transaction", async () => {
  const commands: unknown[] = []
  const store = new DynamoDbDocumentGroupStore("DocumentGroups", { send: async (command: unknown) => {
    commands.push(command)
    return {}
  } } as never)

  await store.createWithPathLock(group("docgrp_1", "/team"))
  const command = commands[0]
  assert.ok(command instanceof TransactWriteItemsCommand)
  const input = command.input
  assert.equal(input.TransactItems?.length, 2)
  assert.equal(input.TransactItems?.[0]?.Put?.ConditionExpression, "attribute_not_exists(groupId)")
  assert.equal(input.TransactItems?.[1]?.Put?.ConditionExpression, "attribute_not_exists(groupId)")
})

test("dynamodb document group store updates paths with new lock, guarded group put, and old lock delete", async () => {
  const commands: unknown[] = []
  const store = new DynamoDbDocumentGroupStore("DocumentGroups", { send: async (command: unknown) => {
    commands.push(command)
    return {}
  } } as never)

  await store.updateWithPathLocks([{
    current: group("docgrp_1", "/old"),
    next: group("docgrp_1", "/new")
  }])
  const command = commands[0]
  assert.ok(command instanceof TransactWriteItemsCommand)
  const input = command.input
  assert.equal(input.TransactItems?.length, 3)
  assert.equal(input.TransactItems?.[0]?.Put?.ConditionExpression, "attribute_not_exists(groupId)")
  assert.equal(input.TransactItems?.[1]?.Put?.ConditionExpression, "attribute_exists(groupId) AND updatedAt = :updatedAt")
  assert.equal(input.TransactItems?.[2]?.Delete?.ConditionExpression, "lockedGroupId = :lockedGroupId")
})

test("dynamodb document group store does not delete an old lock for legacy normalized groups", async () => {
  const commands: unknown[] = []
  const store = new DynamoDbDocumentGroupStore("DocumentGroups", { send: async (command: unknown) => {
    commands.push(command)
    return {}
  } } as never)

  await store.updateWithPathLocks([{
    current: { ...group("docgrp_1", "/old"), schemaVersion: 1 },
    next: group("docgrp_1", "/new")
  }])
  const command = commands[0]
  assert.ok(command instanceof TransactWriteItemsCommand)
  const input = command.input
  assert.equal(input.TransactItems?.length, 2)
  assert.equal(input.TransactItems?.[0]?.Put?.ConditionExpression, "attribute_not_exists(groupId)")
  assert.equal(input.TransactItems?.[1]?.Put?.ConditionExpression, "attribute_exists(groupId) AND updatedAt = :updatedAt")
})

test("dynamodb document group store queries the AdminCanonicalPathIndex", async () => {
  const commands: unknown[] = []
  const store = new DynamoDbDocumentGroupStore("DocumentGroups", { send: async (command: unknown) => {
    commands.push(command)
    return { Items: [] }
  } } as never)

  await store.listByAdminPath("default#user#owner-1")
  const command = commands[0]
  assert.ok(command instanceof QueryCommand)
  assert.equal(command.input.IndexName, "AdminCanonicalPathIndex")
  assert.equal(command.input.KeyConditionExpression, "adminPathPk = :adminPathPk")
})

test("dynamodb document group store skips path locks when finding a canonical path", async () => {
  const expected = group("docgrp_1", "/team")
  const store = new DynamoDbDocumentGroupStore("DocumentGroups", { send: async () => ({
    Items: [
      marshall({
        groupId: "pathlock#default%23user%23owner-1#%2Fteam",
        itemType: "documentGroupPathLock",
        adminPathPk: "default#user#owner-1",
        normalizedCanonicalPath: "/team",
        lockedGroupId: "docgrp_1",
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z"
      }),
      marshall(expected)
    ]
  }) } as never)

  assert.deepEqual(await store.findByCanonicalPath("default#user#owner-1", "/team"), expected)
})

function group(groupId: string, normalizedCanonicalPath: string): DocumentGroup {
  return {
    groupId,
    schemaVersion: 2,
    itemType: "documentGroup",
    tenantId: "default",
    adminPrincipalType: "user",
    adminPrincipalId: "owner-1",
    name: normalizedCanonicalPath.split("/").filter(Boolean).at(-1) ?? "team",
    normalizedName: normalizedCanonicalPath.split("/").filter(Boolean).at(-1) ?? "team",
    canonicalPath: normalizedCanonicalPath,
    normalizedCanonicalPath,
    adminPathPk: "default#user#owner-1",
    parentPathPk: "default#user#owner-1#ROOT",
    ownerUserId: "owner-1",
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: ["owner-1"],
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z"
  }
}
