import type { AppUser } from "../auth.js"
import { config } from "../config.js"
import type { Dependencies } from "../dependencies.js"
import { normalizeSearchTopK, ragRuntimePolicy } from "../agent/runtime-policy.js"
import { loadChunksForManifest } from "../rag/manifest-chunks.js"
import { loadPublishedAliasMap } from "./alias-artifacts.js"
import type { DocumentGroup, DocumentManifest, JsonValue, RetrievedVector, SearchScope, VectorMetadata } from "../types.js"

export type SearchInput = {
  query: string
  topK?: number
  lexicalTopK?: number
  semanticTopK?: number
  embeddingModelId?: string
  semanticVector?: number[]
  filters?: {
    tenantId?: string
    department?: string
    source?: string
    docType?: string
    benchmarkSuiteId?: string
    documentId?: string
  }
  scope?: SearchScope
}

export type SearchResult = {
  id: string
  documentId: string
  fileName: string
  chunkId?: string
  text: string
  score: number
  rrfScore: number
  lexicalScore?: number
  semanticScore?: number
  lexicalRank?: number
  semanticRank?: number
  matchedTerms: string[]
  sources: ("lexical" | "semantic")[]
  createdAt?: string
  metadata?: Record<string, JsonValue>
}

export type SearchResponse = {
  query: string
  results: SearchResult[]
  diagnostics: {
    indexVersion: string
    aliasVersion: string
    lexicalCount: number
    semanticCount: number
    fusedCount: number
    latencyMs: number
    profileId: string
    profileVersion: string
    topGap: number | null
    lexicalSemanticOverlap: number
    scoreDistribution: {
      top: number | null
      median: number | null
      p90: number | null
      min: number | null
      max: number | null
    }
    adaptiveDecision?: {
      strategy: "fixed" | "adaptive"
      reason: string
      effectiveTopK: number
      effectiveMinScore: number
    }
    index?: {
      visibleManifestCount: number
      indexedChunkCount: number
      cache: "memory" | "artifact" | "built"
      loadMs: number
    }
  }
}

type WeightedToken = {
  term: string
  weight: number
}

type Posting = {
  docOrdinal: number
  tf: number
}

type LexicalDocument = {
  id: string
  documentId: string
  fileName: string
  chunkId: string
  text: string
  len: number
  createdAt: string
  metadata?: Record<string, JsonValue>
}

type LexicalIndex = {
  version: string
  nDocs: number
  avgDocLen: number
  docs: LexicalDocument[]
  df: Map<string, number>
  postings: Map<string, Posting[]>
  dictionary: string[]
  aliases: AliasMap
  aliasVersion: string
  diagnostics?: LexicalIndexDiagnostics
}

type LexicalIndexDiagnostics = {
  visibleManifestCount: number
  indexedChunkCount: number
  cache: "memory" | "artifact" | "built"
  loadMs: number
}

type SerializedLexicalIndex = {
  schemaVersion: 1
  signature: string
  index: {
    version: string
    nDocs: number
    avgDocLen: number
    docs: LexicalDocument[]
    df: Array<[string, number]>
    postings: Array<[string, Posting[]]>
    dictionary: string[]
    aliases: AliasMap
    aliasVersion: string
  }
  createdAt: string
}

type LexicalHit = {
  id: string
  score: number
  matchedTerms: string[]
}

type CachedIndex = {
  signature: string
  index: LexicalIndex
}

type AliasMap = Record<string, string[]>

let cachedIndex: CachedIndex | undefined

