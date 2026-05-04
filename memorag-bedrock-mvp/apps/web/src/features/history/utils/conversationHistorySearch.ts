import type { ConversationHistoryItem, ConversationMessage } from "../types.js"

export type ConversationHistorySearchSnippet = {
  role: ConversationMessage["role"] | "title" | "ticket" | "citation"
  text: string
}

export type ConversationHistorySearchResult = {
  item: ConversationHistoryItem
  score: number
  matchedTerms: string[]
  snippet?: ConversationHistorySearchSnippet
}

type SearchField = {
  role: ConversationHistorySearchSnippet["role"]
  text: string
  weight: number
  snippetEligible: boolean
}

type FieldMatch = {
  score: number
  matchedTerms: Set<string>
  snippet?: ConversationHistorySearchSnippet
}

const ALGORITHM_VERSION = "conversation-history-fuzzy-v1"

export function searchConversationHistory(history: ConversationHistoryItem[], query: string): ConversationHistorySearchResult[] {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return history.map((item) => ({ item, score: 0, matchedTerms: [] }))

  const queryTerms = tokenizeQuery(normalizedQuery)
  const primaryTerms = primaryQueryTerms(normalizedQuery)
  const compactQuery = compactForPartialMatch(normalizedQuery)
  const results = history
    .map((item) => scoreConversation(item, { normalizedQuery, compactQuery, queryTerms, primaryTerms }))
    .filter((result) => result.score > 0)

  return results.sort(compareSearchResults)
}

export function conversationHistorySearchAlgorithmVersion(): string {
  return ALGORITHM_VERSION
}

function scoreConversation(
  item: ConversationHistoryItem,
  query: {
    normalizedQuery: string
    compactQuery: string
    queryTerms: string[]
    primaryTerms: string[]
  }
): ConversationHistorySearchResult {
  const matchedTerms = new Set<string>()
  let score = 0
  let bestSnippet: ConversationHistorySearchSnippet | undefined
  let bestSnippetScore = 0

  for (const field of buildSearchFields(item)) {
    const match = scoreField(field, query)
    if (match.score === 0) continue
    score += match.score
    for (const term of match.matchedTerms) matchedTerms.add(term)
    if (match.snippet && match.score > bestSnippetScore) {
      bestSnippet = match.snippet
      bestSnippetScore = match.score
    }
  }

  if (hasLongJapaneseTerm(query.primaryTerms) && !query.primaryTerms.some((term) => matchedTerms.has(term)) && matchedTerms.size < 2) {
    score = 0
  }

  if (query.primaryTerms.length > 0) {
    const covered = query.primaryTerms.filter((term) => matchedTerms.has(term)).length
    score += (covered / query.primaryTerms.length) * 1.2
  }
  if (item.isFavorite) score += 0.05

  return {
    item,
    score,
    matchedTerms: [...matchedTerms],
    snippet: bestSnippet
  }
}

function scoreField(
  field: SearchField,
  query: {
    normalizedQuery: string
    compactQuery: string
    queryTerms: string[]
  }
): FieldMatch {
  const normalizedText = normalizeSearchText(field.text)
  if (!normalizedText) return { score: 0, matchedTerms: new Set() }

  const compactText = compactForPartialMatch(normalizedText)
  const fieldTokens = tokenizeQuery(normalizedText)
  const fieldTokenSet = new Set(fieldTokens)
  const asciiFieldTokens = fieldTokens.filter(isAsciiToken)
  const matchedTerms = new Set<string>()
  let score = 0

  if (normalizedText.includes(query.normalizedQuery)) {
    score += field.weight * 3
    matchedTerms.add(query.normalizedQuery)
  } else if (query.compactQuery.length >= 2 && compactText.includes(query.compactQuery)) {
    score += field.weight * 2
    matchedTerms.add(query.normalizedQuery)
  }

  for (const term of query.queryTerms) {
    const compactTerm = compactForPartialMatch(term)
    if (fieldTokenSet.has(term) || normalizedText.includes(term)) {
      score += field.weight
      matchedTerms.add(term)
      continue
    }
    if (compactTerm.length >= 2 && compactText.includes(compactTerm)) {
      score += field.weight * 0.7
      matchedTerms.add(term)
      continue
    }
    if (isAsciiToken(term) && prefixCandidates(term, asciiFieldTokens).length > 0) {
      score += field.weight * 0.45
      matchedTerms.add(term)
      continue
    }
    if (shouldFuzzy(term) && fuzzyCandidates(term, asciiFieldTokens).length > 0) {
      score += field.weight * 0.25
      matchedTerms.add(term)
    }
  }

  return {
    score,
    matchedTerms,
    snippet: score > 0 && field.snippetEligible ? { role: field.role, text: buildSnippet(field.text) } : undefined
  }
}

