import { randomUUID } from "node:crypto"
import { config } from "../config.js"
import type { Dependencies } from "../dependencies.js"
import type { Citation, DocumentManifest, JsonValue, MemoryCard, RetrievedVector, VectorRecord } from "../types.js"
import { chunkText } from "./chunk.js"
import { parseJsonObject } from "./json.js"
import { buildCluePrompt, buildFinalAnswerPrompt, buildMemoryCardPrompt } from "./prompts.js"
import { extractTextFromUpload } from "./text-extract.js"

type IngestInput = {
  fileName: string
  text?: string
  contentBase64?: string
  mimeType?: string
  metadata?: Record<string, JsonValue>
  embeddingModelId?: string
  memoryModelId?: string
  skipMemory?: boolean
}

type ChatInput = {
  question: string
  modelId?: string
  embeddingModelId?: string
  clueModelId?: string
  topK?: number
  memoryTopK?: number
  minScore?: number
  strictGrounded?: boolean
  includeDebug?: boolean
}

type AnswerJson = {
  isAnswerable?: boolean
  answer?: string
  usedChunkIds?: string[]
}

type MemoryJson = {
  summary?: string
  keywords?: string[]
  likelyQuestions?: string[]
  constraints?: string[]
}

type ClueJson = {
  clues?: string[]
}

const NO_ANSWER = "資料からは回答できません。"

export class MemoRagService {
  constructor(private readonly deps: Dependencies) {}

  async ingest(input: IngestInput): Promise<DocumentManifest> {
    const documentId = randomUUID()
    const createdAt = new Date().toISOString()
    const text = await extractTextFromUpload(input)
    if (!text) throw new Error("Uploaded document did not contain extractable text")

    const chunks = chunkText(text, config.chunkSizeChars, config.chunkOverlapChars)
    if (chunks.length === 0) throw new Error("No chunks were produced from the uploaded document")

    const sourceObjectKey = `documents/${documentId}/source.txt`
    const manifestObjectKey = `manifests/${documentId}.json`
    await this.deps.objectStore.putText(sourceObjectKey, text, "text/plain; charset=utf-8")

    const memoryCards = input.skipMemory
      ? []
      : await this.createMemoryCards({
          fileName: input.fileName,
          text,
          modelId: input.memoryModelId
        })

    const vectorKeys: string[] = []
    const records: VectorRecord[] = []

    for (const chunk of chunks) {
      const vector = await this.deps.textModel.embed(chunk.text, {
        modelId: input.embeddingModelId ?? config.embeddingModelId,
        dimensions: config.embeddingDimensions
      })
      const key = `${documentId}-${chunk.id}`
      vectorKeys.push(key)
      records.push({
        key,
        vector,
        metadata: {
          kind: "chunk",
          documentId,
          fileName: input.fileName,
          chunkId: chunk.id,
          objectKey: sourceObjectKey,
          text: chunk.text,
          createdAt
        }
      })
    }

    for (const card of memoryCards) {
      const vector = await this.deps.textModel.embed(card.text, {
        modelId: input.embeddingModelId ?? config.embeddingModelId,
        dimensions: config.embeddingDimensions
      })
      const key = `${documentId}-${card.id}`
      vectorKeys.push(key)
      records.push({
        key,
        vector,
        metadata: {
          kind: "memory",
          documentId,
          fileName: input.fileName,
          memoryId: card.id,
          objectKey: sourceObjectKey,
          text: card.text,
          createdAt
        }
      })
    }

    await this.deps.vectorStore.put(records)

    const manifest: DocumentManifest = {
      documentId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      metadata: input.metadata,
      sourceObjectKey,
      manifestObjectKey,
      vectorKeys,
      chunkCount: chunks.length,
      memoryCardCount: memoryCards.length,
      createdAt
    }

    await this.deps.objectStore.putText(manifestObjectKey, JSON.stringify(manifest, null, 2), "application/json")
    return manifest
  }