export async function searchRag(deps: Dependencies, input: SearchInput, user: AppUser): Promise<SearchResponse> {
  const started = Date.now()
  const requestedTopK = normalizeSearchTopK(input.topK)
  const lexicalTopK = clampInt(input.lexicalTopK ?? ragRuntimePolicy.retrieval.lexicalTopK, 0, ragRuntimePolicy.retrieval.searchRagMaxSourceTopK)
  const semanticTopK = clampInt(input.semanticTopK ?? ragRuntimePolicy.retrieval.semanticTopK, 0, ragRuntimePolicy.retrieval.searchRagMaxSourceTopK)
  const topK = ragRuntimePolicy.retrieval.adaptiveEnabled
    ? clampInt(Math.max(requestedTopK, Math.ceil(requestedTopK * 1.5)), requestedTopK, ragRuntimePolicy.retrieval.searchRagMaxTopK)
    : requestedTopK
  const index = await getLexicalIndex(deps, user, input.filters, input.scope)
  const queryTokens = tokenizeQuery(input.query)

  const lexicalHits = lexicalTopK > 0 ? bm25Search(index, queryTokens, lexicalTopK, { k1: ragRuntimePolicy.retrieval.bm25K1, b: ragRuntimePolicy.retrieval.bm25B }) : []
  const vectorFilter = {
    kind: "chunk" as const,
    documentId: input.filters?.documentId,
    tenantId: input.filters?.tenantId,
    department: input.filters?.department,
    source: input.filters?.source,
    docType: input.filters?.docType,
    benchmarkSuiteId: input.filters?.benchmarkSuiteId
  }
  const semanticQueryTopK = Math.min(
    ragRuntimePolicy.retrieval.searchRagMaxSourceTopK,
    Math.max(semanticTopK, Math.ceil(semanticTopK * ragRuntimePolicy.retrieval.searchSemanticPrefetchMultiplier))
  )
  const semanticHits =
    semanticTopK > 0
      ? (
          await filterAccessibleVectorHits(
            deps,
            await deps.evidenceVectorStore.query(
              input.semanticVector ??
                (await deps.textModel.embed(input.query, {
                  modelId: input.embeddingModelId ?? config.embeddingModelId,
                  dimensions: config.embeddingDimensions
                })),
              semanticQueryTopK,
              vectorFilter
            ),
            user,
            input.scope
          )
        ).slice(0, semanticTopK)
      : []

  const fused = rrfFuse(
    [
      lexicalHits.map((hit) => ({ id: hit.id, score: hit.score })),
      semanticHits.map((hit) => ({ id: hit.key, score: hit.score }))
    ],
    { k: ragRuntimePolicy.retrieval.rrfK, weights: ragRuntimePolicy.retrieval.rrfWeights }
  )

  const lexicalById = new Map(lexicalHits.map((hit, idx) => [hit.id, { ...hit, rank: idx + 1 }]))
  const semanticById = new Map(semanticHits.map((hit, idx) => [hit.key, { ...hit, rank: idx + 1 }]))
  const docsById = new Map(index.docs.map((doc) => [doc.id, doc]))

  const reranked = cheapRerank(
    input.query,
    fused
      .map((hit) => toSearchResult(hit, docsById.get(hit.id), lexicalById.get(hit.id), semanticById.get(hit.id)))
      .filter((result): result is SearchResult => result !== undefined)
  )
  const diagnostics = buildSearchDiagnostics({
    indexVersion: index.version,
    aliasVersion: index.aliasVersion,
    lexicalHits,
    semanticHits,
    fusedCount: fused.length,
    results: reranked,
    requestedTopK,
    effectiveTopK: topK,
    latencyMs: Date.now() - started,
    indexDiagnostics: index.diagnostics
  })
  const decision = diagnostics.adaptiveDecision ?? { effectiveMinScore: -1, effectiveTopK: requestedTopK }
  const results = reranked.filter((result) => result.score >= decision.effectiveMinScore).slice(0, decision.effectiveTopK)

  return {
    query: input.query,
    results,
    diagnostics: {
      indexVersion: index.version,
      aliasVersion: index.aliasVersion,
      lexicalCount: lexicalHits.length,
      semanticCount: semanticHits.length,
      fusedCount: fused.length,
      latencyMs: diagnostics.latencyMs,
      profileId: diagnostics.profileId,
      profileVersion: diagnostics.profileVersion,
      topGap: diagnostics.topGap,
      lexicalSemanticOverlap: diagnostics.lexicalSemanticOverlap,
      scoreDistribution: diagnostics.scoreDistribution,
      adaptiveDecision: diagnostics.adaptiveDecision,
      index: diagnostics.index
    }
  }
}

