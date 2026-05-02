import type { QaAgentState, QaAgentUpdate, ReferenceTarget } from "../state.js"

const REFERENCE_PATTERNS = [
  /(?:詳細は|詳しくは|参照|別紙|付録|Appendix)\s*([A-Za-z0-9一-龠ぁ-んァ-ヶー_#.-]+)/gi,
  /([A-Za-z]?別紙\s*[A-Za-z0-9一二三四五六七八九十]+)/gi
]

export async function extractReferences(state: QaAgentState): Promise<QaAgentUpdate> {
  const nextDepth = state.iteration + 1
  const extracted: ReferenceTarget[] = []
  const seen = new Set<string>()

  for (const chunk of state.retrievedChunks) {
    const text = chunk.metadata.text ?? ""
    if (!text) continue

    for (const pattern of REFERENCE_PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        const raw = (match[1] ?? match[0] ?? "").trim()
        if (!raw) continue
        const normalizedLabel = normalizeReferenceLabel(raw)
        const key = `${chunk.key}:${normalizedLabel}:${nextDepth}`
        if (seen.has(key)) continue
        seen.add(key)
        extracted.push({
          sourceChunkKey: chunk.key,
          rawLabel: raw,
          normalizedLabel,
          depth: nextDepth
        })
      }
    }
  }

  return {
    iteration: nextDepth,
    referenceQueue: [...state.referenceQueue, ...extracted]
  }
}

function normalizeReferenceLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s+/g, "")
    .replaceAll(/[「」『』()（）【】［］[\].]/g, "")
}
