import assert from "node:assert/strict"
import test from "node:test"
import { tenantPartitionedOwnerKey } from "../rag/memorag-service.js"
import { tenantPartitionId } from "./tenant-partition.js"

test("FR-060 conversation and favorite owner partitions differ for the same subject across tenants", () => {
  const tenantA = tenantPartitionedOwnerKey({
    userId: "same-subject",
    cognitoGroups: ["CHAT_USER"],
    accountStatus: "active",
    tenantId: "tenant-a"
  })
  const tenantB = tenantPartitionedOwnerKey({
    userId: "same-subject",
    cognitoGroups: ["CHAT_USER"],
    accountStatus: "active",
    tenantId: "tenant-b"
  })
  assert.notEqual(tenantA, tenantB)
  assert.match(tenantA, /^tenant:tenant-a:user:same-subject$/)
  assert.match(tenantB, /^tenant:tenant-b:user:same-subject$/)
})

test("FR-060 partition key is derived from server actor data and safely encodes delimiters", () => {
  const key = tenantPartitionedOwnerKey({
    userId: "subject:1/2",
    cognitoGroups: ["CHAT_USER"],
    accountStatus: "active",
    tenantId: "tenant/a:b"
  })
  assert.equal(key, "tenant:tenant%2Fa%3Ab:user:subject%3A1%2F2")
})

test("FR-060 trace partition identifiers are stable, tenant-specific, and non-reversible labels", () => {
  const a = tenantPartitionId("tenant-a")
  const b = tenantPartitionId("tenant-b")
  assert.notEqual(a, b)
  assert.equal(a, tenantPartitionId("tenant-a"))
  assert.match(a, /^tenant:[a-f0-9]{24}$/)
  assert.doesNotMatch(a, /tenant-a/)
})