export async function getLexicalIndex(
  deps: Pick<Dependencies, "objectStore">,
  user: AppUser,
  filters?: SearchInput["filters"],
  scope?: SearchScope
): Promise<LexicalIndex> {
  const started = Date.now()
  const keys = (await deps.objectStore.listKeys("manifests/")).filter((key) => key.endsWith(".json")).sort()
  const manifests = await Promise.all(keys.map(async (key) => JSON.parse(await deps.objectStore.getText(key)) as DocumentManifest))
  const groups = await loadDocumentGroups(deps)
  const visible = manifests
    .filter(isActiveManifest)
    .filter((manifest) => canAccessManifest(manifest, user, groups))
    .filter((manifest) => manifestMatchesFilters(manifest, filters))
    .filter((manifest) => manifestMatchesScope(manifest, scope))
  const publishedAliases = await loadPublishedAliasMap(deps, filters, visible.map((manifest) => manifest.metadata))
  const aliases = mergeAliases([publishedAliases.aliases, ...visible.map((manifest) => aliasMapFromMetadata(manifest.metadata))])
  const combinedAliasSignature = stableStringifyAliasMap(aliases)
  const aliasSignature = publishedAliases.version === "none" ? combinedAliasSignature : `${publishedAliases.version}:${combinedAliasSignature}`
  const signature = visible
    .map((manifest) => `${manifest.documentId}:${manifest.chunkCount}:${manifest.createdAt}:${stableStringifyAliasMap(aliasMapFromMetadata(manifest.metadata))}`)
    .sort()
    .concat(`aliases:${publishedAliases.version}:${stableStringifyAliasMap(publishedAliases.aliases)}`)
    .join("|")
  if (cachedIndex && cachedIndex.signature === signature) {
    cachedIndex.index.diagnostics = indexDiagnostics(visible.length, cachedIndex.index.nDocs, "memory", started)
    return cachedIndex.index
  }
  const artifact = await loadLexicalIndexArtifact(deps, signature)
  if (artifact) {
    artifact.diagnostics = indexDiagnostics(visible.length, artifact.nDocs, "artifact", started)
    cachedIndex = { signature, index: artifact }
    return artifact
  }

  const docs: LexicalDocument[] = []
  for (const manifest of visible) {
    const chunks = await loadChunksForManifest(deps, manifest)
    for (const chunk of chunks) {
      docs.push({
        id: `${manifest.documentId}-${chunk.id}`,
        documentId: manifest.documentId,
        fileName: manifest.fileName,
        chunkId: chunk.id,
        text: chunk.text,
        len: 0,
        createdAt: manifest.createdAt,
        metadata: manifest.metadata
      })
    }
  }

  const index = buildLexicalIndex(docs, versionLabel("lexical", signature || "empty"), aliases, aliasVersionLabel(aliasSignature))
  index.diagnostics = indexDiagnostics(visible.length, index.nDocs, "built", started)
  if (config.publishLexicalIndexOnSearch) await publishLexicalIndexArtifact(deps, signature, index)
  cachedIndex = { signature, index }
  return index
}

export function buildLexicalIndex(inputDocs: LexicalDocument[], version: string, aliases: AliasMap = {}, aliasVersion?: string): LexicalIndex {
  const postings = new Map<string, Posting[]>()
  const df = new Map<string, number>()
  const dictionarySet = new Set<string>()
  let totalLen = 0

  const docs = inputDocs.map((doc, docOrdinal) => {
    const tokens = weightedDocumentTokens(doc.fileName, doc.text)
    const termWeights = new Map<string, number>()
    for (const token of tokens) termWeights.set(token.term, (termWeights.get(token.term) ?? 0) + token.weight)
    for (const [term, tf] of termWeights) {
      dictionarySet.add(term)
      const list = postings.get(term) ?? []
      list.push({ docOrdinal, tf })
      postings.set(term, list)
      df.set(term, (df.get(term) ?? 0) + 1)
    }
    const len = Math.max(1, tokens.reduce((sum, token) => sum + token.weight, 0))
    totalLen += len
    return { ...doc, len }
  })

  return {
    version,
    nDocs: docs.length,
    avgDocLen: docs.length > 0 ? totalLen / docs.length : 1,
    docs,
    df,
    postings,
    dictionary: [...dictionarySet],
    aliases: normalizeAliasMap(aliases),
    aliasVersion: aliasVersion ?? aliasVersionLabel(stableStringifyAliasMap(aliases))
  }
}

