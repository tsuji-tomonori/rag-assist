import type { AppUser } from "../../auth.js"
import type { Dependencies } from "../../dependencies.js"
import { loadChunksForManifest } from "../../rag/manifest-chunks.js"
import { rrfFuse, searchRag, type SearchResult, type SearchResponse } from "../../search/hybrid-search.js"
import type { Chunk, DocumentManifest, RetrievedVector, VectorMetadata } from "../../types.js"
import { expandedSearchTopK, ragRuntimePolicy } from "../runtime-policy.js"
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
          topK: expandedSearchTopK(state.topK),
          lexicalTopK: ragRuntimePolicy.retrieval.lexicalTopK,
          semanticTopK: ragRuntimePolicy.retrieval.semanticTopK,
          embeddingModelId: state.embeddingModelId,
          semanticVector: item.vector.length > 0 ? item.vector : undefined,
          filters: state.searchFilters,
          scope: state.searchScope
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
    const hybridChunks = fused
      .map((hit, index) => {
        const result = bestResultById.get(hit.id)
        return result ? toRetrievedVector(result, hit.score, index + 1) : undefined
      })
      .filter((hit): hit is RetrievedVector => hit !== undefined)
      .slice(0, expandedSearchTopK(state.topK))
    const memorySourceChunks = await expandMemorySourceChunks(deps, state, expandedSearchTopK(state.topK))
    const retrievedChunks = mergeRetrievedChunks([...hybridChunks, ...memorySourceChunks], expandedSearchTopK(state.topK))
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
  const lexicalScore =
    result.lexicalScore === undefined
      ? 0
      : Math.min(
          ragRuntimePolicy.retrieval.sourceScoreMax,
          ragRuntimePolicy.retrieval.lexicalBaseScore + Math.log1p(result.lexicalScore) / ragRuntimePolicy.retrieval.lexicalLogDivisor
        )
  return Math.max(semanticScore, lexicalScore, Math.min(ragRuntimePolicy.retrieval.sourceScoreMax, result.score))
}

function combinedRetrievalScore(result: SearchResult, crossQueryRrfScore: number): number {
  return Math.min(
    ragRuntimePolicy.retrieval.combinedMaxScore,
    retrievalScore(result) +
      Math.min(ragRuntimePolicy.retrieval.crossQueryRrfBoostCap, crossQueryRrfScore * ragRuntimePolicy.retrieval.crossQueryRrfBoostMultiplier)
  )
}

function summarizeDiagnostics(diagnostics: SearchResponse["diagnostics"][], retrievedChunks: RetrievedVector[]) {
  const sourceCounts = { lexical: 0, semantic: 0, hybrid: 0, memory: 0 }
  for (const chunk of retrievedChunks) {
    const sources = sourceList(chunk)
    if (sources.includes("memory")) sourceCounts.memory += 1
    else if (sources.includes("lexical") && sources.includes("semantic")) sourceCounts.hybrid += 1
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
    profileId: diagnostics[0]?.profileId,
    profileVersion: diagnostics[0]?.profileVersion,
    topGap: minNumber(diagnostics.map((item) => item.topGap)),
    lexicalSemanticOverlap: averageNumber(diagnostics.map((item) => item.lexicalSemanticOverlap)),
    sourceCounts
  }
}

function minNumber(values: Array<number | null | undefined>): number | undefined {
  const numbers = values.filter((value): value is number => typeof value === "number")
  return numbers.length > 0 ? Math.min(...numbers) : undefined
}