  async listDocuments(): Promise<DocumentManifest[]> {
    const keys = await this.deps.objectStore.listKeys("manifests/")
    const manifests = await Promise.all(
      keys
        .filter((key) => key.endsWith(".json"))
        .map(async (key) => JSON.parse(await this.deps.objectStore.getText(key)) as DocumentManifest)
    )
    return manifests.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async deleteDocument(documentId: string): Promise<{ documentId: string; deletedVectorCount: number }> {
    const manifestKey = `manifests/${documentId}.json`
    const raw = await this.deps.objectStore.getText(manifestKey)
    const manifest = JSON.parse(raw) as DocumentManifest
    await this.deps.vectorStore.delete(manifest.vectorKeys)
    await this.deps.objectStore.deleteObject(manifest.sourceObjectKey)
    await this.deps.objectStore.deleteObject(manifest.manifestObjectKey)
    return { documentId, deletedVectorCount: manifest.vectorKeys.length }
  }

  async chat(input: ChatInput): Promise<{
    answer: string
    isAnswerable: boolean
    citations: Citation[]
    retrieved: Citation[]
    debug?: Record<string, unknown>
  }> {
    const topK = clamp(input.topK ?? 6, 1, 20)
    const memoryTopK = clamp(input.memoryTopK ?? 4, 1, 10)
    const minScore = input.minScore ?? config.minRetrievalScore
    const embeddingModelId = input.embeddingModelId ?? config.embeddingModelId

    const questionVector = await this.deps.textModel.embed(input.question, {
      modelId: embeddingModelId,
      dimensions: config.embeddingDimensions
    })

    const memoryHits = await this.deps.vectorStore.query(questionVector, memoryTopK, { kind: "memory" })
    const memoryContext = memoryHits.map((hit) => hit.metadata.text ?? "").filter(Boolean).join("\n---\n")

    const clueRaw = await this.deps.textModel.generate(buildCluePrompt(input.question, memoryContext), {
      modelId: input.clueModelId ?? input.modelId ?? config.defaultMemoryModelId,
      temperature: 0,
      maxTokens: 600
    })
    const clueJson = parseJsonObject<ClueJson>(clueRaw)
    const clues = buildSearchClues(input.question, clueJson?.clues ?? [])

    const retrievedByKey = new Map<string, RetrievedVector>()
    for (const clue of clues) {
      const vector = await this.deps.textModel.embed(clue, {
        modelId: embeddingModelId,
        dimensions: config.embeddingDimensions
      })
      const hits = await this.deps.vectorStore.query(vector, topK, { kind: "chunk" })
      for (const hit of hits) {
        const existing = retrievedByKey.get(hit.key)
        if (!existing || hit.score > existing.score) retrievedByKey.set(hit.key, hit)
      }
    }

    const retrieved = [...retrievedByKey.values()].sort((a, b) => b.score - a.score).slice(0, topK)
    const retrievedCitations = retrieved.map(toCitation)

    if (retrieved.length === 0 || (retrieved[0]?.score ?? 0) < minScore) {
      return {
        answer: NO_ANSWER,
        isAnswerable: false,
        citations: [],
        retrieved: retrievedCitations,
        debug: input.includeDebug ? { clues, memoryHits: memoryHits.map(toCitation), threshold: minScore } : undefined
      }
    }

    const answerRaw = await this.deps.textModel.generate(buildFinalAnswerPrompt(input.question, retrieved), {
      modelId: input.modelId ?? config.defaultModelId,
      temperature: 0,
      maxTokens: 1200
    })
    const answerJson = parseJsonObject<AnswerJson>(answerRaw)

    if (!answerJson || answerJson.isAnswerable === false || !answerJson.answer?.trim()) {
      return {
        answer: NO_ANSWER,
        isAnswerable: false,
        citations: [],
        retrieved: retrievedCitations,
        debug: input.includeDebug ? { clues, answerRaw, memoryHits: memoryHits.map(toCitation), threshold: minScore } : undefined
      }
    }

    const used = new Set(answerJson.usedChunkIds ?? [])
    const citations = retrieved
      .filter((hit) => used.size === 0 || used.has(hit.key) || used.has(hit.metadata.chunkId ?? ""))
      .map(toCitation)
      .slice(0, 5)

    if (input.strictGrounded !== false && citations.length === 0) {
      return {
        answer: NO_ANSWER,
        isAnswerable: false,
        citations: [],
        retrieved: retrievedCitations,
        debug: input.includeDebug ? { clues, answerRaw, memoryHits: memoryHits.map(toCitation), threshold: minScore } : undefined
      }
    }

    return {
      answer: answerJson.answer.trim(),
      isAnswerable: true,
      citations,
      retrieved: retrievedCitations,
      debug: input.includeDebug ? { clues, memoryHits: memoryHits.map(toCitation), threshold: minScore } : undefined
    }
  }

  private async createMemoryCards(input: { fileName: string; text: string; modelId?: string }): Promise<MemoryCard[]> {
    const raw = await this.deps.textModel.generate(buildMemoryCardPrompt(input.fileName, input.text), {
      modelId: input.modelId ?? config.defaultMemoryModelId,
      temperature: 0,
      maxTokens: 1000
    })
    const parsed = parseJsonObject<MemoryJson>(raw)
    const fallbackSummary = input.text.replace(/\s+/g, " ").slice(0, 500)
    const card = {
      id: "memory-0000",
      summary: parsed?.summary ?? fallbackSummary,
      keywords: parsed?.keywords?.slice(0, 30) ?? [],
      likelyQuestions: parsed?.likelyQuestions?.slice(0, 20) ?? [],
      constraints: parsed?.constraints?.slice(0, 20) ?? []
    }
    const text = [
      `Summary: ${card.summary}`,
      `Keywords: ${card.keywords.join(", ")}`,
      `Likely questions: ${card.likelyQuestions.join(" / ")}`,
      `Constraints: ${card.constraints.join(" / ")}`
    ].join("\n")
    return [{ ...card, text }]
  }
}

function toCitation(hit: RetrievedVector): Citation {
  return {
    documentId: hit.metadata.documentId,
    fileName: hit.metadata.fileName,
    chunkId: hit.metadata.chunkId ?? hit.metadata.memoryId,
    score: Number(hit.score.toFixed(4)),
    text: hit.metadata.text ?? ""
  }
}

function unique(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))]
}

function buildSearchClues(question: string, generatedClues: string[]): string[] {
  const anchors = question.includes("分類")
    ? [
        "ソフトウェア要求の分類",
        "ソフトウェア製品要求 ソフトウェアプロジェクト要求 機能要求 非機能要求 技術制約 サービス品質制約"
      ]
    : []
  return unique([question, ...anchors, ...generatedClues]).slice(0, 6)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
