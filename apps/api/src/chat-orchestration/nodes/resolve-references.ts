import type { ChatOrchestrationState, ChatOrchestrationUpdate, ReferenceResolution, ReferenceTarget } from "../state.js"

export async function resolveReferences(state: ChatOrchestrationState): Promise<ChatOrchestrationUpdate> {
  const queue = [...state.referenceQueue]
  const nextQueue: ReferenceTarget[] = []
  const unresolved = [...state.unresolvedReferenceTargets]
  const resolved: ReferenceResolution[] = [...state.resolvedReferences]
  const visited = new Set(state.visitedDocumentIds)
  const maxDepth = state.searchBudget.maxReferenceDepth

  for (const target of queue) {
    if (target.depth > maxDepth) {
      resolved.push({ target, status: "skipped_depth", reason: `depth>${maxDepth}` })
      unresolved.push(target)
      continue
    }

    const matchedChunk = state.retrievedChunks.find((chunk) => {
      const fileName = normalize(chunk.metadata.fileName)
      const documentId = normalize(chunk.metadata.documentId)
      const heading = normalize(extractHeading(chunk.metadata.text))
      return [fileName, documentId, heading].some((field) => field.includes(target.normalizedLabel))
    })

    if (!matchedChunk) {
      resolved.push({ target, status: "unresolved", reason: "index_not_found" })
      unresolved.push(target)
      continue
    }

    if (visited.has(matchedChunk.metadata.documentId)) {
      resolved.push({
        target,
        status: "skipped_visited",
        matchedDocumentId: matchedChunk.metadata.documentId,
        matchedFileName: matchedChunk.metadata.fileName,
        matchedHeading: extractHeading(matchedChunk.metadata.text),
        reason: "already_visited"
      })
      continue
    }

    visited.add(matchedChunk.metadata.documentId)
    resolved.push({
      target,
      status: "resolved",
      matchedDocumentId: matchedChunk.metadata.documentId,
      matchedFileName: matchedChunk.metadata.fileName,
      matchedHeading: extractHeading(matchedChunk.metadata.text)
    })
    nextQueue.push({
      sourceChunkKey: matchedChunk.key,
      rawLabel: target.rawLabel,
      normalizedLabel: target.normalizedLabel,
      depth: target.depth + 1
    })
  }

  return {
    referenceQueue: nextQueue,
    resolvedReferences: resolved,
    unresolvedReferenceTargets: unresolved,
    visitedDocumentIds: [...visited]
  }
}

function extractHeading(text: string | undefined): string {
  if (!text) return ""
  const line = text.split("\n").find((value) => value.trim().length > 0) ?? ""
  return line.replace(/^#+\s*/, "").trim()
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "")
}