export function bm25Search(index: LexicalIndex, rawTokens: string[], topK: number, options: { k1?: number; b?: number } = {}): LexicalHit[] {
  if (index.nDocs === 0 || rawTokens.length === 0) return []
  const queryTokens = expandQueryTerms(rawTokens, index.dictionary, index.aliases)
  const scores = new Map<number, number>()
  const matched = new Map<number, Set<string>>()

  for (const token of queryTokens) {
    const list = index.postings.get(token.term)
    if (!list) continue
    const df = index.df.get(token.term) ?? 0
    for (const posting of list) {
      const doc = index.docs[posting.docOrdinal]
      if (!doc) continue
      const score = bm25Score({
        tf: posting.tf * token.weight,
        df,
        docLen: doc.len,
        avgDocLen: index.avgDocLen,
        nDocs: index.nDocs,
        k1: options.k1,
        b: options.b
      })
      const abbreviationBonus = token.weight >= 5 ? token.weight * 0.35 : 0
      scores.set(posting.docOrdinal, (scores.get(posting.docOrdinal) ?? 0) + score + abbreviationBonus)
      const terms = matched.get(posting.docOrdinal) ?? new Set<string>()
      terms.add(token.term)
      matched.set(posting.docOrdinal, terms)
    }
  }

  return [...scores.entries()]
    .map(([docOrdinal, score]) => ({
      id: index.docs[docOrdinal]?.id ?? "",
      score,
      matchedTerms: [...(matched.get(docOrdinal) ?? new Set<string>())]
    }))
    .filter((hit) => hit.id)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

export function rrfFuse(
  resultLists: { id: string; score?: number }[][],
  options: { k?: number; weights?: number[] } = {}
): { id: string; score: number }[] {
  const k = options.k ?? 60
  const weights = options.weights ?? resultLists.map(() => 1)
  const scores = new Map<string, number>()

  resultLists.forEach((list, listIdx) => {
    const weight = weights[listIdx] ?? 1
    list.forEach((item, rankIdx) => {
      const prev = scores.get(item.id) ?? 0
      scores.set(item.id, prev + weight / (k + rankIdx + 1))
    })
  })

  return [...scores.entries()].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score)
}

export function bm25Score(params: {
  tf: number
  df: number
  docLen: number
  avgDocLen: number
  nDocs: number
  k1?: number
  b?: number
}): number {
  const k1 = params.k1 ?? 1.2
  const b = params.b ?? 0.75
  const idf = Math.log(1 + (params.nDocs - params.df + 0.5) / (params.df + 0.5))
  const norm = params.tf + k1 * (1 - b + b * (params.docLen / params.avgDocLen))
  return idf * ((params.tf * (k1 + 1)) / norm)
}

function toSearchResult(
  fused: { id: string; score: number },
  doc: LexicalDocument | undefined,
  lexical: (LexicalHit & { rank: number }) | undefined,
  semantic: (RetrievedVector & { rank: number }) | undefined
): SearchResult | undefined {
  const semanticMetadata = semantic?.metadata
  const documentId = doc?.documentId ?? semanticMetadata?.documentId
  const fileName = doc?.fileName ?? semanticMetadata?.fileName
  const text = doc?.text ?? semanticMetadata?.text
  if (!documentId || !fileName || !text) return undefined

  return {
    id: fused.id,
    documentId,
    fileName,
    chunkId: doc?.chunkId ?? semanticMetadata?.chunkId,
    text,
    score: fused.score,
    rrfScore: fused.score,
    lexicalScore: lexical?.score,
    semanticScore: semantic?.score,
    lexicalRank: lexical?.rank,
    semanticRank: semantic?.rank,
    matchedTerms: lexical?.matchedTerms ?? [],
    sources: [lexical ? "lexical" : undefined, semantic ? "semantic" : undefined].filter((value): value is "lexical" | "semantic" => Boolean(value)),
    createdAt: doc?.createdAt ?? semanticMetadata?.createdAt,
    metadata: sanitizeSearchMetadata(doc?.metadata ?? semanticMetadata)
  }
}

function cheapRerank(query: string, results: SearchResult[]): SearchResult[] {
  const normalizedQuery = normalize(query)
  const queryTokens = new Set(tokenizeQuery(query))
  return results
    .map((result) => {
      let score = result.rrfScore
      const normalizedText = normalize(`${result.fileName}\n${result.text}`)
      if (normalizedQuery && normalizedText.includes(normalizedQuery)) score += ragRuntimePolicy.profile.retrieval.scoring.exactQueryBonus
      if (normalizedQuery && normalize(result.fileName).includes(normalizedQuery)) score += ragRuntimePolicy.profile.retrieval.scoring.fileNameBonus
      const textTokens = new Set(tokenizeQuery(result.text))
      const covered = [...queryTokens].filter((token) => textTokens.has(token)).length
      score += covered * ragRuntimePolicy.profile.retrieval.scoring.tokenCoverageBonus
      if (result.createdAt) {
        const ageDays = (Date.now() - new Date(result.createdAt).getTime()) / 86_400_000
        if (Number.isFinite(ageDays) && ageDays < 90) score += ragRuntimePolicy.profile.retrieval.scoring.recencyBonus
      }
      return { ...result, score }
    })
    .sort((a, b) => b.score - a.score)
}

