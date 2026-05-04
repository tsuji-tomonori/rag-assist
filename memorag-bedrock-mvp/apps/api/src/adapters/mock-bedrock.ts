import { createHash } from "node:crypto"
import { config } from "../config.js"
import type { EmbedOptions, GenerateOptions, TextModel } from "./text-model.js"

function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1
  return vector.map((v) => v / norm)
}

function tokenize(text: string): string[] {
  const ascii = text.toLowerCase().match(/[a-z0-9_-]+/g) ?? []
  const japanese = Array.from(text.replace(/[\s\p{P}]/gu, "")).map((_, i, arr) => arr.slice(i, i + 2).join(""))
  return [...ascii, ...japanese].filter((t) => t.length > 0)
}

export class MockBedrockTextModel implements TextModel {
  private readonly failModes: {
    embed?: Error
    generate?: Error
    invalidJsonOnGenerate?: boolean
  }

  constructor(failModes: { embed?: Error; generate?: Error; invalidJsonOnGenerate?: boolean } = {}) {
    this.failModes = failModes
  }

  async embed(text: string, options: EmbedOptions = {}): Promise<number[]> {
    if (this.failModes.embed) throw this.failModes.embed
    const dimensions = options.dimensions ?? config.embeddingDimensions
    const vector = new Array(dimensions).fill(0)
    for (const token of tokenize(text)) {
      const digest = createHash("sha256").update(token).digest()
      const index = digest.readUInt32BE(0) % dimensions
      const sign = (digest[4] ?? 0) % 2 === 0 ? 1 : -1
      vector[index] = (vector[index] ?? 0) + sign
    }
    return normalize(vector)
  }

  async generate(prompt: string, _options: GenerateOptions = {}): Promise<string> {
    if (this.failModes.generate) throw this.failModes.generate
    if (this.failModes.invalidJsonOnGenerate) return "not-json"
    if (prompt.includes("MEMORY_CARD_JSON")) {
      const source = extractBetween(prompt, "<document>", "</document>").slice(0, 600)
      const keywords = Array.from(new Set(tokenize(source).slice(0, 12)))
      return JSON.stringify({
        summary: source.replace(/\s+/g, " ").slice(0, 240) || "ローカルモック用の資料メモリです。",
        keywords,
        likelyQuestions: keywords.slice(0, 5).map((k) => `${k}について教えてください`),
        constraints: ["資料外の内容は回答しない"]
      })
    }

    if (prompt.includes("CLUES_JSON")) {
      const question = extractBetween(prompt, "<question>", "</question>")
      return JSON.stringify({ clues: [question, ...tokenize(prompt).slice(0, 8)] })
    }

    if (prompt.includes("SUFFICIENT_CONTEXT_JSON")) {
      const question = extractBetween(prompt, "<question>", "</question>")
      const contexts = [...prompt.matchAll(/<chunk id="([^"]+)"[^>]*>([\s\S]*?)<\/chunk>/g)]
      const joined = contexts.map((match) => match[2] ?? "").join("\n")
      if (contexts.length === 0 || joined.trim().length === 0) {
        return JSON.stringify({
          label: "UNANSWERABLE",
          confidence: 0.2,
          requiredFacts: [question],
          supportedFacts: [],
          missingFacts: [question],
          conflictingFacts: [],
          supportingChunkIds: [],
          reason: "根拠チャンクがありません。"
        })
      }
      const supportingChunkIds = contexts.map((match) => match[1]).filter((id): id is string => typeof id === "string" && id.length > 0)
      return JSON.stringify({
        label: "ANSWERABLE",
        confidence: 0.86,
        requiredFacts: [question],
        supportedFacts: [question],
        missingFacts: [],
        conflictingFacts: [],
        supportingChunkIds,
        reason: "モックでは取得済みチャンクに基づき回答可能と判定します。"
      })
    }

    if (prompt.includes("FINAL_ANSWER_JSON")) {
      const contexts = [...prompt.matchAll(/<chunk id="([^"]+)"[^>]*>([\s\S]*?)<\/chunk>/g)]
      const computedFacts = parseComputedFacts(prompt)
      if (contexts.length === 0 && computedFacts.length > 0) {
        const fact = computedFacts[0] as Record<string, unknown> | undefined
        const answer = fact ? answerFromComputedFact(fact) : "資料からは回答できません。"
        return JSON.stringify({
          isAnswerable: answer !== "資料からは回答できません。",
          answer,
          usedChunkIds: [],
          usedComputedFactIds: fact && typeof fact.id === "string" ? [fact.id] : []
        })
      }
      if (contexts.length === 0) {
        return JSON.stringify({ isAnswerable: false, answer: "資料からは回答できません。", usedChunkIds: [] })
      }
      const first = contexts[0]
      if (!first) {
        return JSON.stringify({ isAnswerable: false, answer: "資料からは回答できません。", usedChunkIds: [] })
      }
      const chunkId = first[1] ?? "chunk-unknown"
      const text = first[2]?.trim() ?? ""
      const answer = text.length > 0 ? `資料では次のように記載されています。${text.slice(0, 260)}` : "資料からは回答できません。"
      return JSON.stringify({ isAnswerable: text.length > 0, answer, usedChunkIds: [chunkId], usedComputedFactIds: [] })
    }

    if (prompt.includes("ANSWER_SUPPORT_JSON")) {
      const answer = extractBetween(prompt, "<answer>", "</answer>")
      const contexts = [...prompt.matchAll(/<chunk id="([^"]+)"[^>]*>([\s\S]*?)<\/chunk>/g)]
      const joined = contexts.map((match) => match[2] ?? "").join("\n")
      const supportingChunkIds = contexts.map((match) => match[1]).filter((id): id is string => typeof id === "string" && id.length > 0)
      const computedFacts = parseComputedFacts(prompt)
      const supportingComputedFactIds = computedFacts.map((fact) => fact.id).filter((id): id is string => typeof id === "string")
      if ((contexts.length === 0 && supportingComputedFactIds.length === 0) || !answer.trim()) {
        return JSON.stringify({
          supported: false,
          unsupportedSentences: answer.trim() ? [{ sentence: answer.trim(), reason: "根拠チャンクがありません。" }] : [],
          supportingChunkIds: [],
          supportingComputedFactIds: [],
          contradictionChunkIds: [],
          confidence: 0.2,
          totalSentences: answer.trim() ? 1 : 0,
          reason: "根拠チャンクがありません。"
        })
      }
      return JSON.stringify({
        supported: true,
        unsupportedSentences: [],
        supportingChunkIds,
        supportingComputedFactIds,
        contradictionChunkIds: [],
        confidence: joined.trim().length > 0 || supportingComputedFactIds.length > 0 ? 0.86 : 0.4,
        totalSentences: Math.max(1, answer.split(/[。.!?！？]/).filter((sentence) => sentence.trim()).length),
        reason: "モックでは引用済みチャンクに基づき回答文を支持済みと判定します。"
      })
    }

    if (prompt.includes("RETRIEVAL_JUDGE_JSON")) {
      const contexts = [...prompt.matchAll(/<chunk id="([^"]+)"[^>]*>([\s\S]*?)<\/chunk>/g)]
      const joined = contexts.map((match) => match[2] ?? "").join("\n")
      const factIds = [...prompt.matchAll(/- ([A-Za-z0-9_-]+):/g)].map((match) => match[1]).filter((id): id is string => typeof id === "string")
      const chunkIds = contexts.map((match) => match[1]).filter((id): id is string => typeof id === "string" && id.length > 0)
      const label: "NO_CONFLICT" | "UNCLEAR" = joined.includes("旧制度") && joined.includes("現行制度") ? "NO_CONFLICT" : "UNCLEAR"
      return JSON.stringify({
        label,
        confidence: label === "NO_CONFLICT" ? 0.82 : 0.55,
        factIds,
        supportingChunkIds: label === "NO_CONFLICT" ? chunkIds : [],
        contradictionChunkIds: [],
        reason: label === "NO_CONFLICT" ? "モックでは旧制度と現行制度の scope 差分として扱います。" : "モックでは追加確認が必要と判定します。"
      })
    }

    return "{}"
  }
}