function averageNumber(values: Array<number | null | undefined>): number | undefined {
  const numbers = values.filter((value): value is number => typeof value === "number")
  if (numbers.length === 0) return undefined
  return Number((numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(4))
}

function sourceList(chunk: RetrievedVector): string[] {
  const raw = (chunk.metadata as unknown as { sources?: unknown }).sources
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : []
}

async function expandMemorySourceChunks(deps: Dependencies, state: QaAgentState, limit: number): Promise<RetrievedVector[]> {
  if (!state.useMemory || state.memoryCards.length === 0) return []
  const queryTokens = tokenizeQueries([
    state.normalizedQuery,
    state.question,
    ...state.expandedQueries,
    ...(state.decontextualizedQuery?.retrievalQueries ?? [])
  ])
  const manifestCache = new Map<string, DocumentManifest | undefined>()
  const chunkCache = new Map<string, Chunk[]>()
  const expanded: RetrievedVector[] = []
  for (const memoryHit of state.memoryCards) {
    const memoryMetadata = memoryHit.metadata as VectorMetadata
    const documentId = memoryHit.metadata.documentId
    if (!documentId) continue
    const manifest = await loadManifest(deps, manifestCache, documentId)
    if (!manifest) continue
    const chunks = await loadManifestChunks(deps, chunkCache, manifest)
    const candidates = candidateChunksForMemory(memoryHit, chunks)
    const selected = rankMemorySourceChunks(candidates, memoryHit, queryTokens).slice(0, Math.max(1, Math.min(limit, state.topK)))
    for (const { chunk, score } of selected) {
      expanded.push({
        key: `${documentId}-${chunk.id}`,
        score,
        metadata: {
          kind: "chunk",
          documentId,
          fileName: manifest.fileName,
          chunkId: chunk.id,
          objectKey: manifest.sourceObjectKey,
          text: chunk.text,
          sectionPath: chunk.sectionPath,
          heading: chunk.heading,
          parentSectionId: chunk.parentSectionId,
          previousChunkId: chunk.previousChunkId,
          nextChunkId: chunk.nextChunkId,
          chunkHash: chunk.chunkHash,
          pageStart: chunk.pageStart,
          pageEnd: chunk.pageEnd,
          chunkKind: chunk.chunkKind,
          sourceBlockId: chunk.sourceBlockId,
          normalizedFrom: chunk.normalizedFrom,
          tableColumnCount: chunk.tableColumnCount,
          listDepth: chunk.listDepth,
          codeLanguage: chunk.codeLanguage,
          figureCaption: chunk.figureCaption,
          extractionMethod: chunk.extractionMethod,
          lifecycleStatus: manifest.lifecycleStatus,
          tenantId: stringMetadata(memoryMetadata.tenantId),
          department: stringMetadata(memoryMetadata.department),
          source: stringMetadata(memoryMetadata.source),
          docType: stringMetadata(memoryMetadata.docType),
          benchmarkSuiteId: stringMetadata(memoryMetadata.benchmarkSuiteId),
          scopeType: memoryMetadata.scopeType,
          groupId: stringMetadata(memoryMetadata.groupId),
          groupIds: memoryMetadata.groupIds,
          ownerUserId: stringMetadata(memoryMetadata.ownerUserId),
          temporaryScopeId: stringMetadata(memoryMetadata.temporaryScopeId),
          expiresAt: stringMetadata(memoryMetadata.expiresAt),
          domainPolicy: stringMetadata(memoryMetadata.domainPolicy),
          ragPolicy: stringMetadata(memoryMetadata.ragPolicy),
          answerPolicy: stringMetadata(memoryMetadata.answerPolicy),
          aclGroup: stringMetadata(memoryMetadata.aclGroup),
          aclGroups: memoryMetadata.aclGroups,
          allowedUsers: memoryMetadata.allowedUsers,
          sources: ["memory"],
          sourceChunkIds: memoryMetadata.sourceChunkIds,
          expansionSource: "memory_source",
          createdAt: manifest.createdAt
        }
      })
    }
  }
  return expanded
}

async function loadManifest(
  deps: Pick<Dependencies, "objectStore">,
  cache: Map<string, DocumentManifest | undefined>,
  documentId: string
): Promise<DocumentManifest | undefined> {
  if (cache.has(documentId)) return cache.get(documentId)
  try {
    const manifest = JSON.parse(await deps.objectStore.getText(`manifests/${documentId}.json`)) as DocumentManifest
    cache.set(documentId, manifest)
    return manifest
  } catch {
    cache.set(documentId, undefined)
    return undefined
  }
}

async function loadManifestChunks(deps: Dependencies, cache: Map<string, Chunk[]>, manifest: DocumentManifest): Promise<Chunk[]> {
  const cached = cache.get(manifest.documentId)
  if (cached) return cached
  const chunks = await loadChunksForManifest(deps, manifest)
  cache.set(manifest.documentId, chunks)
  return chunks
}

function candidateChunksForMemory(memoryHit: RetrievedVector, chunks: Chunk[]): Chunk[] {
  const sourceChunkIds = memoryHit.metadata.sourceChunkIds ?? parseSourceChunkIds(memoryHit.metadata.text)
  if (sourceChunkIds.length > 0) {
    const idSet = new Set(sourceChunkIds)
    return chunks.filter((chunk) => idSet.has(chunk.id))
  }
  const pageStart = memoryHit.metadata.pageStart
  const pageEnd = memoryHit.metadata.pageEnd ?? memoryHit.metadata.pageStart
  if (typeof pageStart === "number" && typeof pageEnd === "number") {
    return chunks.filter((chunk) => {
      const chunkStart = chunk.pageStart
      const chunkEnd = chunk.pageEnd ?? chunk.pageStart
      return typeof chunkStart === "number" && typeof chunkEnd === "number" && chunkStart <= pageEnd && chunkEnd >= pageStart
    })
  }
  return []
}

function rankMemorySourceChunks(chunks: Chunk[], memoryHit: RetrievedVector, queryTokens: Set<string>): Array<{ chunk: Chunk; score: number }> {
  return chunks
    .map((chunk, index) => {
      const text = [chunk.heading, ...(chunk.sectionPath ?? []), chunk.figureCaption, chunk.text].filter(Boolean).join(" ")
      const tokenOverlap = overlapScore(queryTokens, tokenize(text))
      const sectionMatch = memoryHit.metadata.sectionPath?.some((section) => chunk.sectionPath?.includes(section)) ? 0.05 : 0
      const pageMatch = pageOverlapsMemory(chunk, memoryHit.metadata) ? 0.04 : 0
      const positionDecay = Math.max(0, 0.03 - index * 0.002)
      const score = Math.min(0.88, memoryHit.score * 0.72 + tokenOverlap * 0.16 + sectionMatch + pageMatch + positionDecay)
      return { chunk, score }
    })
    .sort((a, b) => b.score - a.score)
}

function parseSourceChunkIds(text: string | undefined): string[] {
  const match = text?.match(/^Source chunks:\s*(.+)$/im)
  return match?.[1]?.split(",").map((item) => item.trim()).filter(Boolean) ?? []
}

function pageOverlapsMemory(chunk: Chunk, metadata: VectorMetadata): boolean {
  const memoryStart = metadata.pageStart
  const memoryEnd = metadata.pageEnd ?? metadata.pageStart
  const chunkStart = chunk.pageStart
  const chunkEnd = chunk.pageEnd ?? chunk.pageStart
  if (typeof memoryStart !== "number" || typeof memoryEnd !== "number" || typeof chunkStart !== "number" || typeof chunkEnd !== "number") return false
  return chunkStart <= memoryEnd && chunkEnd >= memoryStart
}

function mergeRetrievedChunks(chunks: RetrievedVector[], limit: number): RetrievedVector[] {
  const byKey = new Map<string, RetrievedVector>()
  for (const chunk of chunks) {
    const existing = byKey.get(chunk.key)
    if (!existing) {
      byKey.set(chunk.key, chunk)
      continue
    }
    const winner = chunk.score > existing.score ? chunk : existing
    const loser = winner === chunk ? existing : chunk
    byKey.set(chunk.key, {
      ...winner,
      metadata: {
        ...winner.metadata,
        sources: [...new Set([...(winner.metadata.sources ?? []), ...(loser.metadata.sources ?? [])])],
        sourceChunkIds: winner.metadata.sourceChunkIds ?? loser.metadata.sourceChunkIds
      }
    })
  }
  return [...byKey.values()].sort((a, b) => b.score - a.score).slice(0, limit)
}

function tokenizeQueries(values: Array<string | undefined>): Set<string> {
  return tokenize(values.filter(Boolean).join(" "))
}

function tokenize(value: string): Set<string> {
  const normalized = value.normalize("NFKC").toLowerCase()
  const tokens = normalized.match(/[\p{Letter}\p{Number}_-]{2,}/gu) ?? []
  const cjk = normalized.match(/[\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}]{2}/gu) ?? []
  return new Set([...tokens, ...cjk])
}

function overlapScore(queryTokens: Set<string>, textTokens: Set<string>): number {
  if (queryTokens.size === 0 || textTokens.size === 0) return 0
  let overlap = 0
  for (const token of queryTokens) {
    if (textTokens.has(token)) overlap += 1
  }
  return overlap / queryTokens.size
}

function stringMetadata(value: string | undefined): string | undefined {
  return typeof value === "string" && value ? value : undefined
}
