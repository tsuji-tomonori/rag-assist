import assert from "node:assert/strict"
import { test } from "node:test"
import { extractDrawingRegionArtifact } from "./drawing-local-extraction.js"

const region = {
  regionId: "a01-titleblock-001",
  regionType: "titleblock",
  pageOrSheet: "A-01",
  bbox: { unit: "normalized_page" as const, x: 0.55, y: 0.72, width: 0.45, height: 0.28 },
  evidenceAnchor: "title block",
  sourceQaIds: ["QA-001"],
  confidence: 0.55
}

test("extractDrawingRegionArtifact prefers PDF text and keeps bbox lineage", () => {
  const artifact = extractDrawingRegionArtifact({
    sourceId: "A01",
    region,
    expectedKinds: ["scale"],
    pdfText: "縮尺 1/100",
    ocrText: "縮尺 1/200"
  })

  assert.equal(artifact.status, "succeeded")
  assert.equal(artifact.sourceMethod, "pdf_text")
  assert.deepEqual(artifact.bbox, region.bbox)
  assert.equal(artifact.parserVersion, "drawing-local-extraction-v1")
  assert.equal(artifact.confidence, 0.55)
  assert.deepEqual(artifact.normalizedValues.map((value) => value.canonical), ["scale:1/100"])
})

test("extractDrawingRegionArtifact falls back to crop OCR before VLM-OCR", () => {
  const artifact = extractDrawingRegionArtifact({
    sourceId: "A01",
    region,
    expectedKinds: ["diameter"],
    ocrText: "VPφ75"
  })

  assert.equal(artifact.status, "succeeded")
  assert.equal(artifact.sourceMethod, "ocr")
  assert.deepEqual(artifact.attemptedMethods, [
    { sourceMethod: "pdf_text", status: "failed", failureReason: "no_region_text" },
    { sourceMethod: "ocr", status: "succeeded" }
  ])
  assert.deepEqual(artifact.normalizedValues.map((value) => value.canonical), ["diameter:phi:75"])
})

test("extractDrawingRegionArtifact records unavailable VLM-OCR instead of inventing values", () => {
  const artifact = extractDrawingRegionArtifact({
    sourceId: "A01",
    region,
    expectedKinds: ["dimension"]
  })

  assert.equal(artifact.status, "failed")
  assert.equal(artifact.sourceMethod, "vlm_ocr")
  assert.equal(artifact.failureReason, "vlm_ocr_unavailable")
  assert.deepEqual(artifact.normalizedValues, [])
  assert.equal(artifact.rawText, undefined)
})
