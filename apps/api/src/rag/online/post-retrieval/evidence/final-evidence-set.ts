import type { Citation, EvidenceRole, RetrievedVector } from "../../../../types.js"
import { toCitation } from "../../../../chat-orchestration/utils.js"

export type EvidenceStructureContext = {
  supportingChunkKeys?: Iterable<string>
  conflictingChunkKeys?: Iterable<string>
  topicsByChunkKey?: ReadonlyMap<string, string>
  asOf?: Date
  authorizationEvaluatedAt: string
}

/**
 * Builds the versioned, locator-preserving evidence projection required before
 * generation/citation. Callers must pass only chunks that have just passed the
 * current authorization/eligibility check.
 */
export function buildFinalEvidenceSet(chunks: RetrievedVector[], context: EvidenceStructureContext): Citation[] {
  const supporting = new Set(context.supportingChunkKeys ?? [])
  const conflicting = new Set(context.conflictingChunkKeys ?? [])
  const asOfMs = (context.asOf ?? new Date()).getTime()
  return chunks.map((chunk) => toCitation(chunk, {
    topic: context.topicsByChunkKey?.get(chunk.key),
    role: evidenceRole(chunk, supporting, conflicting, asOfMs),
    authorizationEvaluatedAt: context.authorizationEvaluatedAt
  }))
}

function evidenceRole(
  chunk: RetrievedVector,
  supporting: ReadonlySet<string>,
  conflicting: ReadonlySet<string>,
  asOfMs: number
): EvidenceRole {
  if (conflicting.has(chunk.key)) return "conflicting"
  const effectiveUntil = chunk.metadata.effectiveUntil ? Date.parse(chunk.metadata.effectiveUntil) : Number.NaN
  if (Number.isFinite(effectiveUntil) && effectiveUntil < asOfMs) return "outdated"
  if (supporting.has(chunk.key)) return "supporting"
  return "background"
}