function extractBetween(text: string, start: string, end: string): string {
  const s = text.indexOf(start)
  const e = text.indexOf(end)
  if (s < 0 || e < 0 || e <= s) return ""
  return text.slice(s + start.length, e).trim()
}

function parseComputedFacts(prompt: string): Array<Record<string, unknown>> {
  const raw = unescapeXml(extractLastBetween(prompt, "<computedFacts>", "</computedFacts>"))
  if (!raw.trim() || raw.trim() === "[]") return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object" && !Array.isArray(item)) : []
  } catch {
    return []
  }
}

function extractLastBetween(text: string, start: string, end: string): string {
  const s = text.lastIndexOf(start)
  if (s < 0) return ""
  const e = text.indexOf(end, s + start.length)
  if (e < 0) return ""
  return text.slice(s + start.length, e).trim()
}

function answerFromComputedFact(fact: Record<string, unknown>): string {
  if (fact.kind === "deadline_status") {
    if (fact.status === "not_due") return `${fact.today}時点では、${fact.dueDate}の期限まであと${fact.daysRemaining}日です。`
    if (fact.status === "due_today") return `${fact.dueDate}は本日期限です。期限切れではありません。`
    return `${fact.today}時点では、${fact.dueDate}の期限から${fact.overdueDays}日超過しています。`
  }
  if (fact.kind === "days_until") return `${fact.today}から${fact.dueDate}まではあと${fact.daysRemaining}日です。`
  if (fact.kind === "add_days") return `期限は${fact.resultDate}です。`
  if (fact.kind === "arithmetic") return `計算結果は${fact.result}${fact.unit ?? ""}です。`
  if (fact.kind === "task_deadline_query_unavailable") return "期限切れタスクの完全な一覧は、構造化インデックスが未実装のため取得できません。"
  if (fact.kind === "calculation_unavailable") return typeof fact.reason === "string" ? fact.reason : "計算できません。"
  return "資料からは回答できません。"
}

function unescapeXml(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
}
