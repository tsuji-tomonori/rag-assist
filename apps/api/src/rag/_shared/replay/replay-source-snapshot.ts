import type { Citation, DocumentManifest, ReplaySourceSnapshot } from "../../../types.js"

/** Builds replay provenance only from fields persisted on the retrieved source. */
export function replaySourceSnapshotFromManifest(manifest: DocumentManifest): ReplaySourceSnapshot {
  const parserVersion = firstObservedVersion([
    manifest.sourceExtractorVersion,
    manifest.parsedDocument?.sourceExtractorVersion,
    uniqueObservedVersion(manifest.chunks?.map((chunk) => chunk.extractionMethod))
  ])
  const extractionVersions = [
    parserVersion,
    ...(manifest.chunks?.map((chunk) => clean(chunk.extractionMethod)) ?? [])
  ].filter((value): value is string => Boolean(value))
  return {
    documentId: manifest.documentId,
    documentVersion: clean(manifest.documentVersion),
    ingestTraceId: clean(manifest.traceId),
    parserVersion,
    ocrVersion: uniqueObservedVersion(extractionVersions.filter(isObservedOcrVersion)),
    chunkerVersion: clean(manifest.chunkerVersion),
    chunkingPolicyVersion: clean(manifest.chunkingPolicy?.version),
    embeddingModelId: clean(manifest.embeddingModelId),
    embeddingDimensions: finitePositiveInteger(manifest.embeddingDimensions),
    indexVersion: clean(manifest.indexVersion),
    promptVersion: clean(manifest.pipelineVersions?.promptVersion),
    pipelineVersion: clean(manifest.pipelineVersions?.chatOrchestrationWorkflowVersion)
  }
}

export function emptyReplaySourceSnapshot(citation: Pick<Citation, "documentId" | "documentVersion">): ReplaySourceSnapshot {
  return {
    documentId: citation.documentId,
    documentVersion: clean(citation.documentVersion),
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
  }
}

function uniqueObservedVersion(values: Array<string | null | undefined> | undefined): string | null {
  const observed = [...new Set((values ?? []).map(clean).filter((value): value is string => Boolean(value)))]
  return observed.length === 1 ? observed[0]! : null
}

function firstObservedVersion(values: Array<string | null | undefined>): string | null {
  return values.map(clean).find((value): value is string => Boolean(value)) ?? null
}

function isObservedOcrVersion(value: string): boolean {
  return /(?:^|[-_.])(ocr|textract)(?:$|[-_.])/iu.test(value)
}

function finitePositiveInteger(value: number | undefined): number | null {
  return Number.isInteger(value) && value! > 0 ? value! : null
}

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}
