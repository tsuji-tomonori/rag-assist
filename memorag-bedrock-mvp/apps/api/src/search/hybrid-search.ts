import type { AppUser } from "../auth.js"
import { config } from "../config.js"
import type { Dependencies } from "../dependencies.js"
import { chunkText } from "../rag/chunk.js"
import type { DocumentManifest, JsonValue, RetrievedVector, VectorMetadata } from "../types.js"

export type SearchInput = {
  query: string
  topK?: number
  lexicalTopK?: number
  semanticTopK?: number
  embeddingModelId?: string
  filters?: {
    tenantId?: string
    department?: string
    source?: string
    docType?: string
    documentId?: string
  }
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
  const topK = clampInt(input.topK ?? 10, 1, 50)
  const lexicalTopK = clampInt(input.lexicalTopK ?? 80, 1, 100)
  const semanticTopK = clampInt(input.semanticTopK ?? 80, 1, 100)
  const index = await getLexicalIndex(deps, user, input.filters)
  const queryTokens = tokenizeQuery(input.query)

  const lexicalHits = bm25Search(index, queryTokens, lexicalTopK)
  const vectorFilter = {
    kind: "chunk" as const,
    documentId: input.filters?.documentId,
    tenantId: input.filters?.tenantId,
    department: input.filters?.department,
    source: input.filters?.source,
    docType: input.filters?.docType
  }
  const embedding = await deps.textModel.embed(input.query, {
    modelId: input.embeddingModelId ?? config.embeddingModelId,
    dimensions: config.embeddingDimensions
  })
  const semanticHits = (await deps.evidenceVectorStore.query(embedding, semanticTopK, vectorFilter)).filter((hit) =>
    canAccessVector(hit.metadata, user)
  )

  const fused = rrfFuse(
    [
      lexicalHits.map((hit) => ({ id: hit.id, score: hit.score })),
      semanticHits.map((hit) => ({ id: hit.key, score: hit.score }))
    ],
    { weights: [1, 0.9] }
  )

  const lexicalById = new Map(lexicalHits.map((hit, idx) => [hit.id, { ...hit, rank: idx + 1 }]))
  const semanticById = new Map(semanticHits.map((hit, idx) => [hit.key, { ...hit, rank: idx + 1 }]))
  const docsById = new Map(index.docs.map((doc) => [doc.id, doc]))

  const results = cheapRerank(
    input.query,
    fused
      .map((hit) => toSearchResult(hit, docsById.get(hit.id), lexicalById.get(hit.id), semanticById.get(hit.id)))
      .filter((result): result is SearchResult => result !== undefined)
  ).slice(0, topK)

  return {
    query: input.query,
    results,
    diagnostics: {
      indexVersion: index.version,
      aliasVersion: index.aliasVersion,
      lexicalCount: lexicalHits.length,
      semanticCount: semanticHits.length,
      fusedCount: fused.length,
      latencyMs: Date.now() - started
    }
  }
}

export async function getLexicalIndex(
  deps: Pick<Dependencies, "objectStore">,
  user: AppUser,
  filters?: SearchInput["filters"]
): Promise<LexicalIndex> {
  const keys = (await deps.objectStore.listKeys("manifests/")).filter((key) => key.endsWith(".json")).sort()
  const manifests = await Promise.all(keys.map(async (key) => JSON.parse(await deps.objectStore.getText(key)) as DocumentManifest))
  const visible = manifests.filter((manifest) => canAccessManifest(manifest, user)).filter((manifest) => manifestMatchesFilters(manifest, filters))
  const aliases = mergeAliases(visible.map((manifest) => aliasMapFromMetadata(manifest.metadata)))
  const aliasSignature = stableStringifyAliasMap(aliases)
  const signature = visible
    .map((manifest) => `${manifest.documentId}:${manifest.chunkCount}:${manifest.createdAt}:${stableStringifyAliasMap(aliasMapFromMetadata(manifest.metadata))}`)
    .sort()
    .join("|")
  if (cachedIndex && cachedIndex.signature === signature) return cachedIndex.index

  const docs: LexicalDocument[] = []
  for (const manifest of visible) {
    const source = await deps.objectStore.getText(manifest.sourceObjectKey)
    const chunks = chunkText(source, config.chunkSizeChars, config.chunkOverlapChars)
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

export function bm25Search(index: LexicalIndex, rawTokens: string[], topK: number): LexicalHit[] {
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
        nDocs: index.nDocs
      })
      scores.set(posting.docOrdinal, (scores.get(posting.docOrdinal) ?? 0) + score)
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
      if (normalizedQuery && normalizedText.includes(normalizedQuery)) score += 0.2
      if (normalizedQuery && normalize(result.fileName).includes(normalizedQuery)) score += 0.15
      const textTokens = new Set(tokenizeQuery(result.text))
      const covered = [...queryTokens].filter((token) => textTokens.has(token)).length
      score += covered * 0.03
      if (result.createdAt) {
        const ageDays = (Date.now() - new Date(result.createdAt).getTime()) / 86_400_000
        if (Number.isFinite(ageDays) && ageDays < 90) score += 0.02
      }
      return { ...result, score }
    })
    .sort((a, b) => b.score - a.score)
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

function canAccessManifest(manifest: DocumentManifest, user: AppUser): boolean {
  if (user.cognitoGroups.includes("SYSTEM_ADMIN")) return true
  const metadata = manifest.metadata ?? {}
  return canAccessMetadata(metadata, user)
}

function canAccessVector(metadata: VectorMetadata, user: AppUser): boolean {
  if (user.cognitoGroups.includes("SYSTEM_ADMIN")) return true
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
  return true
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
  const allowedKeys = ["tenantId", "source", "docType", "department"] as const
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
