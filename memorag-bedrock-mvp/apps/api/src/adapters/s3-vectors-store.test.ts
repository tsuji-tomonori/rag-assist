import assert from "node:assert/strict"
import test from "node:test"
import { assertFilterableMetadataBudget } from "./s3-vectors-store.js"

test("assertFilterableMetadataBudget ignores non-filterable text", () => {
  assert.doesNotThrow(() => assertFilterableMetadataBudget("doc-chunk-0000", {
    kind: "chunk",
    documentId: "doc",
    text: "本文".repeat(5000),
    createdAt: "2026-05-11T00:00:00.000Z"
  }))
})

test("assertFilterableMetadataBudget reports largest filterable fields", () => {
  assert.throws(
    () => assertFilterableMetadataBudget("doc-chunk-0000", {
      kind: "chunk",
      documentId: "doc",
      drawingRegionIndex: [{ regionId: "r1", raw: "A".repeat(2100) }],
      drawingReferenceGraph: { schemaVersion: 1, raw: "B".repeat(1000) },
      optionalField: undefined,
      text: "本文".repeat(5000),
      createdAt: "2026-05-11T00:00:00.000Z"
    }),
    (error) => {
      const message = String((error as Error).message)
      assert.match(message, /Vector filterable metadata exceeds 2048 bytes for doc-chunk-0000/)
      assert.match(message, /drawingRegionIndex/)
      assert.match(message, /drawingReferenceGraph/)
      assert.doesNotMatch(message, /"key":"text"/)
      return true
    }
  )
})
