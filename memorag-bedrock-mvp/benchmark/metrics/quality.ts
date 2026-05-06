export type BenchmarkMetricSummary = Record<string, number | null | undefined>

export type RegressionThresholds = Record<string, number>

export type QualityRegression = {
  metric: string
  baseline: number
  current: number
  delta: number
  threshold: number
}

export type FailedBenchmarkRow = {
  id?: string
  question: string
  reasons: string[]
  expectedContains?: string | string[]
  expectedAnswer?: string
  expected?: string
  answerPreview?: string
}

export type AliasCandidate = {
  term: string
  expansions: string[]
  sourceRowIds: string[]
  reason: string
}

export type QualityReview = {
  status: "pass" | "regressed"
  regressions: QualityRegression[]
  aliasCandidates: AliasCandidate[]
}

export type TokenizerComparison = {
  query: string
  tokenizers: Array<{
    name: string
    tokens: string[]
    tokenCount: number
  }>
  overlap: Array<{
    left: string
    right: string
    jaccard: number
  }>
}

export function createQualityReview(input: {
  current: BenchmarkMetricSummary
  baseline?: BenchmarkMetricSummary
  thresholds?: RegressionThresholds
  failures?: FailedBenchmarkRow[]
}): QualityReview {
  const regressions = input.baseline
    ? detectRegressions(input.current, input.baseline, input.thresholds ?? defaultThresholds)
    : []
  return {
    status: regressions.length > 0 ? "regressed" : "pass",
    regressions,
    aliasCandidates: proposeAliasCandidates(input.failures ?? [])
  }
}

export function detectRegressions(
  current: BenchmarkMetricSummary,
  baseline: BenchmarkMetricSummary,
  thresholds: RegressionThresholds = defaultThresholds
): QualityRegression[] {
  const regressions: QualityRegression[] = []
  for (const [metric, threshold] of Object.entries(thresholds)) {
    const baselineValue = baseline[metric]
    const currentValue = current[metric]
    if (typeof baselineValue !== "number" || typeof currentValue !== "number") continue
    const lowerIsBetter = /rate|latency|error/i.test(metric) && !/recall|precision|accuracy|coverage/i.test(metric)
    const delta = Number((currentValue - baselineValue).toFixed(4))
    const regressed = lowerIsBetter ? delta > threshold : delta < -threshold
    if (regressed) {
      regressions.push({ metric, baseline: baselineValue, current: currentValue, delta, threshold })
    }
  }
  return regressions
}

export function proposeAliasCandidates(failures: FailedBenchmarkRow[]): AliasCandidate[] {
  const candidates = new Map<string, AliasCandidate>()
  for (const failure of failures) {
    if (!failure.reasons.some((reason) => reason.includes("retrieval") || reason.includes("expected_file") || reason.includes("answer_missing"))) continue
    const terms = extractShortTerms(failure.question)
    const expansions = extractExpectedTerms(failure)
    for (const term of terms) {
      const filteredExpansions = expansions.filter((expansion) => expansion !== term)
      if (filteredExpansions.length === 0) continue
      const existing = candidates.get(term) ?? {
        term,
        expansions: [],
        sourceRowIds: [],
        reason: "benchmark failure suggests query/document vocabulary mismatch"
      }
      existing.expansions = [...new Set([...existing.expansions, ...filteredExpansions])].slice(0, 8)
      if (failure.id) existing.sourceRowIds = [...new Set([...existing.sourceRowIds, failure.id])]
      candidates.set(term, existing)
    }
  }
  return [...candidates.values()].sort((a, b) => b.sourceRowIds.length - a.sourceRowIds.length || a.term.localeCompare(b.term)).slice(0, 20)
}

export function compareTokenizers(query: string, tokenizers: Array<{ name: string; tokenize: (value: string) => string[] }>): TokenizerComparison {
  const rows = tokenizers.map((tokenizer) => {
    const tokens = [...new Set(tokenizer.tokenize(query).map(normalize).filter(Boolean))]
    return { name: tokenizer.name, tokens, tokenCount: tokens.length }
  })
  const overlap: TokenizerComparison["overlap"] = []
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const left = rows[i]
      const right = rows[j]
      if (!left || !right) continue
      overlap.push({ left: left.name, right: right.name, jaccard: jaccard(left.tokens, right.tokens) })
    }
  }
  return { query, tokenizers: rows, overlap }
}

export function whitespaceTokenizer(value: string): string[] {
  return normalize(value).split(/\s+/).filter(Boolean)
}

export function cjkBigramTokenizer(value: string): string[] {
  const normalized = normalize(value)
  const tokens = new Set(whitespaceTokenizer(normalized))
  const chars = [...normalized.replace(/\s+/g, "")]
  for (let i = 0; i < chars.length - 1; i += 1) tokens.add(`${chars[i]}${chars[i + 1]}`)
  return [...tokens]
}

export const defaultThresholds: RegressionThresholds = {
  answerableAccuracy: 0.03,
  abstentionRecall: 0.03,
  retrievalRecallAt20: 0.03,
  refusalPrecision: 0.03,
  unsupportedSentenceRate: 0.01,
  p95LatencyMs: 1000
}

function extractShortTerms(text: string): string[] {
  const normalized = normalize(text)
  const ascii = normalized.match(/[a-z0-9][a-z0-9_-]{1,30}/g) ?? []
  const quoted = [...normalized.matchAll(/[「『"']([^「」『』"']{2,30})[」』"']/g)].map((match) => match[1] ?? "")
  return [...new Set([...ascii, ...quoted].map((term) => term.trim()).filter(Boolean))].slice(0, 5)
}

function extractExpectedTerms(failure: FailedBenchmarkRow): string[] {
  return [...new Set(toArray(failure.expectedContains ?? failure.expectedAnswer ?? failure.expected).flatMap(splitExpectedTerms))].slice(0, 12)
}

function splitExpectedTerms(text: string): string[] {
  return normalize(text)
    .split(/[\s、,。.;:：()（）/]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && term.length <= 40)
}

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

function jaccard(left: string[], right: string[]): number {
  const leftSet = new Set(left)
  const rightSet = new Set(right)
  const union = new Set([...leftSet, ...rightSet])
  if (union.size === 0) return 1
  const intersection = [...leftSet].filter((value) => rightSet.has(value)).length
  return Number((intersection / union.size).toFixed(4))
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase()
}
