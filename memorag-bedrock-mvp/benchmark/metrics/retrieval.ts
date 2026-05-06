export type RelevanceItem = {
  documentId?: string
  chunkId?: string
  fileName?: string
  grade?: number
}

export type RetrievedItem = {
  documentId?: string
  chunkId?: string
  fileName?: string
}

export type RetrievalMetrics = {
  recallK: number
  recallAtK: number | null
  recallAt1: number | null
  recallAt3: number | null
  recallAt5: number | null
  recallAt10: number | null
  recallAt20: number | null
  mrrAt10: number | null
  ndcgAt10: number | null
  precisionAt5: number | null
  precisionAt10: number | null
  expectedFileHit: boolean | null
  expectedDocumentHit: boolean | null
  expectedChunkHit: boolean | null
}

const recallKs = [1, 3, 5, 10, 20] as const

export function evaluateRetrieval(results: RetrievedItem[], relevant: RelevanceItem[], options: { recallK?: number } = {}): RetrievalMetrics {
  const recallK = Math.max(1, Math.trunc(options.recallK ?? 20))
  const positive = relevant.filter((item) => relevanceGrade(item) > 0)
  const metrics: RetrievalMetrics = {
    recallK,
    recallAtK: null,
    recallAt1: null,
    recallAt3: null,
    recallAt5: null,
    recallAt10: null,
    recallAt20: null,
    mrrAt10: null,
    ndcgAt10: null,
    precisionAt5: null,
    precisionAt10: null,
    expectedFileHit: null,
    expectedDocumentHit: null,
    expectedChunkHit: null
  }
  if (positive.length === 0) return metrics

  for (const k of recallKs) {
    metrics[`recallAt${k}` as keyof RetrievalMetrics] = recallAt(results, positive, k) as never
  }
  metrics.recallAtK = recallAt(results, positive, recallK)
  metrics.mrrAt10 = reciprocalRank(results, positive, 10)
  metrics.ndcgAt10 = ndcgAt(results, relevant, 10)
  metrics.precisionAt5 = precisionAt(results, positive, 5)
  metrics.precisionAt10 = precisionAt(results, positive, 10)
  metrics.expectedFileHit = positive.some((item) => item.fileName) ? hitByField(results, positive, "fileName") : null
  metrics.expectedDocumentHit = positive.some((item) => item.documentId) ? hitByField(results, positive, "documentId") : null
  metrics.expectedChunkHit = positive.some((item) => item.chunkId) ? hitByField(results, positive, "chunkId") : null
  return metrics
}

export function countAccessLeaks(results: RetrievedItem[], relevant: RelevanceItem[] = [], forbidden: RelevanceItem[] = []): number {
  const forbiddenItems = [...forbidden, ...relevant].filter((item) => relevanceGrade(item) > 0)
  if (forbiddenItems.length === 0) return 0
  return results.filter((result) => forbiddenItems.some((item) => matchesRelevance(result, item))).length
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))
  return sorted[index] ?? null
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4))
}

export function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return Number((numerator / denominator).toFixed(4))
}

function recallAt(results: RetrievedItem[], relevant: RelevanceItem[], k: number): number {
  const hits = relevant.filter((item) => results.slice(0, k).some((result) => matchesRelevance(result, item))).length
  return Number((hits / relevant.length).toFixed(4))
}

function precisionAt(results: RetrievedItem[], relevant: RelevanceItem[], k: number): number {
  const topK = results.slice(0, k)
  if (topK.length === 0) return 0
  const hits = topK.filter((result) => relevant.some((item) => matchesRelevance(result, item))).length
  return Number((hits / k).toFixed(4))
}

function reciprocalRank(results: RetrievedItem[], relevant: RelevanceItem[], k: number): number {
  const index = results.slice(0, k).findIndex((result) => relevant.some((item) => matchesRelevance(result, item)))
  return index === -1 ? 0 : Number((1 / (index + 1)).toFixed(4))
}

function ndcgAt(results: RetrievedItem[], relevant: RelevanceItem[], k: number): number {
  const consumedRelevantIndexes = new Set<number>()
  const gains = results.slice(0, k).map((result) => {
    const matched = relevant
      .map((item, index) => ({ item, index }))
      .filter(({ item, index }) => !consumedRelevantIndexes.has(index) && matchesRelevance(result, item))
      .sort((a, b) => relevanceGrade(b.item) - relevanceGrade(a.item))[0]
    if (!matched) return 0
    consumedRelevantIndexes.add(matched.index)
    return relevanceGrade(matched.item)
  })
  const dcgValue = dcg(gains)
  const idealGains = relevant.map(relevanceGrade).sort((a, b) => b - a).slice(0, k)
  const ideal = dcg(idealGains)
  return ideal === 0 ? 0 : Number((dcgValue / ideal).toFixed(4))
}

function dcg(gains: number[]): number {
  return gains.reduce((sum, gain, index) => sum + ((2 ** gain - 1) / Math.log2(index + 2)), 0)
}

function hitByField(results: RetrievedItem[], relevant: RelevanceItem[], field: keyof RetrievedItem): boolean {
  const expected = new Set(relevant.map((item) => normalize(String(item[field] ?? ""))).filter(Boolean))
  return results.some((result) => expected.has(normalize(String(result[field] ?? ""))))
}

function matchesRelevance(result: RetrievedItem, relevant: RelevanceItem): boolean {
  if (relevant.chunkId && result.chunkId) return normalize(result.chunkId) === normalize(relevant.chunkId)
  if (relevant.documentId && result.documentId) return normalize(result.documentId) === normalize(relevant.documentId)
  if (relevant.fileName && result.fileName) return normalize(result.fileName) === normalize(relevant.fileName)
  return false
}

function relevanceGrade(item: RelevanceItem): number {
  return item.grade ?? 1
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase()
}
