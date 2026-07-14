import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalObjectStore } from "../../../adapters/local-object-store.js"
import { tenantPartitionId } from "../../../security/tenant-partition.js"
import { ObjectStoreRevocationCleanupTenantRegistry } from "./revocation-cleanup-tenant-registry.js"

test("FR-066 tenant registry discovers every registered tenant and backfills legacy cleanup state once", async () => {
  const objectStore = new LocalObjectStore(await mkdtemp(path.join(tmpdir(), "cleanup-tenants-")))
  const registry = new ObjectStoreRevocationCleanupTenantRegistry(
    objectStore,
    () => new Date("2026-07-11T00:00:00.000Z")
  )
  await Promise.all([registry.register("tenant-b"), registry.register("tenant-a"), registry.register("tenant-a")])
  await objectStore.putText(
    `security/revocation-cleanup/${tenantPartitionId("tenant-legacy")}/legacy.json`,
    JSON.stringify({ tenantId: "tenant-legacy" })
  )

  assert.deepEqual(await registry.listAllTenantIds(), ["tenant-a", "tenant-b", "tenant-legacy"])
  assert.equal((await objectStore.listKeys("security/revocation-cleanup-tenants/")).length, 3)
  await assert.doesNotReject(() => objectStore.getText("security/revocation-cleanup-tenant-registry-state/backfill-v1.json"))

  // Once the migration marker exists, scheduled discovery is registry-primary;
  // all current producers register a tenant before writing cleanup state.
  await objectStore.putText(
    `security/revocation-cleanup/${tenantPartitionId("late-unregistered")}/late.json`,
    JSON.stringify({ tenantId: "late-unregistered" })
  )
  assert.deepEqual(await registry.listAllTenantIds(), ["tenant-a", "tenant-b", "tenant-legacy"])
})

test("FR-066 tenant registry rejects legacy state stored under another tenant partition", async () => {
  const objectStore = new LocalObjectStore(await mkdtemp(path.join(tmpdir(), "cleanup-tenants-cross-partition-")))
  await objectStore.putText(
    `security/revocation-cleanup/${tenantPartitionId("tenant-a")}/crossed.json`,
    JSON.stringify({ tenantId: "tenant-b" })
  )
  await assert.rejects(
    () => new ObjectStoreRevocationCleanupTenantRegistry(objectStore).listAllTenantIds(),
    /crossed a tenant partition/
  )
})
