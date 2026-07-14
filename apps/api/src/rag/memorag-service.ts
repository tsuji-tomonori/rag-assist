import { randomUUID } from "node:crypto"
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { SFNClient, StartExecutionCommand, StopExecutionCommand } from "@aws-sdk/client-sfn"
import { config } from "../config.js"
import { hasPermission, rolePermissions, type Role } from "../authorization.js"
import type { Dependencies } from "../dependencies.js"
import { sanitizeProviderText, type AsyncAgentProviderArtifact, type AsyncAgentProviderInput, type AsyncAgentProviderResult } from "../async-agent/provider.js"
import { debugTraceObjectKey, runChatOrchestration } from "./orchestration/chat-rag-orchestrator.js"
import { llmOptions, normalizeMaxIterations, normalizeMemoryTopK, normalizeMinScore, normalizeSearchTopK, normalizeTopK, ragRuntimePolicy } from "../chat-orchestration/runtime-policy.js"
import type { ChatInput, ChatOrchestrationResult } from "../chat-orchestration/types.js"
import { DEBUG_TRACE_SANITIZE_POLICY_VERSION, DEBUG_TRACE_SCHEMA_VERSION, type AdminExportArtifact, type AgentProviderAvailability, type AgentProviderSetting, type AgentRuntimeProvider, type AsyncAgentRun, type AccessRoleDefinition, type AliasAuditLogItem, type AliasDefinition, type AuthoritativeAdmissionContext, type BenchmarkMode, type BenchmarkRun, type BenchmarkRunner, type BenchmarkRunThresholds, type BenchmarkSuite, type ChatRun, type ChatToolInvocation, type Chunk, type ConversationHistoryItem, type CostAuditSummary, type DebugReplayPlan, type DebugTrace, type DocumentGroup, type DocumentIngestRun, type DocumentManifest, type DocumentManifestSummary, type ExtractionWarning, type FavoriteItem, type FavoriteListItem, type FavoriteTargetType, type HumanQuestion, type IngestAdmissionContext, type JsonValue, type ManagedUser, type ManagedUserAuditAction, type ManagedUserAuditLogEntry, type ManagedUserDeletionPreflight, type MemoryCard, type ParsedDocumentPreview, type PublishedAliasArtifact, type QualityActionCard, type ReindexMigration, type StagedPublicationFence, type StructuredBlock, type UserUsageSummary, type VectorRecord } from "../types.js"
import type { ReplayDecisionReasonCode } from "../types.js"
import type { AppUser } from "../auth.js"
import type { CreatedDirectoryUser } from "../adapters/user-directory.js"
import type { AnswerQuestionInput, CreateQuestionInput } from "../adapters/question-store.js"
import type { SaveConversationHistoryInput } from "../adapters/conversation-history-store.js"
import type { DocumentGroupPathUpdate } from "../adapters/document-group-store.js"
import type { ChatRunExecutionEnvelope } from "../adapters/chat-run-store.js"
import { searchRag, type SearchInput, type SearchResponse } from "./online/retrieval/hybrid/hybrid-retriever.js"
import { parseJsonObject } from "./_shared/json.js"
import { loadChunksForManifest, loadStructuredBlocksForManifest } from "./_shared/storage/manifest-chunks.js"
import { documentQualityProfileFromMetadata, qualityGateForNormalRag } from "./_shared/policies/quality-policy.js"
import { sanitizeDebugTraceForPersistence, sanitizeDebugTraceForView } from "./_shared/security/trace-sanitizer.js"
import { buildReplayVersionManifest } from "./_shared/replay/replay-version-manifest.js"
import { stableHash } from "./_shared/security/derived-record-security.js"
import { createPublicationPointerSnapshot, isManifestCurrentPublication, publicationIdentity, StagedPublicationCoordinator, type PublicationScope, type StagedPublicationRun } from "./_shared/publication/staged-publication-coordinator.js"
import {
  ObjectStoreReindexPublicationCompensationRepair,
  type ReindexPublicationCompensationIntent,
  type ReindexPublicationCompensationResult
} from "./_shared/publication/reindex-publication-compensation-repair.js"
import { createVersionedReference } from "./offline/pre-retrieval/admission/source-admission.js"
import {
  SourceGovernanceApprovalService,
  SourceGovernanceUnavailableError,
  createApprovedSourceAdmissionContext,
  discardUncommittedSourceGovernanceRecord,
  type ApproveSourceGovernanceInput,
  type ApprovedSourceGovernancePolicy,
  type RestrictSourceGovernanceInput,
  type StagedSourceGovernancePublication,
  type VersionedSourceGovernanceRecord
} from "./offline/pre-retrieval/admission/source-governance-approval-service.js"
import { buildMemoryCardPrompt } from "./offline/generation/prompt-assets/memory-card-prompt.js"
import { deleteUncommittedIngestArtifacts, putDocumentVectorRecords, registerUncommittedIngestCleanupReconciliation, runIngestPipeline, type IngestInput } from "./offline/pre-retrieval/ingestion/ingest-run.service.js"
import { embedWithCache, mapWithConcurrency } from "./offline/pre-retrieval/embedding/embedding-cache.js"
import { aliasArtifactLatestKey } from "../search/alias-artifacts.js"
import { FolderPermissionService } from "../folders/folder-permission-service.js"
import {
  FolderLifecycleMutationCoordinator,
  type MoveFolderInput,
  type MoveFolderResult
} from "../folders/folder-lifecycle-mutation-coordinator.js"
import {
  canShareDocument,
  DocumentPermissionService,
  type DocumentShareGrantInput
} from "../documents/document-permission-service.js"
import { DocumentLifecycleMutationCoordinator } from "../documents/document-lifecycle-mutation-coordinator.js"
import {
  CurrentWorkerAuthorization,
  PermissionRevokedError,
  isPermissionRevokedError,
  type CurrentWorkerAuthorizationRequest,
  type WorkerAuthorizationBoundary
} from "../security/current-worker-authorization.js"
import { ObjectStoreSecurityMutationAuditOutbox } from "../security/security-mutation-audit-outbox.js"
import {
  accountRevocationCleanupDenyVersion,
  accountRevocationStateVersion,
  ObjectStoreAccountRevocationRegistry
} from "../security/account-revocation-registry.js"
import {
  ObjectStoreRevocationCleanupCoordinator,
  type RevocationCleanupDriver,
  type RevocationCleanupManifest,
  type RevocationCleanupScope,
  type RevocationCleanupTarget,
  type RevocationCleanupTargetReference
} from "./_shared/security/revocation-cleanup-coordinator.js"
import { ObjectStoreRevocationCleanupRepairOutbox } from "./_shared/security/revocation-cleanup-repair-outbox.js"
import { ProductionRagObservationProducer } from "./quality-control/production-rag-observation-producer.js"
import { ApplicationRoleMutationService } from "../security/application-role-mutation-service.js"
import {
  AdministrativePrincipalTransferError,
  AdministrativePrincipalTransferService
} from "../security/administrative-principal-transfer-service.js"
import {
  ResourceGroupMembershipService,
  ResourceGroupMembershipUnavailableError,
  type ReplaceResourceGroupMembershipsInput,
  type ResourceGroupMembershipMutationResult
} from "../security/resource-group-membership-service.js"
import { ObjectStoreResourceGroupMembershipCleanupRepairStore } from "../security/resource-group-membership-cleanup-repair-store.js"
import { tenantPartitionId, tenantStorageKey } from "../security/tenant-partition.js"
import { securityResourceReference } from "../security/security-resource-reference.js"
import {
  enforceResolvedResourceOperation,
  resolvedResourceScope,
  ResourceOperationAuthorizationError
} from "../security/production-resource-operation-authorizer.js"
import {
  readTenantManifest,
  readTenantManifestByKey,
  tenantManifestPrefix,
  tenantVectorKey
} from "./_shared/storage/tenant-artifacts.js"

