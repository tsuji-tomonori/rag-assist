import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalObjectStore } from "./local-object-store.js"
import { LocalVectorStore } from "./local-vector-store.js"

test("local object store writes, lists nested keys, reads, and deletes objects", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-object-test-"))
  const store = new LocalObjectStore(dataDir)

  assert.deepEqual(await store.listKeys("manifests/"), [])
  await store.putText("/manifests/doc-1.json", "{\"ok\":true}")
  await store.putText("manifests/nested/doc-2.json", "{\"ok\":true}")

  assert.deepEqual((await store.listKeys("manifests/")).sort(), ["manifests/doc-1.json", "manifests/nested/doc-2.json"])
  assert.equal(await store.getText("manifests/doc-1.json"), "{\"ok\":true}")

  await store.deleteObject("manifests/doc-1.json")
  assert.deepEqual(await store.listKeys("manifests/"), ["manifests/nested/doc-2.json"])
})

test("local vector store upserts, filters, ranks, and deletes vectors", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-vector-test-"))
  const store = new LocalVectorStore(dataDir)

  await store.put([])
  await store.put([
    {
      key: "doc-1-chunk",
      vector: [1, 0],
      metadata: {
        kind: "chunk",
        documentId: "doc-1",
        fileName: "a.txt",
        chunkId: "chunk-0001",
        text: "A",
        createdAt: "2026-04-30T00:00:00.000Z"
      }
    },
    {
      key: "doc-2-memory",
      vector: [0, 1],
      metadata: {
        kind: "memory",
        documentId: "doc-2",
        fileName: "b.txt",
        memoryId: "memory-0001",
        text: "B",
        createdAt: "2026-04-30T00:00:00.000Z"
      }
    }
  ])
  await store.put([
    {
      key: "doc-1-chunk",
      vector: [0.9, 0.1],
      metadata: {
        kind: "chunk",
        documentId: "doc-1",
        fileName: "a.txt",
        chunkId: "chunk-0001",
        text: "A updated",
        createdAt: "2026-04-30T00:00:01.000Z"
      }
    }
  ])

  const chunkHits = await store.query([1, 0], 5, { kind: "chunk", documentId: "doc-1" })
  assert.equal(chunkHits.length, 1)
  assert.equal(chunkHits[0]?.metadata.text, "A updated")
  assert.ok((chunkHits[0]?.score ?? 0) > 0.9)

  const zeroHits = await store.query([0, 0], 5)
  assert.equal(zeroHits[0]?.score, 0)

  await store.delete([])
  await store.delete(["doc-1-chunk"])
  assert.deepEqual((await store.query([1, 0], 5)).map((hit) => hit.key), ["doc-2-memory"])
})
