import { randomUUID } from "node:crypto"
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { SFNClient, StartExecutionCommand, StopExecutionCommand } from "@aws-sdk/client-sfn"
import { config } from "../config.js"
import { rolePermissions, type Role } from "../authorization.js"
import type { Dependencies } from "../dependencies.js"
import { runQaAgent } from "../agent/graph.js"
import { llmOptions, normalizeMaxIterations, normalizeMemoryTopK, normalizeMinScore, normalizeSearchTopK, normalizeTopK, ragRuntimePolicy } from "../agent/runtime-policy.js"
import type { ChatInput, QaGraphResult } from "../agent/types.js"
import { DEBUG_TRACE_SCHEMA_VERSION, type AccessRoleDefinition, type AliasAuditLogItem, type AliasDefinition, type BenchmarkMode, type BenchmarkRun, type BenchmarkRunner, type BenchmarkRunThresholds, type BenchmarkSuite, type ChatRun, type Chunk, type ConversationHistoryItem, type CostAuditSummary, type DebugTrace, type DocumentGroup, type DocumentIngestRun, type DocumentManifest, type DocumentManifestSummary, type HumanQuestion, type JsonValue, type ManagedUser, type ManagedUserAuditAction, type ManagedUserAuditLogEntry, type MemoryCard, type PublishedAliasArtifact, type ReindexMigration, type StructuredBlock, type UserUsageSummary, type VectorRecord } from "../types.js"
import type { AppUser } from "../auth.js"
import type { AnswerQuestionInput, CreateQuestionInput } from "../adapters/question-store.js"
import type { SaveConversationHistoryInput } from "../adapters/conversation-history-store.js"
import { searchRag, type SearchInput, type SearchResponse } from "../search/hybrid-search.js"
import { chunkStructuredBlocks, chunkText, summarizeDocumentStatistics } from "./chunk.js"
import { embedWithCache, mapWithConcurrency } from "./embedding-cache.js"
import { parseJsonObject } from "./json.js"
import { loadChunksForManifest, loadStructuredBlocksForManifest } from "./manifest-chunks.js"
import { buildPipelineVersions } from "./pipeline-versions.js"
import { buildMemoryCardPrompt } from "./prompts.js"
import { extractDocumentFromUpload } from "./text-extract.js"
import { aliasArtifactLatestKey } from "../search/alias-artifacts.js"

type IngestInput = {
  fileName: string
  text?: string
  contentBase64?: string
  contentBytes?: Buffer
  textractJson?: string
  mimeType?: string
  sourceS3Object?: {
    bucketName: string
    key: string
  }
  metadata?: Record<string, JsonValue>
  embeddingModelId?: string
  memoryModelId?: string
  skipMemory?: boolean
  structuredBlocks?: StructuredBlock[]
  sourceExtractorVersion?: string
}

