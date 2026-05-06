import type { RetrievedVector } from "../types.js"
import { ragRuntimePolicy } from "../agent/runtime-policy.js"

export type ContextBlock = {
  id: string
  chunkId?: string
  fileName: string
  score: number
  text: string
  reason: string
}

export type ContextAssembly = {
  contextBlocks: ContextBlock[]
  includedChunkIds: string[]
  droppedChunkIds: string[]
  assemblyReason: string
}

export function assembleContext(input: {
  question: string
  chunks: RetrievedVector[]
  tokenBudget?: number
  requiredFacts?: string[]
}): ContextAssembly {
  const budgetTokens = adjustTokenBudget(input.question, input.chunks, input.tokenBudget ?? 3000)
  const budgetChars = Math.max(800, budgetTokens * 4)
  const included: ContextBlock[] = []
  const dropped: string[] = []
  let usedChars = 0

  for (const chunk of input.chunks) {
    const snippet = buildRelevantSnippet(input.question, chunk.metadata.text ?? "", Math.min(snippetLimit(input.question, chunk), budgetChars))
    if (!snippet) {
      dropped.push(chunk.key)
      continue
    }
    if (included.length > 0 && usedChars + snippet.length > budgetChars) {
      dropped.push(chunk.key)
      continue
    }
    included.push({
      id: chunk.key,
      chunkId: chunk.metadata.chunkId,
      fileName: chunk.metadata.fileName,
      score: chunk.score,
      text: snippet,
      reason: contextReason(input.requiredFacts ?? [], snippet, chunk)
    })
    usedChars += snippet.length
  }

  return {
    contextBlocks: included,
    includedChunkIds: included.map((block) => block.id),
    droppedChunkIds: dropped,
    assemblyReason: `included=${included.length}, dropped=${dropped.length}, budgetChars=${budgetChars}, profile=${ragRuntimePolicy.retrieval.profileId}@${ragRuntimePolicy.retrieval.profileVersion}`
  }
}

export function formatContextXml(assembly: ContextAssembly): string {
  return assembly.contextBlocks
    .map(
      (block) => `<chunk id="${escapeXml(block.id)}" chunkId="${escapeXml(block.chunkId ?? "")}" score="${block.score.toFixed(4)}" file="${escapeXml(block.fileName)}" reason="${escapeXml(block.reason)}">
${escapeXml(block.text)}
</chunk>`
    )
    .join("\n\n")
}

export function escapeXml(input: string): string {
  return input.replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[char] ?? char))
}

export function buildRelevantSnippet(question: string, text: string, maxChars = 1800): string {
  const index = findBestNeedleIndex(question, text)
  const focused = buildFocusedSentenceSnippet(question, text, maxChars)
  if (focused) return focused
  if (text.length <= maxChars && !(isRequirementsClassificationQuestion(question) && index >= 0)) return text
  if (index < 0) return text.slice(0, maxChars)

  const prefix = isRequirementsClassificationQuestion(question) ? 0 : 160
  const start = Math.max(0, index - prefix)
  const end = Math.min(text.length, start + maxChars)
  return text.slice(start, end)
}

