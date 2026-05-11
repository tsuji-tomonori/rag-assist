import { extractDrawingValues, type DrawingValueKind, type NormalizedDrawingValue } from "./metrics/drawing-normalization.js"

export type DrawingExtractionSourceMethod = "pdf_text" | "ocr" | "vlm_ocr"

export type NormalizedBbox = {
  unit: "normalized_page"
  x: number
  y: number
  width: number
  height: number
}

export type DrawingExtractionRegion = {
  regionId: string
  regionType: string
  pageOrSheet: string
  bbox: NormalizedBbox
  evidenceAnchor: string
  sourceQaIds: string[]
  confidence: number
}

export type DrawingExtractionAttempt = {
  sourceMethod: DrawingExtractionSourceMethod
  status: "succeeded" | "failed" | "skipped"
  failureReason?: string
}

export type DrawingExtractionArtifact = {
  artifactId: string
  regionId: string
  regionType: string
  pageOrSheet: string
  bbox: NormalizedBbox
  sourceMethod: DrawingExtractionSourceMethod
  attemptedMethods: DrawingExtractionAttempt[]
  status: "succeeded" | "failed"
  rawText?: string
  normalizedValues: NormalizedDrawingValue[]
  confidence: number
  parserVersion: string
  sourceQaIds: string[]
  failureReason?: string
}

export type DrawingRegionExtractionRequest = {
  sourceId: string
  region: DrawingExtractionRegion
  parserVersion?: string
  expectedKinds?: DrawingValueKind[]
  pdfText?: string
  ocrText?: string
  vlmOcrText?: string
  vlmOcrEnabled?: boolean
}

const defaultParserVersion = "drawing-local-extraction-v1"

export function extractDrawingRegionArtifact(request: DrawingRegionExtractionRequest): DrawingExtractionArtifact {
  const parserVersion = request.parserVersion ?? defaultParserVersion
  const attempts: DrawingExtractionAttempt[] = []
  const candidates: Array<{ sourceMethod: DrawingExtractionSourceMethod; text?: string; confidenceMultiplier: number }> = [
    { sourceMethod: "pdf_text", text: request.pdfText, confidenceMultiplier: 1 },
    { sourceMethod: "ocr", text: request.ocrText, confidenceMultiplier: 0.85 },
    { sourceMethod: "vlm_ocr", text: request.vlmOcrText, confidenceMultiplier: 0.7 }
  ]

  for (const candidate of candidates) {
    const text = candidate.text?.trim()
    if (candidate.sourceMethod === "vlm_ocr" && !request.vlmOcrEnabled && !text) {
      attempts.push({ sourceMethod: candidate.sourceMethod, status: "failed", failureReason: "vlm_ocr_unavailable" })
      continue
    }
    if (!text) {
      attempts.push({ sourceMethod: candidate.sourceMethod, status: "failed", failureReason: "no_region_text" })
      continue
    }
    attempts.push({ sourceMethod: candidate.sourceMethod, status: "succeeded" })
    return {
      artifactId: `${request.sourceId.toLowerCase()}-${request.region.regionId}-extract-${candidate.sourceMethod}`,
      regionId: request.region.regionId,
      regionType: request.region.regionType,
      pageOrSheet: request.region.pageOrSheet,
      bbox: request.region.bbox,
      sourceMethod: candidate.sourceMethod,
      attemptedMethods: attempts,
      status: "succeeded",
      rawText: text,
      normalizedValues: normalizedValuesFor(text, request.expectedKinds),
      confidence: clampConfidence(request.region.confidence * candidate.confidenceMultiplier),
      parserVersion,
      sourceQaIds: request.region.sourceQaIds
    }
  }

  return {
    artifactId: `${request.sourceId.toLowerCase()}-${request.region.regionId}-extract-failed`,
    regionId: request.region.regionId,
    regionType: request.region.regionType,
    pageOrSheet: request.region.pageOrSheet,
    bbox: request.region.bbox,
    sourceMethod: "vlm_ocr",
    attemptedMethods: attempts,
    status: "failed",
    normalizedValues: [],
    confidence: 0,
    parserVersion,
    sourceQaIds: request.region.sourceQaIds,
    failureReason: attempts.at(-1)?.failureReason ?? "no_extraction_candidate"
  }
}

function normalizedValuesFor(text: string, expectedKinds: DrawingValueKind[] | undefined): NormalizedDrawingValue[] {
  const values = extractDrawingValues(text)
  if (!expectedKinds || expectedKinds.length === 0) return values
  const expected = new Set(expectedKinds)
  return values.filter((value) => expected.has(value.kind))
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, Number(value.toFixed(3))))
}
