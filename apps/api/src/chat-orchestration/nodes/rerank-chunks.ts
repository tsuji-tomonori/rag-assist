import { selectFinalAnswerChunks } from "../../rag/prompts.js"
import type { RetrievedVector, VectorMetadata } from "../../types.js"
import type { ChatOrchestrationState, ChatOrchestrationUpdate } from "../state.js"

export async function rerankChunks(state: ChatOrchestrationState): Promise<ChatOrchestrationUpdate> {
  const reranked = rerankWithConversationAndLayout(state)
  return {
    selectedChunks: selectFinalAnswerChunks(
      state.decontextualizedQuery?.standaloneQuestion ?? state.question,
      reranked.filter((chunk) => chunk.score >= state.minScore)
    ).slice(0, state.topK)
  }
}

function rerankWithConversationAndLayout(state: ChatOrchestrationState): RetrievedVector[] {
  const queryText = [
    state.decontextualizedQuery?.standaloneQuestion,
    ...(state.decontextualizedQuery?.retrievalQueries ?? []),
    state.normalizedQuery,
    state.question
  ].filter(Boolean).join(" ")
  const queryTokens = new Set(tokenize(queryText))
  const pageCounts = countPages(state.retrievedChunks)

  return state.retrievedChunks
    .map((chunk, index) => {
      const boost = layoutBoost(chunk.metadata, queryTokens) +
        pageContinuityBoost(chunk.metadata, pageCounts) +
        previousCitationBoost(chunk.metadata, state.conversationState?.previousCitations ?? [])
      return {
        chunk: {
          ...chunk,
          score: Number(Math.min(1, chunk.score + boost).toFixed(6))
        },
        index
      }
    })
    .sort((a, b) => b.chunk.score - a.chunk.score || a.index - b.index)
    .map((item) => item.chunk)
}

function layoutBoost(metadata: VectorMetadata, queryTokens: Set<string>): number {
  const textTokens = new Set(tokenize([
    metadata.text,
    metadata.heading,
    metadata.sectionPath?.join(" "),
    metadata.figureCaption
  ].filter(Boolean).join(" ")))
  const covered = [...queryTokens].filter((token) => textTokens.has(token)).length
  const coverageBoost = Math.min(0.08, covered * 0.01)
  const headingBoost = metadata.heading && hasAnyToken(metadata.heading, queryTokens) ? 0.035 : 0
  const sectionBoost = metadata.sectionPath?.some((section) => hasAnyToken(section, queryTokens)) ? 0.03 : 0
  const kindBoost = chunkKindBoost(metadata, queryTokens)
  return coverageBoost + headingBoost + sectionBoost + kindBoost
}

function chunkKindBoost(metadata: VectorMetadata, queryTokens: Set<string>): number {
  if (metadata.chunkKind === "table" && hasAny(queryTokens, ["table", "表", "一覧", "金額", "上限", "比較"])) return 0.035
  if (metadata.chunkKind === "list" && hasAny(queryTokens, ["list", "一覧", "手順", "項目", "条件"])) return 0.025
  if (metadata.chunkKind === "figure" && hasAny(queryTokens, ["figure", "図", "チャート", "画像", "スライド"])) return 0.025
  return 0
}

function previousCitationBoost(
  metadata: VectorMetadata,
  citations: Array<{ documentId?: string; fileName?: string; chunkId?: string; pageStart?: number; pageEnd?: number }>
): number {
  let boost = 0
  for (const citation of citations) {
    if (citation.chunkId && metadata.chunkId === citation.chunkId) boost = Math.max(boost, 0.08)
    if ((citation.documentId && metadata.documentId === citation.documentId) || (citation.fileName && metadata.fileName === citation.fileName)) {
      boost = Math.max(boost, 0.045)
      if (pagesNear(metadata, citation)) boost = Math.max(boost, 0.07)
    }
  }
  return boost
}

function pageContinuityBoost(metadata: VectorMetadata, pageCounts: Map<string, number>): number {
  const pageKey = pageAnchor(metadata)
  if (!pageKey) return 0
  return (pageCounts.get(pageKey) ?? 0) >= 2 ? 0.015 : 0
}

function countPages(chunks: RetrievedVector[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const chunk of chunks) {
    const key = pageAnchor(chunk.metadata)
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

function pageAnchor(metadata: VectorMetadata): string | undefined {
  return metadata.pageStart ? `${metadata.documentId}:${metadata.pageStart}` : undefined
}

function pagesNear(metadata: VectorMetadata, citation: { pageStart?: number; pageEnd?: number }): boolean {
  if (!metadata.pageStart || !citation.pageStart) return false
  const citationEnd = citation.pageEnd ?? citation.pageStart
  const metadataEnd = metadata.pageEnd ?? metadata.pageStart
  return metadata.pageStart <= citationEnd + 1 && metadataEnd >= citation.pageStart - 1
}

function hasAnyToken(text: string, queryTokens: Set<string>): boolean {
  const normalized = text.normalize("NFKC").toLowerCase()
  return [...queryTokens].some((token) => normalized.includes(token) || token.includes(normalized))
}

function hasAny(tokens: Set<string>, expected: string[]): boolean {
  const joined = [...tokens].join(" ")
  return expected.some((token) => joined.includes(token.toLowerCase()))
}

function tokenize(input: string): string[] {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .split(/[^\p{Letter}\p{Number}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}