function buildFocusedSentenceSnippet(question: string, text: string, maxChars: number): string | undefined {
  if (isRequirementsClassificationQuestion(question)) return undefined
  const units = splitEvidenceUnits(text)
  if (units.length <= 1 && text.length <= maxChars) return undefined
  const scored = units
    .map((unit, index) => ({
      sentence: unit.text,
      scoringText: unit.contextText ? `${unit.contextText}\n${unit.text}` : unit.text,
      index,
      score: evidenceUnitScore(question, unit)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)

  if (scored.length === 0) return undefined

  const selectedIndexes = selectFocusedSentenceIndexes(question, scored)

  const snippet = scored
    .filter((item) => selectedIndexes.has(item.index))
    .map((item) => item.sentence)
    .filter((sentence): sentence is string => Boolean(sentence))
    .join("\n")
  return snippet.length > maxChars ? snippet.slice(0, maxChars) : snippet
}

function focusedSentenceLimit(question: string): number {
  return questionFacetCount(question) > 1 ? 4 : 1
}

function selectFocusedSentenceIndexes(question: string, scored: Array<{ sentence: string; scoringText: string; index: number; score: number }>): Set<number> {
  const limit = Math.max(focusedSentenceLimit(question), 2)
  const selected = new Set<number>()
  const coveredTerms = new Set<string>()

  for (const item of scored) {
    const terms = dedupeContainedTerms(matchedQuestionTerms(question, item.scoringText))
    const addsCoverage = terms.some((term) => !coveredTerms.has(term) && !isCoveredByRelatedTerm(term, coveredTerms))
    if (selected.size === 0 || addsCoverage) {
      selected.add(item.index)
      for (const term of terms) coveredTerms.add(term)
    }
    if (selected.size >= limit) break
  }

  return selected
}

export function textAnswerRelevanceScore(question: string, text: string): number {
  const units = splitEvidenceUnits(text)
  if (units.length === 0) return sentenceAnswerScore(question, text)
  const bestSentenceScore = Math.max(...units.map((unit) => evidenceUnitScore(question, unit)))
  const wholeTextScore = lexicalOverlapScore(question, text) * 0.4
  return bestSentenceScore + wholeTextScore
}

function evidenceUnitScore(question: string, unit: EvidenceUnit): number {
  const sentenceScore = sentenceAnswerScore(question, unit.text)
  const contextScore = unit.contextText ? lexicalOverlapScore(question, unit.contextText) * 0.5 : 0
  const terms = answerSubjectTerms(question)
  const primaryScore = matchedAttributeScore(questionPrimaryTerms(terms), unit.text)
  const contextPrimaryScore = unit.contextText ? matchedAttributeScore(questionPrimaryTerms(terms), unit.contextText) : 0
  const attributeScore = matchedAttributeScore(questionAttributeTerms(question, terms), unit.text)
  const attributeBonus = attributeScore > 0 && (primaryScore > 0 || contextPrimaryScore > 0) ? attributeScore * 6 : 0
  return sentenceScore + contextScore + attributeBonus - conditionalClausePenalty(question, unit.text) * 2
}

function sentenceAnswerScore(question: string, sentence: string): number {
  const lexicalScore = lexicalOverlapScore(question, sentence)
  if (lexicalScore <= 0) return 0
  return lexicalScore + answerValueSignalScore(question, sentence) + compactnessScore(sentence) - conditionalClausePenalty(question, sentence)
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/(?<=[。！？!?])\s*|\n+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

type EvidenceUnit = {
  text: string
  contextText?: string
}

function splitEvidenceUnits(text: string): EvidenceUnit[] {
  const units: EvidenceUnit[] = []
  let heading = ""

  for (const rawLine of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim()
    if (!line) continue
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/)
    if (headingMatch?.[1]) {
      heading = headingMatch[1].trim()
      continue
    }

    for (const sentence of splitSentences(line)) {
      units.push({ text: sentence, contextText: heading && !sentence.includes(heading) ? heading : undefined })
    }
  }

  return units
}

function answerSubjectTerms(question: string): string[] {
  const normalized = question
    .normalize("NFKC")
    .replace(/[?？。.!！]/g, " ")
  const ascii = normalized.match(/[A-Za-z0-9][A-Za-z0-9_-]{2,}/g) ?? []
  const japanese = normalized.match(/[\p{Script=Han}\p{Script=Katakana}ー]{2,}/gu) ?? []
  return unique([...ascii, ...japanese.flatMap((term) => [term, ...splitMixedJapaneseTerm(term)])])
}

function matchedQuestionTerms(question: string, text: string): string[] {
  const normalizedText = normalize(text)
  return answerSubjectTerms(question).filter((term) => normalizedText.includes(normalize(term)))
}

function splitMixedJapaneseTerm(term: string): string[] {
  const scriptParts = term.match(/[\p{Script=Katakana}ー]+|[\p{Script=Han}]+/gu) ?? []
  const hanBigrams = term.match(/[\p{Script=Han}]{2}/gu) ?? []
  return unique([...scriptParts, ...hanBigrams].filter((part) => part.length >= 2 && part !== term))
}

function contextReason(requiredFacts: string[], text: string, chunk: RetrievedVector): string {
  const normalized = normalize(text)
  const covered = requiredFacts.filter((fact) => significantTerms(fact).some((term) => normalized.includes(normalize(term))))
  const structural = [chunk.metadata.chunkKind, chunk.metadata.heading ? "heading" : undefined, chunk.metadata.sectionPath?.length ? "section" : undefined]
    .filter(Boolean)
    .join("+")
  if (covered.length > 0) return `covers:${covered.slice(0, 3).join(",")}${structural ? `;${structural}` : ""}`
  return structural ? `score_ranked;${structural}` : "score_ranked"
}

function adjustTokenBudget(question: string, chunks: RetrievedVector[], defaultBudget: number): number {
  const structuralBoost = chunks.some((chunk) => ["table", "list", "code"].includes(chunk.metadata.chunkKind ?? "")) ? 1.1 : 1
  const complexityBoost = questionFacetCount(question) > 1 ? 1.15 : 1
  const simplePenalty = chunks.length <= 2 && questionFacetCount(question) <= 1 ? 0.85 : 1
  return Math.min(defaultBudget, Math.max(800, Math.round(defaultBudget * Math.min(1, structuralBoost * complexityBoost * simplePenalty))))
}

function snippetLimit(question: string, chunk: RetrievedVector): number {
  const base = ["table", "list", "code"].includes(chunk.metadata.chunkKind ?? "") || questionFacetCount(question) > 1 ? 2200 : 1800
  return Math.min(2400, base)
}

function findBestNeedleIndex(question: string, text: string): number {
  const normalizedQuestion = question.replace(/[?？。.!！\s]/g, "")
  const fallbackCandidates = unique([
    normalizedQuestion,
    normalizedQuestion.replace(/とは$/, ""),
    normalizedQuestion.replace(/について$/, ""),
    ...Array.from(normalizedQuestion.matchAll(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー]{2,}/gu)).map((match) => match[0])
  ])

  for (const candidate of fallbackCandidates) {
    if (!candidate || candidate.length < 2) continue
    const index = text.indexOf(candidate)
    if (index >= 0) return index
  }
  return -1
}

function significantTerms(text: string): string[] {
  const normalized = text.normalize("NFKC")
  const ascii = normalized.match(/[A-Za-z0-9][A-Za-z0-9_-]{2,}/g) ?? []
  const japanese = normalized.match(/[\p{Script=Han}\p{Script=Katakana}ー]{2,}/gu) ?? []
  return unique([...ascii, ...japanese])
}

function isRequirementsClassificationQuestion(question: string): boolean {
  return /要求.*分類|分類.*要求|classification/i.test(question)
}

function normalize(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, "").toLowerCase()
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function lexicalOverlapScore(question: string, text: string): number {
  const terms = answerSubjectTerms(question)
  const matched = dedupeContainedTerms(matchedQuestionTerms(question, text))
  if (matched.length === 0) return 0
  const coverage = matched.length / Math.max(terms.length, 1)
  const lengthWeighted = matched.reduce((sum, term) => sum + Math.min(14, Math.max(2, term.length * 2)), 0)
  const allTermsBonus = matched.length === terms.length ? 4 : 0
  const hasLongTerm = terms.some((term) => term.length >= 4)
  const matchedLongTerm = matched.some((term) => term.length >= 4)
  const specificityPenalty = hasLongTerm && !matchedLongTerm ? 6 : 0
  const focusBonus = questionFocusTerms(terms).some((term) => matched.includes(term)) ? 12 : 0
  return lengthWeighted + coverage * 6 + allTermsBonus + focusBonus - specificityPenalty
}

function answerValueSignalScore(question: string, sentence: string): number {
  const questionValues = new Set(extractValueSignals(question).map(normalize))
  const sentenceValues = extractValueSignals(sentence)
  const novelValues = sentenceValues.filter((value) => !questionValues.has(normalize(value)))
  if (novelValues.length === 0) return 0
  return Math.min(4, novelValues.length * 2)
}

function extractValueSignals(text: string): string[] {
  const normalized = text.normalize("NFKC")
  return unique([
    ...(normalized.match(/\d+(?:[.,:]\d+)*(?:\s*[^\s\d\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]{1,3})?/gu) ?? []),
    ...(normalized.match(/[A-Z][A-Z0-9_-]{2,}/g) ?? []),
    ...(normalized.match(/[^\s@]+@[^\s@]+\.[^\s@]+/g) ?? []),
    ...(normalized.match(/https?:\/\/[^\s]+/g) ?? [])
  ])
}

function compactnessScore(sentence: string): number {
  if (sentence.length <= 140) return 2
  if (sentence.length <= 280) return 1
  return 0
}

function conditionalClausePenalty(question: string, sentence: string): number {
  if (!/(?:場合|とき|時は|なら)/.test(sentence)) return 0
  return /(?:場合|とき|時は|なら)/.test(question) ? 0 : 10
}

function questionFacetCount(question: string): number {
  return Math.min(4, 1 + (question.match(/[、,/]|(?:と|および|及び|または)/g)?.length ?? 0))
}

function dedupeContainedTerms(terms: string[]): string[] {
  const kept: string[] = []
  for (const term of [...terms].sort((a, b) => b.length - a.length || a.localeCompare(b))) {
    const normalized = normalize(term)
    if (kept.some((keptTerm) => normalize(keptTerm).includes(normalized))) continue
    kept.push(term)
  }
  return kept
}

function questionFocusTerms(terms: string[]): string[] {
  const longTerms = terms.filter((term) => term.length >= 4)
  return unique([...(longTerms.length > 0 ? longTerms.slice(-1) : []), ...terms.slice(-3)])
}

function questionAttributeTerms(question: string, terms: string[]): string[] {
  const normalized = question.normalize("NFKC")
  const marker = normalized.lastIndexOf("の")
  if (marker >= 0) {
    const suffixTerms = answerSubjectTerms(normalized.slice(marker + 1))
    if (suffixTerms.length > 0) return suffixTerms
  }
  return terms.slice(Math.floor(terms.length / 2))
}

function questionPrimaryTerms(terms: string[]): string[] {
  return terms.slice(0, Math.max(1, Math.floor(terms.length / 2)))
}

function matchedAttributeScore(attributeTerms: string[], text: string): number {
  const normalizedText = normalize(text)
  return dedupeContainedTerms(attributeTerms.filter((term) => normalizedText.includes(normalize(term)))).reduce((sum, term) => sum + Math.max(1, term.length), 0)
}

function isCoveredByRelatedTerm(term: string, coveredTerms: Set<string>): boolean {
  const normalized = normalize(term)
  if ([...coveredTerms].some((coveredTerm) => normalize(coveredTerm).includes(normalized))) return true
  const covered = [...coveredTerms].map(normalize).filter((coveredTerm) => normalized.includes(coveredTerm))
  if (covered.length < 2) return false
  return covered.join("").length >= normalized.length
}
