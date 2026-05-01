import { createHash } from "node:crypto"
import { config } from "../config.js"
import type { EmbedOptions, GenerateOptions, TextModel } from "./text-model.js"

function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1
  return vector.map((v) => v / norm)
}

function tokenize(text: string): string[] {
  const ascii = text.toLowerCase().match(/[a-z0-9_\-]+/g) ?? []
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

    if (prompt.includes("FINAL_ANSWER_JSON")) {
      const contexts = [...prompt.matchAll(/<chunk id="([^"]+)"[^>]*>([\s\S]*?)<\/chunk>/g)]
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
      return JSON.stringify({ isAnswerable: text.length > 0, answer, usedChunkIds: [chunkId] })
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
