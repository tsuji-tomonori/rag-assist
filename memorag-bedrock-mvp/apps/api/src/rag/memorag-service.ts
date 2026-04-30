import { randomUUID } from "node:crypto"
import { config } from "../config.js"
import type { Dependencies } from "../dependencies.js"
import type { Citation, DebugStep, DebugTrace, DocumentManifest, JsonValue, MemoryCard, RetrievedVector, VectorRecord } from "../types.js"
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

  async listDebugRuns(): Promise<DebugTrace[]> {
    const keys = await this.deps.objectStore.listKeys("debug-runs/")
    const traces = await Promise.all(
      keys
        .filter((key) => key.endsWith(".json"))
        .map(async (key) => JSON.parse(await this.deps.objectStore.getText(key)) as DebugTrace)
    )
    return traces.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 50)
  }

  async getDebugRun(runId: string): Promise<DebugTrace | undefined> {
    const keys = await this.deps.objectStore.listKeys("debug-runs/")
    const key = keys.find((candidate) => candidate.endsWith(`/${runId}.json`))
    if (!key) return undefined
    return JSON.parse(await this.deps.objectStore.getText(key)) as DebugTrace
  }

  async chat(input: ChatInput): Promise<{
    answer: string
    isAnswerable: boolean
    citations: Citation[]
    retrieved: Citation[]
    debug?: DebugTrace
  }> {
    const topK = clamp(input.topK ?? 6, 1, 20)
    const memoryTopK = clamp(input.memoryTopK ?? 4, 1, 10)
    const minScore = input.minScore ?? config.minRetrievalScore
    const embeddingModelId = input.embeddingModelId ?? config.embeddingModelId
    const modelId = input.modelId ?? config.defaultModelId
    const clueModelId = input.clueModelId ?? input.modelId ?? config.defaultMemoryModelId
    const runStartedAt = new Date()
    const runStartMs = Date.now()
    const steps: DebugStep[] = []

    pushDebugStep(steps, {
      label: "入力解析",
      startedAt: runStartedAt.toISOString(),
      startedMs: runStartMs,
      summary: "ユーザーの質問を解析し、検索に使う主要テキストを確定しました。",
      detail: input.question,
      tokenCount: estimateTokenCount(input.question)
    })

    const memoryStepStart = mark()
    const questionVector = await this.deps.textModel.embed(input.question, {
      modelId: embeddingModelId,
      dimensions: config.embeddingDimensions
    })

    const memoryHits = await this.deps.vectorStore.query(questionVector, memoryTopK, { kind: "memory" })
    const memoryContext = memoryHits.map((hit) => hit.metadata.text ?? "").filter(Boolean).join("\n---\n")
    pushDebugStep(steps, {
      label: "MemoRAGメモリ検索",
      ...memoryStepStart,
      modelId: embeddingModelId,
      summary: "過去の類似質問や要約メモリを検索し、クエリ展開に使う文脈を取得しました。",
      detail: memoryHits.map((hit) => `${hit.metadata.fileName} ${hit.metadata.memoryId ?? ""} score=${hit.score.toFixed(4)}`).join("\n"),
      hitCount: memoryHits.length
    })

    const clueStepStart = mark()
    const clueRaw = await this.deps.textModel.generate(buildCluePrompt(input.question, memoryContext), {
      modelId: clueModelId,
      temperature: 0,
      maxTokens: 600
    })
    const clueJson = parseJsonObject<ClueJson>(clueRaw)
    const clues = buildSearchClues(input.question, clueJson?.clues ?? [])
    pushDebugStep(steps, {
      label: "クエリ正規化",
      ...clueStepStart,
      modelId: clueModelId,
      summary: "表記ゆれや同義語を補い、検索に使うクエリ候補へ変換しました。",
      detail: clues.join("\n"),
      tokenCount: estimateTokenCount(clueRaw)
    })

    const vectorStepStart = mark()
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
    pushDebugStep(steps, {
      label: "ベクトル検索",
      ...vectorStepStart,
      modelId: embeddingModelId,
      summary: "社内ドキュメントのベクトルストアから関連チャンクを検索しました。",
      detail: `${clues.length}件の検索クエリを実行しました。`,
      hitCount: retrievedByKey.size
    })

    const rerankStepStart = mark()
    const retrieved = [...retrievedByKey.values()].sort((a, b) => b.score - a.score).slice(0, topK)
    const retrievedCitations = retrieved.map(toCitation)
    pushDebugStep(steps, {
      label: "再ランキング",
      ...rerankStepStart,
      summary: "重複チャンクを統合し、スコア順で回答候補を選別しました。",
      detail: retrievedCitations.map((citation) => `${citation.fileName} ${citation.chunkId ?? ""} score=${citation.score}`).join("\n"),
      hitCount: retrieved.length
    })

    const groundingStepStart = mark()
    if (retrieved.length === 0 || (retrieved[0]?.score ?? 0) < minScore) {
      pushDebugStep(steps, {
        label: "根拠チェック",
        ...groundingStepStart,
        status: "warning",
        summary: "検索結果が回答しきい値に届かなかったため、回答を拒否しました。",
        detail: `threshold=${minScore}, topScore=${retrieved[0]?.score ?? 0}`,
        hitCount: retrieved.length
      })
      const result = {
        answer: NO_ANSWER,
        isAnswerable: false,
        citations: [],
        retrieved: retrievedCitations,
        debug: undefined as DebugTrace | undefined
      }
      result.debug = await this.finalizeDebugTrace(input, {
        runId: createRunId(runStartedAt),
        startedAt: runStartedAt,
        startedMs: runStartMs,
        modelId,
        clueModelId,
        embeddingModelId,
        topK,
        memoryTopK,
        minScore,
        status: "warning",
        answer: result.answer,
        isAnswerable: result.isAnswerable,
        citations: result.citations,
        retrieved: result.retrieved,
        steps
      })
      return result
    }
    pushDebugStep(steps, {
      label: "根拠チェック",
      ...groundingStepStart,
      summary: "回答候補と検索文書の整合性、出典スコアの妥当性を確認しました。",
      detail: `threshold=${minScore}, topScore=${retrieved[0]?.score ?? 0}`,
      hitCount: retrieved.length
    })

    const answerStepStart = mark()
    const answerRaw = await this.deps.textModel.generate(buildFinalAnswerPrompt(input.question, retrieved), {
      modelId,
      temperature: 0,
      maxTokens: 1200
    })
    const answerJson = parseJsonObject<AnswerJson>(answerRaw)
    pushDebugStep(steps, {
      label: "Bedrock推論",
      ...answerStepStart,
      modelId,
      summary: "根拠に基づき、自然言語での回答候補を生成しました。",
      detail: answerRaw.slice(0, 1200),
      tokenCount: estimateTokenCount(answerRaw)
    })

    const finalStepStart = mark()
    if (!answerJson || answerJson.isAnswerable === false || !answerJson.answer?.trim()) {
      pushDebugStep(steps, {
        label: "最終回答",
        ...finalStepStart,
        status: "warning",
        summary: "モデル出力から回答可能な根拠を確認できなかったため、回答を拒否しました。",
        detail: answerRaw.slice(0, 1200)
      })
      const result = {
        answer: NO_ANSWER,
        isAnswerable: false,
        citations: [],
        retrieved: retrievedCitations,
        debug: undefined as DebugTrace | undefined
      }
      result.debug = await this.finalizeDebugTrace(input, {
        runId: createRunId(runStartedAt),
        startedAt: runStartedAt,
        startedMs: runStartMs,
        modelId,
        clueModelId,
        embeddingModelId,
        topK,
        memoryTopK,
        minScore,
        status: "warning",
        answer: result.answer,
        isAnswerable: result.isAnswerable,
        citations: result.citations,
        retrieved: result.retrieved,
        steps
      })
      return result
    }

    const used = new Set(answerJson.usedChunkIds ?? [])
    const citations = retrieved
      .filter((hit) => used.size === 0 || used.has(hit.key) || used.has(hit.metadata.chunkId ?? ""))
      .map(toCitation)
      .slice(0, 5)

    if (input.strictGrounded !== false && citations.length === 0) {
      pushDebugStep(steps, {
        label: "最終回答",
        ...finalStepStart,
        status: "warning",
        summary: "回答に紐づく引用チャンクを特定できなかったため、回答を拒否しました。",
        detail: answerJson.answer.slice(0, 1200)
      })
      const result = {
        answer: NO_ANSWER,
        isAnswerable: false,
        citations: [],
        retrieved: retrievedCitations,
        debug: undefined as DebugTrace | undefined
      }
      result.debug = await this.finalizeDebugTrace(input, {
        runId: createRunId(runStartedAt),
        startedAt: runStartedAt,
        startedMs: runStartMs,
        modelId,
        clueModelId,
        embeddingModelId,
        topK,
        memoryTopK,
        minScore,
        status: "warning",
        answer: result.answer,
        isAnswerable: result.isAnswerable,
        citations: result.citations,
        retrieved: result.retrieved,
        steps
      })
      return result
    }

    pushDebugStep(steps, {
      label: "最終回答",
      ...finalStepStart,
      summary: "回答の体裁を整え、ユーザーへ返却する準備を完了しました。",
      detail: answerJson.answer.trim().slice(0, 1200),
      hitCount: citations.length
    })

    const result = {
      answer: answerJson.answer.trim(),
      isAnswerable: true,
      citations,
      retrieved: retrievedCitations,
      debug: undefined as DebugTrace | undefined
    }
    result.debug = await this.finalizeDebugTrace(input, {
      runId: createRunId(runStartedAt),
      startedAt: runStartedAt,
      startedMs: runStartMs,
      modelId,
      clueModelId,
      embeddingModelId,
      topK,
      memoryTopK,
      minScore,
      status: "success",
      answer: result.answer,
      isAnswerable: result.isAnswerable,
      citations: result.citations,
      retrieved: result.retrieved,
      steps
    })
    return result
  }

  private async finalizeDebugTrace(
    input: ChatInput,
    state: {
      runId: string
      startedAt: Date
      startedMs: number
      modelId: string
      embeddingModelId: string
      clueModelId: string
      topK: number
      memoryTopK: number
      minScore: number
      status: "success" | "warning" | "error"
      answer: string
      isAnswerable: boolean
      citations: Citation[]
      retrieved: Citation[]
      steps: DebugStep[]
    }
  ): Promise<DebugTrace | undefined> {
    if (!input.includeDebug) return undefined
    const completedAt = new Date()
    const trace: DebugTrace = {
      runId: state.runId,
      question: input.question,
      modelId: state.modelId,
      embeddingModelId: state.embeddingModelId,
      clueModelId: state.clueModelId,
      topK: state.topK,
      memoryTopK: state.memoryTopK,
      minScore: state.minScore,
      startedAt: state.startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      totalLatencyMs: Math.max(0, Date.now() - state.startedMs),
      status: state.status,
      answerPreview: state.answer.slice(0, 400),
      isAnswerable: state.isAnswerable,
      citations: state.citations,
      retrieved: state.retrieved,
      steps: state.steps
    }
    await this.deps.objectStore.putText(debugTraceKey(trace), JSON.stringify(trace, null, 2), "application/json")
    return trace
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

function mark(): { startedAt: string; startedMs: number } {
  return { startedAt: new Date().toISOString(), startedMs: Date.now() }
}

function pushDebugStep(
  steps: DebugStep[],
  input: {
    label: string
    startedAt: string
    startedMs: number
    status?: "success" | "warning" | "error"
    modelId?: string
    summary: string
    detail?: string
    hitCount?: number
    tokenCount?: number
  }
): void {
  const completedAt = new Date()
  steps.push({
    id: steps.length + 1,
    label: input.label,
    status: input.status ?? "success",
    latencyMs: Math.max(0, Date.now() - input.startedMs),
    modelId: input.modelId,
    summary: input.summary,
    detail: input.detail,
    hitCount: input.hitCount,
    tokenCount: input.tokenCount,
    startedAt: input.startedAt,
    completedAt: completedAt.toISOString()
  })
}

function createRunId(startedAt: Date): string {
  const stamp = startedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "_")
  return `run_${stamp}_${randomUUID().slice(0, 8)}`
}

function debugTraceKey(trace: DebugTrace): string {
  return `debug-runs/${trace.startedAt.slice(0, 10)}/${trace.runId}.json`
}

function estimateTokenCount(text: string): number {
  if (!text) return 0
  return Math.max(1, Math.ceil(text.length / 4))
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