function buildSearchFields(item: ConversationHistoryItem): SearchField[] {
  const fields: SearchField[] = [
    { role: "title", text: item.title, weight: 5, snippetEligible: false }
  ]

  for (const message of item.messages) {
    fields.push({
      role: message.role,
      text: message.text,
      weight: message.role === "user" ? 4.5 : 3,
      snippetEligible: true
    })
    if (message.sourceQuestion) {
      fields.push({ role: "user", text: message.sourceQuestion, weight: 3, snippetEligible: true })
    }
    if (message.questionTicket?.title) {
      fields.push({ role: "ticket", text: message.questionTicket.title, weight: 3, snippetEligible: true })
    }
    if (message.questionTicket?.question) {
      fields.push({ role: "ticket", text: message.questionTicket.question, weight: 2.8, snippetEligible: true })
    }
    for (const fileName of citationFileNames(message)) {
      fields.push({ role: "citation", text: fileName, weight: 0.8, snippetEligible: false })
    }
  }

  return fields
}

function citationFileNames(message: ConversationMessage): string[] {
  const fileNames = [
    ...(message.result?.citations ?? []).map((citation) => citation.fileName),
    ...(message.result?.retrieved ?? []).map((citation) => citation.fileName)
  ]
  return [...new Set(fileNames.filter(Boolean))]
}

function buildSnippet(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (normalized.length <= 96) return normalized
  return `${normalized.slice(0, 95)}...`
}

function compareSearchResults(a: ConversationHistorySearchResult, b: ConversationHistorySearchResult): number {
  const scoreDiff = b.score - a.score
  if (Math.abs(scoreDiff) > 0.001) return scoreDiff
  if (Boolean(a.item.isFavorite) !== Boolean(b.item.isFavorite)) return a.item.isFavorite ? -1 : 1
  return new Date(b.item.updatedAt).getTime() - new Date(a.item.updatedAt).getTime()
}

function primaryQueryTerms(text: string): string[] {
  const normalized = normalizeSearchText(text)
  const ascii = normalized.match(/[a-z0-9_-]+/g) ?? []
  const japanese = normalized.match(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー]+/gu) ?? []
  return [...new Set([...ascii, ...japanese].filter((term) => term.length > 0))]
}

function hasLongJapaneseTerm(terms: string[]): boolean {
  return terms.some((term) => term.length >= 3 && /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー]/u.test(term))
}

function tokenizeQuery(text: string): string[] {
  const normalized = normalizeSearchText(text)
  const ascii = normalized.match(/[a-z0-9_-]+/g) ?? []
  const japaneseRuns = normalized.match(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー]+/gu) ?? []
  const japanese = japaneseRuns.flatMap((run) => {
    if (run.length <= 2) return [run]
    return [run, ...ngramTokens(run, 2, 3)]
  })
  return [...new Set([...ascii, ...japanese].filter((term) => term.length > 0))]
}

function ngramTokens(text: string, min: number, max: number): string[] {
  const chars = [...normalizeSearchText(text).replace(/[\s\p{P}]/gu, "")]
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
  return term.length >= 4 && isAsciiToken(term)
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

function isAsciiToken(term: string): boolean {
  return /^[a-z0-9_-]+$/.test(term)
}

function compactForPartialMatch(text: string): string {
  return normalizeSearchText(text).replace(/[\s\p{P}]/gu, "")
}

function normalizeSearchText(text: string): string {
  return text.normalize("NFKC").toLowerCase().trim()
}