function buildSearchDiagnostics(input: {
  indexVersion: string
  aliasVersion: string
  lexicalHits: LexicalHit[]
  semanticHits: RetrievedVector[]
  fusedCount: number
  results: SearchResult[]
  requestedTopK: number
  effectiveTopK: number
  latencyMs: number
  indexDiagnostics?: LexicalIndexDiagnostics
}): SearchResponse["diagnostics"] {
  const scores = input.results.map((result) => result.score).sort((a, b) => a - b)
  const top = input.results[0]?.score ?? null
  const second = input.results[1]?.score ?? null
  const lexicalIds = new Set(input.lexicalHits.map((hit) => hit.id))
  const semanticIds = new Set(input.semanticHits.map((hit) => hit.key))
  const unionSize = new Set([...lexicalIds, ...semanticIds]).size
  const overlap = unionSize === 0 ? 0 : [...lexicalIds].filter((id) => semanticIds.has(id)).length / unionSize
  const gap = top !== null && second !== null ? Number((top - second).toFixed(6)) : null
  const adaptiveDecision = ragRuntimePolicy.retrieval.adaptiveEnabled
    ? {
        strategy: "adaptive" as const,
        reason: gap !== null && gap < ragRuntimePolicy.retrieval.adaptiveTopGapExpandBelow ? "small_top_gap_expand_candidates" : overlap >= ragRuntimePolicy.retrieval.adaptiveOverlapBoostAtLeast ? "lexical_semantic_overlap_supports_precision" : "score_distribution_floor",
        effectiveTopK: input.effectiveTopK,
        effectiveMinScore: adaptiveEffectiveMinScore(scores, ragRuntimePolicy.retrieval.adaptiveMinCombinedScore, ragRuntimePolicy.retrieval.adaptiveScoreFloorQuantile)
      }
    : {
        strategy: "fixed" as const,
        reason: "adaptive retrieval is opt-in",
        effectiveTopK: input.requestedTopK,
        effectiveMinScore: -1
      }

  return {
    indexVersion: input.indexVersion,
    aliasVersion: input.aliasVersion,
    lexicalCount: input.lexicalHits.length,
    semanticCount: input.semanticHits.length,
    fusedCount: input.fusedCount,
    latencyMs: input.latencyMs,
    profileId: ragRuntimePolicy.retrieval.profileId,
    profileVersion: ragRuntimePolicy.retrieval.profileVersion,
    topGap: gap,
    lexicalSemanticOverlap: Number(overlap.toFixed(4)),
    scoreDistribution: {
      top,
      median: percentileScore(scores, 0.5),
      p90: percentileScore(scores, 0.9),
      min: scores[0] ?? null,
      max: scores.at(-1) ?? null
    },
    adaptiveDecision,
    index: input.indexDiagnostics
  }
}

function indexDiagnostics(
  visibleManifestCount: number,
  indexedChunkCount: number,
  cache: LexicalIndexDiagnostics["cache"],
  started: number
): LexicalIndexDiagnostics {
  return {
    visibleManifestCount,
    indexedChunkCount,
    cache,
    loadMs: Date.now() - started
  }
}

export function adaptiveEffectiveMinScore(scores: number[], minCombinedScore: number, scoreFloorQuantile: number): number {
  return Math.max(minCombinedScore, percentileScore([...scores].sort((a, b) => a - b), scoreFloorQuantile) ?? minCombinedScore)
}

function percentileScore(scores: number[], p: number): number | null {
  if (scores.length === 0) return null
  const index = Math.min(scores.length - 1, Math.max(0, Math.ceil(scores.length * p) - 1))
  const value = scores[index]
  return value === undefined ? null : Number(value.toFixed(6))
}

function weightedDocumentTokens(title: string, body: string): WeightedToken[] {
  return [
    ...tokenizeQuery(title).map((term) => ({ term, weight: 3 })),
    ...tokenizeQuery(body).map((term) => ({ term, weight: 1 })),
    ...ngramTokens(title, 2, 3).map((term) => ({ term, weight: 0.6 })),
    ...ngramTokens(body, 2, 3).map((term) => ({ term, weight: 0.35 }))
  ]
}

