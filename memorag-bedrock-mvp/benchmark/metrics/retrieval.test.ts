import assert from "node:assert/strict"
import test from "node:test"
import { countAccessLeaks, evaluateRetrieval } from "./retrieval.js"

test("evaluateRetrieval calculates recall, MRR, nDCG, and hit flags", () => {
  const metrics = evaluateRetrieval(
    [
      { documentId: "doc-a", chunkId: "chunk-1", fileName: "a.md" },
      { documentId: "doc-b", chunkId: "chunk-2", fileName: "b.md" },
      { documentId: "doc-c", chunkId: "chunk-3", fileName: "c.md" }
    ],
    [
      { documentId: "doc-b", chunkId: "chunk-2", fileName: "b.md", grade: 2 },
      { documentId: "doc-c", chunkId: "chunk-3", fileName: "c.md", grade: 1 }
    ]
  )

  assert.equal(metrics.recallAt1, 0)
  assert.equal(metrics.recallAt3, 1)
  assert.equal(metrics.mrrAt10, 0.5)
  assert.equal(metrics.ndcgAt10, 0.659)
  assert.equal(metrics.precisionAt5, 0.4)
  assert.equal(metrics.expectedFileHit, true)
  assert.equal(metrics.expectedDocumentHit, true)
  assert.equal(metrics.expectedChunkHit, true)
})

test("countAccessLeaks treats relevant rows as forbidden for negative ACL cases", () => {
  const leaks = countAccessLeaks(
    [
      { documentId: "public-doc", chunkId: "chunk-1" },
      { documentId: "secret-doc", chunkId: "chunk-9" }
    ],
    [{ documentId: "secret-doc", chunkId: "chunk-9", grade: 2 }]
  )

  assert.equal(leaks, 1)
})
