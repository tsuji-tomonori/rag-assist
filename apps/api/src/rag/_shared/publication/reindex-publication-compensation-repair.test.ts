import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalObjectStore } from "../../../adapters/local-object-store.js"
import { ObjectStoreReindexPublicationCompensationRepair } from "./reindex-publication-compensation-repair.js"

const at = "2026-07-11T00:00:00.000Z"

test("FR-090 reindex compensation intent survives failure and concurrent retry to completion", async () => {
  const objectStore = new LocalObjectStore(await mkdtemp(path.join(tmpdir(), "reindex-compensation-")))
  const store = new ObjectStoreReindexPublicationCompensationRepair(objectStore)
  const input = {
    action: "cutover" as const,
    tenantId: "tenant-a",
    migrationId: "migration-a",
    publicationRunId: "publication-a",
    expectedMigrationStatus: "staged" as const,
    preparedAt: at
  }
  const [first, second] = await Promise.all([store.prepare(input), store.prepare(input)])
  assert.equal(first.operationId, second.operationId)
  const failed = await store.markFailed(first, new Error("rollback unavailable"), "2026-07-11T00:00:01.000Z")
  assert.equal(failed.status, "pending")
  assert.equal(failed.attempts, 1)
  assert.match(failed.lastError ?? "", /rollback_unavailable/)

  const result = {
    activeDocumentId: "document-a",
    compensatedAt: "2026-07-11T00:00:02.000Z",
    generation: 2,
    fencingToken: "fence-a",
    checkpoint: "rolled_back"
  }
  const [left, right] = await Promise.all([
    store.markCompensated(failed, result, "2026-07-11T00:00:03.000Z"),
    store.markCompensated(second, result, "2026-07-11T00:00:03.000Z")
  ])
  assert.equal(left.status, "compensated")
  assert.equal(right.status, "compensated")
  const completed = await store.markCompleted(left, "2026-07-11T00:00:04.000Z")
  assert.equal(completed.status, "completed")
  assert.deepEqual(completed.compensation, result)
})
