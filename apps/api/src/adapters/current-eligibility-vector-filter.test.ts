import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import { LocalVectorStore } from "./local-vector-store.js"
import type { VectorRecord } from "../types.js"

function record(input: {
  key: string
  documentId: string
  vector: number[]
  lifecycleStatus?: "active" | "staging" | "superseded"
  ragEligibility?: "eligible" | "eligible_with_warning" | "excluded"
  tenantId?: string
  aclGroups?: string[]
}): VectorRecord {
  return {
    key: input.key,
    vector: input.vector,
    metadata: {
      kind: "chunk",
      documentId: input.documentId,
      fileName: `${input.documentId}.txt`,
      lifecycleStatus: input.lifecycleStatus,
      ragEligibility: input.ragEligibility,
      tenantId: input.tenantId,
      aclGroups: input.aclGroups,
      createdAt: "2026-07-11T00:00:00.000Z"
    }
  }
}

test("FR-070 engine filter uses authorized document ids before top-k ranking", async () => {
  const store = new LocalVectorStore(await mkdtemp(path.join(os.tmpdir(), "vector-authorized-topk-")))
  await store.put([
    record({ key: "unauthorized-high", documentId: "doc-secret", vector: [1, 0], tenantId: "tenant-a", lifecycleStatus: "active", ragEligibility: "eligible" }),
    record({ key: "authorized-lower", documentId: "doc-readable", vector: [0.8, 0.2], tenantId: "tenant-a", lifecycleStatus: "active", ragEligibility: "eligible" })
  ])

  const hits = await store.query([1, 0], 1, {
    tenantId: "tenant-a",
    documentIds: ["doc-readable"],
    lifecycleStatus: "active",
    ragEligibility: "eligible"
  })

  assert.deepEqual(hits.map((hit) => hit.key), ["authorized-lower"])
})
test("FR-069/070 missing lifecycle or quality metadata is not defaulted to active/eligible", async () => {
  const store = new LocalVectorStore(await mkdtemp(path.join(os.tmpdir(), "vector-fail-closed-")))
  await store.put([
    record({ key: "missing", documentId: "doc-missing", vector: [1, 0], tenantId: "tenant-a" }),
    record({ key: "complete", documentId: "doc-complete", vector: [0.9, 0.1], tenantId: "tenant-a", lifecycleStatus: "active", ragEligibility: "eligible" })
  ])

  const hits = await store.query([1, 0], 10, {
    tenantId: "tenant-a",
    lifecycleStatus: "active",
    ragEligibility: "eligible"
  })
  assert.deepEqual(hits.map((hit) => hit.key), ["complete"])
})

test("FR-070 an ACL filter rejects records whose ACL metadata is missing", async () => {
  const store = new LocalVectorStore(await mkdtemp(path.join(os.tmpdir(), "vector-acl-closed-")))
  await store.put([
    record({ key: "missing-acl", documentId: "doc-missing", vector: [1, 0], tenantId: "tenant-a", lifecycleStatus: "active", ragEligibility: "eligible" }),
    record({ key: "matching-acl", documentId: "doc-readable", vector: [0.9, 0.1], tenantId: "tenant-a", lifecycleStatus: "active", ragEligibility: "eligible", aclGroups: ["resource-group-a"] })
  ])

  const hits = await store.query([1, 0], 10, { allowedGroups: ["resource-group-a"] })
  assert.deepEqual(hits.map((hit) => hit.key), ["matching-acl"])
})