type StartDocumentIngestRunInput = {
  uploadId: string
  objectKey: string
  purpose: "document" | "benchmarkSeed" | "chatAttachment"
  fileName: string
  mimeType?: string
  metadata?: Record<string, JsonValue>
  admissionContext?: IngestAdmissionContext
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

type CreateAsyncAgentRunInput = {
  provider: AgentRuntimeProvider
  modelId: string
  instruction: string
  selectedFolderIds?: string[]
  selectedDocumentIds?: string[]
  selectedSkillIds?: string[]
  selectedAgentProfileIds?: string[]
  budget?: AsyncAgentRun["budget"]
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

const defaultTenantId = "default"
const rootParentPathSegment = "ROOT"
const maxDocumentGroupPathTransactionItems = 8

type SearchImprovementCandidateInput = Pick<AliasInput, "scope"> & {
  term: string
  expansions: string[]
  candidateSource?: "ai_suggested" | "support_ticket"
  suggestionReason?: string
  reviewReason?: string
  impactSummary?: string
  searchResultDiffSummary?: string
  beforeResultIds?: string[]
  afterResultIds?: string[]
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

  async getResourceGroupMembershipState(actor: AppUser, groupId: string) {
    return this.resourceGroupMembershipService().getState(actor, groupId)
  }

  async replaceResourceGroupMemberships(
    actor: AppUser,
    groupId: string,
    input: ReplaceResourceGroupMembershipsInput
  ): Promise<ResourceGroupMembershipMutationResult> {
    return this.resourceGroupMembershipService().replaceMemberships(actor, groupId, input)
  }

  async retryPendingResourceGroupMembershipRevocationCleanups(actor: AppUser, groupId: string): Promise<number> {
    return this.resourceGroupMembershipService().retryPendingRevocationCleanups(actor, groupId)
  }

  async ingest(input: IngestInput): Promise<DocumentManifest> {
    return runIngestPipeline(this.deps, input, (memoryInput) => this.createMemoryCards(memoryInput))
  }

  createCurrentDocumentIngestAuthorization(input: {
    actor: AppUser
    admissionContext: IngestAdmissionContext | undefined
    purpose: "document" | "benchmarkSeed" | "chatAttachment"
    operationId: string
  }) {
    const requiredPermission = input.purpose === "benchmarkSeed"
      ? "benchmark:seed_corpus" as const
      : input.purpose === "chatAttachment"
        ? "chat:create" as const
        : "rag:doc:write:group" as const
    const authorize = (boundary: WorkerAuthorizationBoundary) => this.assertCurrentWorkerAuthorization({
      runId: input.operationId,
      targetType: "document_ingest_run",
      subject: input.actor.userId,
      tenantId: input.actor.tenantId,
      snapshotEmail: input.actor.email,
      snapshotGroups: input.actor.cognitoGroups,
      requiredPermissions: [requiredPermission],
      authorizeResource: (user) => this.isDocumentIngestContextAuthorized(user, {
        createdBy: input.actor.userId,
        purpose: input.purpose,
        admissionContext: input.admissionContext
      })
    }, boundary).then(() => undefined)
    return {
      authorizeStart: () => authorize("start"),
      authorizeProtectedRead: () => authorize("protected_read"),
      currentAuthorization: {
        authorizeExternalSideEffect: () => authorize("external_side_effect"),
        authorizeDurableCommit: () => authorize("durable_commit")
      }
    }
  }

  async discardUncommittedIngest(manifest: DocumentManifest): Promise<void> {
    const results = await Promise.allSettled([
      deleteUncommittedIngestArtifacts(this.deps, manifest),
      discardUncommittedSourceGovernanceRecord(this.deps.objectStore, manifest)
    ])
    if (results.some((result) => result.status === "rejected")) {
      await registerUncommittedIngestCleanupReconciliation(this.deps, manifest)
    }
  }

  async registerSourceGovernance(manifest: DocumentManifest): Promise<VersionedSourceGovernanceRecord> {
    return this.sourceGovernanceApprovalService().ensureInitialRecord(manifest)
  }

  async getSourceGovernance(actor: AppUser, documentId: string): Promise<VersionedSourceGovernanceRecord> {
    const manifest = await this.getManifest(documentId, authoritativeActorTenantId(actor))
    return this.sourceGovernanceApprovalService().getCurrentRecord(actor, manifest)
  }

  async approveSourceGovernance(
    actor: AppUser,
    documentId: string,
    input: ApproveSourceGovernanceInput
  ): Promise<VersionedSourceGovernanceRecord> {
    const manifest = await this.getManifest(documentId, authoritativeActorTenantId(actor))
    return this.sourceGovernanceApprovalService().approve(actor, manifest, input)
  }

  async restrictSourceGovernance(
    actor: AppUser,
    documentId: string,
    input: RestrictSourceGovernanceInput
  ): Promise<VersionedSourceGovernanceRecord> {
    const manifest = await this.getManifest(documentId, authoritativeActorTenantId(actor))
    return this.sourceGovernanceApprovalService().restrict(actor, manifest, input)
  }

  async reindexDocument(actor: AppUser, documentId: string, input: { embeddingModelId?: string; memoryModelId?: string } = {}): Promise<DocumentManifest> {
    const migration = await this.stageReindexMigration(actor, documentId, input)
    await this.cutoverReindexMigration(actor, migration.migrationId)
    return this.getManifest(migration.stagedDocumentId, authoritativeActorTenantId(actor))
  }

  async stageReindexMigration(actor: AppUser, documentId: string, input: { embeddingModelId?: string; memoryModelId?: string } = {}): Promise<ReindexMigration> {
    const manifest = await this.getManifest(documentId, authoritativeActorTenantId(actor))
    await this.assertDocumentManifestWritable(actor, manifest)
    const reindexOperationId = `reindex-stage:${documentId}:${randomUUID()}`
    const authorizeReindex = (boundary: WorkerAuthorizationBoundary) => this.assertCurrentWorkerAuthorization({
      runId: reindexOperationId,
      targetType: "document_ingest_run",
      subject: actor.userId,
      tenantId: actor.tenantId,
      snapshotEmail: actor.email,
      snapshotGroups: actor.cognitoGroups,
      requiredPermissions: ["rag:index:rebuild:group"],
      authorizeResource: async (currentActor) => {
        await this.assertDocumentManifestWritable(currentActor, manifest)
        return true
      }
    }, boundary).then(() => undefined)
    await authorizeReindex("start")
    if ((manifest.lifecycleStatus ?? stringValue(manifest.metadata?.lifecycleStatus) ?? "active") !== "active") {
      throw new Error("Only active documents can be staged for reindex")
    }
    if (manifest.publicationEligible === false || manifest.derivedIntegrity?.verified === false) {
      throw new Error("Source document is not eligible for staged reindex publication")
    }
    const now = new Date().toISOString()
    const scope = reindexPublicationScope(actor, manifest, input)
    const coordinator = new StagedPublicationCoordinator(this.deps)
    const begun = await coordinator.begin({
      scope,
      sourceManifest: manifest,
      workerId: `stage:${actor.userId}:${randomUUID()}`
    })
    const identity = publicationIdentity(scope)
    const existingLedger = await this.loadReindexMigrationLedger()
    const existingMigration = existingLedger.find((candidate) => candidate.publicationRunId === begun.run.runId || candidate.migrationId === begun.run.runId)
    if (begun.alreadyStaged) {
      if (existingMigration) return existingMigration
      if (!begun.run.stagedArtifact) throw new Error("Idempotent staged publication is missing its artifact checkpoint")
      const recovered = reindexMigrationFromPublicationRun(begun.run, actor.userId, manifest.manifestObjectKey)
      existingLedger.push(recovered)
      await this.saveReindexMigrationLedger([recovered])
      return recovered
    }
    if (!begun.lease) throw new Error("Publication staging lease was not acquired")
    const migrationId = begun.run.runId
    const admissionContext = this.deps.localTestIngestAdmissionContext
      ? {
          ...this.deps.localTestIngestAdmissionContext,
          tenantId: manifest.admission?.tenantId ?? stringValue(manifest.metadata?.tenantId),
          ownerUserId: manifest.admission?.ownerUserId ?? stringValue(manifest.metadata?.ownerUserId)
        }
      : reindexAdmissionContext(manifest, begun.lease.fence)
    await authorizeReindex("protected_read")
    const text = await this.deps.objectStore.getText(manifest.sourceObjectKey)
    const structuredBlocks = await this.loadStructuredBlocks(manifest)
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
      admissionContext,
      publicationFence: begun.lease.fence,
      embeddingModelId: input.embeddingModelId ?? manifest.embeddingModelId,
      memoryModelId: input.memoryModelId,
      currentAuthorization: {
        authorizeExternalSideEffect: () => authorizeReindex("external_side_effect"),
        authorizeDurableCommit: () => authorizeReindex("durable_commit")
      }
    })
    const validatedRun = await coordinator.recordStaged(begun.lease, staged)
    const migration: ReindexMigration = {
      migrationId,
      sourceDocumentId: documentId,
      stagedDocumentId: staged.documentId,
      status: "staged",
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now,
      previousManifestObjectKey: manifest.manifestObjectKey,
      stagedManifestObjectKey: staged.manifestObjectKey,
      publicationRunId: validatedRun.runId,
      publicationArtifactId: validatedRun.artifactId,
      publicationIdempotencyKey: identity.idempotencyKey,
      activePointerKey: validatedRun.activePointerKey,
      generation: validatedRun.generation,
      fencingToken: validatedRun.stagedArtifact?.fencingToken,
      checkpoint: validatedRun.checkpoint
    }
    existingLedger.push(migration)
    await this.saveReindexMigrationLedger([migration])
    return migration
  }

  async cutoverReindexMigration(actor: AppUser, migrationId: string): Promise<ReindexMigration> {
    const ledger = await this.loadReindexMigrationLedger()
    const migration = ledger.find((candidate) => candidate.migrationId === migrationId)
    if (!migration) throw new Error("Reindex migration not found")
    const actorTenantId = authoritativeActorTenantId(actor)
    const compensationStore = new ObjectStoreReindexPublicationCompensationRepair(this.deps.objectStore)
    let compensation = migration.publicationRunId
      ? await compensationStore.get(actorTenantId, migrationId, "cutover")
      : undefined
    if (migration.status !== "staged" && !(compensation && migration.status === "rolled_back")) {
      throw new Error(`Reindex migration is ${migration.status}`)
    }
    const source = await this.getManifest(migration.sourceDocumentId, actorTenantId)
    const authorizationManifest = compensation
      ? await this.currentReindexAuthorizationManifest(migration, actorTenantId)
      : source
    await this.assertDocumentManifestWritable(actor, authorizationManifest)
    const authorizeCutover = (boundary: WorkerAuthorizationBoundary) => this.assertCurrentWorkerAuthorization({
      runId: `reindex-cutover:${migrationId}`,
      targetType: "document_ingest_run",
      subject: actor.userId,
      tenantId: actor.tenantId,
      snapshotEmail: actor.email,
      snapshotGroups: actor.cognitoGroups,
      requiredPermissions: ["rag:index:rebuild:group"],
      authorizeResource: async (currentActor) => {
        await this.assertDocumentManifestWritable(currentActor, authorizationManifest)
        return true
      }
    }, boundary).then(() => undefined)
    await authorizeCutover("start")
    await authorizeCutover("protected_read")
    if (migration.publicationRunId) {
      if (compensation) {
        return this.reconcileRevokedCutover(
          migration,
          compensation,
          compensationStore
        )
      }
      await authorizeCutover("external_side_effect")
      await authorizeCutover("durable_commit")
      const committed = await new StagedPublicationCoordinator(this.deps).commit(
        migration.publicationRunId,
        `commit:${actor.userId}:${randomUUID()}`
      )
      const now = new Date().toISOString()
      migration.status = "cutover"
      migration.activeDocumentId = committed.manifest.documentId
      migration.cutoverAt = committed.pointer.committedAt
      migration.updatedAt = now
      migration.generation = committed.run.generation
      migration.fencingToken = committed.pointer.fencingToken
      migration.checkpoint = committed.run.checkpoint
      try {
        await authorizeCutover("durable_commit")
      } catch (error) {
        compensation = await compensationStore.prepare({
          action: "cutover",
          tenantId: actorTenantId,
          migrationId,
          publicationRunId: migration.publicationRunId,
          expectedMigrationStatus: "staged",
          preparedAt: new Date().toISOString()
        })
        try {
          const rolledBack = await new StagedPublicationCoordinator(this.deps).rollback(
            migration.publicationRunId,
            compensation.operationId
          )
          await compensationStore.markCompensated(
            compensation,
            reindexCompensationResult(rolledBack),
            new Date().toISOString()
          )
        } catch (compensationError) {
          await compensationStore.markFailed(compensation, compensationError, new Date().toISOString())
        }
        throw error
      }
      await this.saveReindexMigrationLedger([migration])
      return migration
    }
    const staged = await this.getManifest(migration.stagedDocumentId, authoritativeActorTenantId(actor))
    try {
      await authorizeCutover("external_side_effect")
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
    try {
      await authorizeCutover("durable_commit")
    } catch (error) {
      await this.restoreFailedCutoverState(source, staged)
      throw error
    }
    await this.saveReindexMigrationLedger([migration])
    return migration
  }

  async rollbackReindexMigration(actor: AppUser, migrationId: string): Promise<ReindexMigration> {
    const ledger = await this.loadReindexMigrationLedger()
    const migration = ledger.find((candidate) => candidate.migrationId === migrationId)
    if (!migration) throw new Error("Reindex migration not found")
    const actorTenantId = authoritativeActorTenantId(actor)
    const compensationStore = new ObjectStoreReindexPublicationCompensationRepair(this.deps.objectStore)
    let compensation = migration.publicationRunId
      ? await compensationStore.get(actorTenantId, migrationId, "rollback")
      : undefined
    if (migration.status !== "cutover" && !(compensation && migration.status === "rolled_back")) {
      throw new Error(`Reindex migration is ${migration.status}`)
    }
    const previous = JSON.parse(await this.deps.objectStore.getText(migration.previousManifestObjectKey)) as DocumentManifest
    // The previous generation is intentionally superseded after cutover and
    // therefore cannot be used as an authorization source. Reauthorize the
    // actor against the currently active generation before rollback.
    const staged = await this.getManifest(migration.stagedDocumentId, actorTenantId)
    await this.assertDocumentManifestWritable(actor, staged)
    const authorizePublicationRollback = (boundary: WorkerAuthorizationBoundary) => this.assertCurrentWorkerAuthorization({
      runId: `reindex-rollback:${migrationId}`,
      targetType: "document_ingest_run",
      subject: actor.userId,
      tenantId: actor.tenantId,
      snapshotEmail: actor.email,
      snapshotGroups: actor.cognitoGroups,
      requiredPermissions: ["rag:index:rebuild:group"],
      authorizeResource: async (currentActor) => {
        await this.assertDocumentManifestWritable(currentActor, staged)
        return true
      }
    }, boundary).then(() => undefined)
    await authorizePublicationRollback("start")
    await authorizePublicationRollback("protected_read")
    if (migration.publicationRunId) {
      if (compensation) {
        return this.reconcileRevokedRollback(
          migration,
          compensation,
          compensationStore
        )
      }
      await authorizePublicationRollback("external_side_effect")
      await authorizePublicationRollback("durable_commit")
      const rolledBack = await new StagedPublicationCoordinator(this.deps).rollback(
        migration.publicationRunId,
        `rollback:${actor.userId}:${randomUUID()}`
      )
      const now = new Date().toISOString()
      migration.status = "rolled_back"
      migration.activeDocumentId = rolledBack.manifest.documentId
      migration.rolledBackAt = rolledBack.pointer.committedAt
      migration.updatedAt = now
      migration.generation = rolledBack.run.generation
      migration.fencingToken = rolledBack.pointer.fencingToken
      migration.checkpoint = rolledBack.run.checkpoint
      try {
        await authorizePublicationRollback("durable_commit")
      } catch (error) {
        compensation = await compensationStore.prepare({
          action: "rollback",
          tenantId: actorTenantId,
          migrationId,
          publicationRunId: migration.publicationRunId,
          expectedMigrationStatus: "cutover",
          preparedAt: new Date().toISOString()
        })
        await compensationStore.markCompensated(
          compensation,
          reindexCompensationResult(rolledBack),
          new Date().toISOString()
        )
        throw error
      }
      await this.saveReindexMigrationLedger([migration])
      return migration
    }
    const rollbackOperationId = `reindex-rollback:${migrationId}:${randomUUID()}`
    const authorizeRollback = (boundary: WorkerAuthorizationBoundary) => this.assertCurrentWorkerAuthorization({
      runId: rollbackOperationId,
      targetType: "document_ingest_run",
      subject: actor.userId,
      tenantId: actor.tenantId,
      snapshotEmail: actor.email,
      snapshotGroups: actor.cognitoGroups,
      requiredPermissions: ["rag:index:rebuild:group"],
      authorizeResource: async (currentActor) => {
        await this.assertDocumentManifestWritable(currentActor, staged)
        return true
      }
    }, boundary).then(() => undefined)
    await authorizeRollback("start")
    await authorizeRollback("protected_read")
    const text = await this.deps.objectStore.getText(previous.sourceObjectKey)
    const structuredBlocks = await this.loadStructuredBlocks(previous)
    await authorizeRollback("external_side_effect")
    await this.deps.evidenceVectorStore.delete(staged.evidenceVectorKeys ?? staged.vectorKeys)
    await this.deps.memoryVectorStore.delete(staged.memoryVectorKeys ?? staged.vectorKeys)
    await this.markManifestLifecycle(staged, "superseded")
    const admissionContext = restoredAdmissionContext(previous, migrationId)
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
      admissionContext,
      embeddingModelId: previous.embeddingModelId,
      currentAuthorization: {
        authorizeExternalSideEffect: () => authorizeRollback("external_side_effect"),
        authorizeDurableCommit: () => authorizeRollback("durable_commit")
      }
    })
    const now = new Date().toISOString()
    migration.status = "rolled_back"
    migration.activeDocumentId = restored.documentId
    migration.rolledBackAt = now
    migration.updatedAt = now
    await this.saveReindexMigrationLedger([migration])
    return migration
  }

  async listReindexMigrations(): Promise<ReindexMigration[]> {
    return (await this.loadReindexMigrationLedger()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async listDocuments(user?: AppUser): Promise<DocumentManifest[]> {
    const tenantId = this.documentAccessTenantId(user)
    const keys = await this.deps.objectStore.listKeys(tenantManifestPrefix(this.deps, tenantId))
    const manifests = await Promise.all(
      keys
        .filter((key) => key.endsWith(".json"))
        .map(async (key) => readTenantManifestByKey(this.deps, tenantId, key).catch((error: unknown) => {
          if (isMissingObjectError(error)) {
            console.warn("Skipping missing document manifest listed by object store", { key, error })
            return undefined
          }
          throw error
        }))
    )
    const presentManifests = manifests.filter((manifest): manifest is DocumentManifest => manifest !== undefined)
    const publicationSnapshot = createPublicationPointerSnapshot()
    const currentPublication = await Promise.all(presentManifests.map((manifest) => isManifestCurrentPublication(this.deps, manifest, publicationSnapshot)))
    const activeManifests = presentManifests
      .filter((_, index) => currentPublication[index])
      .filter((manifest) => (manifest.lifecycleStatus ?? stringValue(manifest.metadata?.lifecycleStatus) ?? "active") === "active")
      .filter((manifest) => stringValue(manifest.metadata?.scopeType) !== "chat")
    const accessible = user
      ? await Promise.all(activeManifests.map(async (manifest) => [manifest, await this.canAccessDocumentManifest(user, manifest)] as const))
      : activeManifests.map((manifest) => [manifest, true] as const)
    const permissionService = user ? new DocumentPermissionService(this.deps) : undefined
    const withCapabilities = await Promise.all(accessible
      .filter(([, allowed]) => allowed)
      .map(([manifest]) => manifest)
      .map(async (manifest) => {
        if (!user || !permissionService) return manifest
        const permission = await permissionService.resolveEffectiveDocumentPermission(user, manifest)
        const sanitized = await this.sanitizeDirectSharedManifestForList(user, manifest)
        return {
          ...sanitized,
          currentUserEffectivePermission: permission,
          capabilities: documentCapabilities(permission, user)
        }
      }))
    return withCapabilities
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async getDocumentManifest(documentId: string, actor?: AppUser): Promise<DocumentManifest> {
    return this.getManifest(documentId, this.documentAccessTenantId(actor))
  }

  async getBenchmarkDocumentManifest(documentId: string): Promise<DocumentManifest> {
    const tenantId = config.benchmarkEvaluationTenantId.trim()
    if (!tenantId) throw new Error("Benchmark evaluation tenant is not configured")
    return this.getManifest(documentId, tenantId)
  }

  async listBenchmarkDocumentManifests(): Promise<DocumentManifest[]> {
    const tenantId = config.benchmarkEvaluationTenantId.trim()
    if (!config.benchmarkEvaluationEnabled || !tenantId) {
      throw new Error("Benchmark evaluation tenant is not configured")
    }
    const keys = await this.deps.objectStore.listKeys(tenantManifestPrefix(this.deps, tenantId))
    const manifests = await Promise.all(keys
      .filter((key) => key.endsWith(".json"))
      .map((key) => readTenantManifestByKey(this.deps, tenantId, key).catch((error: unknown) => {
        if (isMissingObjectError(error)) return undefined
        throw error
      })))
    // Benchmark corpus management must be able to discover and delete an active
    // seed even before source-governance publication. Search eligibility still
    // enforces the current publication pointer independently.
    return manifests
      .filter((manifest): manifest is DocumentManifest => manifest !== undefined)
      .filter((manifest) => (manifest.lifecycleStatus ?? stringValue(manifest.metadata?.lifecycleStatus) ?? "active") === "active")
      .filter((manifest) => stringValue(manifest.metadata?.scopeType) !== "chat")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async assertDocumentWritable(actor: AppUser, documentId: string): Promise<DocumentManifest> {
    const manifest = await this.getManifest(documentId, authoritativeActorTenantId(actor))
    await this.assertDocumentManifestWritable(actor, manifest)
    return manifest
  }

  async getParsedDocumentPreview(user: AppUser, documentId: string): Promise<ParsedDocumentPreview | undefined> {
    const manifest = await this.getManifest(documentId, authoritativeActorTenantId(user)).catch((error: unknown) => {
      if (isMissingObjectError(error)) return undefined
      throw error
    })
    if (!manifest) return undefined
    if (!(await this.canAccessDocumentManifest(user, manifest))) throw forbiddenError("Forbidden")
    return buildParsedDocumentPreview(manifest)
  }

  async getDocumentExtractedText(
    user: AppUser,
    documentId: string
  ): Promise<{ text: string; fileName: string } | undefined> {
    const manifest = await this.getManifest(documentId, authoritativeActorTenantId(user)).catch((error: unknown) => {
      if (isMissingObjectError(error)) return undefined
      throw error
    })
    if (!manifest) return undefined
    const publicationSnapshot = createPublicationPointerSnapshot()
    if (!(await isManifestCurrentPublication(this.deps, manifest, publicationSnapshot))) return undefined
    if ((manifest.lifecycleStatus ?? stringValue(manifest.metadata?.lifecycleStatus) ?? "active") !== "active") return undefined
    const permissionService = new DocumentPermissionService(this.deps)
    const permission = await permissionService.resolveEffectiveDocumentPermission(user, manifest)
    if (permission !== "readOnly" && permission !== "full") return undefined
    try {
      await permissionService.assertDocumentOperation(user, manifest, "read", ["responseAllowlistApplied"])
    } catch (error) {
      if (error instanceof ResourceOperationAuthorizationError) return undefined
      throw error
    }
    return {
      text: await this.deps.objectStore.getText(manifest.sourceObjectKey),
      fileName: manifest.fileName
    }
  }

  async listDocumentGroups(user: AppUser): Promise<DocumentGroup[]> {
    const groups = normalizeDocumentGroups(await this.deps.documentGroupStore.list(authoritativeActorTenantId(user)))
    const permissions = new FolderPermissionService(this.deps)
    const resolved = await Promise.all(groups.map(async (group) => {
        const detail = await permissions.resolveEffectiveFolderPermissionDetail(user, group.groupId)
        if (detail.permission !== "none") {
          try {
            await permissions.assertFolderOperation(user, group.groupId, "read", ["responseAllowlistApplied"])
          } catch (error) {
            if (error instanceof ResourceOperationAuthorizationError) {
              return { ...group, effectivePermission: "none" as const, policySource: "none" as const }
            }
            throw error
          }
        }
        return {
          ...group,
          effectivePermission: detail.permission,
          policySource: detail.policySource,
          inheritedFromFolderId: detail.inheritedFromFolderId
        }
      }))
    return resolved
      .filter((group) => group.effectivePermission !== "none")
      .sort((a, b) => (a.normalizedCanonicalPath ?? a.name).localeCompare(b.normalizedCanonicalPath ?? b.name))
  }

  async createDocumentGroup(actor: AppUser, input: {
    name: string
    description?: string
    parentGroupId?: string
  }): Promise<DocumentGroup> {
    const now = new Date().toISOString()
    const name = validateDocumentGroupName(input.name)
    const tenantId = actor.tenantId?.trim()
    const actorUserId = actor.userId.trim()
    if (!tenantId) throw forbiddenError("Forbidden: authoritative tenant is required")
    if (!actorUserId) throw forbiddenError("Forbidden: authoritative actor is required")
    const groups = normalizeDocumentGroups(await this.deps.documentGroupStore.list(tenantId))
    const parent = input.parentGroupId ? groups.find((group) => group.groupId === input.parentGroupId) : undefined
    if (input.parentGroupId && !parent) throw new Error("Parent document group not found")
    if (parent && parent.tenantId !== tenantId) {
      throw forbiddenError("Forbidden: parent document group belongs to another tenant")
    }
    if (parent && (await new FolderPermissionService(this.deps).resolveEffectiveFolderPermission(actor, parent.groupId)) !== "full") {
      throw forbiddenError("Forbidden: cannot create a child group under this parent")
    }
    enforceResolvedResourceOperation(actor, {
      resourceType: "folder",
      operation: "create",
      authorizationPath: parent ? "parentFolder" : "tenantRoot",
      resourceScopes: parent
        ? { destinationContainer: resolvedResourceScope({ tenantId, permission: "full", administrativePrincipal: parent.adminPrincipalType === "user" && parent.adminPrincipalId === actor.userId }) }
        : { tenantCreateScope: resolvedResourceScope({ tenantId, permission: "full" }) },
      satisfiedGuards: ["sameTenantPath", "nonCyclicPath", "canonicalNameConfirmed"]
    })
    const pathFields = documentGroupPathFields({
      tenantId,
      adminPrincipalType: "user",
      adminPrincipalId: actorUserId,
      parent,
      name
    })
    if (groups.some((group) => group.adminPathPk === pathFields.adminPathPk && group.normalizedCanonicalPath === pathFields.normalizedCanonicalPath)) {
      throw new Error("Document group canonical path already exists")
    }
    const group: DocumentGroup = {
      groupId: `docgrp_${randomUUID().slice(0, 12)}`,
      schemaVersion: 2,
      itemType: "documentGroup",
      tenantId,
      adminPrincipalType: "user",
      adminPrincipalId: actorUserId,
      name,
      ...pathFields,
      description: input.description?.trim() || undefined,
      parentGroupId: parent?.groupId,
      ancestorGroupIds: parent ? [...(parent.ancestorGroupIds ?? []), parent.groupId] : [],
      ownerUserId: actorUserId,
      visibility: "private",
      sharedUserIds: [],
      sharedGroups: [],
      managerUserIds: [actorUserId],
      status: "active",
      createdBy: actorUserId,
      createdAt: now,
      updatedAt: now
    }
    return this.deps.documentGroupStore.createWithPathLock(group)
  }

  async updateDocumentGroupSharing(actor: AppUser, groupId: string, input: {
    name?: string
    description?: string
  }): Promise<DocumentGroup | undefined> {
    const groups = normalizeDocumentGroups(await this.deps.documentGroupStore.list(authoritativeActorTenantId(actor)))
    const group = groups.find((item) => item.groupId === groupId)
    if (!group) return undefined
    const folderPermissions = new FolderPermissionService(this.deps)
    if ((await folderPermissions.resolveEffectiveFolderPermission(actor, group.groupId)) !== "full") {
      throw forbiddenError("Forbidden: only group managers can update sharing")
    }
    await folderPermissions.assertFolderOperation(actor, group.groupId, "update", ["expectedVersionMatched"])
    const update: Partial<DocumentGroup> = {}
    let targetName = group.name
    if (input.name !== undefined) {
      targetName = validateDocumentGroupName(input.name)
      update.name = targetName
      update.normalizedName = normalizeDocumentGroupName(targetName)
    }
    if (input.description !== undefined) update.description = input.description.trim() || undefined
    const parent = group.parentGroupId ? groups.find((item) => item.groupId === group.parentGroupId) : undefined
    const now = new Date().toISOString()
    if (input.name !== undefined) {
      const pathUpdates = buildDocumentGroupPathUpdates(groups, group, { ...update, name: targetName, updatedAt: now }, parent)
      if (pathUpdates.length > maxDocumentGroupPathTransactionItems) throw new Error("Document group subtree is too large for synchronous path update")
      for (const next of pathUpdates.map((updateItem) => updateItem.next)) {
        const conflict = groups.find((candidate) => (
          candidate.groupId !== next.groupId &&
          !pathUpdates.some((updateItem) => updateItem.current.groupId === candidate.groupId) &&
          candidate.adminPathPk === next.adminPathPk &&
          candidate.normalizedCanonicalPath === next.normalizedCanonicalPath
        ))
        if (conflict) throw new Error("Document group canonical path already exists")
      }
      const updated = await this.deps.documentGroupStore.updateWithPathLocks(group.tenantId, pathUpdates)
      return updated.find((item) => item.groupId === groupId)
    }
    const [updated] = await this.deps.documentGroupStore.updateWithPathLocks(group.tenantId, [{
      current: group,
      next: { ...group, ...update, updatedAt: now }
    }])
    return updated
  }

  async assertDocumentGroupsWritable(actor: AppUser, groupIds: string[]): Promise<void> {
    if (groupIds.length === 0) return
    const folderPermissions = new FolderPermissionService(this.deps)
    for (const groupId of groupIds) {
      if ((await folderPermissions.resolveEffectiveFolderPermission(actor, groupId)) !== "full") {
        throw forbiddenError(`Forbidden: cannot write document group ${groupId}`)
      }
    }
  }

  private async assertDocumentManifestWritable(actor: AppUser, manifest: DocumentManifest): Promise<void> {
    const permissions = new DocumentPermissionService(this.deps)
    if (!(await this.canManageDocumentManifest(actor, manifest))) {
      throw forbiddenError(`Forbidden: cannot manage document ${manifest.documentId}`)
    }
    try {
      await permissions.assertDocumentOperation(actor, manifest, "update", ["serverManagedFieldsProtected"])
    } catch (error) {
      if (error instanceof ResourceOperationAuthorizationError) throw forbiddenError(`Forbidden: cannot manage document ${manifest.documentId}`)
      throw error
    }
  }

  async getDocumentShareInfo(actor: AppUser, documentId: string) {
    const manifest = await this.getManifest(documentId, authoritativeActorTenantId(actor))
    const permissionService = new DocumentPermissionService(this.deps)
    const effectivePermission = await permissionService.resolveEffectiveDocumentPermission(actor, manifest)
    if (!canShareDocument(effectivePermission, actor)) throw forbiddenError("Forbidden")
    const [shareInfo, policy] = await Promise.all([
      permissionService.getShareInfo(actor, manifest),
      permissionService.getVersionedDocumentSharePolicy(manifest)
    ])
    return {
      ...shareInfo,
      directDocumentGrants: [...policy.grants],
      version: policy.version
    }
  }

  async updateDocumentShare(actor: AppUser, documentId: string, input: {
    grants: DocumentShareGrantInput[]
    expectedVersion: string
    reason: string
  }) {
    const manifest = await this.getManifest(documentId, authoritativeActorTenantId(actor))
    const permissionService = new DocumentPermissionService(this.deps)
    const effectivePermission = await permissionService.resolveEffectiveDocumentPermission(actor, manifest)
    if (!canShareDocument(effectivePermission, actor)) throw forbiddenError("Forbidden")
    const policy = await permissionService.replaceVersionedDocumentSharePolicy(actor, manifest, input)
    const shareInfo = await permissionService.getShareInfo(actor, manifest)
    return {
      ...shareInfo,
      directDocumentGrants: [...policy.grants],
      version: policy.version
    }
  }

  async moveDocument(actor: AppUser, documentId: string, input: {
    destinationFolderId: string
    newTitle?: string
    reason: string
    expectedUpdatedAt?: string
  }): Promise<{
    document: DocumentManifest
    before: { folderIds: string[]; fileName: string }
    after: { folderIds: string[]; fileName: string }
    directDocumentGrantsPreserved: boolean
  }> {
    return new DocumentLifecycleMutationCoordinator(this.deps).moveDocument(actor, documentId, input)
  }

  async moveDocumentGroup(actor: AppUser, groupId: string, input: MoveFolderInput): Promise<MoveFolderResult> {
    return new FolderLifecycleMutationCoordinator(this.deps).moveFolder(actor, groupId, input)
  }

  private async canAccessDocumentManifest(actor: AppUser, manifest: DocumentManifest): Promise<boolean> {
    const permissions = new DocumentPermissionService(this.deps)
    const permission = await permissions.resolveEffectiveDocumentPermission(actor, manifest)
    if (permission !== "readOnly" && permission !== "full") return false
    try {
      await permissions.assertDocumentOperation(actor, manifest, "read", ["responseAllowlistApplied"])
      return true
    } catch (error) {
      if (error instanceof ResourceOperationAuthorizationError) return false
      throw error
    }
  }

  private async canManageDocumentManifest(actor: AppUser, manifest: DocumentManifest): Promise<boolean> {
    const permission = await new DocumentPermissionService(this.deps).resolveEffectiveDocumentPermission(actor, manifest)
    return permission === "full"
  }

  private async sanitizeDirectSharedManifestForList(actor: AppUser, manifest: DocumentManifest): Promise<DocumentManifest> {
    const folderIds = stringArray(
      manifest.metadata?.folderIds ?? manifest.metadata?.folderId ?? manifest.metadata?.groupIds ?? manifest.metadata?.groupId
    ) ?? []
    const folderPermissions = await new FolderPermissionService(this.deps).resolveEffectiveFolderPermissions(actor, folderIds)
    if (folderIds.some((folderId) => folderPermissions[folderId] === "readOnly" || folderPermissions[folderId] === "full")) return manifest
    const metadata = { ...(manifest.metadata ?? {}) }
    delete metadata.groupId
    delete metadata.groupIds
    delete metadata.folderId
    delete metadata.folderIds
    metadata.folderLabel = "共有文書"
    return { ...manifest, metadata }
  }

  async assertSearchScopeReadable(actor: AppUser, scope: ChatInput["searchScope"]): Promise<void> {
    if (!scope?.groupIds?.length) return
    const permissions = new FolderPermissionService(this.deps)
    for (const groupId of scope.groupIds) {
      const permission = await permissions.resolveEffectiveFolderPermission(actor, groupId)
      if (permission !== "readOnly" && permission !== "full") throw forbiddenError(`Forbidden: cannot read document group ${groupId}`)
    }
  }

  private async securityResourceRefsForActor(actor: AppUser, scope?: ChatInput["searchScope"]): Promise<string[]> {
    const tenantId = authoritativeActorTenantId(actor)
    const refs = new Set<string>([
      securityResourceReference(tenantId, "account", actor.userId),
      ...(scope?.groupIds ?? []).map((folderId) => securityResourceReference(tenantId, "folder", folderId)),
      ...(scope?.documentIds ?? []).map((documentId) => securityResourceReference(tenantId, "document", documentId))
    ])
    const queue = (await this.deps.groupMembershipStore.listByMember(tenantId, "user", actor.userId))
      .map((membership) => membership.groupId)
    const visited = new Set<string>()
    while (queue.length > 0) {
      const groupId = queue.shift()!
      if (visited.has(groupId)) continue
      visited.add(groupId)
      refs.add(securityResourceReference(tenantId, "resource_group", groupId))
      const parents = await this.deps.groupMembershipStore.listByMember(tenantId, "group", groupId)
      for (const membership of parents) {
        if (membership.tenantId !== tenantId || membership.memberId !== groupId) {
          throw new Error("Run admission resource-group identity crossed its tenant boundary")
        }
        queue.push(membership.groupId)
      }
    }
    return [...refs].sort()
  }

  private async refreshDescendantDocumentGroupAncestors(root: DocumentGroup): Promise<void> {
    const groups = normalizeDocumentGroups(await this.deps.documentGroupStore.list(root.tenantId))
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
      const updated = await this.deps.documentGroupStore.update(root.tenantId, next.group.groupId, {
        ancestorGroupIds: next.ancestorGroupIds,
        updatedAt: new Date().toISOString()
      })
      for (const child of byParent.get(updated.groupId) ?? []) {
        queue.push({ group: child, ancestorGroupIds: [...next.ancestorGroupIds, updated.groupId] })
      }
    }
  }

  async deleteDocument(
    actor: AppUser,
    documentId: string,
    input: { reason: string; expectedUpdatedAt: string },
    attribution?: { auditActorId: string }
  ): Promise<{ documentId: string; deletedVectorCount: number }> {
    const result = await new DocumentLifecycleMutationCoordinator(this.deps).deleteDocument(actor, documentId, input, attribution)
    return { documentId: result.documentId, deletedVectorCount: result.deletedVectorCount }
  }

  listAccessRoles(): AccessRoleDefinition[] {
    return Object.entries(rolePermissions)
      .map(([role, permissions]) => ({ role, permissions: [...permissions] }))
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

  async createSearchImprovementCandidate(actor: AppUser, questionId: string, input: SearchImprovementCandidateInput): Promise<AliasDefinition | undefined> {
    const question = await this.getQuestion(questionId)
    if (!question) return undefined
    const ledger = await this.loadAliasLedger()
    const now = new Date().toISOString()
    const alias: AliasDefinition = {
      aliasId: `alias_${randomUUID().slice(0, 12)}`,
      term: normalizeAliasTerm(input.term),
      expansions: normalizeAliasExpansions(input.expansions),
      scope: normalizeAliasScope(input.scope),
      status: "draft",
      searchImprovement: {
        candidateSource: input.candidateSource ?? "support_ticket",
        sourceQuestionId: question.questionId,
        sourceMessageId: question.messageId,
        sourceRagRunId: question.ragRunId ?? question.chatRunId,
        suggestionReason: trimOptional(input.suggestionReason),
        reviewState: "pending_review",
        reviewReason: trimOptional(input.reviewReason),
        impactSummary: trimOptional(input.impactSummary),
        searchResultDiffSummary: trimOptional(input.searchResultDiffSummary),
        beforeResultIds: normalizeStringList(input.beforeResultIds, 50),
        afterResultIds: normalizeStringList(input.afterResultIds, 50)
      },
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now
    }
    ledger.aliases.push(alias)
    appendAliasAudit(ledger, actor, "create", alias.aliasId, `created search improvement candidate ${alias.term} from ${question.questionId}`)
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
    if (alias.searchImprovement) alias.searchImprovement.reviewState = "reviewed"
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
      if (alias.status === "approved") {
        alias.publishedVersion = version
        if (alias.searchImprovement) alias.searchImprovement.reviewState = "published"
      }
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

  async getManagedUserDeletionPreflight(actor: AppUser, userId: string): Promise<ManagedUserDeletionPreflight | undefined> {
    const db = await this.loadAdminLedger(actor, { syncUserDirectory: true })
    const target = db.users.find((candidate) => candidate.userId === userId && candidate.status !== "deleted")
    if (!target) return undefined

    const transferService = new AdministrativePrincipalTransferService(this.deps)
    if (this.deps.verifiedIdentityProvider && this.deps.userDirectory) {
      const [currentActor, currentTarget] = await Promise.all([
        this.deps.verifiedIdentityProvider.getCurrentIdentityBySubject(actor.userId),
        this.deps.verifiedIdentityProvider.getCurrentIdentityBySubject(userId)
      ])
      if (
        !currentActor ||
        !currentTarget ||
        currentActor.accountStatus !== "active" ||
        currentActor.tenantId !== currentTarget.tenantId ||
        actor.tenantId !== currentActor.tenantId ||
        currentActor.userId === currentTarget.userId
      ) throw forbiddenError("Forbidden")

      const currentActorUser: AppUser = {
        userId: currentActor.userId,
        identityUsername: currentActor.username,
        email: currentActor.email,
        cognitoGroups: [...currentActor.cognitoGroups],
        accountStatus: currentActor.accountStatus,
        tenantId: currentActor.tenantId
      }
      const ownedResources = await transferService.inspectBeforePermanentDelete({
        actor: currentActorUser,
        sourceUserId: currentTarget.userId,
        tenantId: currentTarget.tenantId
      })
      const eligibleSuccessors = ownedResources.total === 0
        ? []
        : (await Promise.all(db.users
          .filter((candidate) => candidate.userId !== currentTarget.userId && candidate.status !== "deleted")
          .map(async (candidate) => ({
            candidate,
            identity: await this.deps.verifiedIdentityProvider?.getCurrentIdentityBySubject(candidate.userId)
          }))))
          .filter(({ identity }) =>
            identity?.accountStatus === "active" &&
            identity.tenantId === currentTarget.tenantId &&
            identity.userId !== currentTarget.userId &&
            identity.userId.length > 0 &&
            identity.userId.trim() === identity.userId
          )
          .map(({ candidate, identity }) => ({
            userId: identity!.userId,
            email: identity!.email ?? candidate.email,
            displayName: candidate.displayName,
            status: "active" as const
          }))
          .filter((candidate, index, candidates) => candidates.findIndex((entry) => entry.userId === candidate.userId) === index)
          .sort((left, right) => left.email.localeCompare(right.email))
      return {
        targetUserId: currentTarget.userId,
        requiresSuccessor: ownedResources.total > 0,
        ownedResources,
        eligibleSuccessors
      }
    }

    if (config.authEnabled) throw new Error("Authoritative account deletion preflight is not configured")
    const tenantId = actor.tenantId ?? defaultTenantId
    const ownedResources = await transferService.inspectBeforePermanentDelete({
      actor: { ...actor, tenantId, accountStatus: actor.accountStatus ?? "active" },
      sourceUserId: target.userId,
      tenantId
    })
    return {
      targetUserId: target.userId,
      requiresSuccessor: ownedResources.total > 0,
      ownedResources,
      eligibleSuccessors: ownedResources.total === 0
        ? []
        : db.users
          .filter((candidate) => candidate.userId !== target.userId && candidate.status === "active")
          .map((candidate) => ({
            userId: candidate.userId,
            email: candidate.email,
            displayName: candidate.displayName,
            status: "active" as const
          }))
          .sort((left, right) => left.email.localeCompare(right.email))
    }
  }

  async transferManagedUserAdministrativePrincipal(
    actor: AppUser,
    sourceUserId: string,
    input: { successorUserId: string; reason: string }
  ) {
    if (!input.reason.trim() || input.reason.trim() !== input.reason) {
      throw new Error("Transfer reason is required and must be canonical")
    }
    const preflight = await this.getManagedUserDeletionPreflight(actor, sourceUserId)
    if (!preflight) return undefined
    const candidate = preflight.eligibleSuccessors.find((item) => item.userId === input.successorUserId)

    let tenantId = actor.tenantId ?? defaultTenantId
    let successor = {
      userId: input.successorUserId,
      tenantId,
      status: candidate ? "active" as const : "suspended" as const
    }
    let currentActor = actor
    if (this.deps.verifiedIdentityProvider) {
      const [actorIdentity, sourceIdentity, successorIdentity] = await Promise.all([
        this.deps.verifiedIdentityProvider.getCurrentIdentityBySubject(actor.userId),
        this.deps.verifiedIdentityProvider.getCurrentIdentityBySubject(sourceUserId),
        this.deps.verifiedIdentityProvider.getCurrentIdentityBySubject(input.successorUserId)
      ])
      if (
        !actorIdentity || !sourceIdentity
        || actorIdentity.accountStatus !== "active"
        || actorIdentity.tenantId !== sourceIdentity.tenantId
        || actor.tenantId !== actorIdentity.tenantId
      ) throw forbiddenError("Forbidden")
      tenantId = sourceIdentity.tenantId
      currentActor = {
        userId: actorIdentity.userId,
        identityUsername: actorIdentity.username,
        email: actorIdentity.email,
        cognitoGroups: [...actorIdentity.cognitoGroups],
        accountStatus: actorIdentity.accountStatus,
        tenantId: actorIdentity.tenantId
      }
      successor = {
        userId: input.successorUserId,
        tenantId,
        status: candidate
          && successorIdentity?.userId === input.successorUserId
          && successorIdentity.accountStatus === "active"
          && successorIdentity.tenantId === tenantId
          ? "active"
          : "suspended"
      }
    }

    const transfer = new AdministrativePrincipalTransferService(this.deps)
    const request = {
      actor: currentActor,
      sourceUserId,
      tenantId,
      successor,
      reason: input.reason
    }
    if (successor.status !== "active") {
      try {
        await transfer.transferBeforeAdministrativePrincipalChange(request)
      } catch (error) {
        if (!(error instanceof AdministrativePrincipalTransferError)) throw error
      }
      throw forbiddenError("Forbidden")
    }
    return transfer.transferBeforeAdministrativePrincipalChange(request)
  }

  async createManagedUser(actor: AppUser, input: CreateManagedUserInput): Promise<ManagedUser> {
    const now = new Date().toISOString()
    const email = input.email.trim().toLowerCase()
    const username = createManagedUserId(email)
    const displayName = input.displayName?.trim() || email.split("@")[0] || "user"
    const groups = normalizeRoles(input.groups ?? ["CHAT_USER"])
    if (groups.length === 0) groups.push("CHAT_USER")

    if (this.deps.verifiedIdentityProvider && this.deps.userDirectory) {
      const outbox = this.deps.securityAuditOutbox ?? new ObjectStoreSecurityMutationAuditOutbox(this.deps.objectStore)
      let currentActor
      try {
        currentActor = await this.deps.verifiedIdentityProvider.getCurrentIdentityBySubject(actor.userId)
      } catch (error) {
        const tenantId = actor.tenantId?.trim()
        if (!tenantId) throw error
        const unavailableIntent = await outbox.prepare({
          actorId: actor.userId,
          tenantId,
          targetType: "account",
          targetId: username,
          operation: "account.create",
          before: null,
          proposedAfter: { accountStatus: "active", email, groups },
          reason: "Administrative account creation",
          policyVersion: "account-lifecycle-mutation-v1"
        })
        await outbox.complete(unavailableIntent.intentId, tenantId, "failed", { accountStatus: "not_created" })
        throw error
      }
      const tenantId = currentActor?.tenantId ?? actor.tenantId?.trim()
      if (!tenantId) throw forbiddenError("Forbidden")
      const intent = await outbox.prepare({
        actorId: currentActor?.userId ?? actor.userId,
        tenantId,
        targetType: "account",
        targetId: username,
        operation: "account.create",
        before: null,
        proposedAfter: { accountStatus: "active", email, groups },
        reason: "Administrative account creation",
        policyVersion: "account-lifecycle-mutation-v1"
      })
      let created: CreatedDirectoryUser | undefined
      let db: AdminLedger | undefined
      let ledgerCommitted = false
      try {
        const currentActorUser: AppUser | undefined = currentActor && {
          userId: currentActor.userId,
          identityUsername: currentActor.username,
          email: currentActor.email,
          cognitoGroups: [...currentActor.cognitoGroups],
          accountStatus: currentActor.accountStatus,
          tenantId: currentActor.tenantId
        }
        if (
          !currentActorUser
          || currentActorUser.accountStatus !== "active"
          || currentActorUser.tenantId !== actor.tenantId
          || !hasPermission(currentActorUser, "user:create")
        ) throw forbiddenError("Forbidden")
        if (!this.deps.userDirectory.createUser || !this.deps.userDirectory.setUserGroups || !this.deps.userDirectory.deleteUser) {
          throw new Error("Authoritative account creation is not configured")
        }
        db = await this.loadAdminLedger(currentActorUser, { syncUserDirectory: true })
        if (db.users.some((user) => user.userId === username || user.email.toLowerCase() === email)) {
          throw new Error("Managed user already exists")
        }
        created = await this.deps.userDirectory.createUser({ username, email, displayName })
        if (created.status !== "active") throw new Error("Authoritative identity was not created active")
        await this.deps.userDirectory.setUserGroups(created.username, groups)
        const user: ManagedUser = {
          userId: created.userId,
          email: created.email,
          displayName: created.displayName,
          status: "active",
          groups: [...groups],
          createdAt: created.createdAt,
          updatedAt: created.updatedAt
        }
        db.users.push(user)
        db.usage[user.userId] = {
          chatMessages: 0,
          conversationCount: 0,
          questionCount: 0,
          benchmarkRunCount: 0,
          debugRunCount: 0
        }
        this.appendAdminAuditLog(db, currentActorUser, user, "user:create", undefined, user.status, [], user.groups, now)
        await this.saveAdminLedger(db)
        ledgerCommitted = true
        await outbox.complete(intent.intentId, tenantId, "success", {
          accountStatus: "active",
          userId: user.userId,
          groups: user.groups
        })
        return user
      } catch (error) {
        if (created) {
          await this.compensateCreatedDirectoryUser(created.username)
          if (ledgerCommitted && db) {
            db.users.splice(0, db.users.length, ...db.users.filter((candidate) => candidate.userId !== created!.userId))
            delete db.usage[created.userId]
            await this.saveAdminLedger(db).catch(() => undefined)
          }
        }
        const result = (error as Error & { status?: number }).status === 403
          ? "denied"
          : error instanceof Error && (error.message.includes("already exists") || error.name === "UsernameExistsException")
            ? "conflict"
            : "failed"
        await outbox.complete(intent.intentId, tenantId, result, {
          accountStatus: "not_created",
          reconciliationRequired: Boolean(created)
        })
        throw error
      }
    }

    if (config.authEnabled) throw new Error("Authoritative account creation is not configured")
    const db = await this.loadAdminLedger(actor, { syncUserDirectory: true })
    const existing = db.users.find((user) => user.userId === username || user.email.toLowerCase() === email)
    if (existing) throw new Error("Managed user already exists")
    const user: ManagedUser = {
      userId: username,
      email,
      displayName,
      status: "active",
      groups,
      createdAt: now,
      updatedAt: now
    }
    db.users.push(user)
    this.appendAdminAuditLog(db, actor, user, "user:create", undefined, user.status, [], user.groups, now)
    await this.saveAdminLedger(db)
    return user
  }

  async listAdminAuditLog(actor: AppUser): Promise<ManagedUserAuditLogEntry[]> {
    const db = await this.loadAdminLedger(actor)
    return [...(db.auditLog ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100)
  }

  async assignUserRoles(actor: AppUser, userId: string, groups: string[], reason?: string): Promise<ManagedUser | undefined> {
    const normalizedGroups = normalizeRoles(groups)
    const db = await this.loadAdminLedger(actor, { syncUserDirectory: true })
    const user = db.users.find((candidate) => candidate.userId === userId && candidate.status !== "deleted")
    if (!user) return undefined
    const beforeGroups = [...user.groups]

    if (this.deps.verifiedIdentityProvider && this.deps.userDirectory) {
      let committed: ManagedUser | undefined
      const mutation = new ApplicationRoleMutationService({
        identityProvider: this.deps.verifiedIdentityProvider,
        userDirectory: this.deps.userDirectory,
        objectStore: this.deps.objectStore,
        auditOutbox: new ObjectStoreSecurityMutationAuditOutbox(this.deps.objectStore),
        cleanupCoordinator: new ObjectStoreRevocationCleanupCoordinator(this.deps.objectStore)
      })
      await mutation.replaceRoles({
        actor,
        targetUserId: userId,
        roles: groups,
        reason: reason ?? "",
        commitManagedState: async ({ target, afterRoles }) => {
          user.email = target.email ?? user.email
          user.groups = [...afterRoles]
          user.updatedAt = new Date().toISOString()
          this.appendAdminAuditLog(db, actor, user, "role:assign", user.status, user.status, beforeGroups, user.groups, user.updatedAt)
          await this.saveAdminLedger(db)
          committed = user
        }
      })
      return committed
    }

    if (config.authEnabled) throw new Error("Authoritative role mutation is not configured")
    if (actor.userId === userId) throw forbiddenError("Forbidden")
    if (normalizedGroups.includes("SYSTEM_ADMIN") && !actor.cognitoGroups.includes("SYSTEM_ADMIN")) throw forbiddenError("Forbidden")
    if (
      beforeGroups.includes("SYSTEM_ADMIN") &&
      !normalizedGroups.includes("SYSTEM_ADMIN") &&
      !db.users.some((candidate) => candidate.userId !== userId && candidate.status === "active" && candidate.groups.includes("SYSTEM_ADMIN"))
    ) throw forbiddenError("Forbidden")
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

  async deleteManagedUser(actor: AppUser, userId: string, input: { successorUserId?: string } = {}): Promise<ManagedUser | undefined> {
    return this.updateManagedUserStatus(actor, userId, "deleted", input)
  }

  async listUsageSummaries(actor: AppUser): Promise<UserUsageSummary[]> {
    const db = await this.loadAdminLedger(actor, { syncUserDirectory: true })
    const tenantId = authoritativeActorTenantId(actor)
    const manifestKeys = await this.deps.objectStore.listKeys(tenantManifestPrefix(this.deps, tenantId))
    const manifests = (await Promise.all(manifestKeys
      .filter((key) => key.endsWith(".json"))
      .map((key) => readTenantManifestByKey(this.deps, tenantId, key).catch(() => undefined))))
      .filter((manifest): manifest is DocumentManifest => Boolean(manifest))
    const benchmarkRuns = await this.deps.benchmarkRunStore.list(tenantId)

    return db.users
      .filter((user) => user.status !== "deleted")
      .map((user) => {
        const userDocuments = manifests.filter((manifest) => (
          manifest.admission?.ownerUserId === user.userId
          || stringValue(manifest.metadata?.ownerUserId) === user.userId
        ))
        const userBenchmarkRuns = benchmarkRuns.filter((run) => run.createdBy === user.userId)
        const lastActivityAt = [
          ...userDocuments.map((manifest) => manifest.updatedAt ?? manifest.createdAt),
          ...userBenchmarkRuns.map((run) => run.updatedAt)
        ].filter(Boolean).sort().at(-1)
        return {
          userId: user.userId,
          email: user.email,
          displayName: user.displayName,
          documentCount: userDocuments.length,
          benchmarkRunCount: userBenchmarkRuns.length,
          availableMetrics: ["documentCount", "benchmarkRunCount"] as UserUsageSummary["availableMetrics"],
          unavailableMetrics: ["chatMessages", "conversationCount", "questionCount", "debugRunCount"] as UserUsageSummary["unavailableMetrics"],
          lastActivityAt
        }
      })
      .sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""))
  }

  async getCostAuditSummary(actor: AppUser): Promise<CostAuditSummary> {
    await this.loadAdminLedger(actor, { syncUserDirectory: false })
    const now = new Date()
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    return {
      available: false,
      unavailableReason: "versioned_price_catalog_and_complete_usage_evidence_unavailable",
      periodStart,
      periodEnd: now.toISOString()
    }
  }

  async listQualityActionCards(actor: AppUser): Promise<QualityActionCard[]> {
    const documents = await this.listDocuments(actor)
    return documents
      .flatMap((manifest) => qualityActionCardsForManifest(manifest))
      .sort((a, b) => {
        const severityRank = { blocked: 0, warning: 1, info: 2 } satisfies Record<QualityActionCard["severity"], number>
        return severityRank[a.severity] - severityRank[b.severity] || b.createdAt.localeCompare(a.createdAt)
      })
      .slice(0, 200)
  }

  async createAdminExportDownloadUrl(actor: AppUser, exportType: AdminExportArtifact["exportType"]): Promise<AdminExportArtifact> {
    if (!config.debugDownloadBucketName) throw new Error("DEBUG_DOWNLOAD_BUCKET_NAME is not configured")
    const generatedAt = new Date().toISOString()
    const redaction = {
      policyVersion: "admin-export-redaction-v1",
      redactedFields: ["credentials", "secrets", "rawPrompt", "internalReasoning"],
      notes: ["管理 export は署名付き URL と sanitize 済み集計・監査メタデータだけを返します。"]
    }
    const body = exportType === "audit_log"
      ? {
          exportType,
          generatedAt,
          redaction,
          auditLog: await this.listAdminAuditLog(actor)
        }
      : {
          exportType,
          generatedAt,
          redaction,
          costSummary: await this.getCostAuditSummary(actor)
        }
    const safeType = exportType.replace(/[^a-z0-9_-]/g, "_")
    const objectKey = `downloads/admin-${safeType}-${generatedAt.replace(/[-:.]/g, "")}.json`
    const fileName = objectKey.split("/").at(-1) ?? "admin-export.json"
    const contentDisposition = `attachment; filename="${fileName}"`
    const s3 = new S3Client({ region: config.region })
    await s3.send(new PutObjectCommand({
      Bucket: config.debugDownloadBucketName,
      Key: objectKey,
      Body: JSON.stringify(body, null, 2),
      ContentType: "application/json; charset=utf-8",
      ContentDisposition: contentDisposition
    }))

    const expiresInSeconds = Math.max(60, config.debugDownloadExpiresInSeconds)
    const url = await getSignedUrl(s3, new GetObjectCommand({
      Bucket: config.debugDownloadBucketName,
      Key: objectKey,
      ResponseContentType: "application/json; charset=utf-8",
      ResponseContentDisposition: contentDisposition
    }), { expiresIn: expiresInSeconds })
    return { exportType, url, expiresInSeconds, objectKey, generatedAt, redaction }
  }

  async listDebugRuns(actor?: AppUser): Promise<DebugTrace[]> {
    const prefix = debugTraceTenantPrefix(actor ?? localTestActor(this.deps))
    const keys = await this.deps.objectStore.listKeys(prefix)
    const traces = await Promise.all(
      keys
        .filter((key) => key.endsWith(".json"))
        .map(async (key) => normalizeDebugTrace(JSON.parse(await this.deps.objectStore.getText(key))))
    )
    return traces.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 50)
  }

  async getDebugRun(runId: string, actor?: AppUser): Promise<DebugTrace | undefined> {
    const prefix = debugTraceTenantPrefix(actor ?? localTestActor(this.deps))
    const keys = await this.deps.objectStore.listKeys(prefix)
    const key = keys.find((candidate) => candidate.endsWith(`/${runId}.json`))
    if (!key) return undefined
    return normalizeDebugTrace(JSON.parse(await this.deps.objectStore.getText(key)))
  }

  async listChatToolInvocations(actor?: AppUser): Promise<ChatToolInvocation[]> {
    const debugRuns = await this.listDebugRuns(actor)
    return debugRuns
      .flatMap((trace) => trace.toolInvocations ?? [])
      .sort((a, b) => (b.startedAt ?? b.completedAt ?? "").localeCompare(a.startedAt ?? a.completedAt ?? ""))
      .slice(0, 200)
  }

  async createDebugReplayPlan(runId: string, actor?: AppUser): Promise<DebugReplayPlan | undefined> {
    const trace = await this.getDebugRun(runId, actor)
    if (!trace) return undefined
    const redaction = trace.exportRedaction ?? {
      policyVersion: DEBUG_TRACE_SANITIZE_POLICY_VERSION,
      visibility: trace.visibility ?? "operator_sanitized",
      redactedFields: ["rawPrompt", "credentials", "internalReasoning", "unauthorizedDocuments", "internalPolicyDetails"],
      notes: ["replay plan is metadata-only and does not execute model/tool calls"]
    }
    return {
      runId: trace.runId,
      targetType: trace.targetType ?? "rag_run",
      sourceTraceVisibility: trace.visibility ?? "operator_sanitized",
      createdAt: new Date().toISOString(),
      replayable: false,
      versionComplete: Boolean(trace.replayVersionManifest && trace.replayVersionManifest.missingVersions.length === 0),
      versionManifest: trace.replayVersionManifest,
      blockedReason: trace.replayVersionManifest
        ? trace.replayVersionManifest.missingVersions.length === 0
          ? "Replay execution is disabled until operator approval and current permission checks are completed."
          : `Replay version manifest is incomplete: ${trace.replayVersionManifest.missingVersions.join(", ")}`
        : "Historical trace does not contain a replay version manifest; missing versions are not replaced with current values.",
      inputSummary: {
        question: trace.question,
        modelId: trace.modelId,
        embeddingModelId: trace.embeddingModelId,
        topK: trace.topK,
        memoryTopK: trace.memoryTopK,
        minScore: trace.minScore,
        citationCount: trace.citations.length
      },
      redaction
    }
  }

  async chat(input: ChatInput, user?: AppUser): Promise<ChatOrchestrationResult> {
    const actor = user ?? localTestActor(this.deps)
    if (actor) await this.assertSearchScopeReadable(actor, input.searchScope)
    const operationId = `chat-sync:${randomUUID()}`
    const authorize = actor ? (boundary: WorkerAuthorizationBoundary) => this.assertCurrentWorkerAuthorization({
      runId: operationId,
      targetType: "chat_run",
      subject: actor.userId,
      tenantId: actor.tenantId,
      snapshotEmail: actor.email,
      snapshotGroups: actor.cognitoGroups,
      requiredPermissions: ["chat:create"],
      authorizeResource: async (currentActor) => {
        await this.assertSearchScopeReadable(currentActor, input.searchScope)
        return true
      }
    }, boundary) : undefined
    const currentActor = authorize ? await authorize("start") : actor
    if (authorize) await authorize("protected_read")
    let observationArtifactId: string | undefined
    let persistedTrace: DebugTrace | undefined
    try {
      const result = await runChatOrchestration(
        this.deps,
        input,
        currentActor,
        authorize ? {
          emit: async () => undefined,
          authorizeProtectedRead: () => authorize("protected_read").then(() => undefined),
          authorizeExternalSideEffect: () => authorize("external_side_effect").then(() => undefined),
          authorizeDurableCommit: () => authorize("durable_commit").then(() => undefined),
          recordObservationArtifact: (runId) => { observationArtifactId = runId },
          recordPersistedTrace: (trace) => { persistedTrace = trace }
        } : undefined,
        currentActor ? await this.securityResourceRefsForActor(currentActor, input.searchScope) : []
      )
      if (authorize) await authorize("durable_commit")
      return result
    } catch (error) {
      if ((persistedTrace || observationArtifactId) && currentActor?.tenantId) {
        const producer = new ProductionRagObservationProducer(this.deps.objectStore)
        await Promise.all([
          ...(persistedTrace ? [this.deps.objectStore.deleteObject(debugTraceObjectKey(persistedTrace))] : []),
          ...(persistedTrace ? [producer.deleteArtifactSamples("debug_trace", persistedTrace.runId, currentActor.tenantId)] : []),
          ...(observationArtifactId ? [producer.deleteArtifactSamples("normal_chat", observationArtifactId, currentActor.tenantId)] : [])
        ]).catch(() => undefined)
      }
      throw error
    }
  }

  async startChatRun(input: ChatInput, user: AppUser): Promise<{ runId: string; status: ChatRun["status"]; eventsPath: string }> {
    await this.assertSearchScopeReadable(user, input.searchScope)
    const tenantId = authoritativeActorTenantId(user)
    const now = new Date().toISOString()
    const runId = createChatRunId(now)
    const ttl = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
    const run: ChatRun = {
      runId,
      status: "queued",
      createdBy: user.userId,
      tenantId,
      userEmail: user.email,
      userGroups: user.cognitoGroups,
      securityResourceRefs: await this.securityResourceRefsForActor(user, input.searchScope),
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
    await this.deps.chatRunEventStore.append(tenantId, {
      runId,
      type: "status",
      stage: "queued",
      message: "リクエストを受け付けました",
      data: { status: "queued" },
      ttl
    })

    if (config.chatRunStateMachineArn) {
      try {
        await this.startChatRunExecution(tenantId, runId)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await this.markChatRunFailed(tenantId, runId, `StartExecution failed: ${message}`)
        throw err
      }
    } else {
      void this.executeChatRun(tenantId, runId).catch(() => undefined)
    }

    return { runId, status: run.status, eventsPath: `/chat-runs/${encodeURIComponent(runId)}/events` }
  }

  async executeChatRun(tenantId: string, runId: string): Promise<ChatRun> {
    const envelope = await this.getChatRunExecutionEnvelope(tenantId, runId)
    if (!envelope) throw new Error(`Chat run not found: ${runId}`)
    const startedAt = new Date().toISOString()
    let producedDebugTrace: DebugTrace | undefined
    let producedObservationArtifactId: string | undefined
    let run: ChatRun | undefined
    let claimed = false

    try {
      await this.authorizeChatRunBoundary(envelope, "start")
      claimed = await this.updateChatRunIfStatus(tenantId, runId, "queued", { status: "running", startedAt, updatedAt: startedAt })
      if (!claimed) return this.resolveConcurrentChatRun(tenantId, runId, envelope)
      await this.authorizeChatRunBoundary(envelope, "protected_read")
      run = await this.deps.chatRunStore.get(tenantId, runId)
      if (!run || run.status !== "running") return this.resolveConcurrentChatRun(tenantId, runId, envelope)
      const ttl = run.ttl
      await this.authorizeChatRunBoundary(run, "durable_commit")
      await this.deps.chatRunEventStore.append(tenantId, {
        runId,
        type: "status",
        stage: "running",
        message: "回答生成を開始しました",
        data: { status: "running" },
        ttl
      })
      const currentUser = await this.authorizeChatRunBoundary(run, "protected_read")
      const result = await runChatOrchestration(
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
        currentUser,
        {
          authorizeProtectedRead: () => this.authorizeChatRunBoundary(run!, "protected_read").then(() => undefined),
          authorizeExternalSideEffect: () => this.authorizeChatRunBoundary(run!, "external_side_effect").then(() => undefined),
          authorizeDurableCommit: () => this.authorizeChatRunBoundary(run!, "durable_commit").then(() => undefined),
          recordObservationArtifact: (artifactId) => { producedObservationArtifactId = artifactId },
          recordPersistedTrace: (trace) => { producedDebugTrace = trace },
          emit: async (event) => {
            await this.authorizeChatRunBoundary(run!, "durable_commit")
            await this.deps.chatRunEventStore.append(tenantId, {
              runId,
              type: event.type,
              stage: event.stage,
              message: event.message,
              data: toJsonValue(event.data),
              ttl
            })
          }
        },
        run.securityResourceRefs ?? []
      )
      producedDebugTrace ??= result.debug
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
      await this.authorizeChatRunBoundary(run, "durable_commit")
      // Reauthorize the complete terminal sequence before its first write. No
      // external call is allowed between this check, the success CAS, and the
      // body-bearing final event append.
      await this.authorizeChatRunBoundary(run, "durable_commit")
      const successPatch = {
        status: "succeeded",
        responseType: result.responseType,
        answer: result.answer,
        isAnswerable: result.isAnswerable,
        needsClarification: result.needsClarification,
        clarification: result.clarification,
        citations: result.citations,
        retrieved: result.retrieved,
        debugRunId: result.debug?.runId,
        error: undefined,
        errorCode: undefined,
        completedAt,
        updatedAt: completedAt
      } as const
      if (!await this.updateChatRunIfStatus(tenantId, runId, "running", successPatch)) {
        return this.resolveConcurrentChatRun(tenantId, runId, envelope)
      }
      const succeeded: ChatRun = { ...run, ...successPatch }
      await this.deps.chatRunEventStore.append(tenantId, {
        runId,
        type: "final",
        stage: "done",
        message: "回答生成が完了しました",
        data: finalEventData,
        ttl
      })
      return succeeded
    } catch (err) {
      const permissionRevoked = isPermissionRevokedError(err)
      const message = permissionRevoked ? "permission_revoked" : err instanceof Error ? err.message : String(err)
      const completedAt = new Date().toISOString()
      const failurePatch = {
        status: "failed",
        clearResult: true,
        error: message,
        errorCode: permissionRevoked ? "permission_revoked" : "execution_error",
        completedAt,
        updatedAt: completedAt
      } as const
      const failedTransition = await this.updateChatRunIfStatus(
        tenantId,
        runId,
        claimed ? "running" : "queued",
        failurePatch
      )
      if (!failedTransition) return this.resolveConcurrentChatRun(tenantId, runId, envelope)
      const failed = minimizedFailedChatRun(run ?? envelope, failurePatch)
      if (permissionRevoked && run && (producedDebugTrace || producedObservationArtifactId)) {
        await this.compensateRevokedChatArtifacts(failed, producedDebugTrace, producedObservationArtifactId)
      }
      if (!permissionRevoked && run) {
        await this.authorizeChatRunBoundary(run, "durable_commit")
        await this.deps.chatRunEventStore.append(tenantId, {
          runId,
          type: "error",
          stage: "failed",
          message,
          data: { message },
          ttl: run.ttl
        })
      }
      return failed
    }
  }

  async markChatRunFailed(tenantId: string, runId: string, reason: string): Promise<ChatRun> {
    const run = await this.deps.chatRunStore.get(tenantId, runId)
    if (!run) throw new Error(`Chat run not found: ${runId}`)
    if (run.status === "succeeded" || run.status === "failed" || run.status === "cancelled") return run

    const completedAt = new Date().toISOString()
    await this.deps.chatRunEventStore.append(tenantId, {
      runId,
      type: "error",
      stage: "failed",
      message: reason,
      data: { message: reason },
      ttl: run.ttl
    })
    const patch = {
      status: "failed",
      clearResult: true,
      error: reason,
      errorCode: "execution_error",
      completedAt,
      updatedAt: completedAt
    } as const
    if (!await this.updateChatRunIfStatus(tenantId, runId, run.status, patch)) return this.resolveConcurrentChatRun(tenantId, runId, run)
    return minimizedFailedChatRun(run, patch)
  }

  private async compensateRevokedChatArtifacts(run: ChatRun, trace?: DebugTrace, observationArtifactId?: string): Promise<void> {
    const traceKey = trace ? debugTraceObjectKey(trace) : undefined
    try {
      await Promise.all([
        ...(traceKey ? [this.deps.objectStore.deleteObject(traceKey)] : []),
        ...(trace ? [new ProductionRagObservationProducer(this.deps.objectStore).deleteArtifactSamples("debug_trace", trace.runId, run.tenantId)] : []),
        ...(observationArtifactId ? [new ProductionRagObservationProducer(this.deps.objectStore).deleteArtifactSamples("normal_chat", observationArtifactId, run.tenantId)] : [])
      ])
    } catch {
      await new ObjectStoreRevocationCleanupCoordinator(this.deps.objectStore).register({
        operationId: `chat-run-permission-revoked:${run.tenantId}:${run.runId}`,
        tenantId: run.tenantId,
        resourceType: "account",
        resourceId: run.createdBy,
        trigger: "role_revoked",
        deniedPurposes: ["logging", "evaluation"],
        authoritativeDenyVersion: `worker-authorization:${run.runId}:permission_revoked`,
        authoritativeDenyConfirmedAt: run.updatedAt,
        knownTargets: [
          ...(traceKey ? [{ scope: "evaluation_artifact" as const, reference: traceKey }] : []),
          ...(trace ? [{ scope: "evaluation_artifact" as const, reference: `quality-control:debug_trace:${trace.runId}` }] : []),
          ...(observationArtifactId ? [{ scope: "evaluation_artifact" as const, reference: `quality-control:normal_chat:${observationArtifactId}` }] : [])
        ]
      })
    }
  }

  async startDocumentIngestRun(input: StartDocumentIngestRunInput, user: AppUser): Promise<{ runId: string; status: DocumentIngestRun["status"]; eventsPath: string }> {
    const tenantId = authoritativeActorTenantId(user)
    const now = new Date().toISOString()
    const runId = createDocumentIngestRunId(now)
    const ttl = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
    const run: DocumentIngestRun = {
      runId,
      status: "queued",
      createdBy: user.userId,
      tenantId,
      userEmail: user.email,
      userGroups: user.cognitoGroups,
      securityResourceRefs: await this.securityResourceRefsForActor(user),
      uploadId: input.uploadId,
      objectKey: input.objectKey,
      purpose: input.purpose,
      fileName: input.fileName,
      mimeType: input.mimeType,
      metadata: input.metadata,
      admissionContext: input.admissionContext,
      embeddingModelId: input.embeddingModelId,
      memoryModelId: input.memoryModelId,
      skipMemory: input.skipMemory,
      stage: "queued",
      counters: {},
      warnings: [],
      createdAt: now,
      updatedAt: now,
      ttl
    }

    await this.deps.documentIngestRunStore.create(run)
    await this.deps.documentIngestRunEventStore.append(tenantId, {
      runId,
      type: "status",
      stage: "queued",
      message: "文書取り込みを受け付けました",
      data: { status: "queued" },
      ttl
    })

    if (config.documentIngestRunStateMachineArn) {
      try {
        await this.startDocumentIngestRunExecution(tenantId, runId)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await this.markDocumentIngestRunFailed(tenantId, runId, `StartExecution failed: ${message}`)
        throw err
      }
    } else {
      void this.executeDocumentIngestRun(tenantId, runId).catch(() => undefined)
    }

    return { runId, status: run.status, eventsPath: `/document-ingest-runs/${encodeURIComponent(runId)}/events` }
  }

  async executeDocumentIngestRun(tenantId: string, runId: string): Promise<DocumentIngestRun> {
    const run = await this.deps.documentIngestRunStore.get(tenantId, runId)
    if (!run) throw new Error(`Document ingest run not found: ${runId}`)
    if (isDocumentIngestRunTerminal(run.status)) return this.ensureDocumentIngestRunTerminalEvidence(run)
    const ttl = run.ttl
    const startedAt = new Date().toISOString()
    let producedManifest: DocumentManifest | undefined

    try {
      await this.authorizeDocumentIngestRunBoundary(run, "start")
      await this.deps.documentIngestRunStore.update(tenantId, runId, { status: "running", stage: "running", startedAt, updatedAt: startedAt })
      await this.deps.documentIngestRunEventStore.append(tenantId, {
        runId,
        type: "status",
        stage: "running",
        message: "文書取り込みを開始しました",
        data: { status: "running" },
        ttl
      })
      logIngestStage({ stage: "s3_read", phase: "start", runId, fileName: run.fileName, mimeType: run.mimeType })
      await this.deps.documentIngestRunEventStore.append(tenantId, {
        runId,
        type: "status",
        stage: "preprocessing",
        message: "アップロード済みオブジェクトを読み込んでいます",
        data: { status: "running", stage: "preprocessing" },
        ttl
      })
      await this.authorizeDocumentIngestRunBoundary(run, "protected_read")
      const contentBytes = await this.deps.objectStore.getBytes(run.objectKey)
      if (contentBytes.length === 0) throw new Error("Uploaded object is empty")
      logIngestStage({ stage: "s3_read", phase: "end", runId, fileName: run.fileName, mimeType: run.mimeType, fileSizeBytes: contentBytes.length })
      const sourceS3Object = config.docsBucketName
        ? { bucketName: config.docsBucketName, key: run.objectKey }
        : undefined
      await this.deps.documentIngestRunStore.update(tenantId, runId, {
        stage: "extracting",
        counters: { fileSizeBytes: contentBytes.length },
        updatedAt: new Date().toISOString()
      })
      await this.deps.documentIngestRunEventStore.append(tenantId, {
        runId,
        type: "status",
        stage: "extracting",
        message: "文書を解析し、チャンク化とインデックス登録を実行しています",
        data: { status: "running", stage: "extracting", counters: { fileSizeBytes: contentBytes.length } },
        ttl
      })
      await this.authorizeDocumentIngestRunBoundary(run, "external_side_effect")
      const manifest = await this.ingest({
        fileName: run.fileName,
        mimeType: run.mimeType,
        metadata: run.metadata,
        admissionContext: run.admissionContext,
        embeddingModelId: run.embeddingModelId,
        memoryModelId: run.memoryModelId,
        skipMemory: run.skipMemory,
        contentBytes,
        sourceS3Object,
        currentAuthorization: {
          authorizeExternalSideEffect: () => this.authorizeDocumentIngestRunBoundary(run, "external_side_effect").then(() => undefined),
          authorizeDurableCommit: () => this.authorizeDocumentIngestRunBoundary(run, "durable_commit").then(() => undefined)
        }
      })
      producedManifest = manifest
      await this.authorizeDocumentIngestRunBoundary(run, "durable_commit")
      if (run.purpose === "document") await this.registerSourceGovernance(manifest)
      await this.authorizeDocumentIngestRunBoundary(run, "external_side_effect")
      await this.deps.objectStore.deleteObject(run.objectKey)
      const manifestSummary = toDocumentManifestSummary(manifest)
      const completedAt = new Date().toISOString()
      const terminalStatus = isRejectedIngestManifest(manifest) ? "rejected" as const : "succeeded" as const
      const terminalStage = terminalStatus === "rejected" ? "rejected" : "done"
      const counters = {
        ...(manifest.extractionCounters ?? {}),
        chunkCount: manifest.chunkCount,
        memoryCardCount: manifest.memoryCardCount
      }
      await this.authorizeDocumentIngestRunBoundary(run, "durable_commit")
      const evidence = await this.persistDocumentIngestRunTerminalTrace(run, terminalStatus, completedAt, manifest)
      await this.deps.documentIngestRunEventStore.append(tenantId, {
        runId,
        type: "final",
        traceId: evidence.traceId,
        replayVersionManifest: evidence.replayVersionManifest,
        stage: terminalStage,
        message: terminalStatus === "rejected" ? "文書取り込みは受け入れポリシーにより拒否されました" : "文書取り込みが完了しました",
        data: {
          status: terminalStatus,
          traceId: evidence.traceId,
          replayVersionManifest: evidence.replayVersionManifest as unknown as JsonValue,
          documentId: manifest.documentId,
          manifest: manifestSummary as unknown as JsonValue,
          counters,
          warnings: (manifest.extractionWarnings ?? []) as unknown as JsonValue
        },
        ttl
      })
      await this.authorizeDocumentIngestRunBoundary(run, "durable_commit")
      return this.deps.documentIngestRunStore.update(tenantId, runId, {
        status: terminalStatus,
        stage: terminalStage,
        manifest: manifestSummary,
        documentId: manifest.documentId,
        traceId: evidence.traceId,
        replayVersionManifest: evidence.replayVersionManifest,
        counters,
        warnings: manifest.extractionWarnings,
        error: undefined,
        errorCode: undefined,
        completedAt,
        updatedAt: completedAt
      })
    } catch (err) {
      if (producedManifest) await this.discardUncommittedIngest(producedManifest)
      const permissionRevoked = isPermissionRevokedError(err)
      const message = permissionRevoked ? "permission_revoked" : err instanceof Error ? err.message : String(err)
      const completedAt = new Date().toISOString()
      const evidence = await this.persistDocumentIngestRunTerminalTrace(
        run,
        "failed",
        completedAt,
        producedManifest,
        permissionRevoked ? "permission_revoked" : "execution_error"
      )
      await this.deps.documentIngestRunEventStore.append(tenantId, {
        runId,
        type: "error",
        traceId: evidence.traceId,
        replayVersionManifest: evidence.replayVersionManifest,
        stage: "failed",
        message,
        data: {
          status: "failed",
          message,
          traceId: evidence.traceId,
          replayVersionManifest: evidence.replayVersionManifest as unknown as JsonValue
        },
        ttl
      })
      return this.deps.documentIngestRunStore.update(tenantId, runId, {
        status: "failed",
        stage: "failed",
        traceId: evidence.traceId,
        replayVersionManifest: evidence.replayVersionManifest,
        error: message,
        errorCode: permissionRevoked ? "permission_revoked" : "execution_error",
        completedAt,
        updatedAt: completedAt
      })
    }
  }

  async markDocumentIngestRunFailed(tenantId: string, runId: string, reason: string): Promise<DocumentIngestRun> {
    const run = await this.deps.documentIngestRunStore.get(tenantId, runId)
    if (!run) throw new Error(`Document ingest run not found: ${runId}`)
    if (isDocumentIngestRunTerminal(run.status)) return this.ensureDocumentIngestRunTerminalEvidence(run)

    const completedAt = new Date().toISOString()
    const evidence = await this.persistDocumentIngestRunTerminalTrace(run, "failed", completedAt, undefined, "execution_error")
    await this.deps.documentIngestRunEventStore.append(tenantId, {
      runId,
      type: "error",
      traceId: evidence.traceId,
      replayVersionManifest: evidence.replayVersionManifest,
      stage: "failed",
      message: reason,
      data: {
        status: "failed",
        message: reason,
        traceId: evidence.traceId,
        replayVersionManifest: evidence.replayVersionManifest as unknown as JsonValue
      },
      ttl: run.ttl
    })
    return this.deps.documentIngestRunStore.update(tenantId, runId, {
      status: "failed",
      stage: "failed",
      traceId: evidence.traceId,
      replayVersionManifest: evidence.replayVersionManifest,
      error: reason,
      errorCode: "execution_error",
      completedAt,
      updatedAt: completedAt
    })
  }

  async cancelDocumentIngestRun(tenantId: string, runId: string): Promise<DocumentIngestRun | undefined> {
    const run = await this.deps.documentIngestRunStore.get(tenantId, runId)
    if (!run) return undefined
    if (isDocumentIngestRunTerminal(run.status)) return this.ensureDocumentIngestRunTerminalEvidence(run)

    const completedAt = new Date().toISOString()
    const evidence = await this.persistDocumentIngestRunTerminalTrace(run, "cancelled", completedAt, undefined, "cancelled")
    await this.deps.documentIngestRunEventStore.append(tenantId, {
      runId,
      type: "final",
      traceId: evidence.traceId,
      replayVersionManifest: evidence.replayVersionManifest,
      stage: "cancelled",
      message: "文書取り込みは取り消されました",
      data: {
        status: "cancelled",
        traceId: evidence.traceId,
        replayVersionManifest: evidence.replayVersionManifest as unknown as JsonValue
      },
      ttl: run.ttl
    })
    return this.deps.documentIngestRunStore.update(tenantId, runId, {
      status: "cancelled",
      stage: "cancelled",
      traceId: evidence.traceId,
      replayVersionManifest: evidence.replayVersionManifest,
      completedAt,
      updatedAt: completedAt
    })
  }

  private async ensureDocumentIngestRunTerminalEvidence(run: DocumentIngestRun): Promise<DocumentIngestRun> {
    if (run.traceId && run.replayVersionManifest) return run
    if (!isDocumentIngestRunTerminal(run.status)) return run
    const completedAt = run.completedAt ?? new Date().toISOString()
    const evidence = await this.persistDocumentIngestRunTerminalTrace(
      run,
      run.status,
      completedAt,
      undefined,
      terminalIngestReasonCode(run)
    )
    const eventType = run.status === "failed" ? "error" as const : "final" as const
    await this.deps.documentIngestRunEventStore.append(run.tenantId, {
      runId: run.runId,
      type: eventType,
      traceId: evidence.traceId,
      replayVersionManifest: evidence.replayVersionManifest,
      stage: run.stage ?? run.status,
      message: `document_ingest_${run.status}`,
      data: {
        status: run.status,
        traceId: evidence.traceId,
        replayVersionManifest: evidence.replayVersionManifest as unknown as JsonValue
      },
      ttl: run.ttl
    })
    return this.deps.documentIngestRunStore.update(run.tenantId, run.runId, {
      traceId: evidence.traceId,
      replayVersionManifest: evidence.replayVersionManifest,
      completedAt,
      updatedAt: completedAt
    })
  }

  private async persistDocumentIngestRunTerminalTrace(
    run: DocumentIngestRun,
    status: Extract<DocumentIngestRun["status"], "succeeded" | "rejected" | "failed" | "cancelled">,
    completedAt: string,
    manifest?: DocumentManifest,
    reasonCode?: ReplayDecisionReasonCode
  ): Promise<Required<Pick<DocumentIngestRun, "traceId" | "replayVersionManifest">>> {
    const traceId = manifest?.traceId ?? `ingest-run:${run.runId}`
    const citation = manifest
      ? [{
          documentId: manifest.documentId,
          documentVersion: manifest.documentVersion,
          fileName: manifest.fileName,
          score: 1,
          text: ""
        }]
      : []
    const baseReplayVersionManifest = manifest?.replayVersionManifest ?? buildReplayVersionManifest({
      citations: citation,
      observedVersions: {
        parserVersion: run.manifest?.sourceExtractorVersion,
        chunkerVersion: run.manifest?.chunkerVersion
      },
      policyVersions: {
        traceSanitization: DEBUG_TRACE_SANITIZE_POLICY_VERSION
      },
      question: run.fileName,
      candidateCount: 0,
      deniedCandidateCount: 0,
      finalEvidenceCount: 0,
      responseStatus: status === "failed" ? "error" : status === "succeeded" ? "success" : "warning",
      decisionCode: terminalIngestDecisionCode(status),
      reasonCodes: reasonCode ? [reasonCode] : [],
      totalLatencyMs: elapsedMilliseconds(run.startedAt ?? run.createdAt, completedAt),
      nondeterministicFactors: []
    })
    const replayVersionManifest = status === "succeeded" || status === "rejected"
      ? baseReplayVersionManifest
      : {
          ...baseReplayVersionManifest,
          decisions: {
            ...baseReplayVersionManifest.decisions,
            deniedCandidateCount: baseReplayVersionManifest.decisions.candidateCount,
            finalEvidenceCount: 0,
            responseStatus: status === "failed" ? "error" as const : "warning" as const,
            decisionCode: terminalIngestDecisionCode(status),
            reasonCodes: reasonCode ? [reasonCode] : []
          }
        }
    const traceStatus = status === "failed" ? "error" as const : status === "succeeded" ? "success" as const : "warning" as const
    const startedAt = run.startedAt ?? run.createdAt
    const trace = sanitizeDebugTraceForPersistence({
      schemaVersion: DEBUG_TRACE_SCHEMA_VERSION,
      runId: traceId,
      requestTraceId: run.runId,
      tenantPartitionId: tenantPartitionId(run.tenantId),
      actorPartitionId: tenantPartitionId(`${run.tenantId}:actor:${run.createdBy}`),
      securityResourceRefs: [...new Set(run.securityResourceRefs ?? [])].sort(),
      targetType: "ingest_run",
      visibility: "operator_sanitized",
      sanitizePolicyVersion: DEBUG_TRACE_SANITIZE_POLICY_VERSION,
      question: run.fileName,
      modelId: replayVersionManifest.modelVersions.answer ?? "",
      embeddingModelId: replayVersionManifest.embedding.modelId ?? "",
      clueModelId: replayVersionManifest.modelVersions.clue ?? "",
      replayVersionManifest,
      decision: replayVersionManifest.decisions,
      topK: 0,
      memoryTopK: 0,
      minScore: 0,
      startedAt,
      completedAt,
      totalLatencyMs: elapsedMilliseconds(startedAt, completedAt),
      status: traceStatus,
      answerPreview: "",
      isAnswerable: status === "succeeded",
      citations: citation,
      retrieved: citation,
      finalEvidence: status === "succeeded" ? citation : [],
      steps: [{
        id: 1,
        label: "document_ingest_terminal",
        status: traceStatus,
        latencyMs: elapsedMilliseconds(startedAt, completedAt),
        summary: `document_ingest_${status}`,
        startedAt,
        completedAt
      }]
    })
    await this.deps.objectStore.putText(debugTraceObjectKey(trace), JSON.stringify(trace, null, 2), "application/json")
    return { traceId, replayVersionManifest }
  }

  async search(input: SearchInput, user: AppUser): Promise<SearchResponse> {
    await this.assertSearchScopeReadable(user, input.scope)
    return searchRag(this.deps, input, user)
  }

  async createQuestion(input: CreateQuestionInput, user?: AppUser): Promise<HumanQuestion> {
    const defaultAssigneeGroupId = config.defaultSupportAssigneeGroupId || undefined
    const assigneeGroupId = input.assigneeUserId || input.assigneeGroupId
      ? input.assigneeGroupId
      : defaultAssigneeGroupId
    return this.deps.questionStore.create({
      ...input,
      requesterUserId: user?.userId,
      requesterName: input.requesterName?.trim() || userDisplayName(user),
      requesterDepartment: input.requesterDepartment?.trim() || "未設定",
      assigneeGroupId,
      sanitizedDiagnostics: sanitizeSupportDiagnostics(input.sanitizedDiagnostics, input.answerUnavailableReason)
    })
  }

  async listAssignedQuestions(userId: string, groupIds: string[]): Promise<HumanQuestion[]> {
    return this.deps.questionStore.listAssignedToUser(userId, groupIds)
  }

  async listRequestedQuestions(userId: string): Promise<HumanQuestion[]> {
    return this.deps.questionStore.listRequestedByUser(userId)
  }

  async listAllQuestionsForAdmin(): Promise<HumanQuestion[]> {
    return this.deps.questionStore.listAllForAdmin()
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

  private async updateManagedUserStatus(
    actor: AppUser,
    userId: string,
    status: ManagedUser["status"],
    input: { successorUserId?: string } = {}
  ): Promise<ManagedUser | undefined> {
    const db = await this.loadAdminLedger(actor, { syncUserDirectory: true })
    const user = db.users.find((candidate) => candidate.userId === userId && candidate.status !== "deleted")
    if (!user) return undefined
    const beforeStatus = user.status
    const beforeGroups = [...user.groups]

    if (this.deps.verifiedIdentityProvider && this.deps.userDirectory) {
      const [currentActor, currentTarget] = await Promise.all([
        this.deps.verifiedIdentityProvider.getCurrentIdentityBySubject(actor.userId),
        this.deps.verifiedIdentityProvider.getCurrentIdentityBySubject(userId)
      ])
      if (!currentActor || !currentTarget || currentActor.accountStatus !== "active") throw forbiddenError("Forbidden")
      const currentActorUser: AppUser = {
        userId: currentActor.userId,
        identityUsername: currentActor.username,
        email: currentActor.email,
        cognitoGroups: [...currentActor.cognitoGroups],
        accountStatus: currentActor.accountStatus,
        tenantId: currentActor.tenantId
      }
      const requiredPermission = status === "suspended" ? "user:suspend" : status === "active" ? "user:unsuspend" : "user:delete"
      const outbox = this.deps.securityAuditOutbox ?? new ObjectStoreSecurityMutationAuditOutbox(this.deps.objectStore)
      const revocationRegistry = this.deps.accountRevocationRegistry ?? new ObjectStoreAccountRevocationRegistry(this.deps.objectStore)
      const administrativeTransfer = new AdministrativePrincipalTransferService(this.deps)
      const lifecycleReason = `Administrative account lifecycle transition to ${status}`
      let permanentDeleteTransferOperationId: string | undefined
      const intent = await outbox.prepare({
        actorId: currentActor.userId,
        tenantId: currentTarget.tenantId,
        targetType: "account",
        targetId: currentTarget.userId,
        operation: `account.${status === "active" ? "restore" : status}`,
        before: { accountStatus: currentTarget.accountStatus, groups: currentTarget.cognitoGroups },
        proposedAfter: { accountStatus: status, groups: currentTarget.cognitoGroups },
        reason: lifecycleReason,
        policyVersion: "account-lifecycle-mutation-v1"
      })
      try {
        if (
          currentActor.tenantId !== currentTarget.tenantId ||
          actor.tenantId !== currentActor.tenantId ||
          !hasPermission(currentActorUser, requiredPermission) ||
          (status !== "active" && currentActor.userId === currentTarget.userId)
        ) throw forbiddenError("Forbidden")

        if (status === "deleted") {
          const currentSuccessor = input.successorUserId
            ? await this.deps.verifiedIdentityProvider.getCurrentIdentityBySubject(input.successorUserId)
            : undefined
          const transferResult = await administrativeTransfer.transferBeforePermanentDelete({
            actor: currentActorUser,
            sourceUserId: currentTarget.userId,
            tenantId: currentTarget.tenantId,
            successor: currentSuccessor
              ? {
                  userId: currentSuccessor.userId,
                  tenantId: currentSuccessor.tenantId,
                  status: currentSuccessor.accountStatus
                }
              : undefined,
            reason: "Permanent account deletion ownership transfer"
          })
          permanentDeleteTransferOperationId = transferResult.operationId
          if (!permanentDeleteTransferOperationId) throw new Error("Permanent-delete transfer fence operation is missing")
        }
      } catch (error) {
        const result = error instanceof AdministrativePrincipalTransferError
          ? error.reconciliationRequired
            ? "failed"
            : /conflict|already transferred|in progress|CAS race/i.test(error.message) ? "conflict" : "denied"
          : (error as Error & { status?: number }).status === 403 ? "denied" : "failed"
        await outbox.complete(intent.intentId, intent.draft.tenantId, result, {
          accountStatus: currentTarget.accountStatus,
          groups: currentTarget.cognitoGroups
        })
        throw error
      }
      try {
        const cleanupRepairOutbox = new ObjectStoreRevocationCleanupRepairOutbox(this.deps.objectStore)
        if (status === "active") {
          await cleanupRepairOutbox.assertResourceFenceReleased(
            currentTarget.tenantId,
            "account",
            currentTarget.userId
          )
          if (!this.deps.userDirectory.enableUser || !this.deps.userDirectory.revokeSessions) {
            throw new Error("Authoritative account restore is not configured")
          }
          await this.deps.userDirectory.enableUser(currentTarget.username)
          await this.deps.userDirectory.revokeSessions(currentTarget.username)
          await revocationRegistry.clear({
            tenantId: currentTarget.tenantId,
            userId: currentTarget.userId,
            username: currentTarget.username,
            auditIntentId: intent.intentId,
            reason: lifecycleReason
          })
          await administrativeTransfer.releasePermanentDeleteFenceAfterAccountRestore({
            tenantId: currentTarget.tenantId,
            sourceUserId: currentTarget.userId
          })
        } else {
          const denyAt = new Date().toISOString()
          const previousDeny = await revocationRegistry.get(currentTarget.tenantId, currentTarget.userId)
          const cleanupRegistration = {
            operationId: `account-lifecycle:${intent.intentId}`,
            tenantId: currentTarget.tenantId,
            resourceType: "account" as const,
            resourceId: currentTarget.userId,
            trigger: "account_revoked" as const,
            deniedPurposes: ["normal_rag", "external_model", "logging", "evaluation"],
            authoritativeDenyVersion: `account-revocation-deny:${status}:${intent.intentId}`,
            authoritativeDenyConfirmedAt: denyAt,
            knownTargets: [
              { scope: "session" as const, reference: currentTarget.username },
              { scope: "grant" as const, reference: `principal:${currentTarget.userId}` },
              { scope: "cache" as const, reference: `principal:${currentTarget.userId}` },
              { scope: "queued_run" as const, reference: `principal:${currentTarget.userId}` },
              { scope: "evaluation_artifact" as const, reference: `principal:${currentTarget.userId}` }
            ]
          }
          await cleanupRepairOutbox.prepare({
            expectedBeforeDenyVersion: accountRevocationStateVersion(previousDeny),
            cleanupRegistration,
            preparedAt: denyAt
          })
          let denyRecord
          try {
            denyRecord = await revocationRegistry.deny({
              tenantId: currentTarget.tenantId,
              userId: currentTarget.userId,
              username: currentTarget.username,
              desiredStatus: status,
              auditIntentId: intent.intentId,
              reason: lifecycleReason,
              effectiveAt: denyAt
            })
          } catch (error) {
            await cleanupRepairOutbox.markAbandoned({
              tenantId: currentTarget.tenantId,
              resourceType: "account",
              resourceId: currentTarget.userId,
              operationId: cleanupRegistration.operationId
            }, denyAt).catch(() => undefined)
            throw error
          }
          if (accountRevocationCleanupDenyVersion(denyRecord) !== cleanupRegistration.authoritativeDenyVersion) {
            throw new Error("Account deny version does not match its cleanup repair intent")
          }
          const committedRepair = await cleanupRepairOutbox.markDenyCommitted({
            tenantId: currentTarget.tenantId,
            resourceType: "account",
            resourceId: currentTarget.userId,
            operationId: cleanupRegistration.operationId
          }, denyAt)
          if (status === "deleted") {
            if (!permanentDeleteTransferOperationId) throw new Error("Permanent-delete transfer fence operation is missing")
            await administrativeTransfer.confirmPermanentDeleteAccountDeny({
              tenantId: currentTarget.tenantId,
              sourceUserId: currentTarget.userId,
              operationId: permanentDeleteTransferOperationId
            })
          }
          // Persist the application deny before any fallible external IdP call.
          user.status = "suspended"
          user.updatedAt = new Date().toISOString()
          await this.saveAdminLedger(db)
          await new ObjectStoreRevocationCleanupCoordinator(this.deps.objectStore).register(committedRepair.cleanupRegistration)
          await cleanupRepairOutbox.markCleanupRegistered(committedRepair, denyAt)
          if (!this.deps.userDirectory.disableUser || !this.deps.userDirectory.revokeSessions) {
            throw new Error("Authoritative account revocation is not configured")
          }
          await this.deps.userDirectory.disableUser(currentTarget.username)
          await this.deps.userDirectory.revokeSessions(currentTarget.username)
          if (status === "deleted") {
            if (!this.deps.userDirectory.deleteUser) throw new Error("Authoritative account deletion is not configured")
            await this.deps.userDirectory.deleteUser(currentTarget.username)
          }
        }
        user.status = status
        user.updatedAt = new Date().toISOString()
        const action: ManagedUserAuditAction = status === "suspended" ? "user:suspend" : status === "active" ? "user:unsuspend" : "user:delete"
        this.appendAdminAuditLog(db, actor, user, action, beforeStatus, user.status, beforeGroups, user.groups, user.updatedAt)
        await this.saveAdminLedger(db)
        await outbox.complete(intent.intentId, intent.draft.tenantId, "success", {
          accountStatus: status,
          groups: currentTarget.cognitoGroups
        })
        return user
      } catch (error) {
        let observedStatus: ManagedUser["status"] = user.status
        try {
          const observed = await this.deps.verifiedIdentityProvider.getCurrentIdentityBySubject(userId)
          observedStatus = observed?.accountStatus ?? "deleted"
        } catch {
          // Keep the deny-first ledger state when reconciliation lookup fails.
        }
        await outbox.complete(intent.intentId, intent.draft.tenantId, "failed", {
          accountStatus: observedStatus,
          reconciliationRequired: true
        })
        throw error
      }
    }

    if (config.authEnabled) throw new Error("Authoritative account lifecycle mutation is not configured")
    let localPermanentDeleteTransfer: { service: AdministrativePrincipalTransferService; operationId: string } | undefined
    if (status === "deleted") {
      const successor = input.successorUserId
        ? db.users.find((candidate) => candidate.userId === input.successorUserId && candidate.status === "active")
        : undefined
      const service = new AdministrativePrincipalTransferService(this.deps)
      const transferResult = await service.transferBeforePermanentDelete({
        actor: { ...actor, tenantId: actor.tenantId ?? defaultTenantId, accountStatus: actor.accountStatus ?? "active" },
        sourceUserId: user.userId,
        tenantId: actor.tenantId ?? defaultTenantId,
        successor: successor
          ? { userId: successor.userId, tenantId: actor.tenantId ?? defaultTenantId, status: successor.status }
          : undefined,
        reason: "Permanent account deletion ownership transfer"
      })
      if (!transferResult.operationId) throw new Error("Permanent-delete transfer fence operation is missing")
      localPermanentDeleteTransfer = { service, operationId: transferResult.operationId }
    }
    user.status = status
    user.updatedAt = new Date().toISOString()
    const action: ManagedUserAuditAction = status === "suspended" ? "user:suspend" : status === "active" ? "user:unsuspend" : "user:delete"
    this.appendAdminAuditLog(db, actor, user, action, beforeStatus, user.status, beforeGroups, user.groups, user.updatedAt)
    await this.saveAdminLedger(db)
    if (localPermanentDeleteTransfer) {
      await localPermanentDeleteTransfer.service.confirmPermanentDeleteAccountDeny({
        tenantId: actor.tenantId ?? defaultTenantId,
        sourceUserId: user.userId,
        operationId: localPermanentDeleteTransfer.operationId
      })
    }
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
      const currentIdentity = this.deps.verifiedIdentityProvider
        ? await this.deps.verifiedIdentityProvider.getCurrentIdentityBySubject(directoryUser.userId)
        : undefined
      if (this.deps.verifiedIdentityProvider && !currentIdentity) {
        throw new Error("Authoritative directory identity is unavailable during reconciliation")
      }
      const groups = normalizeRoles(currentIdentity?.cognitoGroups ?? directoryUser.groups)
      const status = currentIdentity?.accountStatus ?? directoryUser.status

      if (existing) {
        if (existing.userId !== directoryUser.userId) {
          db.usage[directoryUser.userId] ??= db.usage[existing.userId] ?? {}
          delete db.usage[existing.userId]
          existing.userId = directoryUser.userId
        }
        existing.email = directoryUser.email
        existing.displayName = directoryUser.displayName
        if (this.deps.verifiedIdentityProvider) {
          existing.status = status
          existing.groups = groups
        } else if (existing.groups.length === 0) {
          existing.groups = groups
        }
        existing.createdAt = existing.createdAt || directoryUser.createdAt
        existing.updatedAt = directoryUser.updatedAt
        continue
      }

      db.users.push({
        ...directoryUser,
        status,
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

  private async compensateCreatedDirectoryUser(username: string): Promise<void> {
    try {
      await this.deps.userDirectory?.deleteUser?.(username)
      return
    } catch {
      // A create compensation that cannot delete converges deny-first. The
      // pending/failed common audit intent remains the reconciliation anchor.
    }
    await Promise.allSettled([
      this.deps.userDirectory?.disableUser?.(username),
      this.deps.userDirectory?.revokeSessions?.(username)
    ].filter((operation): operation is Promise<void> => operation !== undefined))
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

  private async currentReindexAuthorizationManifest(
    migration: ReindexMigration,
    tenantId: string
  ): Promise<DocumentManifest> {
    if (!migration.activePointerKey) throw new Error("Reindex migration active pointer is missing")
    const pointer = JSON.parse(await this.deps.objectStore.getText(migration.activePointerKey)) as {
      tenantId?: unknown
      artifactId?: unknown
    }
    if (pointer.tenantId !== tenantId || typeof pointer.artifactId !== "string" || !pointer.artifactId) {
      throw new Error("Reindex migration active pointer identity is invalid")
    }
    return this.getManifest(pointer.artifactId, tenantId)
  }

  private async reconcileRevokedCutover(
    migration: ReindexMigration,
    initial: ReindexPublicationCompensationIntent,
    store: ObjectStoreReindexPublicationCompensationRepair
  ): Promise<ReindexMigration> {
    let repair = initial
    if (repair.status === "pending") {
      try {
        const rolledBack = await new StagedPublicationCoordinator(this.deps).rollback(
          repair.publicationRunId,
          repair.operationId
        )
        repair = await store.markCompensated(
          repair,
          reindexCompensationResult(rolledBack),
          new Date().toISOString()
        )
      } catch (error) {
        await store.markFailed(repair, error, new Date().toISOString())
        throw new Error("Reindex cutover compensation remains pending", { cause: error })
      }
    }
    await this.completeReindexCompensationLedger(migration, repair)
    if (repair.status !== "completed") await store.markCompleted(repair, new Date().toISOString())
    return migration
  }

  private async reconcileRevokedRollback(
    migration: ReindexMigration,
    initial: ReindexPublicationCompensationIntent,
    store: ObjectStoreReindexPublicationCompensationRepair
  ): Promise<ReindexMigration> {
    let repair = initial
    if (repair.status === "pending") {
      try {
        const rolledBack = await new StagedPublicationCoordinator(this.deps).rollback(
          repair.publicationRunId,
          repair.operationId
        )
        repair = await store.markCompensated(
          repair,
          reindexCompensationResult(rolledBack),
          new Date().toISOString()
        )
      } catch (error) {
        await store.markFailed(repair, error, new Date().toISOString())
        throw new Error("Reindex rollback reconciliation remains pending", { cause: error })
      }
    }
    await this.completeReindexCompensationLedger(migration, repair)
    if (repair.status !== "completed") await store.markCompleted(repair, new Date().toISOString())
    return migration
  }

  private async completeReindexCompensationLedger(
    migration: ReindexMigration,
    repair: ReindexPublicationCompensationIntent
  ): Promise<void> {
    const compensation = repair.compensation
    if (!compensation) throw new Error("Reindex publication compensation result is missing")
    migration.status = "rolled_back"
    migration.activeDocumentId = compensation.activeDocumentId
    migration.rolledBackAt = compensation.compensatedAt
    migration.updatedAt = new Date().toISOString()
    migration.generation = compensation.generation
    migration.fencingToken = compensation.fencingToken
    migration.checkpoint = compensation.checkpoint
    delete migration.cutoverAt
    await this.saveReindexMigrationLedger([migration])
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

  private async saveReindexMigrationLedger(changes: ReindexMigration[]): Promise<void> {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      let stored: Awaited<ReturnType<Dependencies["objectStore"]["getTextWithVersion"]>> | undefined
      try {
        stored = await this.deps.objectStore.getTextWithVersion(reindexMigrationLedgerKey)
      } catch (error) {
        if (!isMissingObjectError(error)) throw error
      }
      const current = stored
        ? JSON.parse(stored.text) as { migrations?: ReindexMigration[] }
        : undefined
      const byId = new Map((current?.migrations ?? []).map((migration) => [migration.migrationId, migration]))
      for (const migration of changes) byId.set(migration.migrationId, migration)
      const migrations = [...byId.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      try {
        await this.deps.objectStore.putTextIfVersion(
          reindexMigrationLedgerKey,
          JSON.stringify({ schemaVersion: 1, migrations }, null, 2),
          stored?.version,
          "application/json"
        )
        return
      } catch (error) {
        if (!isConditionalObjectWriteError(error)) throw error
      }
    }
    throw new Error("Could not persist reindex migration ledger after concurrent updates")
  }

  private sourceGovernanceApprovalService(): SourceGovernanceApprovalService {
    return new SourceGovernanceApprovalService({
      objectStore: this.deps.objectStore,
      auditOutbox: this.deps.securityAuditOutbox,
      identityProvider: this.deps.verifiedIdentityProvider,
      allowSnapshotActor: !config.authEnabled && config.nodeEnv !== "production",
      authorizeFullResource: (actor, manifest) => this.assertSourceGovernanceResourceFull(actor, manifest),
      cleanupCoordinator: new ObjectStoreRevocationCleanupCoordinator(this.deps.objectStore),
      publisher: {
        stage: (input) => this.stageApprovedSourceGovernancePublication(input),
        commit: (input) => this.commitApprovedSourceGovernancePublication(input.actor, input.staged)
      }
    })
  }

  private resourceGroupMembershipService(): ResourceGroupMembershipService {
    if (!this.deps.resourceUserPrincipalDirectory || !this.deps.securityAuditOutbox) {
      throw new ResourceGroupMembershipUnavailableError()
    }
    return new ResourceGroupMembershipService({
      userGroupStore: this.deps.userGroupStore,
      groupMembershipStore: this.deps.groupMembershipStore,
      userPrincipalDirectory: this.deps.resourceUserPrincipalDirectory,
      auditOutbox: this.deps.securityAuditOutbox,
      cleanupCoordinator: new ObjectStoreRevocationCleanupCoordinator(this.deps.objectStore),
      cleanupRepairStore: new ObjectStoreResourceGroupMembershipCleanupRepairStore(this.deps.objectStore),
      cleanupRepairOutbox: new ObjectStoreRevocationCleanupRepairOutbox(this.deps.objectStore)
    })
  }

  private async stageApprovedSourceGovernancePublication(input: {
    actor: AppUser
    source: DocumentManifest
    sourceVersion: string
    approval: ApprovedSourceGovernancePolicy
  }): Promise<StagedSourceGovernancePublication> {
    const tenantId = input.source.admission?.tenantId ?? stringValue(input.source.metadata?.tenantId)
    const sourceId = input.source.publicationControl?.sourceId ?? input.source.documentId
    if (!tenantId || tenantId !== input.actor.tenantId) throw forbiddenError("Forbidden: source governance publication tenant mismatch")
    const operationId = `source-governance-stage:${sourceId}:${randomUUID()}`
    const authorizePublication = (boundary: WorkerAuthorizationBoundary) => this.assertCurrentWorkerAuthorization({
      runId: operationId,
      targetType: "document_ingest_run",
      subject: input.actor.userId,
      tenantId: input.actor.tenantId,
      snapshotEmail: input.actor.email,
      snapshotGroups: input.actor.cognitoGroups,
      requiredPermissions: ["rag:source:approve"],
      authorizeResource: async (currentActor) => {
        await this.assertSourceGovernanceResourceFull(currentActor, input.source)
        return true
      }
    }, boundary).then(() => undefined)
    await authorizePublication("start")
    const coordinator = new StagedPublicationCoordinator(this.deps)
    const begun = await coordinator.begin({
      scope: {
        tenantId,
        actorId: input.actor.userId,
        sourceId,
        sourceVersion: input.sourceVersion,
        purpose: "ingest"
      },
      sourceManifest: input.source,
      workerId: `source-approval-stage:${input.actor.userId}:${randomUUID()}`
    })
    if (begun.alreadyStaged) {
      if (!begun.run.stagedArtifact) {
        throw new SourceGovernanceUnavailableError(`Source governance publication run is ${begun.run.status}`)
      }
      return {
        runId: begun.run.runId,
        candidate: await this.getManifestByKey(begun.run.stagedArtifact.manifestObjectKey, tenantId)
      }
    }
    if (!begun.lease) throw new SourceGovernanceUnavailableError("Source governance publication lease was not acquired")

    await authorizePublication("protected_read")
    const sourceText = await this.deps.objectStore.getText(input.source.sourceObjectKey)
    const structuredBlocks = await this.loadStructuredBlocks(input.source)
    const admissionContext = createApprovedSourceAdmissionContext(input.source, input.approval, begun.lease.fence)
    const staged = await this.ingest({
      fileName: input.source.fileName,
      text: sourceText,
      structuredBlocks,
      sourceExtractorVersion: input.source.sourceExtractorVersion,
      mimeType: input.source.mimeType,
      metadata: {
        ...(input.source.metadata ?? {}),
        lifecycleStatus: "staging",
        stagedFromDocumentId: sourceId,
        reindexMigrationId: begun.run.runId
      },
      admissionContext,
      publicationFence: begun.lease.fence,
      embeddingModelId: input.source.embeddingModelId,
      currentAuthorization: {
        authorizeExternalSideEffect: () => authorizePublication("external_side_effect"),
        authorizeDurableCommit: () => authorizePublication("durable_commit")
      }
    })
    await coordinator.recordStaged(begun.lease, staged)
    return { runId: begun.run.runId, candidate: staged }
  }

  private async assertSourceGovernanceResourceFull(actor: AppUser, manifest: DocumentManifest): Promise<void> {
    const tenantId = manifest.admission?.tenantId ?? stringValue(manifest.metadata?.tenantId)
    if (!tenantId || actor.tenantId !== tenantId) throw forbiddenError("Forbidden: source governance tenant mismatch")
    const folderIds = stringArray(
      manifest.metadata?.folderIds ?? manifest.metadata?.folderId ?? manifest.metadata?.groupIds ?? manifest.metadata?.groupId
    ) ?? []
    if (folderIds.length > 0) {
      const permissions = await new FolderPermissionService(this.deps).resolveEffectiveFolderPermissions(actor, folderIds)
      if (folderIds.every((folderId) => permissions[folderId] === "full")) return
      throw forbiddenError("Forbidden: source governance requires full folder permission")
    }
    const scopeType = stringValue(manifest.metadata?.scopeType)
    const ownerUserId = manifest.admission?.ownerUserId ?? stringValue(manifest.metadata?.ownerUserId)
    if (scopeType !== "group" && ownerUserId === actor.userId) return
    throw forbiddenError("Forbidden: source governance requires full resource permission")
  }

  private async commitApprovedSourceGovernancePublication(
    actor: AppUser,
    staged: StagedSourceGovernancePublication
  ): Promise<{ activeDocumentId: string; committedAt: string }> {
    const coordinator = new StagedPublicationCoordinator(this.deps)
    try {
      const committed = await coordinator.commit(
        staged.runId,
        `source-approval-commit:${actor.userId}:${randomUUID()}`
      )
      return { activeDocumentId: committed.manifest.documentId, committedAt: committed.pointer.committedAt }
    } catch (error) {
      const reconciled = await coordinator.reconcile(staged.runId).catch(() => undefined)
      if (reconciled?.status === "committed") {
        const committed = await coordinator.commit(
          staged.runId,
          `source-approval-reconcile:${actor.userId}:${randomUUID()}`
        )
        return { activeDocumentId: committed.manifest.documentId, committedAt: committed.pointer.committedAt }
      }
      throw error
    }
  }

  private async getManifest(documentId: string, tenantId = this.documentAccessTenantId()): Promise<DocumentManifest> {
    return readTenantManifest(this.deps, tenantId, documentId)
  }

  private async getManifestByKey(key: string, tenantId: string): Promise<DocumentManifest> {
    return readTenantManifestByKey(this.deps, tenantId, key)
  }

  private documentAccessTenantId(actor?: AppUser): string {
    const actorTenantId = actor?.tenantId?.trim()
    if (actorTenantId) return actorTenantId
    const fixtureTenantId = this.deps.localTestIngestAdmissionContext?.tenantId?.trim()
    if (fixtureTenantId) return fixtureTenantId
    const configuredTenantId = (config.authEnabled ? config.authTenantId : config.localAuthTenantId).trim()
    if (!configuredTenantId) throw forbiddenError("Forbidden: authoritative tenant is required")
    return configuredTenantId
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
    const embeddingCachePartition = stringValue(manifest.metadata?.tenantId)
    if (!embeddingCachePartition) throw new Error("Document tenant is required for embedding cache partition")

    const evidenceRecords = await mapWithConcurrency(chunks, config.embeddingConcurrency, async (chunk): Promise<VectorRecord> => ({
      key: tenantVectorKey(this.deps, embeddingCachePartition, `${manifest.documentId}-${chunk.id}`),
      vector: await embedWithCache(this.deps, {
        text: chunk.text,
        modelId: embeddingModelId,
        dimensions: manifest.embeddingDimensions ?? config.embeddingDimensions,
        partitionKey: embeddingCachePartition
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
        tableId: chunk.tableId,
        tableRowCount: chunk.tableRowCount,
        tableConfidence: chunk.tableConfidence,
        listDepth: chunk.listDepth,
        codeLanguage: chunk.codeLanguage,
        figureCaption: chunk.figureCaption,
        figureId: chunk.figureId,
        confidence: chunk.confidence,
        readingOrder: chunk.readingOrder,
        bbox: chunk.bbox,
        sourceLocation: chunk.sourceLocation,
        extractionMethod: chunk.extractionMethod,
        lifecycleStatus: status,
        ...filterableMetadata,
        createdAt: manifest.createdAt
      }
    }))

    const memoryRecords = await mapWithConcurrency(memoryCards, config.embeddingConcurrency, async (card): Promise<VectorRecord> => ({
      key: tenantVectorKey(this.deps, embeddingCachePartition, `${manifest.documentId}-${card.id}`),
      vector: await embedWithCache(this.deps, {
        text: card.text,
        modelId: embeddingModelId,
        dimensions: manifest.embeddingDimensions ?? config.embeddingDimensions,
        partitionKey: embeddingCachePartition
      }),
      metadata: {
        kind: "memory",
        documentId: manifest.documentId,
        fileName: manifest.fileName,
        memoryId: card.id,
        objectKey: manifest.sourceObjectKey,
        text: card.text,
        sectionPath: card.sectionPath,
        pageStart: card.pageStart,
        pageEnd: card.pageEnd,
        sourceChunkIds: card.sourceChunkIds,
        lifecycleStatus: status,
        ...filterableMetadata,
        createdAt: manifest.createdAt
      }
    }))

    await putDocumentVectorRecords(this.deps, { evidenceRecords, memoryRecords })
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

  async saveConversationHistory(subject: AppUser | string, input: SaveConversationHistoryInput, tenantId?: string): Promise<ConversationHistoryItem> {
    const ownerKey = tenantPartitionedOwnerKey(subject, tenantId)
    return this.deps.conversationHistoryStore.save(ownerKey, { ...input, isFavorite: false })
  }

  async listConversationHistory(subject: AppUser | string, tenantId?: string): Promise<ConversationHistoryItem[]> {
    const ownerKey = tenantPartitionedOwnerKey(subject, tenantId)
    const [history, favorites] = await Promise.all([
      this.deps.conversationHistoryStore.list(ownerKey),
      this.deps.favoriteStore.list(ownerKey)
    ])
    const favoriteChatSessionIds = new Set(favorites
      .filter((favorite) => favorite.targetType === "chatSession")
      .map((favorite) => favorite.targetId))
    return history
      .map((item) => ({ ...item, isFavorite: favoriteChatSessionIds.has(item.id) }))
      .sort(compareConversationHistoryForDisplay)
      .slice(0, 20)
  }

  async deleteConversationHistory(subject: AppUser | string, id: string, tenantId?: string): Promise<void> {
    return this.deps.conversationHistoryStore.delete(tenantPartitionedOwnerKey(subject, tenantId), id)
  }

  async saveFavorite(user: AppUser, input: { targetType: FavoriteTargetType; targetId: string; label?: string; note?: string }): Promise<FavoriteListItem> {
    if (!favoriteTargetResolverImplemented(input.targetType)) {
      throw new Error(`Unsupported favorite target type: ${input.targetType}`)
    }
    const favorite = await this.deps.favoriteStore.save(tenantPartitionedOwnerKey(user), input)
    return this.resolveFavoriteVisibility(user, favorite)
  }

  async deleteFavorite(subject: AppUser | string, targetType: FavoriteTargetType, targetId: string, tenantId?: string): Promise<void> {
    await this.deps.favoriteStore.delete(tenantPartitionedOwnerKey(subject, tenantId), targetType, targetId)
  }

  async listFavorites(user: AppUser): Promise<FavoriteListItem[]> {
    const [favorites, history] = await Promise.all([
      this.deps.favoriteStore.list(tenantPartitionedOwnerKey(user)),
      this.deps.conversationHistoryStore.list(tenantPartitionedOwnerKey(user))
    ])
    const historyIds = new Set(history.map((item) => item.id))
    const documents = new Map((await this.listDocuments(user)).map((document) => [document.documentId, document]))
    const folders = new Map((await this.listDocumentGroups(user)).map((folder) => [folder.groupId, folder]))
    return favorites.map((favorite) => {
      if (favorite.targetType === "chatSession") {
        return favoriteListItem(favorite, historyIds.has(favorite.targetId))
      }
      if (favorite.targetType === "document") {
        const document = documents.get(favorite.targetId)
        return favoriteListItem(favorite, Boolean(document), document?.fileName)
      }
      if (favorite.targetType === "folder") {
        const folder = folders.get(favorite.targetId)
        return favoriteListItem(favorite, Boolean(folder), folder?.canonicalPath ?? folder?.name)
      }
      return favoriteListItem(favorite, false)
    })
  }

  private async resolveFavoriteVisibility(user: AppUser, favorite: FavoriteItem): Promise<FavoriteListItem> {
    if (favorite.targetType === "chatSession") {
      const history = await this.deps.conversationHistoryStore.list(tenantPartitionedOwnerKey(user))
      return favoriteListItem(favorite, history.some((item) => item.id === favorite.targetId))
    }
    if (favorite.targetType === "document") {
      const document = (await this.listDocuments(user)).find((item) => item.documentId === favorite.targetId)
      return favoriteListItem(favorite, Boolean(document), document?.fileName)
    }
    if (favorite.targetType === "folder") {
      const folder = (await this.listDocumentGroups(user)).find((item) => item.groupId === favorite.targetId)
      return favoriteListItem(favorite, Boolean(folder), folder?.canonicalPath ?? folder?.name)
    }
    return favoriteListItem(favorite, false)
  }

  listBenchmarkSuites(): BenchmarkSuite[] {
    return benchmarkSuites
  }

  listAgentRuntimeProviders(): Array<{
    provider: AgentRuntimeProvider
    displayName: string
    availability: AgentProviderAvailability
    reason?: string
    configuredModelIds: string[]
  }> {
    return this.deps.asyncAgentProviders?.list() ?? []
  }

  listAgentProviderSettings(): AgentProviderSetting[] {
    return this.listAgentRuntimeProviders().map((provider) => ({
      provider: provider.provider,
      displayName: provider.displayName,
      availability: provider.availability,
      credentialMode: provider.availability === "disabled"
        ? "disabled"
        : provider.availability === "not_configured"
          ? "not_configured"
          : "environment",
      configuredModelIds: provider.configuredModelIds,
      reason: provider.reason
    }))
  }

  async createAsyncAgentRun(user: AppUser, input: CreateAsyncAgentRunInput): Promise<AsyncAgentRun> {
    await this.assertAsyncAgentSelectionsReadable(user, input)

    const now = new Date().toISOString()
    const agentRunId = createAsyncAgentRunId(now)
    const provider = this.listAgentRuntimeProviders().find((candidate) => candidate.provider === input.provider)
    const availability = provider?.availability ?? "provider_unavailable"
    const blocked = availability !== "available"
    const selectedFolderIds = uniqueStrings(input.selectedFolderIds ?? [])
    const selectedDocumentIds = uniqueStrings(input.selectedDocumentIds ?? [])
    const workspaceId = `workspace_${agentRunId}`
    const run: AsyncAgentRun = {
      agentRunId,
      runId: agentRunId,
      tenantId: user.tenantId ?? defaultTenantId,
      requesterUserId: user.userId,
      requesterEmail: user.email,
      requesterGroups: [...user.cognitoGroups],
      provider: input.provider,
      modelId: input.modelId,
      status: blocked ? "blocked" : "queued",
      providerAvailability: availability,
      failureReasonCode: blocked ? availability === "not_configured" || availability === "disabled" ? "not_configured" : "provider_unavailable" : undefined,
      failureReason: blocked
        ? availability === "not_configured" || availability === "disabled"
          ? "Provider execution is not configured. G1 records the run contract without starting a provider."
          : "Provider is unavailable. G1 does not create mock provider executions."
        : undefined,
      instruction: input.instruction,
      selectedFolderIds,
      selectedDocumentIds,
      selectedSkillIds: uniqueStrings(input.selectedSkillIds ?? []),
      selectedAgentProfileIds: uniqueStrings(input.selectedAgentProfileIds ?? []),
      workspaceId,
      workspaceMounts: [
        ...selectedFolderIds.map((folderId) => ({
          mountId: `mount_${randomUUID().slice(0, 12)}`,
          workspaceId,
          sourceType: "folder" as const,
          sourceId: folderId,
          mountedPath: `/workspace/read-only/folders/${folderId}`,
          accessMode: "readOnly" as const,
          permissionCheckedAt: now
        })),
        ...selectedDocumentIds.map((documentId) => ({
          mountId: `mount_${randomUUID().slice(0, 12)}`,
          workspaceId,
          sourceType: "document" as const,
          sourceId: documentId,
          mountedPath: `/workspace/read-only/documents/${documentId}`,
          accessMode: "readOnly" as const,
          permissionCheckedAt: now
        }))
      ],
      artifactIds: [],
      artifacts: [],
      budget: input.budget,
      createdBy: user.userId,
      createdAt: now,
      completedAt: blocked ? now : undefined,
      updatedAt: now
    }

    await this.saveAsyncAgentRun(run)
    return run
  }

  async listAsyncAgentRuns(user: AppUser): Promise<AsyncAgentRun[]> {
    const runs = await this.loadAsyncAgentRuns(authoritativeActorTenantId(user))
    const canReadManaged = hasPermission(user, "agent:read:managed")
    return runs
      .filter((run) => canReadManaged || run.requesterUserId === user.userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 100)
  }

  async getAsyncAgentRun(user: AppUser, agentRunId: string): Promise<AsyncAgentRun | undefined> {
    const run = await this.loadAsyncAgentRun(authoritativeActorTenantId(user), agentRunId)
    if (!run) return undefined
    if (!this.canReadAsyncAgentRun(user, run)) throw forbiddenError("Forbidden")
    return run
  }

  async cancelAsyncAgentRun(user: AppUser, agentRunId: string): Promise<AsyncAgentRun | undefined> {
    const run = await this.loadAsyncAgentRun(authoritativeActorTenantId(user), agentRunId)
    if (!run) return undefined
    if (!this.canReadAsyncAgentRun(user, run)) throw forbiddenError("Forbidden")
    if (run.status === "completed" || run.status === "failed" || run.status === "cancelled" || run.status === "expired") return run
    const now = new Date().toISOString()
    const updated: AsyncAgentRun = {
      ...run,
      status: "cancelled",
      failureReasonCode: "cancelled",
      failureReason: "Cancelled before provider execution.",
      completedAt: now,
      updatedAt: now
    }
    await this.saveAsyncAgentRun(updated)
    return updated
  }

  async listAsyncAgentArtifacts(user: AppUser, agentRunId: string): Promise<AsyncAgentRun["artifacts"] | undefined> {
    const run = await this.getAsyncAgentRun(user, agentRunId)
    return run?.artifacts
  }

  async getAsyncAgentArtifact(user: AppUser, agentRunId: string, artifactId: string): Promise<AsyncAgentRun["artifacts"][number] | undefined> {
    const artifacts = await this.listAsyncAgentArtifacts(user, agentRunId)
    return artifacts?.find((artifact) => artifact.artifactId === artifactId)
  }

  async updateAsyncAgentArtifactWriteback(
    user: AppUser,
    agentRunId: string,
    artifactId: string,
    input: {
      action: "request" | "approve" | "reject" | "apply"
      target?: NonNullable<AsyncAgentRun["artifacts"][number]["writebackTarget"]>
      reason?: string
    }
  ): Promise<AsyncAgentRun["artifacts"][number] | undefined> {
    const run = await this.getAsyncAgentRun(user, agentRunId)
    if (!run) return undefined
    const artifact = run.artifacts.find((candidate) => candidate.artifactId === artifactId)
    if (!artifact) return undefined
    const now = new Date().toISOString()
    const target = input.target ?? artifact.writebackTarget
    if ((input.action === "request" || input.action === "approve" || input.action === "apply") && !target) {
      throw new Error("Writeback target is required")
    }
    if (target) await this.assertAsyncAgentWritebackTargetFull(user, target)

    const nextArtifact = { ...artifact }
    if (input.action === "request") {
      nextArtifact.writebackStatus = "pending_approval"
      nextArtifact.writebackTarget = target
      nextArtifact.writebackRequestedBy = user.userId
      nextArtifact.writebackRequestedAt = now
      nextArtifact.writebackDecisionReason = trimOptional(input.reason)
    } else if (input.action === "approve") {
      if (artifact.writebackStatus !== "pending_approval") throw new Error("Only pending writeback can be approved")
      nextArtifact.writebackStatus = "approved"
      nextArtifact.writebackReviewedBy = user.userId
      nextArtifact.writebackReviewedAt = now
      nextArtifact.writebackDecisionReason = trimOptional(input.reason)
    } else if (input.action === "reject") {
      if (artifact.writebackStatus !== "pending_approval") throw new Error("Only pending writeback can be rejected")
      nextArtifact.writebackStatus = "rejected"
      nextArtifact.writebackReviewedBy = user.userId
      nextArtifact.writebackReviewedAt = now
      nextArtifact.writebackDecisionReason = trimOptional(input.reason)
    } else {
      if (artifact.writebackStatus !== "approved") throw new Error("Only approved writeback can be applied")
      nextArtifact.writebackStatus = "applied"
      nextArtifact.writebackAppliedBy = user.userId
      nextArtifact.writebackAppliedAt = now
      nextArtifact.writebackDecisionReason = trimOptional(input.reason)
    }

    const updatedRun: AsyncAgentRun = {
      ...run,
      status: input.action === "request" ? "waiting_for_approval" : run.status,
      updatedAt: now,
      artifacts: run.artifacts.map((candidate) => candidate.artifactId === artifactId ? nextArtifact : candidate)
    }
    await this.saveAsyncAgentRun(updatedRun)
    return nextArtifact
  }

  async executeAsyncAgentRun(tenantId: string, runId: string): Promise<AsyncAgentRun> {
    const run = await this.loadAsyncAgentRun(tenantId, runId)
    if (!run) throw new Error(`Async agent run not found: ${runId}`)
    if (run.status === "blocked" || run.status === "failed" || run.status === "cancelled" || run.status === "completed") return run
    try {
      await this.authorizeAsyncAgentRunBoundary(run, "start")
      await this.authorizeAsyncAgentRunBoundary(run, "protected_read")
    } catch (error) {
      if (isPermissionRevokedError(error)) return this.failAsyncAgentPermission(run)
      throw error
    }
    const now = new Date().toISOString()
    const provider = this.deps.asyncAgentProviders?.get(run.provider)
    const providerDefinition = provider?.definition()
    if (!provider || providerDefinition?.availability !== "available") {
      const updated: AsyncAgentRun = {
        ...run,
        status: "blocked",
        providerAvailability: providerDefinition?.availability ?? "provider_unavailable",
        failureReasonCode: providerDefinition?.availability === "not_configured" || providerDefinition?.availability === "disabled" ? "not_configured" : "provider_unavailable",
        failureReason: providerDefinition?.reason ?? "Provider execution is not configured.",
        completedAt: now,
        updatedAt: now
      }
      await this.saveAsyncAgentRun(updated)
      return updated
    }

    const running: AsyncAgentRun = {
      ...run,
      status: "running",
      providerAvailability: "available",
      startedAt: run.startedAt ?? now,
      updatedAt: now
    }
    await this.saveAsyncAgentRun(running)

    const input: AsyncAgentProviderInput = {
      agentRunId: running.agentRunId,
      requesterUserId: running.requesterUserId,
      provider: running.provider,
      modelId: running.modelId,
      instruction: running.instruction,
      workspaceId: running.workspaceId,
      workspaceMounts: running.workspaceMounts,
      selectedSkillIds: running.selectedSkillIds,
      selectedAgentProfileIds: running.selectedAgentProfileIds,
      budget: running.budget
    }
    try {
      await this.authorizeAsyncAgentRunBoundary(running, "external_side_effect")
    } catch (error) {
      if (isPermissionRevokedError(error)) return this.failAsyncAgentPermission(running)
      throw error
    }
    const result: AsyncAgentProviderResult = await provider.execute(input).catch((error: unknown) => ({
      status: "failed" as const,
      failureReason: error instanceof Error ? error.message : "Provider execution failed."
    }))
    const completedAt = new Date().toISOString()
    try {
      await this.authorizeAsyncAgentRunBoundary(running, "durable_commit")
    } catch (error) {
      if (isPermissionRevokedError(error)) return this.failAsyncAgentPermission(running)
      throw error
    }
    const artifacts = result.status === "completed"
      ? await this.persistAsyncAgentArtifacts(running, result.artifacts, completedAt, result.logText)
      : result.logText
        ? await this.persistAsyncAgentArtifacts(running, [{
            artifactType: "log",
            fileName: "provider-log.txt",
            mimeType: "text/plain",
            text: result.logText,
            writebackStatus: "not_requested"
          }], completedAt)
        : []
    try {
      // Artifact bytes are a durable side effect. Re-check immediately after
      // the writes, then once more immediately before publishing success.
      await this.authorizeAsyncAgentRunBoundary(running, "durable_commit")
    } catch (error) {
      if (isPermissionRevokedError(error)) return this.failAsyncAgentPermission(running, artifacts)
      throw error
    }
    const updated: AsyncAgentRun = {
      ...running,
      status: result.status,
      failureReasonCode: result.status === "completed" ? undefined : "execution_error",
      failureReason: result.status === "completed" ? undefined : sanitizeProviderText(result.failureReason),
      completedAt,
      updatedAt: completedAt,
      artifacts,
      artifactIds: artifacts.map((artifact) => artifact.artifactId)
    }
    try {
      await this.authorizeAsyncAgentRunBoundary(running, "durable_commit")
    } catch (error) {
      if (isPermissionRevokedError(error)) return this.failAsyncAgentPermission(running, artifacts)
      throw error
    }
    await this.saveAsyncAgentRun(updated)
    return updated
  }

  private async failAsyncAgentPermission(
    run: AsyncAgentRun,
    newlyWrittenArtifacts: AsyncAgentRun["artifacts"] = []
  ): Promise<AsyncAgentRun> {
    await Promise.all(newlyWrittenArtifacts.map((artifact) => this.deps.objectStore.deleteObject(artifact.storageRef)))
    const completedAt = new Date().toISOString()
    const failed: AsyncAgentRun = {
      ...run,
      status: "failed",
      failureReasonCode: "permission_revoked",
      failureReason: "permission_revoked",
      artifactIds: [],
      artifacts: [],
      completedAt,
      updatedAt: completedAt
    }
    await this.saveAsyncAgentRun(failed)
    return failed
  }

  private async persistAsyncAgentArtifacts(
    run: AsyncAgentRun,
    artifacts: AsyncAgentProviderArtifact[],
    createdAt: string,
    logText?: string
  ): Promise<AsyncAgentRun["artifacts"]> {
    const normalizedArtifacts = [...artifacts]
    if (logText?.trim()) {
      normalizedArtifacts.push({
        artifactType: "log",
        fileName: "provider-log.txt",
        mimeType: "text/plain",
        text: logText,
        writebackStatus: "not_requested"
      })
    }

    const persisted = await Promise.all(normalizedArtifacts.map(async (artifact) => {
      const artifactId = `artifact_${randomUUID().slice(0, 12)}`
      const fileName = sanitizeArtifactFileName(artifact.fileName)
      const storageRef = `${asyncAgentRunPrefix(run.tenantId)}${encodeURIComponent(run.agentRunId)}/artifacts/${artifactId}/${fileName}`
      const text = sanitizeProviderText(artifact.text)
      await this.deps.objectStore.putText(storageRef, text)
      return {
        artifactId,
        agentRunId: run.agentRunId,
        artifactType: artifact.artifactType,
        fileName,
        mimeType: artifact.mimeType,
        size: Buffer.byteLength(text, "utf-8"),
        storageRef,
        createdAt,
        writebackStatus: artifact.writebackStatus ?? "not_requested"
      }
    }))
    return persisted
  }

  async createBenchmarkRun(user: AppUser, input: CreateBenchmarkRunInput): Promise<BenchmarkRun> {
    const suite = benchmarkSuites.find((candidate) => candidate.suiteId === (input.suiteId ?? "standard-agent-v1"))
    if (!suite) throw new Error(`Unknown benchmark suite: ${input.suiteId}`)
    if ((input.mode ?? suite.mode) !== suite.mode) throw new Error(`Suite ${suite.suiteId} does not support mode ${input.mode}`)
    if ((input.runner ?? "codebuild") !== "codebuild") throw new Error("Only codebuild runner is supported in this version")

    const now = new Date().toISOString()
    const runId = createBenchmarkRunId(now)
    const tenantId = authoritativeActorTenantId(user)
    const outputPrefix = `runs/${tenantPartitionId(tenantId)}/${runId}`
    const run: BenchmarkRun = {
      runId,
      status: "queued",
      mode: suite.mode,
      runner: "codebuild",
      suiteId: suite.suiteId,
      datasetS3Key: suite.datasetS3Key,
      createdBy: user.userId,
      tenantId,
      securityResourceRefs: await this.securityResourceRefsForActor(user),
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
      await this.authorizeBenchmarkRunBoundary(run, "start")
      await this.authorizeBenchmarkRunBoundary(run, "protected_read")
      await this.authorizeBenchmarkRunBoundary(run, "external_side_effect")
      const executionArn = await this.startBenchmarkExecution(run, outputPrefix)
      await this.authorizeBenchmarkRunBoundary(run, "durable_commit")
      return this.deps.benchmarkRunStore.update(run.tenantId, run.runId, { executionArn })
    } catch (err) {
      const permissionRevoked = isPermissionRevokedError(err)
      const failed = await this.deps.benchmarkRunStore.update(run.tenantId, run.runId, {
        status: "failed",
        completedAt: new Date().toISOString(),
        error: permissionRevoked ? "permission_revoked" : err instanceof Error ? err.message : String(err),
        errorCode: permissionRevoked ? "permission_revoked" : "execution_error"
      })
      if (permissionRevoked) return failed
      throw err
    }
  }

  async reauthorizeBenchmarkRunExecution(
    tenantId: string,
    runId: string,
    boundary: WorkerAuthorizationBoundary
  ): Promise<BenchmarkRun> {
    const run = await this.deps.benchmarkRunStore.get(tenantId, runId)
    if (!run) throw new PermissionRevokedError("benchmark_run_unavailable")
    if (run.status === "failed" && run.errorCode === "permission_revoked") {
      throw new PermissionRevokedError("benchmark_run_authorization_already_revoked")
    }
    if (boundary === "start" ? run.status !== "queued" : run.status !== "running") {
      throw new Error("benchmark_run_not_active")
    }
    try {
      await this.authorizeBenchmarkRunBoundary(run, boundary)
      return run
    } catch (error) {
      if (!isPermissionRevokedError(error)) throw error
      const completedAt = new Date().toISOString()
      const failed = await this.deps.benchmarkRunStore.update(tenantId, runId, {
        status: "failed",
        error: "permission_revoked",
        errorCode: "permission_revoked",
        completedAt,
        updatedAt: completedAt
      })
      await this.reconcileRevokedBenchmarkArtifacts(failed, boundary, error)
      throw error
    }
  }

  private async reconcileRevokedBenchmarkArtifacts(
    run: BenchmarkRun,
    boundary: WorkerAuthorizationBoundary,
    revoked: PermissionRevokedError
  ): Promise<void> {
    const targets = benchmarkEvaluationArtifactTargets(run)
    const coordinator = new ObjectStoreRevocationCleanupCoordinator(this.deps.objectStore)
    const operationId = `benchmark-artifact-revoke:${run.runId}`
    await coordinator.register({
      operationId,
      tenantId: run.tenantId,
      resourceType: "benchmark_run",
      resourceId: run.runId,
      trigger: benchmarkRevocationTrigger(revoked),
      deniedPurposes: ["evaluation", `worker_boundary:${boundary}`],
      authoritativeDenyVersion: run.updatedAt,
      authoritativeDenyConfirmedAt: run.completedAt ?? run.updatedAt,
      knownTargets: targets
    })
    await coordinator.reconcile(
      run.tenantId,
      operationId,
      this.benchmarkArtifactCleanupDriver(run, targets)
    ).catch(() => undefined)
  }

  private benchmarkArtifactCleanupDriver(
    run: BenchmarkRun,
    targets: readonly RevocationCleanupTargetReference[]
  ): RevocationCleanupDriver {
    const artifactStore = this.deps.benchmarkArtifactStore
    const allowedReferences = new Set(targets.map((target) => target.reference))
    const prefix = benchmarkRunArtifactPrefix(run)
    return {
      isAuthoritativeDenyCurrent: async (manifest: RevocationCleanupManifest) => {
        const current = await this.deps.benchmarkRunStore.get(run.tenantId, run.runId)
        return current?.status === "failed"
          && current.errorCode === "permission_revoked"
          && current.updatedAt === manifest.authoritativeDeny.version
      },
      discover: async (_manifest: RevocationCleanupManifest, scope: RevocationCleanupScope) => (
        scope === "evaluation_artifact" ? targets : []
      ),
      cleanup: async (_manifest: RevocationCleanupManifest, target: RevocationCleanupTarget) => {
        if (!artifactStore) throw new Error("Benchmark artifact cleanup store is unavailable")
        if (target.scope !== "evaluation_artifact" || !allowedReferences.has(target.reference)) {
          throw new Error("Benchmark artifact cleanup target escaped its run partition")
        }
        await artifactStore.deleteObject(target.reference)
      },
      findResiduals: async (_manifest: RevocationCleanupManifest, scope: RevocationCleanupScope) => {
        if (scope !== "evaluation_artifact") return []
        if (!artifactStore) throw new Error("Benchmark artifact cleanup store is unavailable")
        const existing = new Set(await artifactStore.listKeys(prefix))
        return targets.filter((target) => existing.has(target.reference))
      }
    }
  }

  async listBenchmarkRuns(actor: AppUser): Promise<BenchmarkRun[]> {
    return this.deps.benchmarkRunStore.list(authoritativeActorTenantId(actor))
  }

  async getBenchmarkRun(actor: AppUser, runId: string): Promise<BenchmarkRun | undefined> {
    return this.deps.benchmarkRunStore.get(authoritativeActorTenantId(actor), runId)
  }

  async cancelBenchmarkRun(actor: AppUser, runId: string): Promise<BenchmarkRun | undefined> {
    const tenantId = authoritativeActorTenantId(actor)
    const run = await this.deps.benchmarkRunStore.get(tenantId, runId)
    if (!run) return undefined
    if (run.executionArn) {
      const states = new SFNClient({ region: config.region })
      await states.send(new StopExecutionCommand({
        executionArn: run.executionArn,
        cause: "Cancelled from MemoRAG admin benchmark view"
      }))
    }
    return this.deps.benchmarkRunStore.update(tenantId, runId, {
      status: "cancelled",
      completedAt: new Date().toISOString()
    })
  }

  async createBenchmarkArtifactDownloadUrl(actor: AppUser, runId: string, artifact: BenchmarkDownloadArtifact): Promise<{ url: string; expiresInSeconds: number; objectKey: string } | undefined> {
    const run = await this.deps.benchmarkRunStore.get(authoritativeActorTenantId(actor), runId)
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

  async getBenchmarkCodeBuildLogText(actor: AppUser, runId: string): Promise<{ text: string; fileName: string; contentDisposition: string } | undefined> {
    const run = await this.deps.benchmarkRunStore.get(authoritativeActorTenantId(actor), runId)
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

  private async assertCurrentWorkerAuthorization(
    input: Omit<CurrentWorkerAuthorizationRequest, "tenantId"> & {
      tenantId?: string
      snapshotEmail?: string
      snapshotGroups?: string[]
    },
    boundary: WorkerAuthorizationBoundary
  ): Promise<AppUser> {
    const tenantId = input.tenantId?.trim()
    if (this.deps.verifiedIdentityProvider) {
      if (!tenantId) throw new PermissionRevokedError("worker_tenant_missing")
      return new CurrentWorkerAuthorization(this.deps.verifiedIdentityProvider).assertAuthorized({
        ...input,
        tenantId
      }, boundary)
    }

    // Local/test execution is an explicit compatibility seam. Production auth
    // must never fall back to the submit-time group snapshot.
    if (config.authEnabled) throw new PermissionRevokedError("authoritative_identity_provider_missing")
    const localUser: AppUser = {
      userId: input.subject,
      identityUsername: input.subject,
      email: input.snapshotEmail,
      cognitoGroups: [...(input.snapshotGroups ?? [])],
      accountStatus: "active",
      tenantId: tenantId || defaultTenantId
    }
    if (config.nodeEnv !== "test" && !input.requiredPermissions.every((permission) => hasPermission(localUser, permission))) {
      throw new PermissionRevokedError("local_fixture_permission_missing")
    }
    let resourceAllowed: boolean
    try {
      resourceAllowed = await input.authorizeResource(localUser, boundary)
    } catch {
      resourceAllowed = false
    }
    if (!resourceAllowed) throw new PermissionRevokedError("local_fixture_resource_policy_denied")
    return localUser
  }

  private async getChatRunExecutionEnvelope(tenantId: string, runId: string): Promise<ChatRunExecutionEnvelope | undefined> {
    if (this.deps.chatRunStore.getExecutionEnvelope) {
      return this.deps.chatRunStore.getExecutionEnvelope(tenantId, runId)
    }
    if (config.authEnabled) throw new PermissionRevokedError("chat_run_execution_projection_unavailable")
    const run = await this.deps.chatRunStore.get(tenantId, runId)
    return run ? chatRunExecutionEnvelope(run) : undefined
  }

  private async updateChatRunIfStatus(
    tenantId: string,
    runId: string,
    expectedStatus: ChatRun["status"],
    input: Parameters<NonNullable<Dependencies["chatRunStore"]["updateIfStatus"]>>[3]
  ): Promise<boolean> {
    if (this.deps.chatRunStore.updateIfStatus) {
      return this.deps.chatRunStore.updateIfStatus(tenantId, runId, expectedStatus, input)
    }
    if (config.authEnabled) throw new PermissionRevokedError("chat_run_conditional_transition_unavailable")
    const current = await this.deps.chatRunStore.get(tenantId, runId)
    if (!current || current.status !== expectedStatus) return false
    await this.deps.chatRunStore.update(tenantId, runId, input)
    return true
  }

  private async resolveConcurrentChatRun(
    tenantId: string,
    runId: string,
    fallback: ChatRunExecutionEnvelope
  ): Promise<ChatRun> {
    const current = await this.getChatRunExecutionEnvelope(tenantId, runId)
    if (!current) throw new Error(`Chat run not found: ${runId}`)
    if (current.status === "succeeded") {
      await this.authorizeChatRunBoundary(current, "protected_read")
      const run = await this.deps.chatRunStore.get(tenantId, runId)
      if (run) return run
    }
    return minimizedChatRunEnvelope({ ...fallback, ...current })
  }

  private authorizeChatRunBoundary(run: ChatRunExecutionEnvelope, boundary: WorkerAuthorizationBoundary): Promise<AppUser> {
    return this.assertCurrentWorkerAuthorization({
      runId: run.runId,
      targetType: "chat_run",
      subject: run.createdBy,
      tenantId: run.tenantId,
      snapshotEmail: run.userEmail,
      snapshotGroups: run.userGroups,
      requiredPermissions: ["chat:create"],
      authorizeResource: async (user) => {
        await this.assertSearchScopeReadable(user, run.searchScope)
        return true
      }
    }, boundary)
  }

  private authorizeDocumentIngestRunBoundary(run: DocumentIngestRun, boundary: WorkerAuthorizationBoundary): Promise<AppUser> {
    const requiredPermission = run.purpose === "benchmarkSeed"
      ? "benchmark:seed_corpus" as const
      : run.purpose === "chatAttachment"
        ? "chat:create" as const
        : "rag:doc:write:group" as const
    return this.assertCurrentWorkerAuthorization({
      runId: run.runId,
      targetType: "document_ingest_run",
      subject: run.createdBy,
      tenantId: run.tenantId,
      snapshotEmail: run.userEmail,
      snapshotGroups: run.userGroups,
      requiredPermissions: [requiredPermission],
      authorizeResource: (user) => this.isDocumentIngestContextAuthorized(user, {
        createdBy: run.createdBy,
        purpose: run.purpose,
        admissionContext: run.admissionContext
      })
    }, boundary)
  }

  private async isDocumentIngestContextAuthorized(user: AppUser, input: {
    createdBy: string
    purpose: "document" | "benchmarkSeed" | "chatAttachment"
    admissionContext?: IngestAdmissionContext
  }): Promise<boolean> {
    if (user.userId !== input.createdBy) return false
    const context = input.admissionContext
    if (!context && !this.deps.verifiedIdentityProvider && !config.authEnabled && config.nodeEnv !== "production") return true
    if (context?.mode === "local_test_fixture") return config.nodeEnv !== "production"
    if (!context || context.mode !== "authoritative") return false
    if (input.purpose === "benchmarkSeed") {
      if (
        context.tenantId !== config.benchmarkEvaluationTenantId
        || context.scope?.scopeType !== "benchmark"
        || !context.ownerUserId.startsWith("benchmark-evaluation:")
      ) return false
    } else {
      if (context.ownerUserId !== user.userId || context.tenantId !== user.tenantId) return false
    }
    if (context.scope?.expiresAt && Date.parse(context.scope.expiresAt) <= Date.now()) return false
    if (context.scope?.allowedUsers?.length && !context.scope.allowedUsers.includes(user.userId)) return false
    const groupIds = uniqueStrings([
      ...(context.scope?.groupIds ?? []),
      ...(context.scope?.folderIds ?? [])
    ])
    if (groupIds.length > 0) await this.assertDocumentGroupsWritable(user, groupIds)
    return true
  }

  private authorizeAsyncAgentRunBoundary(run: AsyncAgentRun, boundary: WorkerAuthorizationBoundary): Promise<AppUser> {
    return this.assertCurrentWorkerAuthorization({
      runId: run.runId,
      targetType: "async_agent_run",
      subject: run.requesterUserId,
      tenantId: run.tenantId,
      snapshotEmail: run.requesterEmail,
      snapshotGroups: run.requesterGroups ?? (config.nodeEnv === "test" ? ["SYSTEM_ADMIN"] : []),
      requiredPermissions: ["agent:read:self"],
      authorizeResource: async (user) => {
        if (user.userId !== run.requesterUserId) return false
        await this.assertAsyncAgentSelectionsReadable(user, {
          provider: run.provider,
          modelId: run.modelId,
          instruction: run.instruction,
          selectedFolderIds: run.selectedFolderIds,
          selectedDocumentIds: run.selectedDocumentIds,
          selectedSkillIds: run.selectedSkillIds,
          selectedAgentProfileIds: run.selectedAgentProfileIds,
          budget: run.budget
        })
        return true
      }
    }, boundary)
  }

  private authorizeBenchmarkRunBoundary(run: BenchmarkRun, boundary: WorkerAuthorizationBoundary): Promise<AppUser> {
    return this.assertCurrentWorkerAuthorization({
      runId: run.runId,
      targetType: "benchmark_run",
      subject: run.createdBy,
      tenantId: run.tenantId,
      requiredPermissions: ["benchmark:run"],
      authorizeResource: () => benchmarkSuites.some((suite) => suite.suiteId === run.suiteId && suite.mode === run.mode)
    }, boundary)
  }

  private async assertAsyncAgentSelectionsReadable(user: AppUser, input: CreateAsyncAgentRunInput): Promise<void> {
    const selectedFolderIds = uniqueStrings(input.selectedFolderIds ?? [])
    const selectedDocumentIds = uniqueStrings(input.selectedDocumentIds ?? [])
    await this.assertSearchScopeReadable(user, { groupIds: selectedFolderIds })

    if (selectedDocumentIds.length > 0) {
      const readableDocuments = new Set((await this.listDocuments(user)).map((document) => document.documentId))
      for (const documentId of selectedDocumentIds) {
        if (!readableDocuments.has(documentId)) throw forbiddenError("Forbidden")
      }
    }

    if ((input.selectedSkillIds?.length ?? 0) > 0 && !hasPermission(user, "skill:read")) throw forbiddenError("Forbidden")
    if ((input.selectedAgentProfileIds?.length ?? 0) > 0 && !hasPermission(user, "agent_profile:read")) throw forbiddenError("Forbidden")
  }

  private async assertAsyncAgentWritebackTargetFull(
    user: AppUser,
    target: NonNullable<AsyncAgentRun["artifacts"][number]["writebackTarget"]>
  ): Promise<void> {
    if (target.sourceType === "folder") {
      await this.assertDocumentGroupsWritable(user, [target.sourceId])
      return
    }

    const manifest = await this.getManifest(target.sourceId, authoritativeActorTenantId(user))
    const groupIds = stringArray(manifest.metadata?.groupIds ?? manifest.metadata?.groupId) ?? []
    if (groupIds.length > 0) {
      await this.assertDocumentGroupsWritable(user, groupIds)
      return
    }
    if (stringValue(manifest.metadata?.ownerUserId) === user.userId && hasPermission(user, "rag:doc:write:group")) return
    throw forbiddenError("Forbidden")
  }

  private canReadAsyncAgentRun(user: AppUser, run: AsyncAgentRun): boolean {
    if (run.tenantId !== authoritativeActorTenantId(user)) return false
    if (run.requesterUserId === user.userId && hasPermission(user, "agent:read:self")) return true
    return hasPermission(user, "agent:read:managed")
  }

  private async loadAsyncAgentRuns(tenantId: string): Promise<AsyncAgentRun[]> {
    const prefix = asyncAgentRunPrefix(tenantId)
    const keys = await this.deps.objectStore.listKeys(prefix)
    const runs = await Promise.all(
      keys
        .filter((key) => key.startsWith(prefix) && /^agent-runs\/tenant:[a-f0-9]{24}\/runs\/[^/]+\.json$/u.test(key))
        .map(async (key) => JSON.parse(await this.deps.objectStore.getText(key)) as AsyncAgentRun)
    )
    return runs.map((run) => assertAsyncAgentTenant(normalizeAsyncAgentRun(run), tenantId))
  }

  private async loadAsyncAgentRun(tenantId: string, agentRunId: string): Promise<AsyncAgentRun | undefined> {
    try {
      const run = normalizeAsyncAgentRun(JSON.parse(await this.deps.objectStore.getText(asyncAgentRunObjectKey(tenantId, agentRunId))) as AsyncAgentRun)
      return assertAsyncAgentTenant(run, tenantId)
    } catch (error: unknown) {
      if (isMissingObjectError(error)) {
        try {
          await this.deps.objectStore.getText(`agent-runs/${encodeURIComponent(agentRunId)}.json`)
          throw new Error("Legacy unscoped async agent run requires tenant migration", { cause: error })
        } catch (legacyError) {
          if (isMissingObjectError(legacyError)) return undefined
          throw legacyError
        }
      }
      throw error
    }
  }

  private async saveAsyncAgentRun(run: AsyncAgentRun): Promise<void> {
    await this.deps.objectStore.putText(asyncAgentRunObjectKey(run.tenantId, run.agentRunId), JSON.stringify(run, null, 2), "application/json; charset=utf-8")
  }

  private async startBenchmarkExecution(run: BenchmarkRun, outputPrefix: string): Promise<string> {
    const states = new SFNClient({ region: config.region })
    const response = await states.send(
      new StartExecutionCommand({
        stateMachineArn: config.benchmarkStateMachineArn,
        name: workerExecutionName(run.tenantId, run.runId),
        input: JSON.stringify({
          runId: run.runId,
          storageRunId: tenantStorageKey(run.tenantId, run.runId),
          createdBy: run.createdBy,
          tenantId: run.tenantId,
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

  private async startChatRunExecution(tenantId: string, runId: string): Promise<string> {
    const states = new SFNClient({ region: config.region })
    const response = await states.send(
      new StartExecutionCommand({
        stateMachineArn: config.chatRunStateMachineArn,
        name: workerExecutionName(tenantId, runId),
        input: JSON.stringify({ runId, tenantId })
      })
    )
    if (!response.executionArn) throw new Error("Step Functions executionArn was not returned")
    return response.executionArn
  }

  private async startDocumentIngestRunExecution(tenantId: string, runId: string): Promise<string> {
    const states = new SFNClient({ region: config.region })
    const response = await states.send(
      new StartExecutionCommand({
        stateMachineArn: config.documentIngestRunStateMachineArn,
        name: workerExecutionName(tenantId, runId),
        input: JSON.stringify({ runId, tenantId })
      })
    )
    if (!response.executionArn) throw new Error("Step Functions executionArn was not returned")
    return response.executionArn
  }



  async createDebugTraceDownloadUrl(runId: string, actor?: AppUser): Promise<{ url: string; expiresInSeconds: number; objectKey: string } | undefined> {
    if (!config.debugDownloadBucketName) throw new Error("DEBUG_DOWNLOAD_BUCKET_NAME is not configured")
    const trace = await this.getDebugRun(runId, actor)
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
      ...chunkPageRange(input.chunks),
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
      ...chunkPageRange(sectionChunks),
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
      ...chunkPageRange(sourceChunks),
      sectionPath: sourceChunks[0]?.sectionPath,
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

function chunkPageRange(chunks: Chunk[]): Pick<MemoryCard, "pageStart" | "pageEnd"> {
  const starts = chunks.map((chunk) => chunk.pageStart).filter((page): page is number => typeof page === "number" && Number.isFinite(page))
  const ends = chunks.map((chunk) => chunk.pageEnd ?? chunk.pageStart).filter((page): page is number => typeof page === "number" && Number.isFinite(page))
  return {
    ...(starts.length > 0 ? { pageStart: Math.min(...starts) } : {}),
    ...(ends.length > 0 ? { pageEnd: Math.max(...ends) } : {})
  }
}

function benchmarkRunArtifactPrefix(run: Pick<BenchmarkRun, "tenantId" | "runId">): string {
  return `runs/${tenantPartitionId(run.tenantId)}/${run.runId}/`
}

function benchmarkEvaluationArtifactTargets(run: BenchmarkRun): RevocationCleanupTargetReference[] {
  const prefix = benchmarkRunArtifactPrefix(run)
  return ["results.jsonl", "summary.json", "report.md", "release-audit.json"].map((fileName) => ({
    scope: "evaluation_artifact",
    reference: `${prefix}${fileName}`
  }))
}

function benchmarkRevocationTrigger(error: PermissionRevokedError): "account_revoked" | "role_revoked" {
  return ["account_deleted", "account_inactive", "subject_mismatch", "tenant_membership_revoked"].includes(error.denialReason)
    ? "account_revoked"
    : "role_revoked"
}

function createBenchmarkRunId(now: string): string {
  const compact = now.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
  return `bench_${compact}_${randomUUID().slice(0, 8)}`
}

function createAsyncAgentRunId(now: string): string {
  const compact = now.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
  return `agent_${compact}_${randomUUID().slice(0, 8)}`
}

function sanitizeArtifactFileName(fileName: string): string {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^_+/, "")
  return sanitized || "artifact.txt"
}

function createChatRunId(now: string): string {
  const compact = now.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
  return `chat_${compact}_${randomUUID().slice(0, 8)}`
}

function chatRunExecutionEnvelope(run: ChatRun): ChatRunExecutionEnvelope {
  return {
    runId: run.runId,
    tenantId: run.tenantId,
    status: run.status,
    createdBy: run.createdBy,
    userEmail: run.userEmail,
    userGroups: run.userGroups,
    securityResourceRefs: run.securityResourceRefs,
    searchScope: run.searchScope,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    error: run.error,
    errorCode: run.errorCode,
    ttl: run.ttl
  }
}

function minimizedChatRunEnvelope(envelope: ChatRunExecutionEnvelope): ChatRun {
  return {
    ...envelope,
    question: "",
    modelId: ""
  }
}

function minimizedFailedChatRun(
  run: ChatRun | ChatRunExecutionEnvelope,
  patch: {
    status: "failed"
    error: string
    errorCode: ChatRun["errorCode"]
    completedAt: string
    updatedAt: string
  }
): ChatRun {
  const minimized = minimizedChatRunEnvelope("question" in run ? chatRunExecutionEnvelope(run) : run)
  return { ...minimized, ...patch }
}

function createDocumentIngestRunId(now: string): string {
  const compact = now.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
  return `ingest_${compact}_${randomUUID().slice(0, 8)}`
}

function asyncAgentRunPrefix(tenantId: string): string {
  return `agent-runs/${tenantPartitionId(tenantId)}/runs/`
}

function asyncAgentRunObjectKey(tenantId: string, agentRunId: string): string {
  return `${asyncAgentRunPrefix(tenantId)}${encodeURIComponent(agentRunId)}.json`
}

function workerExecutionName(tenantId: string, runId: string): string {
  return `${tenantPartitionId(tenantId).replace(":", "-")}-${runId}`
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 80)
}

function normalizeAsyncAgentRun(run: AsyncAgentRun): AsyncAgentRun {
  return {
    ...run,
    runId: run.runId ?? run.agentRunId,
    workspaceMounts: run.workspaceMounts ?? [],
    artifactIds: run.artifactIds ?? [],
    artifacts: run.artifacts ?? []
  }
}

function assertAsyncAgentTenant(run: AsyncAgentRun, tenantId: string): AsyncAgentRun {
  if (run.tenantId !== tenantId) throw new Error("Async agent run tenant storage integrity mismatch")
  return run
}

function buildParsedDocumentPreview(manifest: DocumentManifest): ParsedDocumentPreview {
  const parsed = manifest.parsedDocument
  const warnings = [
    ...(manifest.extractionWarnings ?? []),
    ...(parsed?.warnings ?? [])
  ].slice(0, 50)
  if (!parsed) {
    return {
      documentId: manifest.documentId,
      fileName: manifest.fileName,
      sourceExtractorVersion: manifest.sourceExtractorVersion,
      fileProfile: manifest.fileProfile,
      pageCount: 0,
      blockCount: manifest.chunks?.length ?? 0,
      tableCount: 0,
      figureCount: 0,
      warnings,
      counters: manifest.extractionCounters,
      qualityProfile: manifest.qualityProfile ?? documentQualityProfileFromMetadata(manifest.metadata),
      available: false,
      unavailableReason: "parsed document preview is not available for this manifest"
    }
  }

  return {
    documentId: manifest.documentId,
    fileName: manifest.fileName,
    sourceExtractorVersion: parsed.sourceExtractorVersion ?? manifest.sourceExtractorVersion,
    fileProfile: parsed.fileProfile ?? manifest.fileProfile,
    textPreview: parsed.text.replace(/\s+/g, " ").trim().slice(0, 4000) || undefined,
    pageCount: parsed.pages?.length ?? 0,
    blockCount: parsed.blocks?.length ?? 0,
    tableCount: parsed.tables?.length ?? 0,
    figureCount: parsed.figures?.length ?? 0,
    warnings,
    counters: parsed.counters ?? manifest.extractionCounters,
    pages: parsed.pages?.slice(0, 10),
    blocks: parsed.blocks?.slice(0, 50),
    tables: parsed.tables?.slice(0, 20),
    figures: parsed.figures?.slice(0, 20),
    qualityProfile: manifest.qualityProfile ?? documentQualityProfileFromMetadata(manifest.metadata),
    available: true
  }
}

function qualityActionCardsForManifest(manifest: DocumentManifest): QualityActionCard[] {
  const profile = manifest.qualityProfile ?? documentQualityProfileFromMetadata(manifest.metadata)
  const gate = qualityGateForNormalRag(manifest)
  const reasons = [
    ...(profile?.knowledgeQualityStatus === "blocked" ? ["knowledge_quality_blocked"] : []),
    ...(profile?.ragEligibility === "excluded" ? ["rag_excluded"] : []),
    ...(profile?.verificationStatus === "unverified" ? ["verification_required"] : []),
    ...(profile?.verificationStatus === "rejected" ? ["verification_rejected"] : []),
    ...(profile?.freshnessStatus === "stale" ? ["freshness_review_required"] : []),
    ...(profile?.freshnessStatus === "expired" ? ["freshness_expired"] : []),
    ...(profile?.supersessionStatus === "superseded" ? ["superseded_by_newer_document"] : []),
    ...(profile?.extractionQualityStatus === "low" || profile?.extractionQualityStatus === "unusable" ? ["low_extraction_confidence"] : []),
    ...(profile?.flags ?? []),
    ...lowConfidenceWarningCodes(manifest.extractionWarnings ?? manifest.parsedDocument?.warnings ?? [])
  ]
  const uniqueReasons = uniqueStrings(reasons)
  if (uniqueReasons.length === 0 && gate.approved) return []

  const severity: QualityActionCard["severity"] = !gate.approved
    ? "blocked"
    : uniqueReasons.some((reason) => reason.includes("low") || reason.includes("required") || reason.includes("stale"))
      ? "warning"
      : "info"
  const suggestedAction: QualityActionCard["suggestedAction"] = uniqueReasons.some((reason) => reason.includes("extraction") || reason.includes("confidence"))
    ? "review_extraction"
    : uniqueReasons.some((reason) => reason.includes("freshness"))
      ? "update_freshness"
      : uniqueReasons.some((reason) => reason.includes("excluded"))
        ? "rag_exclusion_review"
        : "verify_document"
  return [{
    actionId: `quality_${manifest.documentId}`,
    documentId: manifest.documentId,
    fileName: manifest.fileName,
    severity,
    reasonCodes: uniqueReasons,
    suggestedAction,
    title: severity === "blocked" ? "通常 RAG から除外中の文書" : "文書品質の確認が必要",
    description: uniqueReasons.join(", "),
    createdAt: profile?.updatedAt ?? manifest.createdAt
  }]
}

function lowConfidenceWarningCodes(warnings: ExtractionWarning[]): string[] {
  return warnings
    .filter((warning) => warning.severity === "error" || (warning.confidence !== undefined && warning.confidence < 70))
    .map((warning) => warning.code || "low_confidence_extraction_warning")
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

function isRejectedIngestManifest(manifest: DocumentManifest): boolean {
  return manifest.processingStatus === "rejected" || manifest.admission?.status === "rejected"
}

function isDocumentIngestRunTerminal(status: DocumentIngestRun["status"]): status is Extract<DocumentIngestRun["status"], "succeeded" | "rejected" | "failed" | "cancelled"> {
  return status === "succeeded" || status === "rejected" || status === "failed" || status === "cancelled"
}

function terminalIngestDecisionCode(
  status: Extract<DocumentIngestRun["status"], "succeeded" | "rejected" | "failed" | "cancelled">
): NonNullable<DocumentIngestRun["replayVersionManifest"]>["decisions"]["decisionCode"] {
  if (status === "succeeded") return "completed"
  if (status === "rejected") return "rejected"
  if (status === "cancelled") return "cancelled"
  return "failed"
}

function terminalIngestReasonCode(run: DocumentIngestRun): ReplayDecisionReasonCode | undefined {
  if (run.status === "rejected") return "admission_rejected"
  if (run.status === "cancelled") return "cancelled"
  if (run.status === "failed") return run.errorCode === "permission_revoked" ? "permission_revoked" : "execution_error"
  return undefined
}

function elapsedMilliseconds(startedAt: string, completedAt: string): number {
  const start = Date.parse(startedAt)
  const end = Date.parse(completedAt)
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0
}

function toJsonValue(value: unknown): JsonValue | undefined {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value)) as JsonValue
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

function reindexPublicationScope(
  actor: AppUser,
  manifest: DocumentManifest,
  input: { embeddingModelId?: string; memoryModelId?: string }
): PublicationScope {
  const manifestTenantId = manifest.admission?.tenantId ?? stringValue(manifest.metadata?.tenantId)
  const tenantId = actor.tenantId?.trim() || (!config.authEnabled ? manifestTenantId : undefined)
  if (!tenantId || !manifestTenantId || tenantId !== manifestTenantId) throw forbiddenError("Forbidden: publication tenant mismatch")
  const sourceId = manifest.publicationControl?.sourceId ?? manifest.documentId
  const sourceVersion = stableHash({
    documentVersion: manifest.documentVersion ?? manifest.derivedIntegrity?.manifestHash ?? manifest.updatedAt ?? manifest.createdAt,
    sourceExtractorVersion: manifest.sourceExtractorVersion,
    chunkerVersion: manifest.chunkerVersion,
    embeddingModelId: input.embeddingModelId ?? manifest.embeddingModelId,
    memoryModelId: input.memoryModelId ?? "default"
  })
  return { tenantId, actorId: actor.userId, sourceId, sourceVersion, purpose: "reindex" }
}

function reindexAdmissionContext(manifest: DocumentManifest, fence: StagedPublicationFence): AuthoritativeAdmissionContext {
  const admission = manifest.admission
  if (
    admission?.status !== "approved" || admission.inspectionStatus !== "passed" || !admission.tenantId || !admission.ownerUserId
    || !admission.authorizationRef || !admission.classificationRef || !admission.usagePolicyRef
    || !admission.qualityRef || !admission.lifecycleRef || !admission.provenanceRef || !manifest.qualityProfile
  ) throw new Error("Source manifest does not have a complete authoritative admission record")
  const metadata = manifest.metadata ?? {}
  const rawScopeType = stringValue(metadata.scopeType)
  const scopeType = rawScopeType === "group" || rawScopeType === "chat" || rawScopeType === "benchmark" ? rawScopeType : "personal"
  return {
    mode: "authoritative",
    tenantId: admission.tenantId,
    ownerUserId: admission.ownerUserId,
    authorizationRef: admission.authorizationRef,
    classificationRef: admission.classificationRef,
    usagePolicyRef: admission.usagePolicyRef,
    qualityRef: admission.qualityRef,
    lifecycleRef: createVersionedReference(`lifecycle:${fence.runId}`, "staged-publication-v1", `${fence.fencingToken}:staging`),
    provenanceRef: createVersionedReference(`provenance:${fence.runId}`, "staged-publication-v1", `${manifest.documentVersion}:${fence.artifactId}`),
    inspectionStatus: "passed",
    qualityProfile: manifest.qualityProfile,
    lifecycleStatus: "staging",
    scope: {
      scopeType,
      groupIds: stringArray(metadata.groupIds ?? metadata.groupId),
      folderIds: stringArray(metadata.folderIds ?? metadata.folderId),
      allowedUsers: stringArray(metadata.allowedUsers ?? metadata.userIds),
      temporaryScopeId: stringValue(metadata.temporaryScopeId),
      expiresAt: stringValue(metadata.expiresAt)
    },
    lifecycleMetadata: {
      activeDocumentId: manifest.documentId,
      stagedFromDocumentId: manifest.documentId,
      reindexMigrationId: fence.runId
    }
  }
}

function restoredAdmissionContext(manifest: DocumentManifest, migrationId: string): AuthoritativeAdmissionContext {
  const admission = manifest.admission
  if (
    admission?.status !== "approved" || admission.inspectionStatus !== "passed" || !admission.tenantId || !admission.ownerUserId
    || !admission.authorizationRef || !admission.classificationRef || !admission.usagePolicyRef
    || !admission.qualityRef || !admission.lifecycleRef || !admission.provenanceRef || !manifest.qualityProfile
  ) throw new Error("Previous manifest does not have a complete authoritative admission record")
  const metadata = manifest.metadata ?? {}
  const rawScopeType = stringValue(metadata.scopeType)
  const scopeType = rawScopeType === "group" || rawScopeType === "chat" || rawScopeType === "benchmark" ? rawScopeType : "personal"
  return {
    mode: "authoritative",
    tenantId: admission.tenantId,
    ownerUserId: admission.ownerUserId,
    authorizationRef: admission.authorizationRef,
    classificationRef: admission.classificationRef,
    usagePolicyRef: admission.usagePolicyRef,
    qualityRef: admission.qualityRef,
    lifecycleRef: createVersionedReference(`lifecycle:${migrationId}:rollback`, "rollback-v1", "active"),
    provenanceRef: createVersionedReference(`provenance:${migrationId}:rollback`, "rollback-v1", manifest.documentVersion ?? manifest.documentId),
    inspectionStatus: "passed",
    qualityProfile: manifest.qualityProfile,
    lifecycleStatus: "active",
    scope: {
      scopeType,
      groupIds: stringArray(metadata.groupIds ?? metadata.groupId),
      folderIds: stringArray(metadata.folderIds ?? metadata.folderId),
      allowedUsers: stringArray(metadata.allowedUsers ?? metadata.userIds),
      temporaryScopeId: stringValue(metadata.temporaryScopeId),
      expiresAt: stringValue(metadata.expiresAt)
    },
    lifecycleMetadata: {
      activeDocumentId: manifest.documentId,
      reindexMigrationId: migrationId
    }
  }
}

function reindexCompensationResult(input: Readonly<{
  run: StagedPublicationRun
  manifest: DocumentManifest
  pointer: Readonly<{
    committedAt: string
    generation: number
    fencingToken: string
  }>
}>): ReindexPublicationCompensationResult {
  return {
    activeDocumentId: input.manifest.documentId,
    compensatedAt: input.pointer.committedAt,
    generation: input.pointer.generation,
    fencingToken: input.pointer.fencingToken,
    checkpoint: input.run.checkpoint
  }
}

function reindexMigrationFromPublicationRun(run: StagedPublicationRun, actorId: string, previousManifestObjectKey: string): ReindexMigration {
  const staged = run.stagedArtifact
  if (!staged) throw new Error("Staged publication artifact is missing")
  return {
    migrationId: run.runId,
    sourceDocumentId: run.previousActiveArtifactId,
    stagedDocumentId: run.artifactId,
    status: run.status === "committed" ? "cutover" : run.status === "rolled_back" ? "rolled_back" : "staged",
    createdBy: actorId,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    previousManifestObjectKey,
    stagedManifestObjectKey: staged.manifestObjectKey,
    publicationRunId: run.runId,
    publicationArtifactId: run.artifactId,
    publicationIdempotencyKey: run.idempotencyKey,
    activePointerKey: run.activePointerKey,
    generation: run.generation,
    fencingToken: staged.fencingToken,
    checkpoint: run.checkpoint
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

function normalizeStringList(values: string[] | undefined, maxItems: number): string[] | undefined {
  const normalized = [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].slice(0, maxItems)
  return normalized.length > 0 ? normalized : undefined
}

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
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

function sanitizeSupportDiagnostics(
  diagnostics: HumanQuestion["sanitizedDiagnostics"] | undefined,
  fallbackAnswerUnavailableReason?: string
): HumanQuestion["sanitizedDiagnostics"] | undefined {
  if (!diagnostics && !fallbackAnswerUnavailableReason) return undefined
  const sanitized: NonNullable<HumanQuestion["sanitizedDiagnostics"]> = {
    tier: "support_sanitized",
    answerUnavailableReason: trimOptional(diagnostics?.answerUnavailableReason) ?? trimOptional(fallbackAnswerUnavailableReason),
    retrievalQuality: diagnostics?.retrievalQuality,
    qualityCauses: diagnostics?.qualityCauses?.filter(isSupportQualityCause),
    visibleCitationIds: normalizeStringList(diagnostics?.visibleCitationIds, 20),
    visibleDocumentIds: normalizeStringList(diagnostics?.visibleDocumentIds, 20),
    visibleChunkIds: normalizeStringList(diagnostics?.visibleChunkIds, 50),
    qualityWarnings: normalizeStringList(diagnostics?.qualityWarnings, 20),
    suggestedNextActions: diagnostics?.suggestedNextActions?.filter(isSupportNextAction)
  }
  return Object.fromEntries(Object.entries(sanitized).filter(([, value]) => value !== undefined)) as HumanQuestion["sanitizedDiagnostics"]
}

function isSupportQualityCause(value: unknown): value is NonNullable<HumanQuestion["qualityCause"]> {
  return ["retrieval_gap", "low_quality_evidence", "stale_document", "extraction_warning", "unsupported_answer", "other"].includes(String(value))
}

function isSupportNextAction(value: unknown): value is NonNullable<NonNullable<HumanQuestion["sanitizedDiagnostics"]>["suggestedNextActions"]>[number] {
  return ["search_improvement_review", "document_owner_review", "document_reparse", "rag_exclusion_review", "benchmark_case_review"].includes(String(value))
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

function authoritativeActorTenantId(actor: AppUser): string {
  const tenantId = actor.tenantId?.trim()
  if (!tenantId || actor.accountStatus === "suspended" || actor.accountStatus === "deleted") {
    throw forbiddenError("Forbidden: authoritative tenant is required")
  }
  return tenantId
}

export function tenantPartitionedOwnerKey(subject: AppUser | string, tenantId?: string): string {
  const userId = typeof subject === "string" ? subject.trim() : subject.userId.trim()
  const authoritativeTenantId = (typeof subject === "string" ? tenantId : subject.tenantId)?.trim()
  if (!userId) throw new Error("User identity is required for tenant-partitioned storage")
  if (!authoritativeTenantId) {
    if (config.authEnabled || config.nodeEnv === "production") throw new Error("Authoritative tenant is required for user storage")
    return `local:${encodeURIComponent(userId)}`
  }
  return `tenant:${encodeURIComponent(authoritativeTenantId)}:user:${encodeURIComponent(userId)}`
}

function localTestActor(deps: Dependencies): AppUser | undefined {
  const context = deps.localTestIngestAdmissionContext
  if (!context || context.mode !== "local_test_fixture") return undefined
  const tenantId = context.tenantId?.trim()
  const userId = context.ownerUserId?.trim() || "local-dev"
  if (!tenantId || !userId) return undefined
  return {
    userId,
    tenantId,
    accountStatus: "active",
    cognitoGroups: ["CHAT_USER"]
  }
}

function debugTraceTenantPrefix(actor?: AppUser): string {
  if (!actor) {
    if (config.authEnabled || config.nodeEnv === "production") throw new Error("Current actor is required for debug trace access")
    return "debug-runs/"
  }
  const authoritativeTenantId = actor.tenantId?.trim() || (!config.authEnabled ? config.localAuthTenantId.trim() : "")
  if (!authoritativeTenantId) throw new Error("Authoritative tenant is required for debug trace access")
  return `debug-runs/${tenantPartitionId(authoritativeTenantId)}/`
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

function isConditionalObjectWriteError(err: unknown): boolean {
  const candidate = err as { Code?: string; code?: string; name?: string; message?: string; $metadata?: { httpStatusCode?: number } }
  return candidate.Code === "PreconditionFailed"
    || candidate.code === "PRECONDITION_FAILED"
    || candidate.name === "PreconditionFailed"
    || candidate.$metadata?.httpStatusCode === 412
    || candidate.message?.includes("Conditional write failed") === true
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
  return JSON.stringify(sanitizeDebugTraceForView(withDebugTraceContractMetadata(trace)), null, 2)
}

function normalizeDebugTrace(value: unknown): DebugTrace {
  const trace = value as DebugTrace & { schemaVersion?: number }
  const { schemaVersion: _schemaVersion, ...rest } = trace
  return sanitizeDebugTraceForView(withDebugTraceContractMetadata({
      schemaVersion: DEBUG_TRACE_SCHEMA_VERSION,
      ...rest
    } as DebugTrace))
}

function withDebugTraceContractMetadata(trace: DebugTrace): DebugTrace {
  return {
    ...trace,
    schemaVersion: DEBUG_TRACE_SCHEMA_VERSION,
    targetType: trace.targetType ?? "rag_run",
    visibility: trace.visibility ?? "operator_sanitized",
    sanitizePolicyVersion: trace.sanitizePolicyVersion ?? DEBUG_TRACE_SANITIZE_POLICY_VERSION,
    exportRedaction: trace.exportRedaction ?? {
      policyVersion: DEBUG_TRACE_SANITIZE_POLICY_VERSION,
      visibility: trace.visibility ?? "operator_sanitized",
      redactedFields: ["rawPrompt", "credentials", "internalReasoning", "unauthorizedDocuments", "internalPolicyDetails"],
      notes: [
        "legacy trace normalized with J2 debug redaction metadata",
        "debug API remains protected by chat:admin:read_all until debug:* migration is completed"
      ]
    }
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
  const ragEligibility = ragEligibilityValue(metadata.ragEligibility ?? objectValue(metadata.qualityProfile)?.ragEligibility)
  const drawingSourceType = drawingSourceTypeValue(metadata.drawingSourceType)
  const pageOrSheet = stringValue(metadata.pageOrSheet)
  const drawingNo = stringValue(metadata.drawingNo)
  const sheetTitle = stringValue(metadata.sheetTitle)
  const scale = stringValue(metadata.scale)
  const regionId = stringValue(metadata.regionId)
  const regionType = stringValue(metadata.regionType)
  const sourceType = stringValue(metadata.sourceType)
  const bbox = metadata.bbox
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
  if (ragEligibility) filterable.ragEligibility = ragEligibility
  if (drawingSourceType) filterable.drawingSourceType = drawingSourceType
  if (pageOrSheet) filterable.pageOrSheet = pageOrSheet
  if (drawingNo) filterable.drawingNo = drawingNo
  if (sheetTitle) filterable.sheetTitle = sheetTitle
  if (scale) filterable.scale = scale
  if (regionId) filterable.regionId = regionId
  if (regionType) filterable.regionType = regionType
  if (sourceType) filterable.sourceType = sourceType
  if (bbox !== undefined) filterable.bbox = bbox
  if (aclGroup) filterable.aclGroup = aclGroup
  if (aclGroups.length > 0) filterable.aclGroups = aclGroups
  if (allowedUsers && allowedUsers.length > 0) filterable.allowedUsers = allowedUsers
  return filterable
}

function drawingSourceTypeValue(value: JsonValue | undefined): VectorRecord["metadata"]["drawingSourceType"] | undefined {
  if (value === "project_drawing" || value === "standard_detail" || value === "equipment_standard" || value === "benchmark_reference" || value === "external") return value
  return undefined
}

function ragEligibilityValue(value: JsonValue | undefined): VectorRecord["metadata"]["ragEligibility"] | undefined {
  if (value === "eligible" || value === "eligible_with_warning" || value === "excluded") return value
  return undefined
}

function objectValue(value: JsonValue | undefined): Record<string, JsonValue> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined
}

function documentCapabilities(permission: "none" | "readOnly" | "full", user: AppUser) {
  const full = permission === "full"
  const read = permission === "readOnly" || full
  return {
    canRead: read,
    canShare: full && hasPermission(user, "rag:doc:share"),
    canMove: full && hasPermission(user, "rag:doc:move"),
    canDelete: full && hasPermission(user, "rag:doc:delete:group"),
    canReindex: full && hasPermission(user, "rag:index:rebuild:group")
  }
}

function validateDocumentGroupName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error("Document group name is required")
  if (trimmed.includes("/") || containsControlCharacter(trimmed)) throw new Error("Document group name contains unsupported characters")
  return trimmed
}

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}

function normalizeDocumentGroupName(name: string): string {
  return name.trim().normalize("NFKC").toLocaleLowerCase("ja-JP")
}

function documentGroupPathFields(input: {
  tenantId: string
  adminPrincipalType: "user" | "group"
  adminPrincipalId: string
  parent?: DocumentGroup
  name: string
}): Pick<DocumentGroup, "normalizedName" | "canonicalPath" | "normalizedCanonicalPath" | "adminPathPk" | "parentPathPk"> {
  const normalizedName = normalizeDocumentGroupName(input.name)
  const adminPathPk = documentGroupAdminPathPk(input.tenantId, input.adminPrincipalType, input.adminPrincipalId)
  const parentCanonicalPath = input.parent?.canonicalPath
  const parentNormalizedCanonicalPath = input.parent?.normalizedCanonicalPath
  return {
    normalizedName,
    canonicalPath: parentCanonicalPath ? `${parentCanonicalPath}/${input.name}` : `/${input.name}`,
    normalizedCanonicalPath: parentNormalizedCanonicalPath ? `${parentNormalizedCanonicalPath}/${normalizedName}` : `/${normalizedName}`,
    adminPathPk,
    parentPathPk: documentGroupParentPathPk(adminPathPk, input.parent?.groupId)
  }
}

function documentGroupAdminPathPk(tenantId: string, adminPrincipalType: "user" | "group", adminPrincipalId: string): string {
  return `${tenantId}#${adminPrincipalType}#${adminPrincipalId}`
}

function documentGroupParentPathPk(adminPathPk: string, parentGroupId?: string): string {
  return `${adminPathPk}#${parentGroupId ?? rootParentPathSegment}`
}

function buildDocumentGroupPathUpdates(
  groups: DocumentGroup[],
  root: DocumentGroup,
  rootUpdate: Partial<DocumentGroup>,
  parent?: DocumentGroup
): DocumentGroupPathUpdate[] {
  const childrenByParentId = new Map<string, DocumentGroup[]>()
  for (const group of groups) {
    if (!group.parentGroupId) continue
    childrenByParentId.set(group.parentGroupId, [...(childrenByParentId.get(group.parentGroupId) ?? []), group])
  }

  const updates: DocumentGroupPathUpdate[] = []
  const queue: Array<{ current: DocumentGroup; patch: Partial<DocumentGroup>; parent?: DocumentGroup }> = [{ current: root, patch: rootUpdate, parent }]
  while (queue.length > 0) {
    const item = queue.shift()
    if (!item) continue
    const currentParent = item.parent
    const nextName = item.patch.name ?? item.current.name
    // Renaming an ancestor changes paths, never the descendant administrative principal.
    const tenantId = item.current.tenantId ?? currentParent?.tenantId ?? defaultTenantId
    const adminPrincipalType = item.current.adminPrincipalType ?? currentParent?.adminPrincipalType ?? "user"
    const adminPrincipalId = item.current.adminPrincipalId ?? currentParent?.adminPrincipalId ?? item.current.ownerUserId
    const pathFields = documentGroupPathFields({
      tenantId,
      adminPrincipalType,
      adminPrincipalId,
      parent: currentParent,
      name: nextName
    })
    const next: DocumentGroup = {
      ...item.current,
      ...item.patch,
      schemaVersion: 2,
      itemType: "documentGroup",
      tenantId,
      adminPrincipalType,
      adminPrincipalId,
      name: nextName,
      ...pathFields
    }
    updates.push({ current: item.current, next })
    for (const child of childrenByParentId.get(item.current.groupId) ?? []) {
      queue.push({
        current: child,
        parent: next,
        patch: {
          ancestorGroupIds: [...(next.ancestorGroupIds ?? []), next.groupId],
          updatedAt: next.updatedAt
        }
      })
    }
  }
  return updates
}

function normalizeDocumentGroups(groups: DocumentGroup[]): DocumentGroup[] {
  const byId = new Map(groups.map((group) => [group.groupId, group]))
  const normalized = new Map<string, DocumentGroup>()
  const visiting = new Set<string>()
  const visit = (group: DocumentGroup): DocumentGroup => {
    const cached = normalized.get(group.groupId)
    if (cached) return cached
    if (visiting.has(group.groupId)) return normalizeDocumentGroup(group)
    visiting.add(group.groupId)
    const parent = group.parentGroupId ? byId.get(group.parentGroupId) : undefined
    const normalizedParent = parent ? visit(parent) : undefined
    const result = normalizeDocumentGroup(group, normalizedParent)
    visiting.delete(group.groupId)
    normalized.set(group.groupId, result)
    return result
  }
  return groups.map(visit)
}

function normalizeDocumentGroup(group: DocumentGroup, parent?: DocumentGroup): DocumentGroup {
  const name = group.name.trim() || group.groupId
  const tenantId = group.tenantId ?? parent?.tenantId ?? defaultTenantId
  const adminPrincipalType = group.adminPrincipalType ?? parent?.adminPrincipalType ?? "user"
  const adminPrincipalId = group.adminPrincipalId ?? parent?.adminPrincipalId ?? group.ownerUserId
  const pathFields = group.canonicalPath && group.normalizedCanonicalPath && group.adminPathPk && group.parentPathPk
    ? {
        normalizedName: group.normalizedName ?? normalizeDocumentGroupName(name),
        canonicalPath: group.canonicalPath,
        normalizedCanonicalPath: group.normalizedCanonicalPath,
        adminPathPk: group.adminPathPk,
        parentPathPk: group.parentPathPk
      }
    : documentGroupPathFields({ tenantId, adminPrincipalType, adminPrincipalId, parent, name })
  return {
    ...group,
    schemaVersion: group.schemaVersion ?? 1,
    itemType: "documentGroup",
    tenantId,
    adminPrincipalType,
    adminPrincipalId,
    name,
    ...pathFields,
    ancestorGroupIds: parent ? [...(parent.ancestorGroupIds ?? []), parent.groupId] : uniqueStrings(group.ancestorGroupIds ?? []),
    visibility: group.visibility ?? "private",
    sharedUserIds: uniqueStrings(group.sharedUserIds ?? []),
    sharedGroups: uniqueStrings(group.sharedGroups ?? []),
    managerUserIds: uniqueStrings([group.ownerUserId, ...(group.managerUserIds ?? [])]),
    ...(group.hasExplicitPolicy !== undefined || group.policyId ? { hasExplicitPolicy: group.hasExplicitPolicy ?? true } : {}),
    status: group.status ?? "active",
    createdBy: group.createdBy ?? group.ownerUserId
  }
}


function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort()
}

function userDisplayName(user?: AppUser): string {
  return user?.email?.trim() || user?.userId?.trim() || "未設定"
}

function compareConversationHistoryForDisplay(a: ConversationHistoryItem, b: ConversationHistoryItem): number {
  if (Boolean(a.isFavorite) !== Boolean(b.isFavorite)) return a.isFavorite ? -1 : 1
  return b.updatedAt.localeCompare(a.updatedAt)
}

function stripFavoriteStorageKeys(favorite: FavoriteItem): Omit<FavoriteItem, "ownerUserId" | "targetKey"> {
  const { ownerUserId: _ownerUserId, targetKey: _targetKey, ...visible } = favorite
  return visible
}

function favoriteListItem(favorite: FavoriteItem, accessible: boolean, resolvedLabel?: string): FavoriteListItem {
  const visible = stripFavoriteStorageKeys(favorite)
  if (!accessible) {
    return {
      favoriteId: visible.favoriteId,
      targetType: visible.targetType,
      targetId: visible.targetId,
      accessible: false,
      label: "この項目には現在アクセスできません",
      createdAt: visible.createdAt,
      updatedAt: visible.updatedAt
    }
  }
  return {
    ...visible,
    label: resolvedLabel ?? visible.label,
    accessible: true
  }
}

function favoriteTargetResolverImplemented(targetType: FavoriteTargetType): boolean {
  return targetType === "chatSession" || targetType === "document" || targetType === "folder"
}

function forbiddenError(message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status: 403 })
}

function logIngestStage(input: {
  stage: "s3_read" | "extract" | "chunk" | "embedding" | "vector_put"
  phase: "start" | "end"
  runId?: string
  documentId?: string
  fileName?: string
  mimeType?: string
  fileSizeBytes?: number
  textLength?: number
  blockCount?: number
  chunkCount?: number
  memoryCardCount?: number
  sourceExtractorVersion?: string
}): void {
  console.info(JSON.stringify({
    event: "document_ingest_stage",
    stage: input.stage,
    phase: input.phase,
    runId: input.runId,
    documentId: input.documentId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSizeBytes: input.fileSizeBytes,
    textLength: input.textLength,
    blockCount: input.blockCount,
    chunkCount: input.chunkCount,
    memoryCardCount: input.memoryCardCount,
    sourceExtractorVersion: input.sourceExtractorVersion,
    memory: memoryUsageSnapshot()
  }))
}

function memoryUsageSnapshot(): Record<string, number> {
  const usage = process.memoryUsage()
  return {
    rssBytes: usage.rss,
    heapUsedBytes: usage.heapUsed,
    heapTotalBytes: usage.heapTotal,
    externalBytes: usage.external,
    arrayBuffersBytes: usage.arrayBuffers
  }
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