type StartDocumentIngestRunInput = {
  uploadId: string
  objectKey: string
  purpose: "document" | "benchmarkSeed" | "chatAttachment"
  fileName: string
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

type CreateBenchmarkRunInput = {
  suiteId?: string
  mode?: BenchmarkMode
  runner?: BenchmarkRunner
  modelId?: string
  embeddingModelId?: string
  topK?: number
  memoryTopK?: number
  minScore?: number
  concurrency?: number
  thresholds?: BenchmarkRunThresholds
}

type BenchmarkDownloadArtifact = "report" | "summary" | "results" | "logs"

type AdminLedger = {
  users: ManagedUser[]
  usage: Record<string, Partial<Omit<UserUsageSummary, "userId" | "email" | "displayName">>>
  auditLog?: ManagedUserAuditLogEntry[]
}

type CreateManagedUserInput = {
  email: string
  displayName?: string
  groups?: string[]
}

type AliasInput = {
  term?: string
  expansions?: string[]
  scope?: {
    tenantId?: string
    department?: string
    source?: string
    docType?: string
    benchmarkSuiteId?: string
  }
}

type AliasReviewInput = {
  decision: "approve" | "reject"
  comment?: string
}

type AliasLedger = {
  schemaVersion: 1
  aliases: AliasDefinition[]
  auditLog: AliasAuditLogItem[]
}

const adminLedgerKey = "admin/admin-ledger.json"
const aliasLedgerKey = "admin/alias-ledger.json"
const reindexMigrationLedgerKey = "admin/reindex-migrations.json"
const pricingCatalogUpdatedAt = "2026-05-02T00:00:00.000Z"

const benchmarkSuites: BenchmarkSuite[] = [
  {
    suiteId: "smoke-agent-v1",
    label: "Agent smoke",
    mode: "agent",
    datasetS3Key: "datasets/agent/smoke-v1.jsonl",
    preset: "smoke",
    defaultConcurrency: 1
  },
  {
    suiteId: "standard-agent-v1",
    label: "Agent standard",
    mode: "agent",
    datasetS3Key: config.benchmarkDefaultDatasetKey,
    preset: "standard",
    defaultConcurrency: 1
  },
  {
    suiteId: "clarification-smoke-v1",
    label: "Clarification smoke",
    mode: "agent",
    datasetS3Key: "datasets/agent/clarification-smoke-v1.jsonl",
    preset: "smoke",
    defaultConcurrency: 1
  },
  {
    suiteId: "allganize-rag-evaluation-ja-v1",
    label: "Allganize RAG Evaluation JA",
    mode: "agent",
    datasetS3Key: "hf://datasets/allganize/RAG-Evaluation-Dataset-JA",
    preset: "standard",
    defaultConcurrency: 1
  },
  {
    suiteId: "mmrag-docqa-v1",
    label: "MMRAG-DocQA",
    mode: "agent",
    datasetS3Key: "hf://datasets/yubo2333/MMLongBench-Doc",
    preset: "standard",
    defaultConcurrency: 1
  },
  {
    suiteId: "mtrag-v1",
    label: "MTRAG multi-turn RAG",
    mode: "agent",
    datasetS3Key: "datasets/conversation/mtrag-v1.jsonl",
    preset: "standard",
    defaultConcurrency: 1
  },
  {
    suiteId: "chatrag-bench-v1",
    label: "ChatRAG Bench multi-turn RAG",
    mode: "agent",
    datasetS3Key: "datasets/conversation/chatrag-bench-v1.jsonl",
    preset: "standard",
    defaultConcurrency: 1
  },
  {
    suiteId: "jp-public-pdf-qa-v1",
    label: "日本語公開PDF QA",
    mode: "agent",
    datasetS3Key: "benchmark/dataset.jp-public-pdf-qa.jsonl",
    preset: "standard",
    defaultConcurrency: 1
  },
  {
    suiteId: "mlit-pdf-figure-table-rag-seed-v1",
    label: "MLIT PDF figure/table RAG seed",
    mode: "agent",
    datasetS3Key: "datasets/agent/mlit-pdf-figure-table-rag-seed-v1.jsonl",
    preset: "standard",
    defaultConcurrency: 1
  },
  {
    suiteId: "architecture-drawing-qarag-v0.1",
    label: "建築図面 QARAG v0.1",
    mode: "agent",
    datasetS3Key: "generated://architecture-drawing-qarag-v0.1",
    preset: "standard",
    defaultConcurrency: 1
  },
  {
    suiteId: "search-smoke-v1",
    label: "Search smoke",
    mode: "search",
    datasetS3Key: "datasets/search/smoke-v1.jsonl",
    preset: "smoke",
    defaultConcurrency: 1
  },
  {
    suiteId: "search-standard-v1",
    label: "Search standard",
    mode: "search",
    datasetS3Key: "datasets/search/standard-v1.jsonl",
    preset: "standard",
    defaultConcurrency: 1
  }
]

export class MemoRagService {
  constructor(private readonly deps: Dependencies) {}

  async ingest(input: IngestInput): Promise<DocumentManifest> {
    const documentId = randomUUID()
    const createdAt = new Date().toISOString()
    const embeddingModelId = input.embeddingModelId ?? config.embeddingModelId
    const extracted = input.structuredBlocks?.length
      ? {
          text: input.text ?? input.structuredBlocks.map((block) => block.text).join("\n\n"),
          blocks: input.structuredBlocks,
          sourceExtractorVersion: input.sourceExtractorVersion ?? "structured-blocks-ledger-v1"
        }
      : await extractDocumentFromUpload(input)
    const pipelineVersions = buildPipelineVersions({
      embeddingModelId,
      embeddingDimensions: config.embeddingDimensions,
      sourceExtractorVersion: extracted.sourceExtractorVersion
    })
    const text = extracted.text
    if (!text) throw new Error("Uploaded document did not contain extractable text")

    const chunks = extracted.blocks?.length
      ? chunkStructuredBlocks(extracted.blocks, config.chunkSizeChars, config.chunkOverlapChars)
      : chunkText(text, config.chunkSizeChars, config.chunkOverlapChars)
    if (chunks.length === 0) throw new Error("No chunks were produced from the uploaded document")

    const sourceObjectKey = `documents/${documentId}/source.txt`
    const structuredBlocksObjectKey = extracted.blocks?.length ? `documents/${documentId}/structured-blocks.json` : undefined
    const memoryCardsObjectKey = input.skipMemory ? undefined : `documents/${documentId}/memory-cards.json`
    const manifestObjectKey = `manifests/${documentId}.json`
    await this.deps.objectStore.putText(sourceObjectKey, text, "text/plain; charset=utf-8")
    if (structuredBlocksObjectKey && extracted.blocks) {
      await this.deps.objectStore.putText(structuredBlocksObjectKey, JSON.stringify({ schemaVersion: 1, blocks: extracted.blocks }, null, 2), "application/json")
    }

    const documentStatistics = summarizeDocumentStatistics(chunks)
    const memoryCards = input.skipMemory
      ? []
      : await this.createMemoryCards({
          fileName: input.fileName,
          text,
          chunks,
          documentStatistics,
          modelId: input.memoryModelId
        })
    if (memoryCardsObjectKey) {
      await this.deps.objectStore.putText(memoryCardsObjectKey, JSON.stringify({ schemaVersion: 1, memoryCards }, null, 2), "application/json")
    }

    const evidenceVectorKeys: string[] = []
    const memoryVectorKeys: string[] = []
    const evidenceRecords: VectorRecord[] = []
    const memoryRecords: VectorRecord[] = []
    const filterableMetadata = toFilterableVectorMetadata(input.metadata)

    const evidenceRows = await mapWithConcurrency(chunks, config.embeddingConcurrency, async (chunk) => {
      const vector = await embedWithCache(this.deps, {
        text: chunk.text,
        modelId: embeddingModelId,
        dimensions: config.embeddingDimensions
      })
      const key = `${documentId}-${chunk.id}`
      evidenceVectorKeys.push(key)
      return {
        key,
        vector,
        metadata: {
          kind: "chunk",
          documentId,
          fileName: input.fileName,
          chunkId: chunk.id,
          objectKey: sourceObjectKey,
          text: chunk.text,
          sectionPath: chunk.sectionPath,
          heading: chunk.heading,
          parentSectionId: chunk.parentSectionId,
          previousChunkId: chunk.previousChunkId,
          nextChunkId: chunk.nextChunkId,
          chunkHash: chunk.chunkHash,
          pageStart: chunk.pageStart,
          pageEnd: chunk.pageEnd,
          chunkKind: chunk.chunkKind,
          sourceBlockId: chunk.sourceBlockId,
          normalizedFrom: chunk.normalizedFrom,
          tableColumnCount: chunk.tableColumnCount,
          listDepth: chunk.listDepth,
          codeLanguage: chunk.codeLanguage,
          figureCaption: chunk.figureCaption,
          extractionMethod: chunk.extractionMethod,
          lifecycleStatus: lifecycleStatus(input.metadata),
          ...filterableMetadata,
          createdAt
        }
      } satisfies VectorRecord
    })
    evidenceRecords.push(...evidenceRows)

    const memoryRows = await mapWithConcurrency(memoryCards, config.embeddingConcurrency, async (card) => {
      const vector = await embedWithCache(this.deps, {
        text: card.text,
        modelId: embeddingModelId,
        dimensions: config.embeddingDimensions
      })
      const key = `${documentId}-${card.id}`
      memoryVectorKeys.push(key)
      return {
        key,
        vector,
        metadata: {
          kind: "memory",
          documentId,
          fileName: input.fileName,
          memoryId: card.id,
          objectKey: sourceObjectKey,
          text: card.text,
          sectionPath: card.sectionPath,
          lifecycleStatus: lifecycleStatus(input.metadata),
          ...filterableMetadata,
          createdAt
        }
      } satisfies VectorRecord
    })
    memoryRecords.push(...memoryRows)

    await this.deps.evidenceVectorStore.put(evidenceRecords)
    await this.deps.memoryVectorStore.put(memoryRecords)

    const manifest: DocumentManifest = {
      documentId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      metadata: input.metadata,
      sourceObjectKey,
      structuredBlocksObjectKey,
      memoryCardsObjectKey,
      manifestObjectKey,
      vectorKeys: [...evidenceVectorKeys, ...memoryVectorKeys],
      memoryVectorKeys,
      evidenceVectorKeys,
      embeddingModelId,
      embeddingDimensions: config.embeddingDimensions,
      chunkerVersion: pipelineVersions.chunkerVersion,
      sourceExtractorVersion: pipelineVersions.sourceExtractorVersion,
      memoryPromptVersion: pipelineVersions.memoryPromptVersion,
      indexVersion: pipelineVersions.indexVersion,
      pipelineVersions,
      documentStatistics,
      chunks: chunks.map(toChunkMetadata),
      lifecycleStatus: lifecycleStatus(input.metadata),
      activeDocumentId: stringValue(input.metadata?.activeDocumentId),
      stagedFromDocumentId: stringValue(input.metadata?.stagedFromDocumentId),
      reindexMigrationId: stringValue(input.metadata?.reindexMigrationId),
      chunkCount: chunks.length,
      memoryCardCount: memoryCards.length,
      createdAt
    }

    await this.deps.objectStore.putText(manifestObjectKey, JSON.stringify(manifest, null, 2), "application/json")
    return manifest
  }

  async reindexDocument(actor: AppUser, documentId: string, input: { embeddingModelId?: string; memoryModelId?: string } = {}): Promise<DocumentManifest> {
    const migration = await this.stageReindexMigration(actor, documentId, input)
    await this.cutoverReindexMigration(migration.migrationId)
    return this.getManifest(migration.stagedDocumentId)
  }

  async stageReindexMigration(actor: AppUser, documentId: string, input: { embeddingModelId?: string; memoryModelId?: string } = {}): Promise<ReindexMigration> {
    const manifestKey = `manifests/${documentId}.json`
    const manifest = JSON.parse(await this.deps.objectStore.getText(manifestKey)) as DocumentManifest
    if ((manifest.lifecycleStatus ?? stringValue(manifest.metadata?.lifecycleStatus) ?? "active") !== "active") {
      throw new Error("Only active documents can be staged for reindex")
    }
    const text = await this.deps.objectStore.getText(manifest.sourceObjectKey)
    const structuredBlocks = await this.loadStructuredBlocks(manifest)
    const now = new Date().toISOString()
    const migrationId = `reindex_${now.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}_${randomUUID().slice(0, 8)}`
    const staged = await this.ingest({
      fileName: manifest.fileName,
      text,
      structuredBlocks,
      sourceExtractorVersion: manifest.sourceExtractorVersion,
      mimeType: manifest.mimeType,
      metadata: {
        ...(manifest.metadata ?? {}),
        lifecycleStatus: "staging",
        stagedFromDocumentId: documentId,
        reindexMigrationId: migrationId,
        previousManifestObjectKey: manifest.manifestObjectKey
      },
      embeddingModelId: input.embeddingModelId ?? manifest.embeddingModelId,
      memoryModelId: input.memoryModelId
    })
    const migration: ReindexMigration = {
      migrationId,
      sourceDocumentId: documentId,
      stagedDocumentId: staged.documentId,
      status: "staged",
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now,
      previousManifestObjectKey: manifest.manifestObjectKey,
      stagedManifestObjectKey: staged.manifestObjectKey
    }
    const ledger = await this.loadReindexMigrationLedger()
    ledger.push(migration)
    await this.saveReindexMigrationLedger(ledger)
    return migration
  }

  async cutoverReindexMigration(migrationId: string): Promise<ReindexMigration> {
    const ledger = await this.loadReindexMigrationLedger()
    const migration = ledger.find((candidate) => candidate.migrationId === migrationId)
    if (!migration) throw new Error("Reindex migration not found")
    if (migration.status !== "staged") throw new Error(`Reindex migration is ${migration.status}`)
    const source = await this.getManifest(migration.sourceDocumentId)
    const staged = await this.getManifest(migration.stagedDocumentId)
    try {
      await this.reputDocumentVectorsWithLifecycle(staged, "active")
      await this.markManifestLifecycle(staged, "active", { activeDocumentId: staged.documentId })
      await this.markManifestLifecycle(source, "superseded")
    } catch (error) {
      await this.restoreFailedCutoverState(source, staged)
      throw error
    }
    await this.deleteDocumentVectors(source)
    const now = new Date().toISOString()
    migration.status = "cutover"
    migration.activeDocumentId = staged.documentId
    migration.cutoverAt = now
    migration.updatedAt = now
    await this.saveReindexMigrationLedger(ledger)
    return migration
  }

  async rollbackReindexMigration(migrationId: string): Promise<ReindexMigration> {
    const ledger = await this.loadReindexMigrationLedger()
    const migration = ledger.find((candidate) => candidate.migrationId === migrationId)
    if (!migration) throw new Error("Reindex migration not found")
    if (migration.status !== "cutover") throw new Error(`Reindex migration is ${migration.status}`)
    const staged = await this.getManifest(migration.stagedDocumentId)
    const previous = JSON.parse(await this.deps.objectStore.getText(migration.previousManifestObjectKey)) as DocumentManifest
    const text = await this.deps.objectStore.getText(previous.sourceObjectKey)
    const structuredBlocks = await this.loadStructuredBlocks(previous)
    await this.deps.evidenceVectorStore.delete(staged.evidenceVectorKeys ?? staged.vectorKeys)
    await this.deps.memoryVectorStore.delete(staged.memoryVectorKeys ?? staged.vectorKeys)
    await this.markManifestLifecycle(staged, "superseded")
    const restored = await this.ingest({
      fileName: previous.fileName,
      text,
      structuredBlocks,
      sourceExtractorVersion: previous.sourceExtractorVersion,
      mimeType: previous.mimeType,
      metadata: {
        ...(previous.metadata ?? {}),
        lifecycleStatus: "active",
        rolledBackFromMigrationId: migrationId,
        restoredFromDocumentId: previous.documentId
      },
      embeddingModelId: previous.embeddingModelId
    })
    const now = new Date().toISOString()
    migration.status = "rolled_back"
    migration.activeDocumentId = restored.documentId
    migration.rolledBackAt = now
    migration.updatedAt = now
    await this.saveReindexMigrationLedger(ledger)
    return migration
  }

  async listReindexMigrations(): Promise<ReindexMigration[]> {
    return (await this.loadReindexMigrationLedger()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async listDocuments(user?: AppUser): Promise<DocumentManifest[]> {
    const keys = await this.deps.objectStore.listKeys("manifests/")
    const manifests = await Promise.all(
      keys
        .filter((key) => key.endsWith(".json"))
        .map(async (key) => this.getManifestByKey(key).catch((error: unknown) => {
          if (isMissingObjectError(error)) {
            console.warn("Skipping missing document manifest listed by object store", { key, error })
            return undefined
          }
          throw error
        }))
    )
    const documentGroups = user ? (await this.deps.documentGroupStore.list()).map(normalizeDocumentGroup) : []
    return manifests
      .filter((manifest): manifest is DocumentManifest => manifest !== undefined)
      .filter((manifest) => (manifest.lifecycleStatus ?? stringValue(manifest.metadata?.lifecycleStatus) ?? "active") === "active")
      .filter((manifest) => stringValue(manifest.metadata?.scopeType) !== "chat")
      .filter((manifest) => !user || canAccessManifest(manifest, user, documentGroups))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async getDocumentManifest(documentId: string): Promise<DocumentManifest> {
    return this.getManifest(documentId)
  }

  async listDocumentGroups(user: AppUser): Promise<DocumentGroup[]> {
    const groups = (await this.deps.documentGroupStore.list()).map(normalizeDocumentGroup)
    return groups
      .filter((group) => canAccessDocumentGroup(group, user))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async createDocumentGroup(actor: AppUser, input: {
    name: string
    description?: string
    parentGroupId?: string
    visibility?: DocumentGroup["visibility"]
    sharedUserIds?: string[]
    sharedGroups?: string[]
    managerUserIds?: string[]
  }): Promise<DocumentGroup> {
    const now = new Date().toISOString()
    const parent = input.parentGroupId ? normalizeOptionalDocumentGroup(await this.deps.documentGroupStore.get(input.parentGroupId)) : undefined
    if (input.parentGroupId && !parent) throw new Error("Parent document group not found")
    if (parent && !canManageDocumentGroup(parent, actor)) throw forbiddenError("Forbidden: cannot create a child group under this parent")
    const group: DocumentGroup = {
      groupId: `docgrp_${randomUUID().slice(0, 12)}`,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      parentGroupId: parent?.groupId,
      ancestorGroupIds: parent ? [...(parent.ancestorGroupIds ?? []), parent.groupId] : [],
      ownerUserId: actor.userId,
      visibility: input.visibility ?? "private",
      sharedUserIds: uniqueStrings(input.sharedUserIds ?? []),
      sharedGroups: uniqueStrings(input.sharedGroups ?? []),
      managerUserIds: uniqueStrings([actor.userId, ...(input.managerUserIds ?? [])]),
      createdAt: now,
      updatedAt: now
    }
    return this.deps.documentGroupStore.create(group)
  }

  async updateDocumentGroupSharing(actor: AppUser, groupId: string, input: {
    visibility?: DocumentGroup["visibility"]
    parentGroupId?: string
    sharedUserIds?: string[]
    sharedGroups?: string[]
    managerUserIds?: string[]
  }): Promise<DocumentGroup | undefined> {
    const group = normalizeOptionalDocumentGroup(await this.deps.documentGroupStore.get(groupId))
    if (!group) return undefined
    if (!canManageDocumentGroup(group, actor)) throw forbiddenError("Forbidden: only group managers can update sharing")
    const update: Partial<DocumentGroup> = {}
    if (input.visibility !== undefined) update.visibility = input.visibility
    if (input.sharedUserIds !== undefined) update.sharedUserIds = uniqueStrings(input.sharedUserIds)
    if (input.sharedGroups !== undefined) update.sharedGroups = uniqueStrings(input.sharedGroups)
    if (input.managerUserIds !== undefined) update.managerUserIds = uniqueStrings([group.ownerUserId, ...input.managerUserIds])
    let parentChanged = false
    if (input.parentGroupId !== undefined) {
      parentChanged = true
      const parentGroupId = input.parentGroupId
      if (parentGroupId === group.groupId) throw new Error("Document group cannot be its own parent")
      const parent = normalizeOptionalDocumentGroup(await this.deps.documentGroupStore.get(parentGroupId))
      if (!parent) throw new Error("Parent document group not found")
      if ((parent.ancestorGroupIds ?? []).includes(group.groupId)) throw new Error("Document group cannot move under its descendant")
      if (!canManageDocumentGroup(parent, actor)) throw forbiddenError("Forbidden: cannot move group under this parent")
      update.parentGroupId = parent.groupId
      update.ancestorGroupIds = [...(parent.ancestorGroupIds ?? []), parent.groupId]
    }
    const updated = await this.deps.documentGroupStore.update(groupId, { ...update, updatedAt: new Date().toISOString() })
    if (parentChanged) await this.refreshDescendantDocumentGroupAncestors(updated)
    return updated
  }

  async assertDocumentGroupsWritable(actor: AppUser, groupIds: string[]): Promise<void> {
    if (groupIds.length === 0) return
    for (const groupId of groupIds) {
      const group = normalizeOptionalDocumentGroup(await this.deps.documentGroupStore.get(groupId))
      if (!group || !canManageDocumentGroup(group, actor)) throw forbiddenError(`Forbidden: cannot write document group ${groupId}`)
    }
  }

  async assertSearchScopeReadable(actor: AppUser, scope: ChatInput["searchScope"]): Promise<void> {
    if (!scope?.groupIds?.length) return
    for (const groupId of scope.groupIds) {
      const group = normalizeOptionalDocumentGroup(await this.deps.documentGroupStore.get(groupId))
      if (!group || !canAccessDocumentGroup(group, actor)) throw forbiddenError(`Forbidden: cannot read document group ${groupId}`)
    }
  }

  private async refreshDescendantDocumentGroupAncestors(root: DocumentGroup): Promise<void> {
    const groups = (await this.deps.documentGroupStore.list()).map(normalizeDocumentGroup)
    const byParent = new Map<string, DocumentGroup[]>()
    for (const group of groups) {
      if (!group.parentGroupId) continue
      byParent.set(group.parentGroupId, [...(byParent.get(group.parentGroupId) ?? []), group])
    }
    const queue = byParent.get(root.groupId)?.map((group) => ({
      group,
      ancestorGroupIds: [...(root.ancestorGroupIds ?? []), root.groupId]
    })) ?? []
    while (queue.length > 0) {
      const next = queue.shift()
      if (!next) continue
      const updated = await this.deps.documentGroupStore.update(next.group.groupId, {
        ancestorGroupIds: next.ancestorGroupIds,
        updatedAt: new Date().toISOString()
      })
      for (const child of byParent.get(updated.groupId) ?? []) {
        queue.push({ group: child, ancestorGroupIds: [...next.ancestorGroupIds, updated.groupId] })
      }
    }
  }

  async deleteDocument(documentId: string): Promise<{ documentId: string; deletedVectorCount: number }> {
    const manifestKey = `manifests/${documentId}.json`
    const raw = await this.deps.objectStore.getText(manifestKey)
    const manifest = JSON.parse(raw) as DocumentManifest
    await this.deps.evidenceVectorStore.delete(manifest.evidenceVectorKeys ?? manifest.vectorKeys)
    await this.deps.memoryVectorStore.delete(manifest.memoryVectorKeys ?? manifest.vectorKeys)
    await this.deps.objectStore.deleteObject(manifest.sourceObjectKey)
    if (manifest.structuredBlocksObjectKey) await this.deps.objectStore.deleteObject(manifest.structuredBlocksObjectKey)
    if (manifest.memoryCardsObjectKey) await this.deps.objectStore.deleteObject(manifest.memoryCardsObjectKey)
    await this.deps.objectStore.deleteObject(manifest.manifestObjectKey)
    return { documentId, deletedVectorCount: manifest.vectorKeys.length }
  }

  listAccessRoles(): AccessRoleDefinition[] {
    return Object.entries(rolePermissions)
      .map(([role, permissions]) => ({ role, permissions }))
      .sort((a, b) => a.role.localeCompare(b.role))
  }

  async listAliases(): Promise<AliasDefinition[]> {
    const ledger = await this.loadAliasLedger()
    return ledger.aliases.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async createAlias(actor: AppUser, input: Required<Pick<AliasInput, "term" | "expansions">> & Pick<AliasInput, "scope">): Promise<AliasDefinition> {
    const ledger = await this.loadAliasLedger()
    const now = new Date().toISOString()
    const alias: AliasDefinition = {
      aliasId: `alias_${randomUUID().slice(0, 12)}`,
      term: normalizeAliasTerm(input.term),
      expansions: normalizeAliasExpansions(input.expansions),
      scope: normalizeAliasScope(input.scope),
      status: "draft",
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now
    }
    ledger.aliases.push(alias)
    appendAliasAudit(ledger, actor, "create", alias.aliasId, `created ${alias.term}`)
    await this.saveAliasLedger(ledger)
    return alias
  }

  async updateAlias(actor: AppUser, aliasId: string, input: AliasInput): Promise<AliasDefinition | undefined> {
    const ledger = await this.loadAliasLedger()
    const alias = ledger.aliases.find((candidate) => candidate.aliasId === aliasId)
    if (!alias) return undefined
    if (input.term !== undefined) alias.term = normalizeAliasTerm(input.term)
    if (input.expansions !== undefined) alias.expansions = normalizeAliasExpansions(input.expansions)
    if (input.scope !== undefined) alias.scope = normalizeAliasScope(input.scope)
    alias.status = alias.status === "disabled" ? "disabled" : "draft"
    alias.updatedAt = new Date().toISOString()
    delete alias.reviewedBy
    delete alias.reviewedAt
    delete alias.reviewComment
    delete alias.publishedVersion
    appendAliasAudit(ledger, actor, "update", alias.aliasId, `updated ${alias.term}`)
    await this.saveAliasLedger(ledger)
    return alias
  }

  async reviewAlias(actor: AppUser, aliasId: string, input: AliasReviewInput): Promise<AliasDefinition | undefined> {
    const ledger = await this.loadAliasLedger()
    const alias = ledger.aliases.find((candidate) => candidate.aliasId === aliasId)
    if (!alias) return undefined
    alias.status = input.decision === "approve" ? "approved" : "draft"
    alias.reviewedBy = actor.userId
    alias.reviewedAt = new Date().toISOString()
    alias.reviewComment = input.comment
    alias.updatedAt = alias.reviewedAt
    appendAliasAudit(ledger, actor, "review", alias.aliasId, `${input.decision} ${alias.term}`)
    await this.saveAliasLedger(ledger)
    return alias
  }

  async disableAlias(actor: AppUser, aliasId: string): Promise<AliasDefinition | undefined> {
    const ledger = await this.loadAliasLedger()
    const alias = ledger.aliases.find((candidate) => candidate.aliasId === aliasId)
    if (!alias) return undefined
    alias.status = "disabled"
    alias.updatedAt = new Date().toISOString()
    appendAliasAudit(ledger, actor, "disable", alias.aliasId, `disabled ${alias.term}`)
    await this.saveAliasLedger(ledger)
    return alias
  }

  async publishAliases(actor: AppUser): Promise<{ version: string; publishedAt: string; aliasCount: number }> {
    const ledger = await this.loadAliasLedger()
    const publishedAt = new Date().toISOString()
    const version = createAliasVersion(publishedAt)
    const aliases = ledger.aliases.filter((alias) => alias.status === "approved").map((alias) => ({ ...alias, publishedVersion: version }))
    for (const alias of ledger.aliases) {
      if (alias.status === "approved") alias.publishedVersion = version
    }
    const objectKey = `aliases/${version}/aliases.json`
    const artifact: PublishedAliasArtifact = {
      schemaVersion: 1,
      version,
      publishedBy: actor.userId,
      publishedAt,
      aliases
    }
    await this.deps.objectStore.putText(objectKey, JSON.stringify(artifact, null, 2), "application/json")
    await this.deps.objectStore.putText(aliasArtifactLatestKey, JSON.stringify({ version, objectKey, publishedAt, aliasCount: aliases.length }, null, 2), "application/json")
    appendAliasAudit(ledger, actor, "publish", undefined, `published ${aliases.length} aliases as ${version}`)
    await this.saveAliasLedger(ledger)
    return { version, publishedAt, aliasCount: aliases.length }
  }

  async listAliasAuditLog(): Promise<AliasAuditLogItem[]> {
    const ledger = await this.loadAliasLedger()
    return ledger.auditLog.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200)
  }

  async listManagedUsers(actor: AppUser): Promise<ManagedUser[]> {
    const db = await this.loadAdminLedger(actor, { syncUserDirectory: true })
    return db.users
      .filter((user) => user.status !== "deleted")
      .sort((a, b) => a.email.localeCompare(b.email))
  }

  async createManagedUser(actor: AppUser, input: CreateManagedUserInput): Promise<ManagedUser> {
    const now = new Date().toISOString()
    const email = input.email.trim().toLowerCase()
    const db = await this.loadAdminLedger(actor, { syncUserDirectory: true })
    const userId = createManagedUserId(email)
    const existing = db.users.find((user) => user.userId === userId || user.email.toLowerCase() === email)
    if (existing) throw new Error("Managed user already exists")

    const user: ManagedUser = {
      userId,
      email,
      displayName: input.displayName?.trim() || email.split("@")[0],
      status: "active",
      groups: normalizeRoles(input.groups ?? ["CHAT_USER"]),
      createdAt: now,
      updatedAt: now
    }
    if (user.groups.length === 0) user.groups = ["CHAT_USER"]
    db.users.push(user)
    this.appendAdminAuditLog(db, actor, user, "user:create", undefined, user.status, [], user.groups, now)
    await this.saveAdminLedger(db)
    return user
  }

  async listAdminAuditLog(actor: AppUser): Promise<ManagedUserAuditLogEntry[]> {
    const db = await this.loadAdminLedger(actor)
    return [...(db.auditLog ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100)
  }

  async assignUserRoles(actor: AppUser, userId: string, groups: string[]): Promise<ManagedUser | undefined> {
    const normalizedGroups = normalizeRoles(groups)
    const db = await this.loadAdminLedger(actor, { syncUserDirectory: true })
    const user = db.users.find((candidate) => candidate.userId === userId && candidate.status !== "deleted")
    if (!user) return undefined
    const beforeGroups = [...user.groups]
    user.groups = normalizedGroups
    if (user.groups.length === 0) user.groups = ["CHAT_USER"]
    user.updatedAt = new Date().toISOString()
    await this.deps.userDirectory?.setUserGroups?.(user.email, user.groups)
    this.appendAdminAuditLog(db, actor, user, "role:assign", user.status, user.status, beforeGroups, user.groups, user.updatedAt)
    await this.saveAdminLedger(db)
    return user
  }

  async suspendManagedUser(actor: AppUser, userId: string): Promise<ManagedUser | undefined> {
    return this.updateManagedUserStatus(actor, userId, "suspended")
  }

  async unsuspendManagedUser(actor: AppUser, userId: string): Promise<ManagedUser | undefined> {
    return this.updateManagedUserStatus(actor, userId, "active")
  }

  async deleteManagedUser(actor: AppUser, userId: string): Promise<ManagedUser | undefined> {
    return this.updateManagedUserStatus(actor, userId, "deleted")
  }

  async listUsageSummaries(actor: AppUser): Promise<UserUsageSummary[]> {
    const db = await this.loadAdminLedger(actor, { syncUserDirectory: true })
    const documents = await this.listDocuments()
    const benchmarkRuns = await this.listBenchmarkRuns()
    const debugRuns = await this.listDebugRuns()

    return db.users
      .filter((user) => user.status !== "deleted")
      .map((user) => {
        const stored = db.usage[user.userId] ?? {}
        const userBenchmarkRuns = benchmarkRuns.filter((run) => run.createdBy === user.userId)
        const lastActivityAt = [
          stored.lastActivityAt,
          ...userBenchmarkRuns.map((run) => run.updatedAt),
          ...debugRuns.map((run) => run.completedAt)
        ].filter(Boolean).sort().at(-1)
        return {
          userId: user.userId,
          email: user.email,
          displayName: user.displayName,
          chatMessages: stored.chatMessages ?? 0,
          conversationCount: stored.conversationCount ?? 0,
          questionCount: stored.questionCount ?? 0,
          documentCount: user.groups.includes("RAG_GROUP_MANAGER") || user.groups.includes("SYSTEM_ADMIN") ? documents.length : 0,
          benchmarkRunCount: (stored.benchmarkRunCount ?? 0) + userBenchmarkRuns.length,
          debugRunCount: user.groups.includes("SYSTEM_ADMIN") ? debugRuns.length : (stored.debugRunCount ?? 0),
          lastActivityAt
        }
      })
      .sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""))
  }

  async getCostAuditSummary(actor: AppUser): Promise<CostAuditSummary> {
    const usage = await this.listUsageSummaries(actor)
    const documents = await this.listDocuments()
    const benchmarkRuns = await this.listBenchmarkRuns()
    const debugRuns = await this.listDebugRuns()
    const totalChatMessages = usage.reduce((sum, user) => sum + user.chatMessages, 0)
    const totalBenchmarkCases = benchmarkRuns.reduce((sum, run) => sum + (run.metrics?.total ?? 0), 0)
    const items = [
      estimateCost("Bedrock", "chat completion", totalChatMessages, "message", 0.0008, "estimated_usage"),
      estimateCost("S3 Vectors", "document chunks", documents.reduce((sum, document) => sum + document.chunkCount + document.memoryCardCount, 0), "vector", 0.00005, "estimated_usage"),
      estimateCost("Benchmark", "dataset cases", totalBenchmarkCases, "case", 0.0012, totalBenchmarkCases > 0 ? "actual_usage" : "manual_estimate"),
      estimateCost("Debug trace", "persisted traces", debugRuns.length, "trace", 0.0001, "estimated_usage")
    ] as const
    const userCosts = usage.map((user) => ({
      userId: user.userId,
      email: user.email,
      estimatedCostUsd: roundCost(user.chatMessages * 0.0008 + user.benchmarkRunCount * 0.012 + user.debugRunCount * 0.0001)
    }))
    const now = new Date()
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    return {
      periodStart,
      periodEnd: now.toISOString(),
      currency: "USD",
      totalEstimatedUsd: roundCost(items.reduce((sum, item) => sum + item.estimatedCostUsd, 0)),
      items: [...items],
      users: userCosts.sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd),
      pricingCatalogUpdatedAt
    }
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

  async chat(input: ChatInput, user?: AppUser): Promise<QaGraphResult> {
    if (user) await this.assertSearchScopeReadable(user, input.searchScope)
    return runQaAgent(this.deps, input, user)
  }

  async startChatRun(input: ChatInput, user: AppUser): Promise<{ runId: string; status: ChatRun["status"]; eventsPath: string }> {
    await this.assertSearchScopeReadable(user, input.searchScope)
    const now = new Date().toISOString()
    const runId = createChatRunId(now)
    const ttl = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
    const run: ChatRun = {
      runId,
      status: "queued",
      createdBy: user.userId,
      userEmail: user.email,
      userGroups: user.cognitoGroups,
      question: input.question,
      conversationHistory: input.conversationHistory,
      clarificationContext: input.clarificationContext,
      modelId: input.modelId ?? config.defaultModelId,
      embeddingModelId: input.embeddingModelId ?? config.embeddingModelId,
      clueModelId: input.clueModelId ?? input.modelId ?? config.defaultMemoryModelId,
      topK: normalizeTopK(input.topK),
      memoryTopK: normalizeMemoryTopK(input.memoryTopK),
      minScore: normalizeMinScore(input.minScore),
      strictGrounded: input.strictGrounded,
      useMemory: input.useMemory,
      maxIterations: normalizeMaxIterations(input.maxIterations),
      searchScope: input.searchScope,
      includeDebug: input.includeDebug ?? input.debug ?? false,
      createdAt: now,
      updatedAt: now,
      ttl
    }

    await this.deps.chatRunStore.create(run)
    await this.deps.chatRunEventStore.append({
      runId,
      type: "status",
      stage: "queued",
      message: "リクエストを受け付けました",
      data: { status: "queued" },
      ttl
    })

    if (config.chatRunStateMachineArn) {
      try {
        await this.startChatRunExecution(runId)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await this.markChatRunFailed(runId, `StartExecution failed: ${message}`)
        throw err
      }
    } else {
      void this.executeChatRun(runId).catch(() => undefined)
    }

    return { runId, status: run.status, eventsPath: `/chat-runs/${encodeURIComponent(runId)}/events` }
  }

  async executeChatRun(runId: string): Promise<ChatRun> {
    const run = await this.deps.chatRunStore.get(runId)
    if (!run) throw new Error(`Chat run not found: ${runId}`)
    const ttl = run.ttl
    const startedAt = new Date().toISOString()
    await this.deps.chatRunStore.update(runId, { status: "running", startedAt, updatedAt: startedAt })
    await this.deps.chatRunEventStore.append({
      runId,
      type: "status",
      stage: "running",
      message: "回答生成を開始しました",
      data: { status: "running" },
      ttl
    })

    try {
      const result = await runQaAgent(
        this.deps,
        {
          question: run.question,
          conversationHistory: run.conversationHistory,
          clarificationContext: run.clarificationContext,
          modelId: run.modelId,
          embeddingModelId: run.embeddingModelId,
          clueModelId: run.clueModelId,
          topK: run.topK,
          memoryTopK: run.memoryTopK,
          minScore: run.minScore,
          strictGrounded: run.strictGrounded,
          useMemory: run.useMemory,
          maxIterations: run.maxIterations,
          searchScope: run.searchScope,
          includeDebug: run.includeDebug
        },
        { userId: run.createdBy, email: run.userEmail, cognitoGroups: run.userGroups?.length ? run.userGroups : ["CHAT_USER"] },
        {
          emit: async (event) => {
            await this.deps.chatRunEventStore.append({
              runId,
              type: event.type,
              stage: event.stage,
              message: event.message,
              data: toJsonValue(event.data),
              ttl
            })
          }
        }
      )
      const completedAt = new Date().toISOString()
      const finalEventData: Record<string, JsonValue> = {
        responseType: result.responseType,
        answer: result.answer,
        isAnswerable: result.isAnswerable,
        citations: result.citations as unknown as JsonValue,
        retrieved: result.retrieved as unknown as JsonValue
      }
      if (result.needsClarification !== undefined) finalEventData.needsClarification = result.needsClarification
      if (result.clarification) finalEventData.clarification = result.clarification as unknown as JsonValue
      if (result.debug?.runId) finalEventData.debugRunId = result.debug.runId
      await this.deps.chatRunEventStore.append({
        runId,
        type: "final",
        stage: "done",
        message: "回答生成が完了しました",
        data: finalEventData,
        ttl
      })
      return this.deps.chatRunStore.update(runId, {
        status: "succeeded",
        responseType: result.responseType,
        answer: result.answer,
        isAnswerable: result.isAnswerable,
        needsClarification: result.needsClarification,
        clarification: result.clarification,
        citations: result.citations,
        retrieved: result.retrieved,
        debugRunId: result.debug?.runId,
        completedAt,
        updatedAt: completedAt
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const completedAt = new Date().toISOString()
      await this.deps.chatRunEventStore.append({
        runId,
        type: "error",
        stage: "failed",
        message,
        data: { message },
        ttl
      })
      return this.deps.chatRunStore.update(runId, {
        status: "failed",
        error: message,
        completedAt,
        updatedAt: completedAt
      })
    }
  }

  async markChatRunFailed(runId: string, reason: string): Promise<ChatRun> {
    const run = await this.deps.chatRunStore.get(runId)
    if (!run) throw new Error(`Chat run not found: ${runId}`)
    if (run.status === "succeeded" || run.status === "failed" || run.status === "cancelled") return run

    const completedAt = new Date().toISOString()
    await this.deps.chatRunEventStore.append({
      runId,
      type: "error",
      stage: "failed",
      message: reason,
      data: { message: reason },
      ttl: run.ttl
    })
    return this.deps.chatRunStore.update(runId, {
      status: "failed",
      error: reason,
      completedAt,
      updatedAt: completedAt
    })
  }

  async startDocumentIngestRun(input: StartDocumentIngestRunInput, user: AppUser): Promise<{ runId: string; status: DocumentIngestRun["status"]; eventsPath: string }> {
    const now = new Date().toISOString()
    const runId = createDocumentIngestRunId(now)
    const ttl = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
    const run: DocumentIngestRun = {
      runId,
      status: "queued",
      createdBy: user.userId,
      userEmail: user.email,
      userGroups: user.cognitoGroups,
      uploadId: input.uploadId,
      objectKey: input.objectKey,
      purpose: input.purpose,
      fileName: input.fileName,
      mimeType: input.mimeType,
      metadata: input.metadata,
      embeddingModelId: input.embeddingModelId,
      memoryModelId: input.memoryModelId,
      skipMemory: input.skipMemory,
      createdAt: now,
      updatedAt: now,
      ttl
    }

    await this.deps.documentIngestRunStore.create(run)
    await this.deps.documentIngestRunEventStore.append({
      runId,
      type: "status",
      stage: "queued",
      message: "文書取り込みを受け付けました",
      data: { status: "queued" },
      ttl
    })

    if (config.documentIngestRunStateMachineArn) {
      try {
        await this.startDocumentIngestRunExecution(runId)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await this.markDocumentIngestRunFailed(runId, `StartExecution failed: ${message}`)
        throw err
      }
    } else {
      void this.executeDocumentIngestRun(runId).catch(() => undefined)
    }

    return { runId, status: run.status, eventsPath: `/document-ingest-runs/${encodeURIComponent(runId)}/events` }
  }

  async executeDocumentIngestRun(runId: string): Promise<DocumentIngestRun> {
    const run = await this.deps.documentIngestRunStore.get(runId)
    if (!run) throw new Error(`Document ingest run not found: ${runId}`)
    const ttl = run.ttl
    const startedAt = new Date().toISOString()
    await this.deps.documentIngestRunStore.update(runId, { status: "running", startedAt, updatedAt: startedAt })
    await this.deps.documentIngestRunEventStore.append({
      runId,
      type: "status",
      stage: "running",
      message: "文書取り込みを開始しました",
      data: { status: "running" },
      ttl
    })

    try {
      const contentBytes = await this.deps.objectStore.getBytes(run.objectKey)
      if (contentBytes.length === 0) throw new Error("Uploaded object is empty")
      const sourceS3Object = config.docsBucketName
        ? { bucketName: config.docsBucketName, key: run.objectKey }
        : undefined
      const manifest = await this.ingest({
        fileName: run.fileName,
        mimeType: run.mimeType,
        metadata: run.metadata,
        embeddingModelId: run.embeddingModelId,
        memoryModelId: run.memoryModelId,
        skipMemory: run.skipMemory,
        contentBytes,
        sourceS3Object
      })
      await this.deps.objectStore.deleteObject(run.objectKey)
      const manifestSummary = toDocumentManifestSummary(manifest)
      const completedAt = new Date().toISOString()
      await this.deps.documentIngestRunEventStore.append({
        runId,
        type: "final",
        stage: "done",
        message: "文書取り込みが完了しました",
        data: { documentId: manifest.documentId, manifest: manifestSummary as unknown as JsonValue },
        ttl
      })
      return this.deps.documentIngestRunStore.update(runId, {
        status: "succeeded",
        manifest: manifestSummary,
        documentId: manifest.documentId,
        completedAt,
        updatedAt: completedAt
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const completedAt = new Date().toISOString()
      await this.deps.documentIngestRunEventStore.append({
        runId,
        type: "error",
        stage: "failed",
        message,
        data: { message },
        ttl
      })
      return this.deps.documentIngestRunStore.update(runId, {
        status: "failed",
        error: message,
        completedAt,
        updatedAt: completedAt
      })
    }
  }

  async markDocumentIngestRunFailed(runId: string, reason: string): Promise<DocumentIngestRun> {
    const run = await this.deps.documentIngestRunStore.get(runId)
    if (!run) throw new Error(`Document ingest run not found: ${runId}`)
    if (run.status === "succeeded" || run.status === "failed" || run.status === "cancelled") return run

    const completedAt = new Date().toISOString()
    await this.deps.documentIngestRunEventStore.append({
      runId,
      type: "error",
      stage: "failed",
      message: reason,
      data: { message: reason },
      ttl: run.ttl
    })
    return this.deps.documentIngestRunStore.update(runId, {
      status: "failed",
      error: reason,
      completedAt,
      updatedAt: completedAt
    })
  }

  async search(input: SearchInput, user: AppUser): Promise<SearchResponse> {
    await this.assertSearchScopeReadable(user, input.scope)
    return searchRag(this.deps, input, user)
  }

  async createQuestion(input: CreateQuestionInput, user?: AppUser): Promise<HumanQuestion> {
    return this.deps.questionStore.create({
      ...input,
      requesterUserId: user?.userId,
      requesterName: input.requesterName?.trim() || userDisplayName(user),
      requesterDepartment: input.requesterDepartment?.trim() || "未設定"
    })
  }

  async listQuestions(): Promise<HumanQuestion[]> {
    return this.deps.questionStore.list()
  }

  async getQuestion(questionId: string): Promise<HumanQuestion | undefined> {
    return this.deps.questionStore.get(questionId)
  }

  async answerQuestion(questionId: string, input: AnswerQuestionInput, user?: AppUser): Promise<HumanQuestion> {
    return this.deps.questionStore.answer(questionId, {
      ...input,
      responderName: input.responderName?.trim() || userDisplayName(user)
    })
  }

  async resolveQuestion(questionId: string): Promise<HumanQuestion> {
    return this.deps.questionStore.resolve(questionId)
  }

  private async updateManagedUserStatus(actor: AppUser, userId: string, status: ManagedUser["status"]): Promise<ManagedUser | undefined> {
    const db = await this.loadAdminLedger(actor, { syncUserDirectory: true })
    const user = db.users.find((candidate) => candidate.userId === userId && candidate.status !== "deleted")
    if (!user) return undefined
    const beforeStatus = user.status
    const beforeGroups = [...user.groups]
    user.status = status
    user.updatedAt = new Date().toISOString()
    const action: ManagedUserAuditAction = status === "suspended" ? "user:suspend" : status === "active" ? "user:unsuspend" : "user:delete"
    this.appendAdminAuditLog(db, actor, user, action, beforeStatus, user.status, beforeGroups, user.groups, user.updatedAt)
    await this.saveAdminLedger(db)
    return user
  }

  private async loadAdminLedger(actor: AppUser, options: { syncUserDirectory?: boolean } = {}): Promise<AdminLedger> {
    let db: AdminLedger
    try {
      db = JSON.parse(await this.deps.objectStore.getText(adminLedgerKey)) as AdminLedger
    } catch (err) {
      if (!isMissingObjectError(err)) throw err
      db = { users: [], usage: {} }
    }
    db.auditLog ??= []

    const now = new Date().toISOString()
    const actorEmail = actor.email ?? `${actor.userId}@local`
    const existingActor = db.users.find((user) => user.userId === actor.userId || user.email.toLowerCase() === actorEmail.toLowerCase())
    if (existingActor) {
      if (existingActor.userId !== actor.userId) {
        db.usage[actor.userId] ??= db.usage[existingActor.userId] ?? {}
        delete db.usage[existingActor.userId]
        existingActor.userId = actor.userId
      }
      existingActor.email = actorEmail
      existingActor.groups = normalizeRoles(actor.cognitoGroups)
      existingActor.status = existingActor.status === "deleted" ? "active" : existingActor.status
      existingActor.lastLoginAt = now
      existingActor.updatedAt = now
    } else {
      db.users.push({
        userId: actor.userId,
        email: actorEmail,
        displayName: actorEmail.split("@")[0],
        status: "active",
        groups: normalizeRoles(actor.cognitoGroups),
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now
      })
      db.usage[actor.userId] = {
        chatMessages: 0,
        conversationCount: 0,
        questionCount: 0,
        benchmarkRunCount: 0,
        debugRunCount: 0,
        lastActivityAt: now
      }
    }
    if (options.syncUserDirectory) await this.syncUserDirectory(db)
    return db
  }

  private async syncUserDirectory(db: AdminLedger): Promise<void> {
    if (!this.deps.userDirectory) return

    const directoryUsers = await this.deps.userDirectory.listUsers()
    for (const directoryUser of directoryUsers) {
      const email = directoryUser.email.toLowerCase()
      const existing = db.users.find((user) => user.userId === directoryUser.userId || user.email.toLowerCase() === email)
      const groups = normalizeRoles(directoryUser.groups)

      if (existing) {
        if (existing.userId !== directoryUser.userId) {
          db.usage[directoryUser.userId] ??= db.usage[existing.userId] ?? {}
          delete db.usage[existing.userId]
          existing.userId = directoryUser.userId
        }
        existing.email = directoryUser.email
        existing.displayName = directoryUser.displayName
        if (existing.groups.length === 0) existing.groups = groups
        existing.createdAt = existing.createdAt || directoryUser.createdAt
        existing.updatedAt = directoryUser.updatedAt
        continue
      }

      db.users.push({
        ...directoryUser,
        groups
      })
      db.usage[directoryUser.userId] ??= {
        chatMessages: 0,
        conversationCount: 0,
        questionCount: 0,
        benchmarkRunCount: 0,
        debugRunCount: 0
      }
    }
  }

  private async saveAdminLedger(db: AdminLedger): Promise<void> {
    await this.deps.objectStore.putText(adminLedgerKey, JSON.stringify(db, null, 2), "application/json")
  }

  private async loadAliasLedger(): Promise<AliasLedger> {
    try {
      const raw = JSON.parse(await this.deps.objectStore.getText(aliasLedgerKey)) as AliasLedger
      return {
        schemaVersion: 1,
        aliases: Array.isArray(raw.aliases) ? raw.aliases : [],
        auditLog: Array.isArray(raw.auditLog) ? raw.auditLog : []
      }
    } catch (err) {
      if (!isMissingObjectError(err)) throw err
      return { schemaVersion: 1, aliases: [], auditLog: [] }
    }
  }

  private async saveAliasLedger(ledger: AliasLedger): Promise<void> {
    await this.deps.objectStore.putText(aliasLedgerKey, JSON.stringify(ledger, null, 2), "application/json")
  }

  private async loadReindexMigrationLedger(): Promise<ReindexMigration[]> {
    try {
      const raw = JSON.parse(await this.deps.objectStore.getText(reindexMigrationLedgerKey)) as { migrations?: ReindexMigration[] }
      return Array.isArray(raw.migrations) ? raw.migrations : []
    } catch (err) {
      if (!isMissingObjectError(err)) throw err
      return []
    }
  }

  private async saveReindexMigrationLedger(migrations: ReindexMigration[]): Promise<void> {
    await this.deps.objectStore.putText(reindexMigrationLedgerKey, JSON.stringify({ schemaVersion: 1, migrations }, null, 2), "application/json")
  }

  private async getManifest(documentId: string): Promise<DocumentManifest> {
    return this.getManifestByKey(`manifests/${documentId}.json`)
  }

  private async getManifestByKey(key: string): Promise<DocumentManifest> {
    return JSON.parse(await this.deps.objectStore.getText(key)) as DocumentManifest
  }

  private async loadStructuredBlocks(manifest: DocumentManifest): Promise<StructuredBlock[] | undefined> {
    return loadStructuredBlocksForManifest(this.deps, manifest)
  }

  private async loadMemoryCards(manifest: DocumentManifest): Promise<MemoryCard[] | undefined> {
    if (!manifest.memoryCardsObjectKey) return undefined
    try {
      const raw = JSON.parse(await this.deps.objectStore.getText(manifest.memoryCardsObjectKey)) as { memoryCards?: MemoryCard[] }
      return Array.isArray(raw.memoryCards) ? raw.memoryCards : undefined
    } catch (err) {
      if (!isMissingObjectError(err)) throw err
      return undefined
    }
  }

  private async reputDocumentVectorsWithLifecycle(
    manifest: DocumentManifest,
    status: NonNullable<DocumentManifest["lifecycleStatus"]>
  ): Promise<void> {
    const chunks = await loadChunksForManifest(this.deps, manifest)
    const sourceText = await this.deps.objectStore.getText(manifest.sourceObjectKey)
    const storedMemoryCards = await this.loadMemoryCards(manifest)
    const memoryCards = manifest.memoryVectorKeys?.length
      ? storedMemoryCards ??
        await this.createMemoryCards({
          fileName: manifest.fileName,
          text: sourceText,
          chunks
        })
      : []
    const metadata = { ...(manifest.metadata ?? {}), lifecycleStatus: status }
    const filterableMetadata = toFilterableVectorMetadata(metadata)
    const embeddingModelId = manifest.embeddingModelId ?? config.embeddingModelId

    const evidenceRecords = await mapWithConcurrency(chunks, config.embeddingConcurrency, async (chunk): Promise<VectorRecord> => ({
      key: `${manifest.documentId}-${chunk.id}`,
      vector: await embedWithCache(this.deps, {
        text: chunk.text,
        modelId: embeddingModelId,
        dimensions: manifest.embeddingDimensions ?? config.embeddingDimensions
      }),
      metadata: {
        kind: "chunk",
        documentId: manifest.documentId,
        fileName: manifest.fileName,
        chunkId: chunk.id,
        objectKey: manifest.sourceObjectKey,
        text: chunk.text,
        sectionPath: chunk.sectionPath,
        heading: chunk.heading,
        parentSectionId: chunk.parentSectionId,
        previousChunkId: chunk.previousChunkId,
        nextChunkId: chunk.nextChunkId,
        chunkHash: chunk.chunkHash,
        pageStart: chunk.pageStart,
        pageEnd: chunk.pageEnd,
        chunkKind: chunk.chunkKind,
        sourceBlockId: chunk.sourceBlockId,
        normalizedFrom: chunk.normalizedFrom,
        tableColumnCount: chunk.tableColumnCount,
        listDepth: chunk.listDepth,
        codeLanguage: chunk.codeLanguage,
        figureCaption: chunk.figureCaption,
        extractionMethod: chunk.extractionMethod,
        lifecycleStatus: status,
        ...filterableMetadata,
        createdAt: manifest.createdAt
      }
    }))

    const memoryRecords = await mapWithConcurrency(memoryCards, config.embeddingConcurrency, async (card): Promise<VectorRecord> => ({
      key: `${manifest.documentId}-${card.id}`,
      vector: await embedWithCache(this.deps, {
        text: card.text,
        modelId: embeddingModelId,
        dimensions: manifest.embeddingDimensions ?? config.embeddingDimensions
      }),
      metadata: {
        kind: "memory",
        documentId: manifest.documentId,
        fileName: manifest.fileName,
        memoryId: card.id,
        objectKey: manifest.sourceObjectKey,
        text: card.text,
        sectionPath: card.sectionPath,
        lifecycleStatus: status,
        ...filterableMetadata,
        createdAt: manifest.createdAt
      }
    }))

    await this.deps.evidenceVectorStore.put(evidenceRecords)
    await this.deps.memoryVectorStore.put(memoryRecords)
  }

  private async restoreFailedCutoverState(source: DocumentManifest, staged: DocumentManifest): Promise<void> {
    try {
      await this.reputDocumentVectorsWithLifecycle(staged, "staging")
    } catch {
      // Retrieval also checks manifest lifecycle, so restoration failures are best-effort here.
    }
    try {
      await this.markManifestLifecycle(staged, "staging")
    } catch {
      // Preserve the original cutover error.
    }
    try {
      await this.markManifestLifecycle(source, "active")
    } catch {
      // Preserve the original cutover error.
    }
  }

  private async deleteDocumentVectors(manifest: DocumentManifest): Promise<void> {
    await Promise.allSettled([
      this.deps.evidenceVectorStore.delete(manifest.evidenceVectorKeys ?? manifest.vectorKeys),
      this.deps.memoryVectorStore.delete(manifest.memoryVectorKeys ?? manifest.vectorKeys)
    ])
  }

  private async markManifestLifecycle(
    manifest: DocumentManifest,
    status: NonNullable<DocumentManifest["lifecycleStatus"]>,
    extra: Record<string, JsonValue> = {}
  ): Promise<DocumentManifest> {
    const metadata = { ...(manifest.metadata ?? {}), ...extra, lifecycleStatus: status }
    const next: DocumentManifest = {
      ...manifest,
      metadata,
      lifecycleStatus: status,
      activeDocumentId: typeof extra.activeDocumentId === "string" ? extra.activeDocumentId : manifest.activeDocumentId
    }
    await this.deps.objectStore.putText(next.manifestObjectKey, JSON.stringify(next, null, 2), "application/json")
    return next
  }

  private appendAdminAuditLog(
    db: AdminLedger,
    actor: AppUser,
    target: ManagedUser,
    action: ManagedUserAuditAction,
    beforeStatus: ManagedUser["status"] | undefined,
    afterStatus: ManagedUser["status"] | undefined,
    beforeGroups: string[],
    afterGroups: string[],
    createdAt: string
  ) {
    db.auditLog ??= []
    db.auditLog.unshift({
      auditId: randomUUID(),
      action,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetUserId: target.userId,
      targetEmail: target.email,
      beforeStatus,
      afterStatus,
      beforeGroups,
      afterGroups,
      createdAt
    })
    db.auditLog = db.auditLog.slice(0, 200)
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

  listBenchmarkSuites(): BenchmarkSuite[] {
    return benchmarkSuites
  }

  async createBenchmarkRun(user: AppUser, input: CreateBenchmarkRunInput): Promise<BenchmarkRun> {
    const suite = benchmarkSuites.find((candidate) => candidate.suiteId === (input.suiteId ?? "standard-agent-v1"))
    if (!suite) throw new Error(`Unknown benchmark suite: ${input.suiteId}`)
    if ((input.mode ?? suite.mode) !== suite.mode) throw new Error(`Suite ${suite.suiteId} does not support mode ${input.mode}`)
    if ((input.runner ?? "codebuild") !== "codebuild") throw new Error("Only codebuild runner is supported in this version")

    const now = new Date().toISOString()
    const runId = createBenchmarkRunId(now)
    const outputPrefix = `runs/${runId}`
    const run: BenchmarkRun = {
      runId,
      status: "queued",
      mode: suite.mode,
      runner: "codebuild",
      suiteId: suite.suiteId,
      datasetS3Key: suite.datasetS3Key,
      createdBy: user.userId,
      createdAt: now,
      updatedAt: now,
      modelId: input.modelId ?? config.defaultModelId,
      embeddingModelId: input.embeddingModelId ?? config.embeddingModelId,
      topK: input.topK === undefined
        ? suite.mode === "search"
          ? ragRuntimePolicy.retrieval.defaultSearchBenchmarkTopK
          : ragRuntimePolicy.retrieval.defaultTopK
        : suite.mode === "search"
          ? normalizeSearchTopK(input.topK)
          : normalizeTopK(input.topK),
      memoryTopK: normalizeMemoryTopK(input.memoryTopK),
      minScore: normalizeMinScore(input.minScore),
      concurrency: input.concurrency ?? suite.defaultConcurrency,
      thresholds: input.thresholds,
      summaryS3Key: `${outputPrefix}/summary.json`,
      reportS3Key: `${outputPrefix}/report.md`,
      resultsS3Key: `${outputPrefix}/results.jsonl`
    }

    await this.deps.benchmarkRunStore.create(run)
    if (!config.benchmarkStateMachineArn) return run

    try {
      const executionArn = await this.startBenchmarkExecution(run, outputPrefix)
      return this.deps.benchmarkRunStore.update(run.runId, { executionArn })
    } catch (err) {
      await this.deps.benchmarkRunStore.update(run.runId, {
        status: "failed",
        completedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  async listBenchmarkRuns(): Promise<BenchmarkRun[]> {
    return this.deps.benchmarkRunStore.list()
  }

  async getBenchmarkRun(runId: string): Promise<BenchmarkRun | undefined> {
    return this.deps.benchmarkRunStore.get(runId)
  }

  async cancelBenchmarkRun(runId: string): Promise<BenchmarkRun | undefined> {
    const run = await this.deps.benchmarkRunStore.get(runId)
    if (!run) return undefined
    if (run.executionArn) {
      const states = new SFNClient({ region: config.region })
      await states.send(new StopExecutionCommand({
        executionArn: run.executionArn,
        cause: "Cancelled from MemoRAG admin benchmark view"
      }))
    }
    return this.deps.benchmarkRunStore.update(runId, {
      status: "cancelled",
      completedAt: new Date().toISOString()
    })
  }

  async createBenchmarkArtifactDownloadUrl(runId: string, artifact: BenchmarkDownloadArtifact): Promise<{ url: string; expiresInSeconds: number; objectKey: string } | undefined> {
    const run = await this.deps.benchmarkRunStore.get(runId)
    if (!run) return undefined
    if (artifact === "logs") {
      if (!run.codeBuildLogUrl) return undefined
      return {
        url: run.codeBuildLogUrl,
        expiresInSeconds: config.benchmarkDownloadExpiresInSeconds,
        objectKey: run.codeBuildBuildId ?? run.runId
      }
    }
    if (!config.benchmarkBucketName) throw new Error("BENCHMARK_BUCKET_NAME is not configured")
    const objectKey = artifact === "summary" ? run.summaryS3Key : artifact === "results" ? run.resultsS3Key : run.reportS3Key
    if (!objectKey) return undefined

    const expiresInSeconds = Math.max(60, config.benchmarkDownloadExpiresInSeconds)
    const s3 = new S3Client({ region: config.region })
    const downloadMetadata = createBenchmarkArtifactDownloadMetadata(runId, artifact, objectKey)
    const url = await getSignedUrl(s3, new GetObjectCommand({
      Bucket: config.benchmarkBucketName,
      Key: downloadMetadata.objectKey,
      ResponseContentDisposition: downloadMetadata.contentDisposition
    }), { expiresIn: expiresInSeconds })
    return { url, expiresInSeconds, objectKey }
  }

  async getBenchmarkCodeBuildLogText(runId: string): Promise<{ text: string; fileName: string; contentDisposition: string } | undefined> {
    const run = await this.deps.benchmarkRunStore.get(runId)
    if (!run) return undefined

    const text = await this.deps.codeBuildLogReader?.getText({
      buildId: run.codeBuildBuildId,
      logGroupName: run.codeBuildLogGroupName,
      logStreamName: run.codeBuildLogStreamName
    })
    if (text === undefined) return undefined

    const fileName = `benchmark-logs-${runId.replace(/[^a-zA-Z0-9._-]/g, "_")}.txt`
    return {
      text,
      fileName,
      contentDisposition: `attachment; filename="${fileName}"`
    }
  }

  private async startBenchmarkExecution(run: BenchmarkRun, outputPrefix: string): Promise<string> {
    const states = new SFNClient({ region: config.region })
    const response = await states.send(
      new StartExecutionCommand({
        stateMachineArn: config.benchmarkStateMachineArn,
        name: run.runId,
        input: JSON.stringify({
          runId: run.runId,
          mode: run.mode,
          runner: run.runner,
          suiteId: run.suiteId,
          datasetS3Key: run.datasetS3Key,
          datasetS3Uri: `s3://${config.benchmarkBucketName}/${run.datasetS3Key}`,
          outputS3Prefix: `s3://${config.benchmarkBucketName}/${outputPrefix}`,
          apiBaseUrl: config.benchmarkTargetApiBaseUrl,
          modelId: run.modelId,
          embeddingModelId: run.embeddingModelId,
          topK: run.topK,
          memoryTopK: run.memoryTopK,
          minScore: run.minScore,
          concurrency: run.concurrency,
          summaryS3Key: run.summaryS3Key,
          reportS3Key: run.reportS3Key,
          resultsS3Key: run.resultsS3Key
        })
      })
    )
    if (!response.executionArn) throw new Error("Step Functions executionArn was not returned")
    return response.executionArn
  }

  private async startChatRunExecution(runId: string): Promise<string> {
    const states = new SFNClient({ region: config.region })
    const response = await states.send(
      new StartExecutionCommand({
        stateMachineArn: config.chatRunStateMachineArn,
        name: runId,
        input: JSON.stringify({ runId })
      })
    )
    if (!response.executionArn) throw new Error("Step Functions executionArn was not returned")
    return response.executionArn
  }

  private async startDocumentIngestRunExecution(runId: string): Promise<string> {
    const states = new SFNClient({ region: config.region })
    const response = await states.send(
      new StartExecutionCommand({
        stateMachineArn: config.documentIngestRunStateMachineArn,
        name: runId,
        input: JSON.stringify({ runId })
      })
    )
    if (!response.executionArn) throw new Error("Step Functions executionArn was not returned")
    return response.executionArn
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

  private async createMemoryCards(input: { fileName: string; text: string; chunks: Chunk[]; documentStatistics?: DocumentManifest["documentStatistics"]; modelId?: string }): Promise<MemoryCard[]> {
    const raw = await this.deps.textModel.generate(
      buildMemoryCardPrompt(input.fileName, input.text),
      llmOptions("memoryCard", input.modelId ?? config.defaultMemoryModelId)
    )
    const parsed = parseJsonObject<MemoryJson>(raw)
    const fallbackSummary = input.text.replace(/\s+/g, " ").slice(0, ragRuntimePolicy.limits.memorySummaryMaxChars)
    const card: MemoryCard = {
      id: "memory-0000",
      level: "document",
      summary: parsed?.summary ?? fallbackSummary,
      keywords: parsed?.keywords?.slice(0, ragRuntimePolicy.limits.memoryKeywordLimit) ?? [],
      likelyQuestions: parsed?.likelyQuestions?.slice(0, ragRuntimePolicy.limits.memoryQuestionLimit) ?? [],
      constraints: parsed?.constraints?.slice(0, ragRuntimePolicy.limits.memoryConstraintLimit) ?? [],
      sourceChunkIds: input.chunks.map((chunk) => chunk.id),
      text: ""
    }
    const text = [
      `Summary: ${card.summary}`,
      `Keywords: ${card.keywords.join(", ")}`,
      `Likely questions: ${card.likelyQuestions.join(" / ")}`,
      `Constraints: ${card.constraints.join(" / ")}`
    ].join("\n")
    const sectionCards = createSectionMemoryCards(input.chunks, input.documentStatistics)
    const conceptCards = createConceptMemoryCards(input.chunks, card.keywords, input.documentStatistics)
    return [{ ...card, text }, ...sectionCards, ...conceptCards]
  }
}

function createSectionMemoryCards(chunks: Chunk[], statistics?: DocumentManifest["documentStatistics"]): MemoryCard[] {
  const bySection = new Map<string, Chunk[]>()
  for (const chunk of chunks) {
    const section = chunk.sectionPath?.join(" > ")
    if (!section) continue
    bySection.set(section, [...(bySection.get(section) ?? []), chunk])
  }
  const limit = Math.min(ragRuntimePolicy.limits.sectionMemoryLimit, Math.max(1, statistics?.sectionCount ?? bySection.size))
  return [...bySection.entries()].slice(0, limit).map(([section, sectionChunks], index) => {
    const summary = sectionChunks.map((chunk) => chunk.text).join(" ").replace(/\s+/g, " ").slice(0, ragRuntimePolicy.limits.memorySummaryMaxChars)
    const card: MemoryCard = {
      id: `memory-section-${String(index).padStart(4, "0")}`,
      level: "section",
      summary,
      keywords: section.split(/\s+|>|、|,/).map((item) => item.trim()).filter(Boolean).slice(0, ragRuntimePolicy.limits.memoryKeywordLimit),
      likelyQuestions: [`${section}について教えてください。`],
      constraints: [],
      sourceChunkIds: sectionChunks.map((chunk) => chunk.id),
      sectionPath: sectionChunks[0]?.sectionPath,
      text: ""
    }
    card.text = [
      `Level: section`,
      `Section: ${section}`,
      `Summary: ${card.summary}`,
      `Keywords: ${card.keywords.join(", ")}`,
      `Source chunks: ${card.sourceChunkIds?.join(", ")}`
    ].join("\n")
    return card
  })
}

function createConceptMemoryCards(chunks: Chunk[], keywords: string[], statistics?: DocumentManifest["documentStatistics"]): MemoryCard[] {
  const structuralTerms = [
    statistics && statistics.tableCount > 0 ? "table" : "",
    statistics && statistics.listCount > 0 ? "list" : "",
    statistics && statistics.codeCount > 0 ? "code" : ""
  ].filter(Boolean)
  const terms = [...new Set([...keywords, ...chunks.flatMap((chunk) => chunk.heading ? [chunk.heading] : [])].map((term) => term.trim()).filter(Boolean))].slice(
    0,
    Math.max(1, ragRuntimePolicy.limits.conceptMemoryTermLimit - structuralTerms.length)
  )
  return [...terms, ...structuralTerms].map((term, index) => {
    const sourceChunks = chunks.filter((chunk) => (chunk.text.includes(term) || chunk.heading === term)).slice(
      0,
      ragRuntimePolicy.limits.conceptMemorySourceChunkLimit
    )
    const card: MemoryCard = {
      id: `memory-concept-${String(index).padStart(4, "0")}`,
      level: "concept",
      summary: `${term} に関連する記述を検索補助するための概念メモリです。`,
      keywords: [term],
      likelyQuestions: [`${term}とは？`, `${term}の条件は？`],
      constraints: ["最終回答の引用は raw evidence chunk に限定する。"],
      sourceChunkIds: sourceChunks.map((chunk) => chunk.id),
      text: ""
    }
    card.text = [
      `Level: concept`,
      `Concept: ${term}`,
      `Summary: ${card.summary}`,
      `Source chunks: ${card.sourceChunkIds?.join(", ")}`
    ].join("\n")
    return card
  })
}

function createBenchmarkRunId(now: string): string {
  const compact = now.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
  return `bench_${compact}_${randomUUID().slice(0, 8)}`
}

function createChatRunId(now: string): string {
  const compact = now.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
  return `chat_${compact}_${randomUUID().slice(0, 8)}`
}

function createDocumentIngestRunId(now: string): string {
  const compact = now.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
  return `ingest_${compact}_${randomUUID().slice(0, 8)}`
}

function toDocumentManifestSummary(manifest: DocumentManifest): DocumentManifestSummary {
  return {
    documentId: manifest.documentId,
    fileName: manifest.fileName,
    mimeType: manifest.mimeType,
    chunkCount: manifest.chunkCount,
    memoryCardCount: manifest.memoryCardCount,
    createdAt: manifest.createdAt,
    lifecycleStatus: manifest.lifecycleStatus,
    activeDocumentId: manifest.activeDocumentId,
    stagedFromDocumentId: manifest.stagedFromDocumentId,
    reindexMigrationId: manifest.reindexMigrationId,
    chunkerVersion: manifest.chunkerVersion,
    sourceExtractorVersion: manifest.sourceExtractorVersion
  }
}

function toJsonValue(value: unknown): JsonValue | undefined {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value)) as JsonValue
}

function toChunkMetadata(chunk: Chunk): NonNullable<DocumentManifest["chunks"]>[number] {
  const { text: _text, ...metadata } = chunk
  return metadata
}

function artifactExtension(artifact: BenchmarkDownloadArtifact): string {
  if (artifact === "report") return ".md"
  if (artifact === "summary") return ".json"
  return ".jsonl"
}

export function createBenchmarkArtifactDownloadMetadata(
  runId: string,
  artifact: "report" | "summary" | "results",
  objectKey: string
): { fileName: string; objectKey: string; contentDisposition: string } {
  const fileName = `benchmark-${artifact}-${runId.replace(/[^a-zA-Z0-9._-]/g, "_")}${artifactExtension(artifact)}`
  return {
    fileName,
    objectKey,
    contentDisposition: `attachment; filename="${fileName}"`
  }
}

function normalizeRoles(groups: string[]): Role[] {
  return [...new Set(groups.filter((group): group is Role => group in rolePermissions))]
}

function normalizeAliasTerm(term: string): string {
  return term.trim().toLowerCase()
}

function normalizeAliasExpansions(expansions: string[]): string[] {
  return [...new Set(expansions.map((value) => value.trim()).filter(Boolean))].slice(0, ragRuntimePolicy.limits.aliasExpansionLimit)
}

function normalizeAliasScope(scope: AliasInput["scope"]): AliasDefinition["scope"] | undefined {
  if (!scope) return undefined
  const normalized = Object.fromEntries(
    Object.entries(scope)
      .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0)
  ) as AliasDefinition["scope"]
  return normalized && Object.keys(normalized).length > 0 ? normalized : undefined
}

function appendAliasAudit(
  ledger: AliasLedger,
  actor: AppUser,
  action: AliasAuditLogItem["action"],
  aliasId: string | undefined,
  detail: string
): void {
  ledger.auditLog.push({
    auditId: `audit_${randomUUID().slice(0, 12)}`,
    aliasId,
    action,
    actorUserId: actor.userId,
    createdAt: new Date().toISOString(),
    detail
  })
}

function createAliasVersion(now: string): string {
  return `alias_${now.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}_${randomUUID().slice(0, 8)}`
}

function createManagedUserId(email: string): string {
  return email.toLowerCase().replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
}

function estimateCost(
  service: string,
  category: string,
  usage: number,
  unit: string,
  unitCostUsd: number,
  confidence: "actual_usage" | "estimated_usage" | "manual_estimate"
) {
  return {
    service,
    category,
    usage,
    unit,
    unitCostUsd,
    estimatedCostUsd: roundCost(usage * unitCostUsd),
    confidence
  }
}

function roundCost(value: number): number {
  return Math.round(value * 1000000) / 1000000
}

function isMissingObjectError(err: unknown): boolean {
  const candidate = err as { Code?: string; code?: string; name?: string; message?: string; $metadata?: { httpStatusCode?: number } }
  return candidate.Code === "NoSuchKey"
    || candidate.code === "ENOENT"
    || candidate.name === "NoSuchKey"
    || candidate.name === "NotFound"
    || candidate.$metadata?.httpStatusCode === 404
    || candidate.message?.includes("NoSuchKey") === true
    || candidate.message?.includes("ENOENT") === true
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
    ...rest,
    pipelineVersions:
      trace.pipelineVersions ??
      buildPipelineVersions({
        embeddingModelId: trace.embeddingModelId ?? config.embeddingModelId,
        embeddingDimensions: config.embeddingDimensions
      })
  }
}

function toFilterableVectorMetadata(metadata: Record<string, JsonValue> | undefined): Partial<VectorRecord["metadata"]> {
  if (!metadata) return {}
  const aclGroups = stringArray(metadata.aclGroups ?? metadata.allowedGroups) ?? []
  const allowedUsers = stringArray(metadata.allowedUsers ?? metadata.userIds)
  const groupIds = stringArray(metadata.groupIds ?? metadata.groupId) ?? []
  const filterable: Partial<VectorRecord["metadata"]> = {}
  const tenantId = stringValue(metadata.tenantId)
  const department = stringValue(metadata.department)
  const source = stringValue(metadata.source)
  const docType = stringValue(metadata.docType)
  const benchmarkSuiteId = stringValue(metadata.benchmarkSuiteId)
  const scopeType = stringValue(metadata.scopeType)
  const ownerUserId = stringValue(metadata.ownerUserId)
  const temporaryScopeId = stringValue(metadata.temporaryScopeId)
  const expiresAt = stringValue(metadata.expiresAt)
  const domainPolicy = stringValue(metadata.domainPolicy)
  const ragPolicy = stringValue(metadata.ragPolicy)
  const answerPolicy = stringValue(metadata.answerPolicy)
  const aclGroup = stringValue(metadata.aclGroup) ?? aclGroups[0]
  if (tenantId) filterable.tenantId = tenantId
  if (department) filterable.department = department
  if (source) filterable.source = source
  if (docType) filterable.docType = docType
  if (benchmarkSuiteId) filterable.benchmarkSuiteId = benchmarkSuiteId
  if (scopeType === "personal" || scopeType === "group" || scopeType === "chat" || scopeType === "benchmark") filterable.scopeType = scopeType
  if (groupIds[0]) filterable.groupId = groupIds[0]
  if (groupIds.length > 0) filterable.groupIds = groupIds
  if (ownerUserId) filterable.ownerUserId = ownerUserId
  if (temporaryScopeId) filterable.temporaryScopeId = temporaryScopeId
  if (expiresAt) filterable.expiresAt = expiresAt
  if (domainPolicy) filterable.domainPolicy = domainPolicy
  if (ragPolicy) filterable.ragPolicy = ragPolicy
  if (answerPolicy) filterable.answerPolicy = answerPolicy
  if (aclGroup) filterable.aclGroup = aclGroup
  if (aclGroups.length > 0) filterable.aclGroups = aclGroups
  if (allowedUsers && allowedUsers.length > 0) filterable.allowedUsers = allowedUsers
  return filterable
}

function lifecycleStatus(metadata: Record<string, JsonValue> | undefined): VectorRecord["metadata"]["lifecycleStatus"] {
  const value = stringValue(metadata?.lifecycleStatus)
  return value === "staging" || value === "superseded" ? value : "active"
}

function canAccessManifest(manifest: DocumentManifest, user: AppUser, documentGroups: DocumentGroup[] = []): boolean {
  if (user.cognitoGroups.includes("SYSTEM_ADMIN")) return true
  const metadata = manifest.metadata ?? {}
  if (stringValue(metadata.ownerUserId) === user.userId) return true
  const groupIds = stringArray(metadata.groupIds ?? metadata.groupId) ?? []
  if (groupIds.some((groupId) => canAccessDocumentGroup(documentGroups.find((group) => group.groupId === groupId), user))) return true
  if (stringValue(metadata.scopeType) === "group") return false
  const groups = new Set(user.cognitoGroups)
  const aclGroups = stringArray(metadata.aclGroups ?? metadata.allowedGroups ?? metadata.aclGroup ?? metadata.group) ?? []
  if (aclGroups.length > 0 && !aclGroups.some((group) => groups.has(group))) return false
  const allowedUsers = stringArray(metadata.allowedUsers ?? metadata.userIds ?? metadata.privateToUserId) ?? []
  if (allowedUsers.length > 0 && !allowedUsers.includes(user.userId) && (!user.email || !allowedUsers.includes(user.email))) return false
  return true
}

function canAccessDocumentGroup(group: DocumentGroup | undefined, user: AppUser): boolean {
  if (!group) return false
  if (user.cognitoGroups.includes("SYSTEM_ADMIN")) return true
  if (group.ownerUserId === user.userId || group.managerUserIds.includes(user.userId) || group.sharedUserIds.includes(user.userId)) return true
  if (user.email && group.sharedUserIds.includes(user.email)) return true
  if (group.visibility === "org") return true
  return group.sharedGroups.some((sharedGroup) => user.cognitoGroups.includes(sharedGroup))
}

function canManageDocumentGroup(group: DocumentGroup, user: AppUser): boolean {
  return user.cognitoGroups.includes("SYSTEM_ADMIN") || group.ownerUserId === user.userId || group.managerUserIds.includes(user.userId)
}

function normalizeDocumentGroup(group: DocumentGroup): DocumentGroup {
  return {
    ...group,
    ancestorGroupIds: uniqueStrings(group.ancestorGroupIds ?? []),
    visibility: group.visibility ?? "private",
    sharedUserIds: uniqueStrings(group.sharedUserIds ?? []),
    sharedGroups: uniqueStrings(group.sharedGroups ?? []),
    managerUserIds: uniqueStrings([group.ownerUserId, ...(group.managerUserIds ?? [])])
  }
}

function normalizeOptionalDocumentGroup(group: DocumentGroup | undefined): DocumentGroup | undefined {
  return group ? normalizeDocumentGroup(group) : undefined
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort()
}

function userDisplayName(user?: AppUser): string {
  return user?.email?.trim() || user?.userId?.trim() || "未設定"
}

function forbiddenError(message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status: 403 })
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
