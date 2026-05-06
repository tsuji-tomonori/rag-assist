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
  if (text.length <= maxChars && !(isRequirementsClassificationQuestion(question) && index >= 0)) return text
  if (index < 0) return text.slice(0, maxChars)

  const prefix = isRequirementsClassificationQuestion(question) ? 0 : 160
  const start = Math.max(0, index - prefix)
  const end = Math.min(text.length, start + maxChars)
  return text.slice(start, end)
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
