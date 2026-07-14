import assert from "node:assert/strict"
import test from "node:test"
import { emptyReplaySourceSnapshot, replaySourceSnapshotFromManifest } from "./replay-source-snapshot.js"

test("FR-074 empty replay snapshot preserves only citation identity and records every unknown version as null", () => {
  assert.deepEqual(emptyReplaySourceSnapshot({ documentId: "doc-1", documentVersion: "  version-1  " }), {
    documentId: "doc-1",
    documentVersion: "version-1",
    ingestTraceId: null,
    parserVersion: null,
    ocrVersion: null,
    chunkerVersion: null,
    chunkingPolicyVersion: null,
    embeddingModelId: null,
    embeddingDimensions: null,
    indexVersion: null,
    promptVersion: null,
    pipelineVersion: null
  })
})

test("FR-074 replay snapshot rejects ambiguous extractor versions and invalid embedding dimensions", () => {
  const snapshot = replaySourceSnapshotFromManifest({
    documentId: "doc-2",
    documentVersion: " ",
    fileName: "source.pdf",
    chunks: [
      { id: "chunk-1", startChar: 0, endChar: 3, extractionMethod: "textract-v1" },
      { id: "chunk-2", startChar: 4, endChar: 7, extractionMethod: "ocr-v2" }
    ],
    chunkCount: 2,
    memoryCardCount: 0,
    embeddingDimensions: -1,
    sourceObjectKey: "source",
    manifestObjectKey: "manifest",
    vectorKeys: [],
    createdAt: "2026-07-11T00:00:00.000Z"
  })

  assert.equal(snapshot.parserVersion, null)
  assert.equal(snapshot.ocrVersion, null)
  assert.equal(snapshot.embeddingDimensions, null)
  assert.equal(snapshot.documentVersion, null)
})
