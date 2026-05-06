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
  const sentences = splitSentences(text)
  if (sentences.length <= 1 && text.length <= maxChars) return undefined
  const scored = sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score: sentenceAnswerScore(question, sentence)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)

  if (scored.length === 0) return undefined

  const selectedIndexes = new Set(scored.slice(0, focusedSentenceLimit(question)).map((item) => item.index))

  const snippet = [...selectedIndexes]
    .sort((a, b) => a - b)
    .map((idx) => sentences[idx])
    .filter((sentence): sentence is string => Boolean(sentence))
    .join("\n")
  return snippet.length > maxChars ? snippet.slice(0, maxChars) : snippet
}

function focusedSentenceLimit(question: string): number {
  return /比較|違い|差分|一覧|洗い出|条件|例外|手順|方法/.test(question) ? 4 : 1
}

function sentenceAnswerScore(question: string, sentence: string): number {
  const normalized = normalize(sentence)
  const terms = answerSubjectTerms(question)
  const termScore = terms.reduce((sum, term) => sum + (normalized.includes(normalize(term)) ? term.length >= 4 ? 5 : 3 : 0), 0)
  const exactSubjectScore = terms.length > 0 && terms.every((term) => normalized.includes(normalize(term))) ? 6 : 0
  const intentScore = intentCuePatterns(question).reduce((sum, pattern) => sum + (pattern.test(sentence.normalize("NFKC")) ? 10 : 0), 0)
  const mismatchPenalty = /頻度|何回|何度|ごと|毎年|毎月/.test(question) && /例外|申請|提出|窓口/.test(sentence) ? 4 : 0
  const missingSubjectPenalty = terms.length > 0 && termScore === 0 ? 12 : 0
  return termScore + exactSubjectScore + intentScore - mismatchPenalty - missingSubjectPenalty
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/(?<=[。！？!?])\s*|\n+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function answerSubjectTerms(question: string): string[] {
  const normalized = question
    .normalize("NFKC")
    .replace(/[?？。.!！]/g, " ")
  const ascii = normalized.match(/[A-Za-z0-9][A-Za-z0-9_-]{2,}/g) ?? []
  const japanese = normalized.match(/[\p{Script=Han}\p{Script=Katakana}ー]{2,}/gu) ?? []
  return unique([...ascii, ...japanese.flatMap((term) => [term, ...splitMixedJapaneseTerm(term)])].filter((term) => !isGenericQuestionTerm(term)))
}

function isGenericQuestionTerm(term: string): boolean {
  return [
    "申請",
    "期限",
    "期日",
    "締切",
    "必要",
    "条件",
    "対象",
    "頻度",
    "手順",
    "方法",
    "提出",
    "報告",
    "連絡",
    "依頼先",
    "窓口",
    "部署",
    "書類",
    "記録",
    "システム",
    "チャンネル"
  ].includes(term)
}

function splitMixedJapaneseTerm(term: string): string[] {
  return (term.match(/[\p{Script=Katakana}ー]+|[\p{Script=Han}]+/gu) ?? []).filter((part) => part.length >= 2 && part !== term)
}

function intentCuePatterns(question: string): RegExp[] {
  const patterns: RegExp[] = []
  if (/いつ|期限|期日|締切|何日前|開始日|終了日/.test(question)) patterns.push(/[0-9０-９]+(?:日|営業日|か月|ヶ月|月|年)|前営業日|直ちに|入社初日|月末|月初|毎月/)
  if (/頻度|何回|何度|ごと|毎年|毎月/.test(question)) patterns.push(/[0-9０-９]+回|年[0-9０-９]+回|[0-9０-９]+日ごと|毎年|毎月/)
  if (/誰|担当|承認者|責任者|報告先|依頼先|窓口/.test(question)) patterns.push(/上長|責任者|産業医|法務部|総務部|人事部|ヘルプデスク|部|者/)
  if (/どこ|どの|方法|手順|申請|提出|チャンネル|保管場所/.test(question)) patterns.push(/システム|フォーム|提出|部|窓口|チャンネル|ストレージ/)
  if (/何が|何を|書類|記録|ありますか/.test(question)) patterns.push(/雇用契約書|身元確認書類|口座情報|版番号|更新日|更新者|変更理由|対象家族/)
  return patterns
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
  const complexityBoost = /比較|手順|一覧|洗い出|条件|例外/.test(question) ? 1.15 : 1
  const simplePenalty = chunks.length <= 2 && !/比較|手順|一覧|洗い出|条件|例外/.test(question) ? 0.85 : 1
  return Math.min(defaultBudget, Math.max(800, Math.round(defaultBudget * Math.min(1, structuralBoost * complexityBoost * simplePenalty))))
}

function snippetLimit(question: string, chunk: RetrievedVector): number {
  const base = ["table", "list", "code"].includes(chunk.metadata.chunkKind ?? "") || /一覧|洗い出|手順/.test(question) ? 2200 : 1800
  return Math.min(2400, base)
}

function findBestNeedleIndex(question: string, text: string): number {
  const normalizedQuestion = question.replace(/[?？。.!！\s]/g, "")
  const priorityCandidates = intentAnchors(question)
  const fallbackCandidates = unique([
    normalizedQuestion,
    normalizedQuestion.replace(/とは$/, ""),
    normalizedQuestion.replace(/について$/, ""),
    ...Array.from(normalizedQuestion.matchAll(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー]{2,}/gu)).map((match) => match[0])
  ])

  for (const candidate of [...priorityCandidates, ...fallbackCandidates]) {
    if (!candidate || candidate.length < 2) continue
    const index = text.indexOf(candidate)
    if (index >= 0) return index
  }
  return -1
}

function intentAnchors(question: string): string[] {
  const anchors: string[] = []
  if (/分類|一覧|洗い出/.test(question)) anchors.push("分類", "種類", "区分")
  if (/期限|期日|締切/.test(question)) anchors.push("期限", "期日", "締切")
  if (/金額|費用|料金/.test(question)) anchors.push("金額", "費用", "料金")
  if (/手順|方法|申請/.test(question)) anchors.push("手順", "方法", "申請")
  return anchors
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
