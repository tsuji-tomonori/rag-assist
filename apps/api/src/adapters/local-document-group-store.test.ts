import assert from "node:assert/strict"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalDocumentGroupStore } from "./local-document-group-store.js"
import type { DocumentGroup } from "../types.js"

test("local document group store preserves legacy reads and basic create/update errors", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-local-document-groups-"))
  const store = new LocalDocumentGroupStore(dataDir)

  assert.deepEqual(await store.list(), [])
  assert.deepEqual(await store.updateWithPathLocks([]), [])

  await assert.rejects(() => store.update("missing", { name: "Updated" }), /Document group not found/)

  const created = await store.create(group("docgrp_1", "/team"))
  assert.equal((await store.get("docgrp_1"))?.groupId, created.groupId)
  await assert.rejects(() => store.create(group("docgrp_1", "/team-copy")), /Document group already exists/)

  const updated = await store.update("docgrp_1", { description: "Updated description", updatedAt: "2026-05-02T00:00:00.000Z" })
  assert.equal(updated.description, "Updated description")
  assert.equal(updated.updatedAt, "2026-05-02T00:00:00.000Z")

  await writeFile(path.join(dataDir, "document-groups.json"), JSON.stringify({
    schemaVersion: 1,
    groups: "not-an-array",
    pathLocks: "not-an-array"
  }))
  assert.deepEqual(await store.list(), [])
})

test("local document group store enforces canonical path locks for create and move", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-local-document-groups-"))
  const store = new LocalDocumentGroupStore(dataDir)
  const source = await store.createWithPathLock(group("docgrp_1", "/team"))
  await assert.rejects(() => store.createWithPathLock(group("docgrp_2", "/team")), /canonical path already exists/)
  await assert.rejects(() => store.createWithPathLock(group("docgrp_1", "/team-copy")), /Document group already exists/)

  const sibling = await store.createWithPathLock(group("docgrp_2", "/sibling"))
  await assert.rejects(() => store.updateWithPathLocks([{
    current: { ...source, updatedAt: "2026-04-30T00:00:00.000Z" },
    next: group("docgrp_1", "/renamed")
  }]), /changed before path update/)
  await assert.rejects(() => store.updateWithPathLocks([{
    current: source,
    next: { ...group("docgrp_1", "/sibling"), updatedAt: "2026-05-03T00:00:00.000Z" }
  }]), /canonical path already exists/)

  const moved = { ...group("docgrp_1", "/renamed"), updatedAt: "2026-05-03T00:00:00.000Z" }
  assert.deepEqual(await store.updateWithPathLocks([{ current: source, next: moved }]), [moved])
  assert.equal((await store.findByCanonicalPath("default#user#owner-1", "/renamed"))?.groupId, "docgrp_1")
  assert.deepEqual((await store.listByAdminPath("default#user#owner-1")).map((item) => item.groupId).sort(), [moved.groupId, sibling.groupId].sort())
  await assert.rejects(() => store.createWithPathLock(group("docgrp_3", "/renamed")), /canonical path already exists/)
})

test("local document group store detects lock conflicts during path updates", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-local-document-groups-"))
  const store = new LocalDocumentGroupStore(dataDir)
  const source = group("docgrp_1", "/team")
  await store.create(source)
  await store.createWithPathLock(group("docgrp_2", "/locked"))

  await assert.rejects(() => store.updateWithPathLocks([{
    current: source,
    next: { ...group("docgrp_1", "/locked"), updatedAt: "2026-05-03T00:00:00.000Z" }
  }]), /canonical path already exists/)
})

function group(groupId: string, normalizedCanonicalPath: string): DocumentGroup {
  const name = normalizedCanonicalPath.split("/").filter(Boolean).at(-1) ?? "team"
  return {
    groupId,
    schemaVersion: 2,
    itemType: "documentGroup",
    tenantId: "default",
    adminPrincipalType: "user",
    adminPrincipalId: "owner-1",
    name,
    normalizedName: name,
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
