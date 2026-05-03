import type { AppUser } from "../../auth.js"
import type { Dependencies } from "../../dependencies.js"
import { rrfFuse, searchRag, type SearchResult, type SearchResponse } from "../../search/hybrid-search.js"
import type { RetrievedVector, VectorMetadata } from "../../types.js"
import type { QaAgentState, QaAgentUpdate } from "../state.js"

export function createSearchEvidenceNode(deps: Dependencies, user: AppUser) {
  return async function searchEvidence(state: QaAgentState): Promise<QaAgentUpdate> {
    const queryEmbeddings =
      state.queryEmbeddings.length > 0
        ? state.queryEmbeddings
        : [
            {
              query: state.normalizedQuery ?? state.question,
              vector: []
            }
          ]

    const resultLists: SearchResult[][] = []
    const bestResultById = new Map<string, SearchResult>()
    const diagnostics: SearchResponse["diagnostics"][] = []

    for (const item of queryEmbeddings) {
      const response = await searchRag(
        deps,
        {
          query: item.query,
          topK: Math.max(state.topK, 30),
          lexicalTopK: 80,
          semanticTopK: 80,
          embeddingModelId: state.embeddingModelId,
          semanticVector: item.vector.length > 0 ? item.vector : undefined
        },
        user
      )
      diagnostics.push(response.diagnostics)
      resultLists.push(response.results)

      for (const result of response.results) {
        const existing = bestResultById.get(result.id)
        if (!existing || retrievalScore(result) > retrievalScore(existing)) bestResultById.set(result.id, result)
      }
    }

    const fused = rrfFuse(resultLists.map((results) => results.map((result) => ({ id: result.id, score: result.score }))))
    const retrievedChunks = fused
      .map((hit, index) => {
        const result = bestResultById.get(hit.id)
        return result ? toRetrievedVector(result, hit.score, index + 1) : undefined
      })
      .filter((hit): hit is RetrievedVector => hit !== undefined)
      .slice(0, Math.max(state.topK, 30))
    return { retrievedChunks, retrievalDiagnostics: summarizeDiagnostics(diagnostics, retrievedChunks) }
  }
}

function toRetrievedVector(result: SearchResult, crossQueryRrfScore: number, crossQueryRank: number): RetrievedVector {
  return {
    key: result.id,
    score: combinedRetrievalScore(result, crossQueryRrfScore),
    metadata: {
      kind: "chunk",
      documentId: result.documentId,
      fileName: result.fileName,
      chunkId: result.chunkId,
      text: result.text,
      createdAt: result.createdAt ?? new Date(0).toISOString(),
      ...(result.metadata as Partial<VectorMetadata> | undefined),
      sources: result.sources,
      rrfScore: result.rrfScore,
      lexicalRank: result.lexicalRank,
      semanticRank: result.semanticRank,
      crossQueryRrfScore,
      crossQueryRank,
      expansionSource: "hybrid"
    } as VectorMetadata
  }
}

function retrievalScore(result: SearchResult): number {
  const semanticScore = result.semanticScore ?? 0
  const lexicalScore = result.lexicalScore === undefined ? 0 : Math.min(0.95, 0.35 + Math.log1p(result.lexicalScore) / 3)
  return Math.max(semanticScore, lexicalScore, Math.min(0.95, result.score))
}

function combinedRetrievalScore(result: SearchResult, crossQueryRrfScore: number): number {
  return Math.min(0.99, retrievalScore(result) + Math.min(0.08, crossQueryRrfScore * 3))
}

function summarizeDiagnostics(diagnostics: SearchResponse["diagnostics"][], retrievedChunks: RetrievedVector[]) {
  const sourceCounts = { lexical: 0, semantic: 0, hybrid: 0 }
  for (const chunk of retrievedChunks) {
    const sources = sourceList(chunk)
    if (sources.includes("lexical") && sources.includes("semantic")) sourceCounts.hybrid += 1
    else if (sources.includes("lexical")) sourceCounts.lexical += 1
    else if (sources.includes("semantic")) sourceCounts.semantic += 1
  }

  return {
    queryCount: diagnostics.length,
    indexVersions: [...new Set(diagnostics.map((item) => item.indexVersion))],
    aliasVersions: [...new Set(diagnostics.map((item) => item.aliasVersion))],
    lexicalCount: diagnostics.reduce((sum, item) => sum + item.lexicalCount, 0),
    semanticCount: diagnostics.reduce((sum, item) => sum + item.semanticCount, 0),
    fusedCount: diagnostics.reduce((sum, item) => sum + item.fusedCount, 0),
    sourceCounts
  }
}

function sourceList(chunk: RetrievedVector): string[] {
  const raw = (chunk.metadata as unknown as { sources?: unknown }).sources
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : []
}
