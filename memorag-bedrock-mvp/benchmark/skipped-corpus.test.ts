import assert from "node:assert/strict"
import test from "node:test"
import { createSkippedDatasetRow, skippedCorpusFileNameSet, skippedExpectedFileNames } from "./skipped-corpus.js"
import type { SeededDocument } from "./corpus.js"

test("skippedCorpusFileNameSet includes only unextractable corpus skips", () => {
  const corpusSeed: SeededDocument[] = [
    { fileName: "active.pdf", status: "uploaded", chunkCount: 3, sourceHash: "hash", ingestSignature: "signature" },
    { fileName: "cached.pdf", status: "skipped", chunkCount: 3, sourceHash: "hash", ingestSignature: "signature" },
    {
      fileName: "image-only.pdf",
      status: "skipped_unextractable",
      chunkCount: 0,
      sourceHash: "hash",
      ingestSignature: "signature",
      skipReason: "no_extractable_text"
    }
  ]

  assert.deepEqual([...skippedCorpusFileNameSet(corpusSeed)], ["image-only.pdf"])
})

test("skippedExpectedFileNames finds direct, follow-up, and fact-slot file references", () => {
  const skippedFiles = new Set(["image-only.pdf", "slot.pdf"])
  const row = {
    id: "row-1",
    question: "質問",
    expectedFiles: ["image-only.pdf", "active.pdf", "image-only.pdf"],
    followUp: { expectedFileNames: ["follow-up.pdf"] },
    expectedFactSlots: [
      { expectedFiles: ["slot.pdf"] },
      { expectedFiles: ["active.pdf"] }
    ]
  }

  assert.deepEqual(skippedExpectedFileNames(row, skippedFiles), ["image-only.pdf", "slot.pdf"])
  assert.deepEqual(createSkippedDatasetRow(row, ["image-only.pdf"]), {
    id: "row-1",
    question: "質問",
    fileNames: ["image-only.pdf"],
    reason: "required_corpus_skipped"
  })
})