function expandQueryTerms(rawTerms: string[], dictionary: string[], aliases: AliasMap): WeightedToken[] {
  const terms = new Map<string, number>()
  for (const term of rawTerms) {
    terms.set(term, Math.max(terms.get(term) ?? 0, 1))
    for (const alias of aliases[term] ?? []) terms.set(normalize(alias), Math.max(terms.get(normalize(alias)) ?? 0, 1.6))
    for (const ngram of ngramTokens(term, 2, 3)) terms.set(ngram, Math.max(terms.get(ngram) ?? 0, 0.45))
  }

  for (const term of rawTerms) {
    for (const candidate of prefixCandidates(term, dictionary)) terms.set(candidate, Math.max(terms.get(candidate) ?? 0, 0.5))
    for (const candidate of cjkAbbreviationCandidates(term, dictionary)) terms.set(candidate, Math.max(terms.get(candidate) ?? 0, 12))
    if (shouldFuzzy(term)) {
      for (const candidate of fuzzyCandidates(term, dictionary)) terms.set(candidate, Math.max(terms.get(candidate) ?? 0, 0.35))
    }
  }

  return [...terms.entries()].map(([term, weight]) => ({ term, weight }))
}

export function tokenizeQuery(text: string): string[] {
  const normalized = normalize(text)
  const ascii = normalized.match(/[a-z0-9_-]+/g) ?? []
  const japaneseRuns = normalized.match(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー]+/gu) ?? []
  const japanese = japaneseRuns.flatMap((run) => {
    if (run.length <= 2) return [run]
    return [run, ...ngramTokens(run, 2, 3)]
  })
  return [...new Set([...ascii, ...japanese].filter((term) => term.length > 0))]
}

function ngramTokens(text: string, min: number, max: number): string[] {
  const chars = [...normalize(text).replace(/[\s\p{P}]/gu, "")]
  const grams: string[] = []
  for (let size = min; size <= max; size += 1) {
    if (chars.length < size) continue
    for (let i = 0; i <= chars.length - size; i += 1) grams.push(chars.slice(i, i + size).join(""))
  }
  return grams
}

function prefixCandidates(term: string, dictionary: string[]): string[] {
  if (term.length < 2) return []
  return dictionary.filter((candidate) => candidate.length > term.length && candidate.startsWith(term)).slice(0, 20)
}

function cjkAbbreviationCandidates(term: string, dictionary: string[]): string[] {
  if (!isCjkAbbreviationTerm(term)) return []
  return dictionary
    .filter((candidate) => candidate.length > term.length && candidate.length <= Math.max(8, term.length * 12))
    .filter((candidate) => isCjkAbbreviationExpansion(term, candidate))
    .slice(0, 20)
}

function fuzzyCandidates(term: string, dictionary: string[]): string[] {
  const maxDistance = term.length > 7 ? 2 : 1
  return dictionary
    .filter((candidate) => candidate !== term && shouldFuzzy(candidate) && Math.abs(candidate.length - term.length) <= maxDistance)
    .filter((candidate) => levenshteinDistance(term, candidate, maxDistance) <= maxDistance)
    .slice(0, 10)
}

function shouldFuzzy(term: string): boolean {
  return term.length >= 4 && /^[a-z0-9_-]+$/.test(term)
}

function isCjkAbbreviationTerm(term: string): boolean {
  return term.length >= 2 && term.length <= 6 && isCjkText(term)
}

function isCjkText(value: string): boolean {
  return /^[\p{Script=Katakana}\p{Script=Han}ー]+$/u.test(value)
}

function isCjkAbbreviationExpansion(term: string, candidate: string): boolean {
  return isCjkText(candidate) && candidate[0] === term[0] && !candidate.includes(term) && isOrderedSubsequence(term, candidate)
}

function isOrderedSubsequence(short: string, long: string): boolean {
  let index = 0
  for (const char of short) {
    index = long.indexOf(char, index)
    if (index < 0) return false
    index += char.length
  }
  return true
}

function levenshteinDistance(a: string, b: string, maxDistance: number): number {
  let prev = Array.from({ length: b.length + 1 }, (_, idx) => idx)
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i]
    let rowMin = curr[0] ?? i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const value = Math.min((curr[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost)
      curr[j] = value
      rowMin = Math.min(rowMin, value)
    }
    if (rowMin > maxDistance) return rowMin
    prev = curr
  }
  return prev[b.length] ?? maxDistance + 1
}

function normalize(text: string): string {
  return text.normalize("NFKC").toLowerCase().trim()
}

function canAccessManifest(manifest: DocumentManifest, user: AppUser, groups: DocumentGroup[] = []): boolean {
  if (user.cognitoGroups.includes("SYSTEM_ADMIN")) return true
  const metadata = manifest.metadata ?? {}
  if (stringValue(metadata.ownerUserId) === user.userId) return true
  const manifestGroupIds = stringValues(metadata.groupIds ?? metadata.groupId)
  if (manifestGroupIds.some((groupId) => canAccessDocumentGroup(groups.find((group) => group.groupId === groupId), user))) return true
  if (stringValue(metadata.scopeType) === "group") return false
  return canAccessMetadata(metadata, user)
}

