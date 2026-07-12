import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalObjectStore } from "../../../adapters/local-object-store.js"
import {
  ObjectStoreRevocationCleanupRepairOutbox,
  RevocationCleanupFenceError
} from "./revocation-cleanup-repair-outbox.js"

const at = "2026-07-11T00:00:00.000Z"

test("FR-066 shared repair outbox fences regrant from pre-deny prepare through cleanup registration", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(tmpdir(), "cleanup-repair-")))
  const outbox = new ObjectStoreRevocationCleanupRepairOutbox(store)
  const prepared = await outbox.prepare({
    expectedBeforeDenyVersion: "before-v1",
    preparedAt: at,
    cleanupRegistration: {
      operationId: "document-share:audit-1",
      tenantId: "tenant-a",
      resourceType: "document",
      resourceId: "document-a",
      trigger: "share_revoked",
      authoritativeDenyVersion: "deny-v2",
      authoritativeDenyConfirmedAt: at,
      knownTargets: [{ scope: "grant", reference: "document:document-a:principal:user:user-a:ceiling:none" }]
    }
  })

  await assert.rejects(
    () => outbox.assertResourceFenceReleased("tenant-a", "document", "document-a"),
    (error: unknown) => error instanceof RevocationCleanupFenceError
  )
  assert.equal((await outbox.listPending("tenant-a"))[0]?.status, "prepared")
  const committed = await outbox.markDenyCommitted(prepared, at)
  const registered = await outbox.markCleanupRegistered(committed, at)
  await assert.rejects(() => outbox.assertResourceFenceReleased("tenant-a", "document", "document-a"), RevocationCleanupFenceError)
  await outbox.markCleanupCompleted(registered, at)
  await assert.doesNotReject(() => outbox.assertResourceFenceReleased("tenant-a", "document", "document-a"))
  assert.deepEqual(await outbox.listPending("tenant-a"), [])
})

test("FR-066 abandoned pre-deny repair releases only its exact tenant resource fence", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(tmpdir(), "cleanup-repair-abandon-")))
  const outbox = new ObjectStoreRevocationCleanupRepairOutbox(store)
  const prepared = await outbox.prepare({
    expectedBeforeDenyVersion: "before-v1",
    preparedAt: at,
    cleanupRegistration: {
      operationId: "folder-share:audit-1",
      tenantId: "tenant-a",
      resourceType: "folder",
      resourceId: "folder-a",
      trigger: "share_revoked",
      authoritativeDenyVersion: "deny-v2",
      authoritativeDenyConfirmedAt: at
    }
  })
  await assert.doesNotReject(() => outbox.assertResourceFenceReleased("tenant-b", "folder", "folder-a"))
  await outbox.markAbandoned(prepared, at)
  await assert.doesNotReject(() => outbox.assertResourceFenceReleased("tenant-a", "folder", "folder-a"))
})
