import { randomUUID } from "node:crypto"
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { config } from "../config.js"
import type { Dependencies } from "../dependencies.js"
import { runQaAgent } from "../agent/graph.js"
import type { ChatInput } from "../agent/types.js"
import { DEBUG_TRACE_SCHEMA_VERSION, type Citation, type ConversationHistoryItem, type DebugTrace, type DocumentManifest, type HumanQuestion, type JsonValue, type MemoryCard, type VectorRecord } from "../types.js"
import type { AppUser } from "../auth.js"
import type { AnswerQuestionInput, CreateQuestionInput } from "../adapters/question-store.js"
import type { SaveConversationHistoryInput } from "../adapters/conversation-history-store.js"
import { searchRag, type SearchInput, type SearchResponse } from "../search/hybrid-search.js"
import { chunkText } from "./chunk.js"
import { parseJsonObject } from "./json.js"
import { buildMemoryCardPrompt } from "./prompts.js"
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

type MemoryJson = {
  summary?: string
  keywords?: string[]
  likelyQuestions?: string[]
  constraints?: string[]
}

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

    const evidenceVectorKeys: string[] = []
    const memoryVectorKeys: string[] = []
    const evidenceRecords: VectorRecord[] = []
    const memoryRecords: VectorRecord[] = []
    const filterableMetadata = toFilterableVectorMetadata(input.metadata)

    for (const chunk of chunks) {
      const vector = await this.deps.textModel.embed(chunk.text, {
        modelId: input.embeddingModelId ?? config.embeddingModelId,
        dimensions: config.embeddingDimensions
      })
      const key = `${documentId}-${chunk.id}`
      evidenceVectorKeys.push(key)
      evidenceRecords.push({
        key,
        vector,
        metadata: {
          kind: "chunk",
          documentId,
          fileName: input.fileName,
          chunkId: chunk.id,
          objectKey: sourceObjectKey,
          text: chunk.text,
          ...filterableMetadata,
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
      memoryVectorKeys.push(key)
      memoryRecords.push({
        key,
        vector,
        metadata: {
          kind: "memory",
          documentId,
          fileName: input.fileName,
          memoryId: card.id,
          objectKey: sourceObjectKey,
          text: card.text,
          ...filterableMetadata,
          createdAt
        }
      })
    }

    await this.deps.evidenceVectorStore.put(evidenceRecords)
    await this.deps.memoryVectorStore.put(memoryRecords)

    const manifest: DocumentManifest = {
      documentId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      metadata: input.metadata,
      sourceObjectKey,
      manifestObjectKey,
      vectorKeys: [...evidenceVectorKeys, ...memoryVectorKeys],
      memoryVectorKeys,
      evidenceVectorKeys,
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
    await this.deps.evidenceVectorStore.delete(manifest.evidenceVectorKeys ?? manifest.vectorKeys)
    await this.deps.memoryVectorStore.delete(manifest.memoryVectorKeys ?? manifest.vectorKeys)
    await this.deps.objectStore.deleteObject(manifest.sourceObjectKey)
    await this.deps.objectStore.deleteObject(manifest.manifestObjectKey)
    return { documentId, deletedVectorCount: manifest.vectorKeys.length }
  }

  async listDebugRuns(): Promise<DebugTrace[]> {
    const keys = await this.deps.objectStore.listKeys("debug-runs/")
    const traces = await Promise.all(
      keys
        .filter((key) => key.endsWith(".json"))
        .map(async (key) => normalizeDebugTrace(JSON.parse(await this.deps.objectStore.getText(key))))
    )
    return traces.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 50)
  }

  async getDebugRun(runId: string): Promise<DebugTrace | undefined> {
    const keys = await this.deps.objectStore.listKeys("debug-runs/")
    const key = keys.find((candidate) => candidate.endsWith(`/${runId}.json`))
    if (!key) return undefined
    return normalizeDebugTrace(JSON.parse(await this.deps.objectStore.getText(key)))
  }

  async chat(input: ChatInput): Promise<{
    answer: string
    isAnswerable: boolean
    citations: Citation[]
    retrieved: Citation[]
    debug?: DebugTrace
  }> {
    return runQaAgent(this.deps, input)
  }

  async search(input: SearchInput, user: AppUser): Promise<SearchResponse> {
    return searchRag(this.deps, input, user)
  }

  async createQuestion(input: CreateQuestionInput): Promise<HumanQuestion> {
    return this.deps.questionStore.create(input)
  }

  async listQuestions(): Promise<HumanQuestion[]> {
    return this.deps.questionStore.list()
  }

  async getQuestion(questionId: string): Promise<HumanQuestion | undefined> {
    return this.deps.questionStore.get(questionId)
  }

  async answerQuestion(questionId: string, input: AnswerQuestionInput): Promise<HumanQuestion> {
    return this.deps.questionStore.answer(questionId, input)
  }

  async resolveQuestion(questionId: string): Promise<HumanQuestion> {
    return this.deps.questionStore.resolve(questionId)
  }

  async saveConversationHistory(userId: string, input: SaveConversationHistoryInput): Promise<ConversationHistoryItem> {
    return this.deps.conversationHistoryStore.save(userId, input)
  }

  async listConversationHistory(userId: string): Promise<ConversationHistoryItem[]> {
    return this.deps.conversationHistoryStore.list(userId)
  }

  async deleteConversationHistory(userId: string, id: string): Promise<void> {
    return this.deps.conversationHistoryStore.delete(userId, id)
  }



  async createDebugTraceDownloadUrl(runId: string): Promise<{ url: string; expiresInSeconds: number; objectKey: string } | undefined> {
    if (!config.debugDownloadBucketName) throw new Error("DEBUG_DOWNLOAD_BUCKET_NAME is not configured")
    const trace = await this.getDebugRun(runId)
    if (!trace) return undefined

    const body = formatDebugTraceJson(trace)
    const downloadMetadata = createDebugTraceDownloadMetadata(trace.runId)
    const s3 = new S3Client({ region: config.region })
    await s3.send(new PutObjectCommand({
      Bucket: config.debugDownloadBucketName,
      Key: downloadMetadata.objectKey,
      Body: body,
      ContentType: "application/json; charset=utf-8",
      ContentDisposition: downloadMetadata.contentDisposition
    }))

    const expiresInSeconds = Math.max(60, config.debugDownloadExpiresInSeconds)
    const url = await getSignedUrl(s3, new GetObjectCommand({
      Bucket: config.debugDownloadBucketName,
      Key: downloadMetadata.objectKey,
      ResponseContentType: "application/json; charset=utf-8",
      ResponseContentDisposition: downloadMetadata.contentDisposition
    }), { expiresIn: expiresInSeconds })
    return { url, expiresInSeconds, objectKey: downloadMetadata.objectKey }
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



export function createDebugTraceDownloadMetadata(runId: string): {
  fileName: string
  objectKey: string
  contentDisposition: string
} {
  const fileName = `debug-trace-${runId.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`
  return {
    fileName,
    objectKey: `downloads/${fileName}`,
    contentDisposition: `attachment; filename="${fileName}"`
  }
}

export function formatDebugTraceJson(trace: DebugTrace): string {
  return JSON.stringify(trace, null, 2)
}

function normalizeDebugTrace(value: unknown): DebugTrace {
  const trace = value as DebugTrace & { schemaVersion?: number }
  const { schemaVersion: _schemaVersion, ...rest } = trace
  return {
    schemaVersion: DEBUG_TRACE_SCHEMA_VERSION,
    ...rest
  }
}

function toFilterableVectorMetadata(metadata: Record<string, JsonValue> | undefined): Partial<VectorRecord["metadata"]> {
  if (!metadata) return {}
  const aclGroups = stringArray(metadata.aclGroups ?? metadata.allowedGroups) ?? []
  const allowedUsers = stringArray(metadata.allowedUsers ?? metadata.userIds)
  const filterable: Partial<VectorRecord["metadata"]> = {}
  const tenantId = stringValue(metadata.tenantId)
  const department = stringValue(metadata.department)
  const source = stringValue(metadata.source)
  const docType = stringValue(metadata.docType)
  const aclGroup = stringValue(metadata.aclGroup) ?? aclGroups[0]
  if (tenantId) filterable.tenantId = tenantId
  if (department) filterable.department = department
  if (source) filterable.source = source
  if (docType) filterable.docType = docType
  if (aclGroup) filterable.aclGroup = aclGroup
  if (aclGroups.length > 0) filterable.aclGroups = aclGroups
  if (allowedUsers && allowedUsers.length > 0) filterable.allowedUsers = allowedUsers
  return filterable
}

function stringValue(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined
}

function stringArray(value: JsonValue | undefined): string[] | undefined {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) {
    const values = value.filter((item): item is string => typeof item === "string")
    return values.length > 0 ? values : undefined
  }
  return undefined
}