function isActiveManifest(manifest: DocumentManifest): boolean {
  if ((manifest.lifecycleStatus ?? stringValue(manifest.metadata?.lifecycleStatus) ?? "active") !== "active") return false
  const expiresAt = stringValue(manifest.metadata?.expiresAt)
  return !expiresAt || new Date(expiresAt).getTime() > Date.now()
}

async function filterAccessibleVectorHits(
  deps: Pick<Dependencies, "objectStore">,
  hits: RetrievedVector[],
  user: AppUser,
  scope?: SearchScope
): Promise<RetrievedVector[]> {
  const manifestCache = new Map<string, DocumentManifest | undefined>()
  const groups = await loadDocumentGroups(deps)
  const result: RetrievedVector[] = []
  for (const hit of hits) {
    if (!canAccessVectorMetadata(hit.metadata, user)) continue
    const manifest = await getCachedManifest(deps, manifestCache, hit.metadata.documentId)
    if (!manifest || !isActiveManifest(manifest) || !canAccessManifest(manifest, user, groups) || !manifestMatchesScope(manifest, scope)) continue
    result.push(hit)
  }
  return result
}

async function getCachedManifest(
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

function canAccessVectorMetadata(metadata: VectorMetadata, user: AppUser): boolean {
  if ((metadata.lifecycleStatus ?? "active") !== "active") return false
  if (user.cognitoGroups.includes("SYSTEM_ADMIN")) return true
  const scopeType = metadata.scopeType
  if (scopeType === "group" || scopeType === "chat") return true
  return canAccessMetadata(metadata as unknown as Record<string, JsonValue>, user)
}

function canAccessMetadata(metadata: Record<string, JsonValue>, user: AppUser): boolean {
  const groups = new Set(user.cognitoGroups)
  const aclGroups = stringValues(metadata.aclGroups ?? metadata.allowedGroups ?? metadata.aclGroup ?? metadata.group)
  if (aclGroups.length > 0 && !aclGroups.some((group) => groups.has(group))) return false
  const allowedUsers = stringValues(metadata.allowedUsers ?? metadata.userIds ?? metadata.privateToUserId)
  if (allowedUsers.length > 0 && !allowedUsers.includes(user.userId) && (!user.email || !allowedUsers.includes(user.email))) return false
  return true
}

function manifestMatchesFilters(manifest: DocumentManifest, filters: SearchInput["filters"] = {}): boolean {
  if (filters.documentId && manifest.documentId !== filters.documentId) return false
  const metadata = manifest.metadata ?? {}
  if (filters.tenantId && stringValue(metadata.tenantId) !== filters.tenantId) return false
  if (filters.department && stringValue(metadata.department) !== filters.department) return false
  if (filters.source && stringValue(metadata.source) !== filters.source) return false
  if (filters.docType && stringValue(metadata.docType) !== filters.docType) return false
  if (filters.benchmarkSuiteId && stringValue(metadata.benchmarkSuiteId) !== filters.benchmarkSuiteId) return false
  return true
}

function manifestMatchesScope(manifest: DocumentManifest, scope: SearchScope | undefined): boolean {
  const metadata = manifest.metadata ?? {}
  const scopeType = stringValue(metadata.scopeType)
  const temporaryMatch = Boolean(
    scope?.includeTemporary && scope.temporaryScopeId && stringValue(metadata.temporaryScopeId) === scope.temporaryScopeId
  )
  if (!scope || scope.mode === "all" || !scope.mode) {
    if (scopeType !== "chat") return true
    return temporaryMatch
  }
  const groupIds = stringValues(metadata.groupIds ?? metadata.groupId)
  if (scope.mode === "groups") {
    const requested = new Set(scope.groupIds ?? [])
    return temporaryMatch || groupIds.some((groupId) => requested.has(groupId))
  }
  if (scope.mode === "documents") {
    const requested = new Set(scope.documentIds ?? [])
    return temporaryMatch || requested.has(manifest.documentId)
  }
  if (scope.mode === "temporary") {
    return Boolean(scope.temporaryScopeId && stringValue(metadata.temporaryScopeId) === scope.temporaryScopeId)
  }
  return true
}

async function loadDocumentGroups(deps: Pick<Dependencies, "objectStore">): Promise<DocumentGroup[]> {
  try {
    const raw = JSON.parse(await deps.objectStore.getText("document-groups/groups.json")) as { groups?: DocumentGroup[] }
    return Array.isArray(raw.groups) ? raw.groups : []
  } catch {
    return []
  }
}

function canAccessDocumentGroup(group: DocumentGroup | undefined, user: AppUser): boolean {
  if (!group) return false
  if (group.ownerUserId === user.userId || group.managerUserIds.includes(user.userId) || group.sharedUserIds.includes(user.userId)) return true
  if (user.email && group.sharedUserIds.includes(user.email)) return true
  if (group.visibility === "org") return true
  return group.sharedGroups.some((sharedGroup) => user.cognitoGroups.includes(sharedGroup))
}

function stringValues(value: JsonValue | undefined): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string")
  return []
}

