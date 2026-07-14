import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import test from "node:test"

const scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "document-group-canonical-path-backfill.mjs")

test("document group backfill emits tenant physical keys without changing public IDs", async () => {
  const fixture = await fixturePaths()
  await writeFile(fixture.inputPath, JSON.stringify({
    groups: [{
      groupId: "shared-id",
      tenantId: "tenant-a",
      ownerUserId: "owner-a",
      name: "営業",
      createdAt: "2026-07-11T00:00:00.000Z",
      updatedAt: "2026-07-11T00:00:00.000Z"
    }]
  }))

  const result = runBackfill(fixture)
  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(await readFile(fixture.reportPath, "utf8"))
  const partition = `tenant:${createHash("sha256").update("tenant-a").digest("hex").slice(0, 24)}`
  assert.equal(report.canApply, true)
  assert.deepEqual(report.canonicalFieldUpdates[0], {
    groupId: "shared-id",
    tenantId: "tenant-a",
    adminPrincipalType: "user",
    adminPrincipalId: "owner-a",
    normalizedName: "営業",
    canonicalPath: "/営業",
    normalizedCanonicalPath: "/営業",
    adminPathPk: "tenant-a#user#owner-a",
    parentPathPk: "tenant-a#user#owner-a#ROOT",
    storageGroupId: `${partition}#shared-id`,
    storageAdminPathPk: `${partition}#tenant-a%23user%23owner-a`,
    tenantPartitionId: partition,
    tenantItemId: "documentGroup#shared-id",
    schemaVersion: 2
  })
  assert.equal(report.lockItems[0].tenantPartitionId, partition)
  assert.equal(report.lockItems[0].rawAdminPathPk, "tenant-a#user#owner-a")
  assert.match(report.lockItems[0].groupId, new RegExp(`^${partition}#pathlock%23`))
})

test("document group backfill fails closed when a root tenant is missing", async () => {
  const fixture = await fixturePaths()
  await writeFile(fixture.inputPath, JSON.stringify({
    groups: [{ groupId: "legacy", ownerUserId: "owner-a", name: "Legacy" }]
  }))

  const result = runBackfill(fixture)
  assert.equal(result.status, 1)
  const report = JSON.parse(await readFile(fixture.reportPath, "utf8"))
  assert.equal(report.canApply, false)
  assert.deepEqual(report.canonicalFieldUpdates, [])
  assert.match(report.skipped[0], /no authoritative tenantId/)
})

async function fixturePaths() {
  const directory = await mkdtemp(path.join(tmpdir(), "document-group-backfill-"))
  return {
    directory,
    inputPath: path.join(directory, "document-groups.json"),
    reportPath: path.join(directory, "report.json")
  }
}

function runBackfill(fixture) {
  return spawnSync(process.execPath, [scriptPath, "--dry-run"], {
    cwd: fixture.directory,
    encoding: "utf8",
    env: {
      ...process.env,
      DOCUMENT_GROUPS_BACKFILL_INPUT: fixture.inputPath,
      DOCUMENT_GROUPS_BACKFILL_REPORT: fixture.reportPath
    }
  })
}