function stringValue(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined
}

function aliasMapFromMetadata(metadata: Record<string, JsonValue> | undefined): AliasMap {
  if (!metadata) return {}
  const raw = metadata.searchAliases ?? metadata.aliases
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const aliases: AliasMap = {}
  for (const [key, value] of Object.entries(raw)) {
    const terms = stringValues(value)
    if (terms.length > 0) aliases[key] = terms
  }
  return aliases
}

function mergeAliases(maps: AliasMap[]): AliasMap {
  const merged = new Map<string, Set<string>>()
  for (const map of maps) {
    for (const [rawKey, rawValues] of Object.entries(map)) {
      const key = normalize(rawKey)
      if (!key) continue
      const values = merged.get(key) ?? new Set<string>()
      for (const rawValue of rawValues) {
        const value = normalize(rawValue)
        if (value) values.add(value)
      }
      if (values.size > 0) merged.set(key, values)
    }
  }
  return Object.fromEntries([...merged.entries()].map(([key, values]) => [key, [...values].sort()]))
}

function normalizeAliasMap(aliases: AliasMap): AliasMap {
  return mergeAliases([aliases])
}

function stableStringifyAliasMap(aliases: AliasMap): string {
  const normalized = normalizeAliasMap(aliases)
  return JSON.stringify(Object.fromEntries(Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b))))
}

function sanitizeSearchMetadata(metadata: Record<string, JsonValue> | VectorMetadata | undefined): Record<string, JsonValue> | undefined {
  if (!metadata) return undefined
  const allowedKeys = ["tenantId", "source", "docType", "benchmarkSuiteId", "department", "domainPolicy", "ragPolicy", "answerPolicy"] as const
  const sanitized: Record<string, JsonValue> = {}
  for (const key of allowedKeys) {
    const value = metadata[key]
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      sanitized[key] = value
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

function aliasVersionLabel(aliasSignature: string): string {
  return aliasSignature === "{}" ? "none" : versionLabel("alias", aliasSignature)
}

async function loadLexicalIndexArtifact(deps: Pick<Dependencies, "objectStore">, signature: string): Promise<LexicalIndex | undefined> {
  if (!signature) return undefined
  try {
    const latest = JSON.parse(await deps.objectStore.getText("lexical-index/latest.json")) as { signature?: string; objectKey?: string }
    if (latest.signature !== signature || !latest.objectKey) return undefined
    const artifact = JSON.parse(await deps.objectStore.getText(latest.objectKey)) as SerializedLexicalIndex
    if (artifact.schemaVersion !== 1 || artifact.signature !== signature) return undefined
    return deserializeLexicalIndex(artifact.index)
  } catch {
    return undefined
  }
}

async function publishLexicalIndexArtifact(deps: Pick<Dependencies, "objectStore">, signature: string, index: LexicalIndex): Promise<void> {
  if (!signature) return
  const objectKey = `lexical-index/${index.version.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`
  const artifact: SerializedLexicalIndex = {
    schemaVersion: 1,
    signature,
    index: serializeLexicalIndex(index),
    createdAt: new Date().toISOString()
  }
  await deps.objectStore.putText(objectKey, JSON.stringify(artifact), "application/json")
  await deps.objectStore.putText("lexical-index/latest.json", JSON.stringify({ signature, objectKey, indexVersion: index.version, aliasVersion: index.aliasVersion }, null, 2), "application/json")
}

function serializeLexicalIndex(index: LexicalIndex): SerializedLexicalIndex["index"] {
  return {
    ...index,
    df: [...index.df.entries()],
    postings: [...index.postings.entries()]
  }
}

function deserializeLexicalIndex(input: SerializedLexicalIndex["index"]): LexicalIndex {
  return {
    ...input,
    df: new Map(input.df),
    postings: new Map(input.postings)
  }
}

function versionLabel(prefix: string, value: string): string {
  return `${prefix}:${hashString(value)}`
}

function hashString(value: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.trunc(value)))
}
