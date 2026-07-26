import { createHash } from "node:crypto"
import { isApplicationRole, ROLE_CATALOG_VERSION } from "@memorag-mvp/contract/access-control"
import type { Dependencies } from "../../../dependencies.js"
import type { AppUser } from "../../../auth.js"
import type { BenchmarkRun, ChatRun, DocumentIngestRun, DocumentManifest, DocumentShareGrant } from "../../../types.js"
import { groupMembershipStateVersion } from "../../../adapters/group-membership-store.js"
import { accountRevocationCleanupDenyVersion, ObjectStoreAccountRevocationRegistry } from "../../../security/account-revocation-registry.js"
import { tenantPartitionId } from "../../../security/tenant-partition.js"
import { securityResourceReference } from "../../../security/security-resource-reference.js"
import {
  DocumentPermissionService,
  documentShareGrantKey,
  documentSharePolicyStateVersion
} from "../../../documents/document-permission-service.js"
import { FolderPermissionService } from "../../../folders/folder-permission-service.js"
import {
  assertManifestTenant,
  tenantArtifactRoot,
  tenantManifestPrefix
} from "../storage/tenant-artifacts.js"
import { isManifestCurrentPublication } from "../publication/staged-publication-coordinator.js"
import { sourceGovernanceRestrictionStateVersion, type SourceGovernanceRecord } from "../../offline/pre-retrieval/admission/source-governance-approval-service.js"
import {
  buildRevocationCleanupDenyProbe,
  ObjectStoreRevocationCleanupCoordinator,
  type RevocationCleanupDriver,
  type RevocationCleanupManifest,
  type RevocationCleanupScope,
  type RevocationCleanupTarget,
  type RevocationCleanupTargetReference,
  RevocationCleanupValidationError
} from "./revocation-cleanup-coordinator.js"
import { ObjectStoreRevocationCleanupRepairOutbox } from "./revocation-cleanup-repair-outbox.js"
import { temporaryScopeIds } from "./session-local-evidence-scope.js"

const objectActionPrefix = "object:"
const benchmarkObjectActionPrefix = "benchmark-object:"
const evidenceVectorActionPrefix = "evidence-vector:"
const memoryVectorActionPrefix = "memory-vector:"
const chatRunActionPrefix = "chat-run:"
const ingestRunActionPrefix = "ingest-run:"
const benchmarkRunActionPrefix = "benchmark-run:"
const publicationPointerActionPrefix = "publication-pointer:"

type CleanupDeps = Pick<Dependencies,
  | "objectStore"
  | "benchmarkArtifactStore"
  | "evidenceVectorStore"
  | "memoryVectorStore"
  | "chatRunStore"
  | "documentIngestRunStore"
  | "benchmarkRunStore"
  | "userDirectory"
  | "verifiedIdentityProvider"
  | "accountRevocationRegistry"
  | "userGroupStore"
  | "groupMembershipStore"
  | "folderPolicyStore"
  | "documentGroupStore"
  | "localTestIngestAdmissionContext"
  | "legacyGlobalDocumentArtifacts"
>

export type AuthoritativeRevocationDenyVerifier = Readonly<{
  isCurrent(manifest: RevocationCleanupManifest): Promise<boolean>
}>

export type ProductionRevocationCleanupBatchResult = Readonly<{
  tenantId: string
  examined: number
  completed: number
  superseded: number
  reconciliationRequired: number
  operationIds: readonly string[]
}>

export class ProductionRevocationCleanupService {
  constructor(
    private readonly deps: CleanupDeps,
    private readonly denyVerifier?: AuthoritativeRevocationDenyVerifier
  ) {}

  async reconcilePending(tenantId: string, limit = 100): Promise<ProductionRevocationCleanupBatchResult> {
    const coordinator = new ObjectStoreRevocationCleanupCoordinator(this.deps.objectStore)
    const repairOutbox = new ObjectStoreRevocationCleanupRepairOutbox(this.deps.objectStore)
    const driver = new ProductionRevocationCleanupDriver(this.deps, this.denyVerifier)
    const repairs = await repairOutbox.listPending(tenantId, limit)
    for (const repair of repairs) {
      let current: boolean
      try {
        current = await driver.isAuthoritativeDenyCurrent(buildRevocationCleanupDenyProbe(repair.cleanupRegistration))
      } catch {
        // Unknown/read failures are fail-closed: retain the durable repair and
        // retry without creating a manifest whose deny cannot be proven.
        continue
      }
      if (!current) {
        // A `prepared` repair is intentionally durable before the authoritative
        // deny CAS. The worker can race that CAS, so absence of the deny is not
        // proof that the operation was abandoned. The mutator marks a failed
        // pre-commit operation abandoned after its CAS/fence has definitively
        // failed. Once `deny_committed` was recorded, however, a non-current
        // deny is a later authoritative supersession and the fence can close.
        if (repair.status === "deny_committed") {
          await repairOutbox.markAbandoned(repair, new Date().toISOString())
        }
        continue
      }
      const committed = await repairOutbox.markDenyCommitted(repair, new Date().toISOString())
      await coordinator.register(committed.cleanupRegistration)
      await repairOutbox.markCleanupRegistered(committed, new Date().toISOString())
    }
    const manifests = await coordinator.listPending(tenantId, limit)
    const results: RevocationCleanupManifest[] = []
    for (const manifest of manifests) {
      const result = await coordinator.reconcile(
        tenantId,
        manifest.operationId,
        driver
      )
      results.push(result)
      if (result.status === "completed" || result.status === "superseded") {
        const repair = await repairOutbox.get(result.tenantId, result.resourceType, result.resourceId, result.operationId)
        if (repair) await repairOutbox.markCleanupCompleted(repair, new Date().toISOString())
      }
    }
    return {
      tenantId,
      examined: results.length,
      completed: results.filter((manifest) => manifest.status === "completed").length,
      superseded: results.filter((manifest) => manifest.status === "superseded").length,
      reconciliationRequired: results.filter((manifest) => manifest.status === "reconciliation_required").length,
      operationIds: results.map((manifest) => manifest.operationId)
    }
  }
}

/**
 * Production cleanup driver for the durable FR-066 ledger. Every physical
 * target is re-derived inside its tenant partition. Logical grant targets are
 * never used to restore or rewrite an ACL; their authoritative deny is the
 * deletion boundary and only derived artifacts are removed.
 */
export class ProductionRevocationCleanupDriver implements RevocationCleanupDriver {
  private readonly denyVerifier: AuthoritativeRevocationDenyVerifier
  private relevantDocumentCache: DocumentManifest[] | undefined
  private tenantDocumentCache: DocumentManifest[] | undefined
  private runSnapshotPromise: Promise<{ chatRuns: ChatRun[]; ingestRuns: DocumentIngestRun[]; benchmarkRuns: BenchmarkRun[] }> | undefined
  private allRunSnapshotPromise: Promise<{ chatRuns: ChatRun[]; ingestRuns: DocumentIngestRun[]; benchmarkRuns: BenchmarkRun[] }> | undefined
  private readonly groupActorMembershipCache = new Map<string, Promise<boolean>>()

  constructor(
    private readonly deps: CleanupDeps,
    denyVerifier?: AuthoritativeRevocationDenyVerifier
  ) {
    this.denyVerifier = denyVerifier ?? new DefaultAuthoritativeRevocationDenyVerifier(deps)
  }

  isAuthoritativeDenyCurrent(manifest: RevocationCleanupManifest): Promise<boolean> {
    validateCleanupIdentity(manifest)
    return this.denyVerifier.isCurrent(manifest)
  }

  async discover(
    manifest: RevocationCleanupManifest,
    scope: RevocationCleanupScope
  ): Promise<readonly RevocationCleanupTargetReference[]> {
    validateCleanupIdentity(manifest)
    if (isContentScope(scope) && !permitsDestructiveContentCleanup(manifest)) return []
    if (isIndexScope(scope) && !permitsDestructiveIndexCleanup(manifest)) return []
    const documents = await this.relevantDocuments(manifest)
    const references: RevocationCleanupTargetReference[] = []
    const add = (reference: string) => references.push({ scope, reference })

    if (scope === "source") {
      for (const document of documents) {
        add(objectAction(document.sourceObjectKey))
        add(objectAction(document.manifestObjectKey))
      }
    } else if (scope === "chunk") {
      for (const document of documents) {
        if (document.structuredBlocksObjectKey) add(objectAction(document.structuredBlocksObjectKey))
      }
    } else if (scope === "memory") {
      for (const document of documents) {
        if (document.memoryCardsObjectKey) add(objectAction(document.memoryCardsObjectKey))
        for (const key of document.memoryVectorKeys ?? []) add(memoryVectorAction(key))
      }
    } else if (scope === "active_index") {
      for (const document of documents.filter((candidate) => candidate.lifecycleStatus === "active" || candidate.lifecycleStatus === undefined)) {
        for (const key of document.evidenceVectorKeys ?? document.vectorKeys) add(evidenceVectorAction(key))
        for (const key of document.memoryVectorKeys ?? []) add(memoryVectorAction(key))
        const pointerKey = await this.currentPublicationPointerKey(manifest, document)
        if (pointerKey) add(action(publicationPointerActionPrefix, pointerKey))
      }
    } else if (scope === "staged_index") {
      for (const document of documents.filter((candidate) => candidate.lifecycleStatus === "staging" || candidate.publicationFence)) {
        for (const key of document.evidenceVectorKeys ?? document.vectorKeys) add(evidenceVectorAction(key))
        for (const key of document.memoryVectorKeys ?? []) add(memoryVectorAction(key))
        if (document.publicationFence?.stageNamespace) {
          const prefix = `${tenantArtifactRoot(manifest.tenantId)}/${canonicalRelativePrefix(document.publicationFence.stageNamespace)}/`
          for (const key of await this.listSafeObjectKeys(manifest, prefix)) add(objectAction(key))
        }
      }
    } else if (scope === "old_index") {
      for (const document of documents.filter((candidate) => candidate.lifecycleStatus === "superseded" || candidate.stagedFromDocumentId)) {
        for (const key of document.evidenceVectorKeys ?? document.vectorKeys) add(evidenceVectorAction(key))
        for (const key of document.memoryVectorKeys ?? []) add(memoryVectorAction(key))
      }
    } else if (scope === "cache") {
      add(`reconcile:${manifest.resourceType}:${manifest.resourceId}`)
    } else if (scope === "queued_run") {
      const derivedReferences = permitsDestructiveContentCleanup(manifest)
        ? documents.map((document) => `document:${document.documentId}`)
        : []
      for (const reference of derivedReferences) add(reference)
      for (const run of await this.matchingActiveRuns(manifest, undefined, derivedReferences)) add(run.reference)
    } else if (scope === "evaluation_artifact") {
      for (const target of manifest.targets.filter((target) => target.scope === scope)) {
        if (isSafeBenchmarkObjectKey(manifest, target.reference)) add(benchmarkObjectAction(target.reference))
        if (isSafeTenantDebugObjectKey(manifest, target.reference)) add(objectAction(target.reference))
      }
      for (const key of await this.relatedDebugTraceKeys(manifest, documents)) add(objectAction(key))
      for (const key of await this.qualitySampleKeys(manifest)) add(objectAction(key))
    }
    return uniqueReferences(references)
  }

  async cleanup(manifest: RevocationCleanupManifest, target: RevocationCleanupTarget): Promise<void> {
    validateCleanupIdentity(manifest)
    if (target.scope === "source" || target.scope === "chunk" || target.scope === "memory") {
      await this.cleanupContentTarget(manifest, target)
      return
    }
    if (target.scope === "active_index" || target.scope === "staged_index" || target.scope === "old_index") {
      await this.cleanupIndexTarget(manifest, target)
      return
    }
    if (target.scope === "cache") {
      await this.cleanupCacheTarget(manifest, target)
      return
    }
    if (target.scope === "grant") {
      assertLogicalReference(target.reference)
      return
    }
    if (target.scope === "session") {
      await this.cleanupSessionTarget(manifest, target.reference)
      return
    }
    if (target.scope === "queued_run") {
      await this.cleanupQueuedRunTarget(manifest, target.reference)
      return
    }
    if (target.scope === "evaluation_artifact") {
      await this.cleanupEvaluationTarget(manifest, target.reference)
      return
    }
    throw new RevocationCleanupValidationError("Unsupported production cleanup scope")
  }

  async findResiduals(
    manifest: RevocationCleanupManifest,
    scope: RevocationCleanupScope
  ): Promise<readonly RevocationCleanupTargetReference[]> {
    validateCleanupIdentity(manifest)
    const candidates = uniqueReferences([
      ...manifest.targets.filter((target) => target.scope === scope).map(({ scope: targetScope, reference }) => ({ scope: targetScope, reference })),
      ...await this.discover(manifest, scope)
    ])
    const residuals: RevocationCleanupTargetReference[] = []
    for (const candidate of candidates) {
      if (await this.targetExists(manifest, candidate)) residuals.push(candidate)
    }
    return residuals
  }

  private async relevantDocuments(manifest: RevocationCleanupManifest): Promise<DocumentManifest[]> {
    if (this.relevantDocumentCache !== undefined) return this.relevantDocumentCache
    if (manifest.resourceType !== "document" && manifest.resourceType !== "temporary_attachment") return []
    const documents = (await this.tenantDocuments(manifest)).filter((candidate) => {
      const sourceId = candidate.publicationControl?.sourceId
      return candidate.documentId === manifest.resourceId || sourceId === manifest.resourceId
    })
    this.relevantDocumentCache = documents
    return documents
  }

  private async tenantDocuments(manifest: RevocationCleanupManifest): Promise<DocumentManifest[]> {
    if (this.tenantDocumentCache !== undefined) return this.tenantDocumentCache
    const prefix = tenantArtifactRoot(manifest.tenantId)
    const keys = await this.listSafeObjectKeys(manifest, `${prefix}/`)
    const manifestKeys = keys.filter((key) => key.endsWith(".json") && (key.startsWith(tenantManifestPrefix(this.deps, manifest.tenantId)) || key.includes("/manifests/")))
    const documents: DocumentManifest[] = []
    for (const key of manifestKeys) {
      let candidate: DocumentManifest
      try {
        candidate = JSON.parse(await this.deps.objectStore.getText(key)) as DocumentManifest
      } catch (error) {
        throw new RevocationCleanupValidationError(`Document manifest discovery failed: ${failureName(error)}`)
      }
      assertManifestTenant(candidate, manifest.tenantId, key)
      documents.push(candidate)
    }
    this.tenantDocumentCache = documents
    return documents
  }

  private async cleanupContentTarget(manifest: RevocationCleanupManifest, target: RevocationCleanupTarget): Promise<void> {
    if (!permitsDestructiveContentCleanup(manifest)) {
      throw new RevocationCleanupValidationError("This revocation does not authorize destructive content cleanup")
    }
    const objectKey = decodeAction(target.reference, objectActionPrefix)
    if (objectKey !== undefined) {
      assertSafeTenantObjectKey(manifest, objectKey)
      await this.deps.objectStore.deleteObject(objectKey)
      return
    }
    const memoryVector = decodeAction(target.reference, memoryVectorActionPrefix)
    if (memoryVector !== undefined || (target.scope === "memory" && isSafeTenantVectorKey(manifest, target.reference))) {
      const key = memoryVector ?? target.reference
      assertSafeTenantVectorKey(manifest, key)
      await this.deps.memoryVectorStore.delete([key])
      return
    }
    if (isSafeTenantObjectKey(manifest, target.reference, false)) {
      await this.deps.objectStore.deleteObject(target.reference)
      return
    }
    if (target.scope === "chunk" && isLogicalChunkReference(target.reference)) return
    throw new RevocationCleanupValidationError("Content cleanup target escaped its tenant partition")
  }

  private async cleanupIndexTarget(manifest: RevocationCleanupManifest, target: RevocationCleanupTarget): Promise<void> {
    if (!permitsDestructiveIndexCleanup(manifest)) {
      throw new RevocationCleanupValidationError("This revocation does not authorize destructive index cleanup")
    }
    const objectKey = decodeAction(target.reference, objectActionPrefix)
    if (objectKey !== undefined) {
      if (target.scope !== "staged_index") throw new RevocationCleanupValidationError("Only staged indexes may contain object artifacts")
      assertSafeStageObjectKey(manifest, objectKey)
      await this.deps.objectStore.deleteObject(objectKey)
      return
    }
    const pointerKey = decodeAction(target.reference, publicationPointerActionPrefix)
    if (pointerKey !== undefined) {
      if (target.scope !== "active_index") throw new RevocationCleanupValidationError("Publication pointer has an invalid cleanup scope")
      if (await this.publicationControlObjectMatches(manifest, pointerKey)) await this.deps.objectStore.deleteObject(pointerKey)
      return
    }
    const evidenceKey = decodeAction(target.reference, evidenceVectorActionPrefix)
    const memoryKey = decodeAction(target.reference, memoryVectorActionPrefix)
    if (evidenceKey !== undefined) {
      assertSafeTenantVectorKey(manifest, evidenceKey)
      await this.deps.evidenceVectorStore.delete([evidenceKey])
      return
    }
    if (memoryKey !== undefined) {
      assertSafeTenantVectorKey(manifest, memoryKey)
      await this.deps.memoryVectorStore.delete([memoryKey])
      return
    }
    const rawVectorKey = extractTenantVectorKey(manifest, target.reference)
    if (rawVectorKey) {
      await Promise.all([
        this.deps.evidenceVectorStore.delete([rawVectorKey]),
        this.deps.memoryVectorStore.delete([rawVectorKey])
      ])
      return
    }
    if (target.scope === "staged_index" && isSafeTenantStagePrefix(manifest, target.reference)) {
      const prefix = `${tenantArtifactRoot(manifest.tenantId)}/${canonicalRelativePrefix(target.reference)}/`
      await Promise.all((await this.listSafeObjectKeys(manifest, prefix)).map((key) => this.deps.objectStore.deleteObject(key)))
      return
    }
    if (target.scope === "old_index" && isLogicalOldIndexReference(target.reference)) return
    throw new RevocationCleanupValidationError("Index cleanup target escaped its tenant partition")
  }

  private async cleanupCacheTarget(manifest: RevocationCleanupManifest, target: RevocationCleanupTarget): Promise<void> {
    const objectKey = decodeAction(target.reference, objectActionPrefix)
    if (objectKey !== undefined) {
      assertSafeCacheObjectKey(manifest, objectKey)
      await this.deps.objectStore.deleteObject(objectKey)
      return
    }
    assertLogicalReference(target.reference)
    if (!target.reference.startsWith("reconcile:")) return
    for (const prefix of tenantCachePrefixes(manifest.tenantId)) {
      await Promise.all((await this.listSafeObjectKeys(manifest, prefix)).map((key) => this.deps.objectStore.deleteObject(key)))
    }
  }

  private async cleanupSessionTarget(manifest: RevocationCleanupManifest, reference: string): Promise<void> {
    assertLogicalReference(reference)
    if (reference.includes("/session") || reference.startsWith("resource-group:")) return
    if (!this.deps.userDirectory?.revokeSessions) throw new Error("Authoritative session revocation adapter is unavailable")
    const identity = await this.resolveSessionIdentity(manifest, reference)
    if (!identity) return
    await this.deps.userDirectory.revokeSessions(identity.username)
  }

  private async resolveSessionIdentity(manifest: RevocationCleanupManifest, reference: string) {
    if (!this.deps.verifiedIdentityProvider) throw new Error("Authoritative session identity verifier is unavailable")
    const identity = manifest.resourceType === "account"
      ? await this.deps.verifiedIdentityProvider.getCurrentIdentity(reference)
      : await this.deps.verifiedIdentityProvider.getCurrentIdentityBySubject(reference)
    if (!identity) {
      if (manifest.trigger === "account_revoked" || manifest.resourceType === "group" || manifest.resourceType === "resource_group") return undefined
      throw new Error("Authoritative session identity is unavailable")
    }
    if (identity.tenantId !== manifest.tenantId) throw new RevocationCleanupValidationError("Session cleanup crossed its tenant boundary")
    if (manifest.resourceType === "account" && identity.userId !== manifest.resourceId) {
      throw new RevocationCleanupValidationError("Session cleanup crossed its account boundary")
    }
    return identity
  }

  private async cleanupQueuedRunTarget(manifest: RevocationCleanupManifest, reference: string): Promise<void> {
    const chatRunId = decodeAction(reference, chatRunActionPrefix)
    if (chatRunId !== undefined) {
      const current = await this.deps.chatRunStore.get(manifest.tenantId, chatRunId)
      if (current && isActiveRunStatus(current.status)) {
        const now = new Date().toISOString()
        await this.deps.chatRunStore.update(manifest.tenantId, chatRunId, {
          status: "failed",
          error: "permission_revoked",
          errorCode: "permission_revoked",
          clearResult: true,
          completedAt: now,
          updatedAt: now
        })
        await this.markRunInactive("chat", chatRunId)
      }
      return
    }
    const ingestRunId = decodeAction(reference, ingestRunActionPrefix)
    if (ingestRunId !== undefined) {
      const current = await this.deps.documentIngestRunStore.get(manifest.tenantId, ingestRunId)
      if (current && isActiveRunStatus(current.status)) {
        const now = new Date().toISOString()
        await this.deps.documentIngestRunStore.update(manifest.tenantId, ingestRunId, {
          status: "failed",
          error: "permission_revoked",
          errorCode: "permission_revoked",
          completedAt: now,
          updatedAt: now
        })
        await this.markRunInactive("ingest", ingestRunId)
      }
      return
    }
    const benchmarkRunId = decodeAction(reference, benchmarkRunActionPrefix)
    if (benchmarkRunId !== undefined) {
      const current = await this.deps.benchmarkRunStore.get(manifest.tenantId, benchmarkRunId)
      if (current && isActiveRunStatus(current.status)) {
        const now = new Date().toISOString()
        await this.deps.benchmarkRunStore.update(manifest.tenantId, benchmarkRunId, {
          status: "failed",
          error: "permission_revoked",
          errorCode: "permission_revoked",
          completedAt: now,
          updatedAt: now
        })
        await this.markRunInactive("benchmark", benchmarkRunId)
      }
      return
    }
    assertLogicalReference(reference)
    for (const run of await this.matchingActiveRuns(manifest, reference)) await this.cleanupQueuedRunTarget(manifest, run.reference)
  }

  private async cleanupEvaluationTarget(manifest: RevocationCleanupManifest, reference: string): Promise<void> {
    const docsKey = decodeAction(reference, objectActionPrefix)
    if (docsKey !== undefined) {
      const allowedQualitySample = docsKey.startsWith("quality-control/source-samples/")
        && (await this.qualitySampleKeys(manifest)).includes(docsKey)
      if (!isSafeTenantDebugObjectKey(manifest, docsKey) && !allowedQualitySample) {
        throw new RevocationCleanupValidationError("Evaluation cleanup target escaped its tenant partition")
      }
      await this.deps.objectStore.deleteObject(docsKey)
      return
    }
    const benchmarkKey = decodeAction(reference, benchmarkObjectActionPrefix)
    if (benchmarkKey !== undefined || isSafeBenchmarkObjectKey(manifest, reference)) {
      const key = benchmarkKey ?? reference
      assertSafeBenchmarkObjectKey(manifest, key)
      if (!this.deps.benchmarkArtifactStore) throw new Error("Benchmark artifact cleanup store is unavailable")
      await this.deps.benchmarkArtifactStore.deleteObject(key)
      return
    }
    if (isSafeTenantDebugObjectKey(manifest, reference)) {
      await this.deps.objectStore.deleteObject(reference)
      return
    }
    assertLogicalReference(reference)
  }

  private async targetExists(manifest: RevocationCleanupManifest, target: RevocationCleanupTargetReference): Promise<boolean> {
    if (isContentScope(target.scope) && !permitsDestructiveContentCleanup(manifest)) {
      throw new RevocationCleanupValidationError("This revocation does not authorize content residual checks")
    }
    if (isIndexScope(target.scope) && !permitsDestructiveIndexCleanup(manifest)) {
      throw new RevocationCleanupValidationError("This revocation does not authorize index residual checks")
    }
    const objectKey = decodeAction(target.reference, objectActionPrefix)
    if (objectKey !== undefined) {
      if (target.scope === "cache") assertSafeCacheObjectKey(manifest, objectKey)
      else if (target.scope === "staged_index") assertSafeStageObjectKey(manifest, objectKey)
      else if (target.scope === "evaluation_artifact") {
        if (objectKey.startsWith("quality-control/source-samples/") && !await this.objectExists(this.deps.objectStore, objectKey)) {
          return false
        }
        const allowedQualitySample = objectKey.startsWith("quality-control/source-samples/")
          && (await this.qualitySampleKeys(manifest)).includes(objectKey)
        if (!isSafeTenantDebugObjectKey(manifest, objectKey) && !allowedQualitySample) {
          throw new RevocationCleanupValidationError("Evaluation cleanup target escaped its tenant partition")
        }
      } else assertSafeTenantObjectKey(manifest, objectKey)
      return this.objectExists(this.deps.objectStore, objectKey)
    }
    const benchmarkKey = decodeAction(target.reference, benchmarkObjectActionPrefix)
    if (benchmarkKey !== undefined) {
      assertSafeBenchmarkObjectKey(manifest, benchmarkKey)
      if (!this.deps.benchmarkArtifactStore) throw new Error("Benchmark artifact cleanup store is unavailable")
      return this.objectExists(this.deps.benchmarkArtifactStore, benchmarkKey)
    }
    const pointerKey = decodeAction(target.reference, publicationPointerActionPrefix)
    if (pointerKey !== undefined) return this.publicationControlObjectMatches(manifest, pointerKey)
    const evidenceKey = decodeAction(target.reference, evidenceVectorActionPrefix)
    if (evidenceKey !== undefined) {
      assertSafeTenantVectorKey(manifest, evidenceKey)
      return this.vectorExists(this.deps.evidenceVectorStore, evidenceKey)
    }
    const memoryKey = decodeAction(target.reference, memoryVectorActionPrefix)
    if (memoryKey !== undefined) {
      assertSafeTenantVectorKey(manifest, memoryKey)
      return this.vectorExists(this.deps.memoryVectorStore, memoryKey)
    }
    if (target.scope === "source" || target.scope === "chunk") {
      if (isSafeTenantObjectKey(manifest, target.reference, false)) return this.objectExists(this.deps.objectStore, target.reference)
      if (target.scope === "chunk" && isLogicalChunkReference(target.reference)) return false
      throw new RevocationCleanupValidationError("Content residual target escaped its tenant partition")
    }
    if (target.scope === "memory") {
      if (isSafeTenantObjectKey(manifest, target.reference, false)) return this.objectExists(this.deps.objectStore, target.reference)
      const vectorKey = extractTenantVectorKey(manifest, target.reference)
      if (vectorKey) return this.vectorExists(this.deps.memoryVectorStore, vectorKey)
      throw new RevocationCleanupValidationError("Memory residual target escaped its tenant partition")
    }
    if (target.scope === "active_index" || target.scope === "staged_index" || target.scope === "old_index") {
      const vectorKey = extractTenantVectorKey(manifest, target.reference)
      if (vectorKey) {
        return (await this.vectorExists(this.deps.evidenceVectorStore, vectorKey))
          || (await this.vectorExists(this.deps.memoryVectorStore, vectorKey))
      }
      if (target.scope === "staged_index" && isSafeTenantStagePrefix(manifest, target.reference)) {
        return (await this.listSafeObjectKeys(manifest, `${tenantArtifactRoot(manifest.tenantId)}/${canonicalRelativePrefix(target.reference)}/`)).length > 0
      }
      if (target.scope === "old_index" && isLogicalOldIndexReference(target.reference)) return false
      throw new RevocationCleanupValidationError("Index residual target escaped its tenant partition")
    }
    if (target.scope === "cache") {
      if (isSafeCacheObjectKey(manifest, target.reference, false)) return this.objectExists(this.deps.objectStore, target.reference)
      assertLogicalReference(target.reference)
      // Logical cache invalidation is a one-time fence. Cache entries created
      // after cleanup are derived under the current deny and must not prevent
      // convergence by becoming a permanent "directory must stay empty" invariant.
      return false
    }
    if (target.scope === "queued_run") {
      if (decodeAction(target.reference, chatRunActionPrefix) !== undefined) {
        const run = await this.deps.chatRunStore.get(manifest.tenantId, decodeAction(target.reference, chatRunActionPrefix)!)
        return Boolean(run && isActiveRunStatus(run.status))
      }
      if (decodeAction(target.reference, ingestRunActionPrefix) !== undefined) {
        const run = await this.deps.documentIngestRunStore.get(manifest.tenantId, decodeAction(target.reference, ingestRunActionPrefix)!)
        return Boolean(run && isActiveRunStatus(run.status))
      }
      if (decodeAction(target.reference, benchmarkRunActionPrefix) !== undefined) {
        const run = await this.deps.benchmarkRunStore.get(manifest.tenantId, decodeAction(target.reference, benchmarkRunActionPrefix)!)
        return Boolean(run && isActiveRunStatus(run.status))
      }
      if ((await this.matchingActiveRuns(manifest, target.reference)).length > 0) return true
      return manifest.attempts === 0
    }
    if (target.scope === "session") {
      if (target.reference.includes("/session") || target.reference.startsWith("resource-group:")) return false
      const identity = await this.resolveSessionIdentity(manifest, target.reference)
      if (!identity) return false
      const invalidAfter = identity.sessionInvalidAfterEpochMs
      const denyConfirmedAt = Date.parse(manifest.authoritativeDeny.confirmedAt)
      if (!Number.isFinite(denyConfirmedAt)) throw new RevocationCleanupValidationError("Session deny timestamp is invalid")
      return invalidAfter === undefined || invalidAfter < denyConfirmedAt
    }
    if (target.scope === "evaluation_artifact") {
      if (isSafeBenchmarkObjectKey(manifest, target.reference)) {
        if (!this.deps.benchmarkArtifactStore) throw new Error("Benchmark artifact cleanup store is unavailable")
        return this.objectExists(this.deps.benchmarkArtifactStore, target.reference)
      }
      if (isSafeTenantDebugObjectKey(manifest, target.reference)) return this.objectExists(this.deps.objectStore, target.reference)
      return (await this.qualitySampleKeys(manifest)).length > 0
    }
    return false
  }

  private async matchingActiveRuns(
    manifest: RevocationCleanupManifest,
    onlyReference?: string,
    additionalReferences: readonly string[] = []
  ): Promise<Array<{ scope: "queued_run"; reference: string }>> {
    const references = [...(onlyReference ? [onlyReference] : manifest.targets.filter((target) => target.scope === "queued_run").map((target) => target.reference)), ...additionalReferences]
      .filter((reference) => !isActionReference(reference))
    if (references.length === 0) return []
    if (!this.deps.chatRunStore.listAllAuthoritative || !this.deps.documentIngestRunStore.listAllAuthoritative || !this.deps.benchmarkRunStore.listAllAuthoritative) {
      throw new Error("Strongly consistent tenant run enumeration adapter is unavailable")
    }
    const { chatRuns, ingestRuns, benchmarkRuns } = await this.tenantRuns(manifest.tenantId)
    const result: Array<{ scope: "queued_run"; reference: string }> = []
    for (const run of chatRuns.filter((candidate) => isActiveRunStatus(candidate.status))) {
      for (const reference of references) {
        if (!await this.matchesChatRun(manifest, reference, run)) continue
        result.push({ scope: "queued_run", reference: action(chatRunActionPrefix, run.runId) })
        break
      }
    }
    for (const run of ingestRuns.filter((candidate) => isActiveRunStatus(candidate.status))) {
      for (const reference of references) {
        if (!await this.matchesIngestRun(manifest, reference, run)) continue
        result.push({ scope: "queued_run", reference: action(ingestRunActionPrefix, run.runId) })
        break
      }
    }
    for (const run of benchmarkRuns.filter((candidate) => isActiveRunStatus(candidate.status))) {
      if (references.some((reference) => matchesBenchmarkRun(manifest, reference, run.createdBy))) {
        result.push({ scope: "queued_run", reference: action(benchmarkRunActionPrefix, run.runId) })
      }
    }
    return uniqueReferences(result) as Array<{ scope: "queued_run"; reference: string }>
  }

  private async matchesChatRun(manifest: RevocationCleanupManifest, reference: string, run: ChatRun): Promise<boolean> {
    const documentPrincipal = documentPrincipalReference(reference)
    if (documentPrincipal) {
      if (!run.searchScope?.documentIds?.includes(documentPrincipal.documentId)) return false
      if (!await this.actorMatchesPrincipal(manifest, documentPrincipal.principalType, documentPrincipal.principalId, run.createdBy)) return false
      const ceiling = principalCeilingForReference(manifest, reference)
      if (!ceiling) throw new RevocationCleanupValidationError("Document queued-run cleanup has no permission ceiling")
      if (permissionAtLeast(ceiling, "readOnly")) return false
      return this.actorLacksDocumentPermission(manifest, actorForRun(manifest, run), documentPrincipal.documentId, "readOnly")
    }
    const folderPrincipal = folderPrincipalReference(reference)
    if (folderPrincipal) {
      if (!run.searchScope?.groupIds?.includes(folderPrincipal.folderId)) return false
      if (!await this.actorMatchesPrincipal(manifest, folderPrincipal.principalType, folderPrincipal.principalId, run.createdBy)) return false
      const ceiling = principalCeilingForReference(manifest, reference)
      if (!ceiling) throw new RevocationCleanupValidationError("Folder queued-run cleanup has no permission ceiling")
      if (permissionAtLeast(ceiling, "readOnly")) return false
      return this.actorLacksFolderPermission(actorForRun(manifest, run), folderPrincipal.folderId, "readOnly")
    }
    const groupPrincipal = resourceGroupPrincipalReference(manifest, reference)
    if (groupPrincipal) {
      if (!await this.actorMatchesPrincipal(manifest, groupPrincipal.principalType, groupPrincipal.principalId, run.createdBy)) return false
      const ceiling = principalCeilingForReference(manifest, reference)
      if (!ceiling) throw new RevocationCleanupValidationError("Resource-group queued-run cleanup has no permission ceiling")
      if (permissionAtLeast(ceiling, "readOnly")) return false
      return this.chatRunHasInsufficientCurrentScope(manifest, run)
    }
    if (matchesPrincipalReference(reference, run.createdBy)) return true
    if (reference.startsWith("document:")) {
      const documentId = reference.slice("document:".length)
      return run.searchScope?.documentIds?.includes(documentId) === true
    }
    if (reference.startsWith("temporary-scope:")) return temporaryScopeIds(run.searchScope).includes(reference.slice("temporary-scope:".length))
    if (reference.startsWith("temporary:")) return run.searchScope?.documentIds?.includes(reference.slice("temporary:".length)) === true
    const groupId = resourceGroupReferenceId(reference)
    return Boolean(groupId && run.searchScope?.groupIds?.includes(groupId))
  }

  private async matchesIngestRun(manifest: RevocationCleanupManifest, reference: string, run: DocumentIngestRun): Promise<boolean> {
    const documentPrincipal = documentPrincipalReference(reference)
    if (documentPrincipal) {
      if (run.documentId !== documentPrincipal.documentId) return false
      if (!await this.actorMatchesPrincipal(manifest, documentPrincipal.principalType, documentPrincipal.principalId, run.createdBy)) return false
      const ceiling = principalCeilingForReference(manifest, reference)
      if (!ceiling) throw new RevocationCleanupValidationError("Document queued-run cleanup has no permission ceiling")
      if (permissionAtLeast(ceiling, "full")) return false
      return this.actorLacksDocumentPermission(manifest, actorForRun(manifest, run), documentPrincipal.documentId, "full")
    }
    const folderPrincipal = folderPrincipalReference(reference)
    if (folderPrincipal) {
      if (!ingestFolderIds(run).includes(folderPrincipal.folderId)) return false
      if (!await this.actorMatchesPrincipal(manifest, folderPrincipal.principalType, folderPrincipal.principalId, run.createdBy)) return false
      const ceiling = principalCeilingForReference(manifest, reference)
      if (!ceiling) throw new RevocationCleanupValidationError("Folder queued-run cleanup has no permission ceiling")
      if (permissionAtLeast(ceiling, "full")) return false
      return this.actorLacksFolderPermission(actorForRun(manifest, run), folderPrincipal.folderId, "full")
    }
    const groupPrincipal = resourceGroupPrincipalReference(manifest, reference)
    if (groupPrincipal) {
      if (!await this.actorMatchesPrincipal(manifest, groupPrincipal.principalType, groupPrincipal.principalId, run.createdBy)) return false
      const ceiling = principalCeilingForReference(manifest, reference)
      if (!ceiling) throw new RevocationCleanupValidationError("Resource-group queued-run cleanup has no permission ceiling")
      if (permissionAtLeast(ceiling, "full")) return false
      return this.ingestRunHasInsufficientCurrentScope(manifest, run)
    }
    if (matchesPrincipalReference(reference, run.createdBy)) return true
    if (reference.startsWith("document:")) return run.documentId === reference.slice("document:".length)
    if (reference.startsWith("temporary:")) return run.documentId === reference.slice("temporary:".length)
    if (reference.startsWith("temporary-scope:")) return run.metadata?.temporaryScopeId === reference.slice("temporary-scope:".length)
    const groupId = resourceGroupReferenceId(reference)
    return Boolean(groupId && ingestFolderIds(run).includes(groupId))
  }

  private async chatRunHasInsufficientCurrentScope(manifest: RevocationCleanupManifest, run: ChatRun): Promise<boolean> {
    const actor = actorForRun(manifest, run)
    const documentIds = run.searchScope?.documentIds ?? []
    const folderIds = run.searchScope?.groupIds ?? []
    if (documentIds.length === 0 && folderIds.length === 0) return false
    for (const documentId of documentIds) {
      if (await this.actorLacksDocumentPermission(manifest, actor, documentId, "readOnly")) return true
    }
    for (const folderId of folderIds) {
      if (await this.actorLacksFolderPermission(actor, folderId, "readOnly")) return true
    }
    return false
  }

  private async ingestRunHasInsufficientCurrentScope(manifest: RevocationCleanupManifest, run: DocumentIngestRun): Promise<boolean> {
    const actor = actorForRun(manifest, run)
    if (run.documentId && await this.actorLacksDocumentPermission(manifest, actor, run.documentId, "full")) return true
    const folderIds = ingestFolderIds(run)
    for (const folderId of folderIds) {
      if (await this.actorLacksFolderPermission(actor, folderId, "full")) return true
    }
    return false
  }

  private async actorLacksDocumentPermission(
    manifest: RevocationCleanupManifest,
    actor: AppUser,
    documentId: string,
    required: "readOnly" | "full"
  ): Promise<boolean> {
    const document = (await this.tenantDocuments(manifest)).find((candidate) => candidate.documentId === documentId)
    if (!document) throw new RevocationCleanupValidationError("Queued-run document identity is unavailable")
    const decision = await new DocumentPermissionService(this.deps).resolveEffectiveDocumentPermissionDecision(actor, document)
    if (permissionDecisionUnavailable(decision.reasonCode)) {
      throw new RevocationCleanupValidationError("Queued-run document permission could not be verified")
    }
    return !permissionAtLeast(decision.permission, required)
  }

  private async actorLacksFolderPermission(actor: AppUser, folderId: string, required: "readOnly" | "full"): Promise<boolean> {
    const decision = await new FolderPermissionService(this.deps).resolveEffectiveFolderPermissionDecision(actor, folderId)
    if (permissionDecisionUnavailable(decision.reasonCode)) {
      throw new RevocationCleanupValidationError("Queued-run folder permission could not be verified")
    }
    return !permissionAtLeast(decision.permission, required)
  }

  private actorMatchesPrincipal(
    manifest: RevocationCleanupManifest,
    principalType: "user" | "group",
    principalId: string,
    actorId: string
  ): Promise<boolean> {
    if (principalType === "user") return Promise.resolve(principalId === actorId)
    const key = `${manifest.tenantId}\u0000${principalId}\u0000${actorId}`
    const existing = this.groupActorMembershipCache.get(key)
    if (existing) return existing
    const pending = this.actorBelongsToGroup(manifest, principalId, actorId, new Set())
    this.groupActorMembershipCache.set(key, pending)
    return pending
  }

  private async actorBelongsToGroup(
    manifest: RevocationCleanupManifest,
    groupId: string,
    actorId: string,
    path: Set<string>
  ): Promise<boolean> {
    if (path.has(groupId)) throw new RevocationCleanupValidationError("Resource-group membership cycle is invalid")
    const group = await this.deps.userGroupStore.get(manifest.tenantId, groupId)
    if (!group || group.tenantId !== manifest.tenantId) {
      throw new RevocationCleanupValidationError("Queued-run resource-group identity is unavailable")
    }
    const memberships = await this.deps.groupMembershipStore.listByGroupId(manifest.tenantId, groupId)
    if (memberships.some((membership) => membership.tenantId !== manifest.tenantId || membership.groupId !== groupId)) {
      throw new RevocationCleanupValidationError("Queued-run resource-group membership crossed its tenant boundary")
    }
    if (memberships.some((membership) => membership.memberType === "user" && membership.memberId === actorId)) return true
    const nextPath = new Set(path)
    nextPath.add(groupId)
    for (const membership of memberships.filter((candidate) => candidate.memberType === "group")) {
      if (await this.actorBelongsToGroup(manifest, membership.memberId, actorId, nextPath)) return true
    }
    return false
  }

  private tenantRuns(tenantId: string): Promise<{ chatRuns: ChatRun[]; ingestRuns: DocumentIngestRun[]; benchmarkRuns: BenchmarkRun[] }> {
    this.runSnapshotPromise ??= Promise.all([
      this.deps.chatRunStore.listAllAuthoritative!(tenantId),
      this.deps.documentIngestRunStore.listAllAuthoritative!(tenantId),
      this.deps.benchmarkRunStore.listAllAuthoritative!(tenantId)
    ]).then(([chatRuns, ingestRuns, benchmarkRuns]) => ({ chatRuns, ingestRuns, benchmarkRuns }))
    return this.runSnapshotPromise
  }

  private allTenantRuns(tenantId: string): Promise<{ chatRuns: ChatRun[]; ingestRuns: DocumentIngestRun[]; benchmarkRuns: BenchmarkRun[] }> {
    if (!this.deps.chatRunStore.listAll || !this.deps.documentIngestRunStore.listAll || !this.deps.benchmarkRunStore.listAll) {
      throw new Error("Tenant evaluation-run backfill adapter is unavailable")
    }
    this.allRunSnapshotPromise ??= Promise.all([
      this.deps.chatRunStore.listAll(tenantId),
      this.deps.documentIngestRunStore.listAll(tenantId),
      this.deps.benchmarkRunStore.listAll(tenantId)
    ]).then(([chatRuns, ingestRuns, benchmarkRuns]) => ({ chatRuns, ingestRuns, benchmarkRuns }))
    return this.allRunSnapshotPromise
  }

  private async evaluationRunIds(manifest: RevocationCleanupManifest, securityRefs: Set<string>): Promise<Set<string>> {
    const { chatRuns, ingestRuns, benchmarkRuns } = await this.allTenantRuns(manifest.tenantId)
    const matchesRefs = (run: { securityResourceRefs?: string[] }) => run.securityResourceRefs?.some((reference) => securityRefs.has(reference)) === true
    const accountMatch = (run: { createdBy: string }) => manifest.resourceType === "account" && run.createdBy === manifest.resourceId
    const folderMatch = (folderIds: readonly string[]) => manifest.resourceType === "folder" && folderIds.includes(manifest.resourceId)
    const ids = new Set<string>()
    for (const run of chatRuns) {
      if (matchesRefs(run) || accountMatch(run) || folderMatch(run.searchScope?.groupIds ?? [])) ids.add(run.runId)
    }
    for (const run of ingestRuns) {
      if (matchesRefs(run) || accountMatch(run) || folderMatch(ingestFolderIds(run))) ids.add(run.runId)
    }
    for (const run of benchmarkRuns) {
      if (matchesRefs(run) || accountMatch(run)) ids.add(run.runId)
    }
    return ids
  }

  private async markRunInactive(kind: "chat" | "ingest" | "benchmark", runId: string): Promise<void> {
    if (!this.runSnapshotPromise) return
    const snapshot = await this.runSnapshotPromise
    const runs = kind === "chat" ? snapshot.chatRuns : kind === "ingest" ? snapshot.ingestRuns : snapshot.benchmarkRuns
    const run = runs.find((candidate) => candidate.runId === runId)
    if (run) run.status = "failed"
  }

  private async qualitySampleKeys(manifest: RevocationCleanupManifest): Promise<string[]> {
    const requested = manifest.targets
      .filter((target) => target.scope === "evaluation_artifact" && target.reference.startsWith("quality-control:"))
      .map((target) => target.reference.split(":"))
    const documents = await this.relevantDocuments(manifest)
    const resourceIds = new Set([
      manifest.resourceId,
      ...documents.flatMap((document) => [document.documentId, document.publicationControl?.sourceId ?? ""])
    ].filter(Boolean))
    const securityRefs = this.evaluationSecurityRefs(manifest, documents)
    const runIds = await this.evaluationRunIds(manifest, securityRefs)
    if (requested.length === 0 && resourceIds.size === 0 && securityRefs.size === 0 && runIds.size === 0) return []
    const qualityPrefix = qualityTenantSamplePrefix(manifest.tenantId)
    const keys = await this.listSafeObjectKeys(manifest, qualityPrefix, { allowQualityPrefix: true })
    const matching: string[] = []
    for (const key of keys.filter((candidate) => candidate.endsWith(".json"))) {
      let sample: { sourceType?: unknown; artifactId?: unknown; tenantPartitionId?: unknown; resourceIds?: unknown; securityResourceRefs?: unknown }
      try {
        sample = JSON.parse(await this.deps.objectStore.getText(key)) as typeof sample
      } catch (error) {
        throw new RevocationCleanupValidationError(`Quality sample discovery failed: ${failureName(error)}`)
      }
      if (sample.tenantPartitionId === undefined) throw new RevocationCleanupValidationError("Tenant-partitioned quality sample has no tenant identity")
      if (sample.tenantPartitionId !== tenantPartitionId(manifest.tenantId)) {
        throw new RevocationCleanupValidationError("Quality sample crossed its tenant partition")
      }
      if (sample.resourceIds !== undefined && (!Array.isArray(sample.resourceIds) || sample.resourceIds.some((value) => typeof value !== "string"))) {
        throw new RevocationCleanupValidationError("Quality sample resource identity is invalid")
      }
      if (sample.securityResourceRefs !== undefined && (!Array.isArray(sample.securityResourceRefs) || sample.securityResourceRefs.some((value) => typeof value !== "string"))) {
        throw new RevocationCleanupValidationError("Quality sample security resource identity is invalid")
      }
      const exactArtifact = requested.some(([, sourceType, artifactId]) => sourceType === sample.sourceType && artifactId === sample.artifactId)
      const relatedResource = (sample.resourceIds as string[] | undefined)?.some((resourceId) => resourceIds.has(resourceId)) === true
      const relatedSecurityResource = (sample.securityResourceRefs as string[] | undefined)?.some((reference) => securityRefs.has(reference)) === true
      const relatedRun = typeof sample.artifactId === "string" && runIds.has(sample.artifactId)
      if (exactArtifact || relatedResource || relatedSecurityResource || relatedRun) matching.push(key)
    }
    return matching
  }

  private async relatedDebugTraceKeys(
    manifest: RevocationCleanupManifest,
    documents: readonly DocumentManifest[]
  ): Promise<string[]> {
    const documentIds = new Set(documents.map((document) => document.documentId))
    const securityRefs = this.evaluationSecurityRefs(manifest, documents)
    const runIds = await this.evaluationRunIds(manifest, securityRefs)
    if (documentIds.size === 0 && securityRefs.size === 0 && runIds.size === 0) return []
    const prefix = `debug-runs/${tenantPartitionId(manifest.tenantId)}/`
    const keys = await this.listSafeObjectKeys(manifest, prefix, { allowDebugPrefix: true })
    const matching: string[] = []
    for (const key of keys.filter((candidate) => candidate.endsWith(".json"))) {
      let trace: { runId?: unknown; tenantPartitionId?: unknown; securityResourceRefs?: unknown; retrieved?: unknown; finalEvidence?: unknown; citations?: unknown }
      try {
        trace = JSON.parse(await this.deps.objectStore.getText(key)) as typeof trace
      } catch (error) {
        throw new RevocationCleanupValidationError(`Debug trace discovery failed: ${failureName(error)}`)
      }
      if (trace.tenantPartitionId !== tenantPartitionId(manifest.tenantId)) {
        throw new RevocationCleanupValidationError("Debug trace tenant identity is invalid")
      }
      if (trace.securityResourceRefs !== undefined && (!Array.isArray(trace.securityResourceRefs) || trace.securityResourceRefs.some((value) => typeof value !== "string"))) {
        throw new RevocationCleanupValidationError("Debug trace security resource identity is invalid")
      }
      const citations = [trace.retrieved, trace.finalEvidence, trace.citations]
        .flatMap((value) => Array.isArray(value) ? value : []) as Array<{ documentId?: unknown }>
      const relatedDocument = citations.some((citation) => typeof citation.documentId === "string" && documentIds.has(citation.documentId))
      const relatedSecurityResource = (trace.securityResourceRefs as string[] | undefined)?.some((reference) => securityRefs.has(reference)) === true
      const relatedRun = typeof trace.runId === "string" && runIds.has(trace.runId)
      if (relatedDocument || relatedSecurityResource || relatedRun) matching.push(key)
    }
    return matching
  }

  private evaluationSecurityRefs(
    manifest: RevocationCleanupManifest,
    documents: readonly DocumentManifest[]
  ): Set<string> {
    const refs = new Set<string>()
    const addPrincipal = (principalType: "user" | "group", principalId: string) => refs.add(securityResourceReference(
      manifest.tenantId,
      principalType === "user" ? "account" : "resource_group",
      principalId
    ))
    if (manifest.resourceType === "account") refs.add(securityResourceReference(manifest.tenantId, "account", manifest.resourceId))
    if (manifest.resourceType === "folder") {
      if (manifest.trigger === "share_revoked") {
        for (const target of manifest.targets.filter((candidate) => candidate.scope === "grant")) {
          const principal = revokedFolderPrincipal(manifest, target.reference)
          if (principal) addPrincipal(principal.principalType, principal.principalId)
        }
      } else refs.add(securityResourceReference(manifest.tenantId, "folder", manifest.resourceId))
    }
    if (manifest.resourceType === "group" || manifest.resourceType === "resource_group") {
      const affected = manifest.targets
        .filter((candidate) => candidate.scope === "grant")
        .map((target) => revokedGroupMember(manifest, target.reference))
        .filter((member): member is NonNullable<ReturnType<typeof revokedGroupMember>> => Boolean(member))
      if (affected.length > 0) for (const member of affected) addPrincipal(member.memberType, member.memberId)
      else refs.add(securityResourceReference(manifest.tenantId, "resource_group", manifest.resourceId))
    }
    if ((manifest.resourceType === "document" || manifest.resourceType === "temporary_attachment") && manifest.trigger === "share_revoked") {
      for (const target of manifest.targets.filter((candidate) => candidate.scope === "grant")) {
        const principal = revokedDocumentPrincipal(manifest, target.reference)
        if (principal) addPrincipal(principal.principalType, principal.principalId)
      }
    } else if (manifest.resourceType === "document" || manifest.resourceType === "temporary_attachment") {
      for (const document of documents) refs.add(securityResourceReference(manifest.tenantId, "document", document.documentId))
    }
    return refs
  }

  private async currentPublicationPointerKey(
    manifest: RevocationCleanupManifest,
    document: DocumentManifest
  ): Promise<string | undefined> {
    const key = document.publicationControl?.activePointerKey
    if (!key) return undefined
    return await this.publicationControlObjectMatches(manifest, key) ? key : undefined
  }

  private async publicationControlObjectMatches(
    manifest: RevocationCleanupManifest,
    key: string
  ): Promise<boolean> {
    if (hasPathEscape(key) || !key.startsWith("publication/active/")) {
      throw new RevocationCleanupValidationError("Publication cleanup target escaped its control partition")
    }
    const documents = await this.relevantDocuments(manifest)
    let parsed: {
      tenantId?: unknown
      sourceId?: unknown
      artifactId?: unknown
      manifestObjectKey?: unknown
      runId?: unknown
      scope?: { tenantId?: unknown; sourceId?: unknown }
    }
    try {
      parsed = JSON.parse(await this.deps.objectStore.getText(key)) as typeof parsed
    } catch (error) {
      if (isMissingError(error)) return false
      throw error
    }
    const sourceIds = new Set([manifest.resourceId, ...documents.flatMap((document) => [document.documentId, document.publicationControl?.sourceId ?? ""])].filter(Boolean))
    const matches = parsed.tenantId === manifest.tenantId
      && typeof parsed.sourceId === "string"
      && sourceIds.has(parsed.sourceId)
    if (!matches) throw new RevocationCleanupValidationError("Publication pointer identity is invalid")
    return true
  }

  private async listSafeObjectKeys(
    manifest: RevocationCleanupManifest,
    prefix: string,
    options: { allowQualityPrefix?: boolean; allowDebugPrefix?: boolean } = {}
  ): Promise<string[]> {
    if (options.allowQualityPrefix) {
      if (prefix !== qualityTenantSamplePrefix(manifest.tenantId)) throw new RevocationCleanupValidationError("Quality cleanup prefix is invalid")
    } else if (options.allowDebugPrefix) {
      if (prefix !== `debug-runs/${tenantPartitionId(manifest.tenantId)}/`) throw new RevocationCleanupValidationError("Debug cleanup prefix is invalid")
    } else assertSafeListPrefix(manifest, prefix)
    const keys = await this.deps.objectStore.listKeys(prefix)
    if (keys.some((key) => !key.startsWith(prefix) || hasPathEscape(key))) {
      throw new RevocationCleanupValidationError("Cleanup discovery escaped its allowed prefix")
    }
    return keys
  }

  private async objectExists(store: Dependencies["objectStore"], key: string): Promise<boolean> {
    try {
      await store.getObjectSize(key)
      return true
    } catch (error) {
      if (isMissingError(error)) return false
      throw error
    }
  }

  private async vectorExists(store: Dependencies["evidenceVectorStore"], key: string): Promise<boolean> {
    if (!store.getByKeys) throw new Error("Vector residual verification adapter is unavailable")
    return (await store.getByKeys([key])).some((record) => record.key === key)
  }
}

class DefaultAuthoritativeRevocationDenyVerifier implements AuthoritativeRevocationDenyVerifier {
  constructor(private readonly deps: CleanupDeps) {}

  async isCurrent(manifest: RevocationCleanupManifest): Promise<boolean> {
    if (manifest.resourceType === "benchmark_run") return this.benchmarkDeny(manifest)
    if (manifest.resourceType === "account") return this.accountDeny(manifest)
    if (manifest.resourceType === "group" || manifest.resourceType === "resource_group") return this.groupDeny(manifest)
    if (manifest.resourceType === "folder") return this.folderDeny(manifest)
    if (manifest.resourceType === "document" || manifest.resourceType === "temporary_attachment") return this.documentDeny(manifest)
    throw new RevocationCleanupValidationError("Authoritative deny verifier does not support this resource type")
  }

  private async benchmarkDeny(manifest: RevocationCleanupManifest): Promise<boolean> {
    const run = await this.deps.benchmarkRunStore.get(manifest.tenantId, manifest.resourceId)
    if (!run) throw new Error("Authoritative benchmark run is unavailable")
    return run.status === "failed"
      && run.errorCode === "permission_revoked"
      && run.updatedAt === manifest.authoritativeDeny.version
  }

  private async accountDeny(manifest: RevocationCleanupManifest): Promise<boolean> {
    if (manifest.operationId.startsWith("chat-run-permission-revoked:")) {
      const operationPrefix = `chat-run-permission-revoked:${manifest.tenantId}:`
      if (!manifest.operationId.startsWith(operationPrefix)) throw new RevocationCleanupValidationError("Revoked chat run tenant identity is invalid")
      const runId = manifest.operationId.slice(operationPrefix.length)
      if (!runId) throw new RevocationCleanupValidationError("Revoked chat run identity is invalid")
      const run = await this.deps.chatRunStore.get(manifest.tenantId, runId)
      if (!run) throw new Error("Authoritative revoked chat run is unavailable")
      return run.status === "failed"
        && run.errorCode === "permission_revoked"
        && run.createdBy === manifest.resourceId
        && manifest.authoritativeDeny.version === `worker-authorization:${run.runId}:permission_revoked`
        && manifest.authoritativeDeny.confirmedAt === run.updatedAt
    }
    if (manifest.trigger === "account_revoked") {
      const registry = this.deps.accountRevocationRegistry ?? new ObjectStoreAccountRevocationRegistry(this.deps.objectStore)
      const record = await registry.get(manifest.tenantId, manifest.resourceId)
      return Boolean(record
        && record.state === "denied"
        && (
          manifest.authoritativeDeny.version === accountRevocationCleanupDenyVersion(record)
          || manifest.authoritativeDeny.version === `account-revocation:${record.revision}:${record.auditIntentId}`
        ))
    }
    if (manifest.trigger === "role_revoked") {
      if (!this.deps.verifiedIdentityProvider) throw new Error("Authoritative identity verifier is unavailable")
      const identity = await this.deps.verifiedIdentityProvider.getCurrentIdentityBySubject(manifest.resourceId)
      if (!identity || identity.tenantId !== manifest.tenantId) throw new Error("Authoritative role subject is unavailable")
      const versionPrefix = `${ROLE_CATALOG_VERSION}:`
      if (!manifest.authoritativeDeny.version.startsWith(versionPrefix)) throw new RevocationCleanupValidationError("Authoritative role deny version is invalid")
      const expected = manifest.authoritativeDeny.version.slice(versionPrefix.length).split(",").filter((role) => role && role !== "none").sort()
      const current = identity.cognitoGroups.filter(isApplicationRole).sort()
      if (sameStrings(expected, current)) return true
      const roleTargets = manifest.targets
        .filter((target) => target.scope === "grant" && target.reference.startsWith("role:"))
        .map((target) => target.reference.slice("role:".length))
      const removedRoles = roleTargets.filter(isApplicationRole)
      if (removedRoles.length === 0 || removedRoles.length !== roleTargets.length) {
        throw new RevocationCleanupValidationError("Authoritative role deny has no valid affected role")
      }
      return removedRoles.every((role) => !current.includes(role))
    }
    throw new RevocationCleanupValidationError("Unsupported account deny trigger")
  }

  private async groupDeny(manifest: RevocationCleanupManifest): Promise<boolean> {
    if (manifest.trigger === "group_revoked") {
      const state = await this.deps.groupMembershipStore.getVersionedGroupState(manifest.tenantId, manifest.resourceId)
      const expected = manifest.authoritativeDeny.version.replace(/^membership:/u, "")
      if (state.version === expected || groupMembershipStateVersion(state.memberships) === expected) return true
      const revokedMembers = manifest.targets
        .filter((target) => target.scope === "grant")
        .map((target) => revokedGroupMember(manifest, target.reference))
        .filter((member): member is { memberType: "user" | "group"; memberId: string; ceiling: "none" | "readOnly" | "full" } => Boolean(member))
      if (revokedMembers.length === 0) throw new RevocationCleanupValidationError("Authoritative group deny has no affected member")
      const permissionRank = { none: 0, readOnly: 1, full: 2 } as const
      return revokedMembers.every((revoked) => {
        const current = state.memberships.find((membership) => (
          membership.memberType === revoked.memberType && membership.memberId === revoked.memberId
        ))
        return permissionRank[current?.permissionLevel ?? "none"] <= permissionRank[revoked.ceiling]
      })
    }
    if (manifest.trigger === "archived") {
      const group = await this.deps.userGroupStore.get(manifest.tenantId, manifest.resourceId)
      if (!group) throw new Error("Authoritative resource group is unavailable")
      return group.status === "archived"
        && manifest.authoritativeDeny.version === `resource-group:${group.updatedAt}`
    }
    throw new RevocationCleanupValidationError("Unsupported group deny trigger")
  }

  private async folderDeny(manifest: RevocationCleanupManifest): Promise<boolean> {
    if (manifest.trigger !== "share_revoked") throw new RevocationCleanupValidationError("Unsupported folder deny trigger")
    const state = await this.deps.folderPolicyStore.getVersionedByFolderId(manifest.tenantId, manifest.resourceId)
    if (state.version === manifest.authoritativeDeny.version) return true
    const affected = manifest.targets
      .filter((target) => target.scope === "grant")
      .map((target) => revokedFolderPrincipal(manifest, target.reference))
      .filter((principal): principal is { principalType: "user" | "group"; principalId: string; ceiling: "none" | "readOnly" } => Boolean(principal))
    if (affected.length === 0) throw new RevocationCleanupValidationError("Authoritative folder deny has no affected principal")
    const rank = { deny: 0, readOnly: 1, full: 2 } as const
    return affected.every((principal) => {
      const current = state.policy?.entries.find((entry) => (
        entry.principalType === principal.principalType && entry.principalId === principal.principalId
      ))
      return rank[current?.permissionLevel ?? "deny"] <= rank[principal.ceiling === "none" ? "deny" : "readOnly"]
    })
  }

  private async documentDeny(manifest: RevocationCleanupManifest): Promise<boolean> {
    if (manifest.trigger === "share_revoked") {
      const stored = await this.deps.objectStore.getText(documentShareGrantKey(manifest.tenantId, manifest.resourceId))
      const parsed = JSON.parse(stored) as { grants?: DocumentShareGrant[] }
      if (!Array.isArray(parsed.grants)) throw new RevocationCleanupValidationError("Authoritative document share policy is invalid")
      const grants = parsed.grants.filter((grant) => grant.tenantId === manifest.tenantId && grant.documentId === manifest.resourceId)
      const deniedTargets = manifest.targets.filter((target) => target.scope === "grant")
      if (deniedTargets.length === 0) throw new RevocationCleanupValidationError("Document share deny has no affected principal")
      const affected = deniedTargets.map((target) => revokedDocumentPrincipal(manifest, target.reference))
      if (affected.some((principal) => !principal)) throw new RevocationCleanupValidationError("Document share deny principal is invalid")
      if (documentSharePolicyStateVersion(grants) === manifest.authoritativeDeny.version) return true
      // A later unrelated policy revision is still safe when every originally
      // affected principal remains denied. Regranting any one supersedes cleanup.
      const rank = { deny: 0, readOnly: 1, full: 2 } as const
      return affected.every((principal) => {
        if (!principal) return false
        const current = grants.find((grant) => grant.principalType === principal.principalType && grant.principalId === principal.principalId)
        return rank[current?.permissionLevel ?? "deny"] <= rank[principal.ceiling]
      })
    }
    if (manifest.operationId.startsWith("source-governance:")) {
      const key = `source-governance/${encodeURIComponent(manifest.tenantId)}/${encodeURIComponent(manifest.resourceId)}.json`
      const stored = await this.deps.objectStore.getTextWithVersion(key)
      const record = JSON.parse(stored.text) as SourceGovernanceRecord
      return record.tenantId === manifest.tenantId
        && record.sourceId === manifest.resourceId
        && (record.status === "restricted" || record.status === "reconciliation_required")
        && Boolean(record.restriction)
        && (
          stored.version === manifest.authoritativeDeny.version
          || sourceGovernanceRestrictionStateVersion(record) === manifest.authoritativeDeny.version
        )
    }
    if (manifest.authoritativeDeny.version.startsWith("expiry:")) {
      const expectedExpiresAt = manifest.authoritativeDeny.version.slice("expiry:".length)
      const expiresAt = Date.parse(expectedExpiresAt)
      if (!Number.isFinite(expiresAt)) throw new RevocationCleanupValidationError("Authoritative expiry deny is invalid")
      const current = await findDocumentManifestIfPresent(this.deps, manifest)
      if (current) {
        return current.metadata?.scopeType === "chat"
          && current.metadata.expiresAt === expectedExpiresAt
          && expiresAt <= Date.now()
      }
      if (!sourceCleanupWasApplied(manifest)) throw new Error("Authoritative temporary attachment is unavailable")
      return expiresAt <= Date.now()
    }
    if (manifest.authoritativeDeny.version.startsWith("uncommitted:") && manifest.operationId.startsWith("ingest-compensation:")) {
      const current = await findDocumentManifest(this.deps, manifest).catch((error) => {
        if (isMissingError(error)) return undefined
        throw error
      })
      return current ? !await isManifestCurrentPublication(this.deps, current) : true
    }
    if (manifest.trigger === "temporary_scope_mismatch") {
      const operationPrefix = `temporary:temporary_scope_mismatch:${manifest.resourceId}:`
      const requestedScopeId = manifest.operationId.startsWith(operationPrefix) ? manifest.operationId.slice(operationPrefix.length) : ""
      if (!requestedScopeId) throw new RevocationCleanupValidationError("Temporary scope deny identity is invalid")
      const current = await findDocumentManifestIfPresent(this.deps, manifest)
      if (!current) throw new Error("Authoritative temporary attachment is unavailable")
      const currentScopeId = typeof current.metadata?.temporaryScopeId === "string" ? current.metadata.temporaryScopeId : ""
      return current.metadata?.scopeType === "chat"
        && Boolean(currentScopeId)
        && currentScopeId !== requestedScopeId
        && manifest.authoritativeDeny.version === `temporary_scope_mismatch:${current.updatedAt ?? current.createdAt}`
    }
    if (manifest.trigger === "account_revoked" && manifest.resourceType === "temporary_attachment") {
      const operationPrefix = `temporary:account_revoked:${manifest.resourceId}:`
      const ownerUserId = manifest.operationId.startsWith(operationPrefix) ? manifest.operationId.slice(operationPrefix.length) : ""
      if (!ownerUserId) throw new RevocationCleanupValidationError("Temporary owner deny identity is invalid")
      const registry = this.deps.accountRevocationRegistry ?? new ObjectStoreAccountRevocationRegistry(this.deps.objectStore)
      if ((await registry.get(manifest.tenantId, ownerUserId))?.state !== "denied") return false
      const current = await findDocumentManifestIfPresent(this.deps, manifest)
      if (!current) {
        if (!sourceCleanupWasApplied(manifest)) throw new Error("Authoritative temporary attachment is unavailable")
        return true
      }
      return current.metadata?.scopeType === "chat"
        && current.metadata.ownerUserId === ownerUserId
        && manifest.authoritativeDeny.version === `account_revoked:${current.updatedAt ?? current.createdAt}`
    }
    if (manifest.trigger === "deleted" || manifest.trigger === "archived") {
      const current = await findDocumentManifestIfPresent(this.deps, manifest)
      if (!current) {
        if (sourceCleanupWasCheckpointed(manifest)) return true
        throw new Error("Authoritative document lifecycle state is unavailable")
      }
      if (
        manifest.trigger === "deleted"
        && manifest.authoritativeDeny.version.startsWith("document-revocation:")
      ) {
        const revocation = current.metadata?.documentRevocation
        const tombstonedAt = current.updatedAt ?? current.createdAt
        return Boolean(
          revocation
          && typeof revocation === "object"
          && !Array.isArray(revocation)
          && revocation.operationId === manifest.operationId
          && current.lifecycleStatus === "superseded"
          && manifest.authoritativeDeny.version === `document-revocation:${manifest.operationId}:${tombstonedAt}`
        )
      }
      return current.lifecycleStatus !== "active"
        || typeof current.metadata?.deletedAt === "string"
        || typeof current.metadata?.archivedAt === "string"
    }
    throw new RevocationCleanupValidationError("Unsupported document deny trigger")
  }
}

async function findDocumentManifest(deps: CleanupDeps, manifest: RevocationCleanupManifest): Promise<DocumentManifest> {
  const prefix = tenantManifestPrefix(deps, manifest.tenantId)
  const keys = await deps.objectStore.listKeys(prefix)
  if (keys.some((key) => !key.startsWith(prefix) || hasPathEscape(key))) {
    throw new RevocationCleanupValidationError("Authoritative document listing escaped its tenant partition")
  }
  for (const key of keys.filter((candidate) => candidate.endsWith(".json"))) {
    const candidate = JSON.parse(await deps.objectStore.getText(key)) as DocumentManifest
    assertManifestTenant(candidate, manifest.tenantId, key)
    if (candidate.documentId === manifest.resourceId || candidate.publicationControl?.sourceId === manifest.resourceId) return candidate
  }
  throw Object.assign(new Error("Authoritative document manifest is unavailable"), { code: "ENOENT" })
}

async function findDocumentManifestIfPresent(deps: CleanupDeps, manifest: RevocationCleanupManifest): Promise<DocumentManifest | undefined> {
  try {
    return await findDocumentManifest(deps, manifest)
  } catch (error) {
    if (isMissingError(error)) return undefined
    throw error
  }
}

function sourceCleanupWasApplied(manifest: RevocationCleanupManifest): boolean {
  return manifest.targets.some((target) => target.scope === "source" && target.status === "cleaned")
}

function sourceCleanupWasCheckpointed(manifest: RevocationCleanupManifest): boolean {
  return sourceCleanupWasApplied(manifest)
    || Boolean(manifest.scopes.find((scope) => scope.scope === "source")?.discoveredAt)
}

function matchesPrincipalReference(reference: string, userId: string): boolean {
  if (reference === `principal:${userId}`) return true
  if (reference.includes(`/principal/user/${encodeURIComponent(userId)}/`)) return true
  return reference.endsWith(`:principal:${userId}`)
}

function matchesBenchmarkRun(manifest: RevocationCleanupManifest, reference: string, createdBy: string): boolean {
  if (
    documentPrincipalReference(reference)
    || folderPrincipalReference(reference)
    || resourceGroupPrincipalReference(manifest, reference)
    || reference.startsWith("document:")
  ) return false
  return matchesPrincipalReference(reference, createdBy)
}

function documentPrincipalReference(reference: string): { documentId: string; principalType: "user" | "group"; principalId: string } | undefined {
  const match = /^document:([^:]+):principal:(user|group):([^:]+)$/u.exec(reference)
  return match?.[1] && match[2] && match[3]
    ? { documentId: match[1], principalType: match[2] as "user" | "group", principalId: match[3] }
    : undefined
}

function folderPrincipalReference(reference: string): { folderId: string; principalType: "user" | "group"; principalId: string } | undefined {
  const match = /^folder:([^:]+):principal:(user|group):([^:]+)$/u.exec(reference)
  return match?.[1] && match[2] && match[3]
    ? { folderId: match[1], principalType: match[2] as "user" | "group", principalId: match[3] }
    : undefined
}

function resourceGroupPrincipalReference(
  manifest: RevocationCleanupManifest,
  reference: string
): { groupId: string; principalType: "user" | "group"; principalId: string } | undefined {
  const encoded = /^resource-group\/([^/]+)\/principal\/(user|group)\/([^/]+)\/queued-run$/u.exec(reference)
  if (encoded?.[1] && encoded[2] && encoded[3]) {
    try {
      const groupId = decodeURIComponent(encoded[1])
      if (groupId !== manifest.resourceId) return undefined
      return {
        groupId,
        principalType: encoded[2] as "user" | "group",
        principalId: decodeURIComponent(encoded[3])
      }
    } catch {
      return undefined
    }
  }
  const prefix = `resource-group:${manifest.resourceId}:principal:`
  if (!reference.startsWith(prefix)) return undefined
  const principalId = reference.slice(prefix.length)
  if (!principalId || principalId.includes(":")) return undefined
  const matchingGrant = manifest.targets
    .filter((target) => target.scope === "grant")
    .map((target) => revokedGroupMember(manifest, target.reference))
    .find((member) => member?.memberId === principalId)
  return matchingGrant ? { groupId: manifest.resourceId, principalType: matchingGrant.memberType, principalId } : undefined
}

function resourceGroupReferenceId(reference: string): string | undefined {
  if (reference.startsWith("resource-group:")) return reference.split(":")[1]
  const match = /^resource-group\/([^/]+)\//u.exec(reference)
  return match?.[1] ? decodeURIComponent(match[1]) : undefined
}

function revokedGroupMember(
  manifest: RevocationCleanupManifest,
  reference: string
): { memberType: "user" | "group"; memberId: string; ceiling: "none" | "readOnly" | "full" } | undefined {
  const colonPrefix = `resource-group:${manifest.resourceId}:`
  if (reference.startsWith(colonPrefix)) {
    const [memberType, memberId, ...extra] = reference.slice(colonPrefix.length).split(":")
    if ((memberType === "user" || memberType === "group") && memberId && extra.length === 0) return { memberType, memberId, ceiling: "none" }
    return undefined
  }
  const match = /^resource-group\/([^/]+)\/principal\/(user|group)\/([^/]+)\/grant\/ceiling\/(none|readOnly|full)$/u.exec(reference)
  if (!match?.[1] || !match[2] || !match[3] || !match[4]) return undefined
  try {
    if (decodeURIComponent(match[1]) !== manifest.resourceId) return undefined
    return {
      memberType: match[2] as "user" | "group",
      memberId: decodeURIComponent(match[3]),
      ceiling: match[4] as "none" | "readOnly" | "full"
    }
  } catch {
    return undefined
  }
}

function revokedFolderPrincipal(
  manifest: RevocationCleanupManifest,
  reference: string
): { principalType: "user" | "group"; principalId: string; ceiling: "none" | "readOnly" } | undefined {
  const prefix = `folder:${manifest.resourceId}:principal:`
  if (!reference.startsWith(prefix)) return undefined
  const [principalType, principalId, marker, ceiling, ...extra] = reference.slice(prefix.length).split(":")
  if ((principalType !== "user" && principalType !== "group") || !principalId || extra.length > 0) return undefined
  if (marker === undefined && ceiling === undefined) return { principalType, principalId, ceiling: "none" }
  if (marker !== "ceiling" || (ceiling !== "none" && ceiling !== "readOnly")) return undefined
  return { principalType, principalId, ceiling }
}

function revokedDocumentPrincipal(
  manifest: RevocationCleanupManifest,
  reference: string
): { principalType: "user" | "group"; principalId: string; ceiling: "deny" | "readOnly" } | undefined {
  const prefix = `document:${manifest.resourceId}:principal:`
  if (!reference.startsWith(prefix)) return undefined
  const [principalType, principalId, marker, ceiling, ...extra] = reference.slice(prefix.length).split(":")
  if (
    (principalType !== "user" && principalType !== "group")
    || !principalId
    || marker !== "ceiling"
    || (ceiling !== "none" && ceiling !== "readOnly")
    || extra.length > 0
  ) return undefined
  return { principalType, principalId, ceiling: ceiling === "none" ? "deny" : "readOnly" }
}

type CleanupPermission = "none" | "readOnly" | "full"

function principalCeilingForReference(manifest: RevocationCleanupManifest, reference: string): CleanupPermission | undefined {
  const document = documentPrincipalReference(reference)
  if (document) {
    const principal = manifest.targets
      .filter((target) => target.scope === "grant")
      .map((target) => revokedDocumentPrincipal(manifest, target.reference))
      .find((candidate) => candidate?.principalType === document.principalType && candidate.principalId === document.principalId)
    return principal?.ceiling === "deny" ? "none" : principal?.ceiling
  }
  const folder = folderPrincipalReference(reference)
  if (folder) {
    return manifest.targets
      .filter((target) => target.scope === "grant")
      .map((target) => revokedFolderPrincipal(manifest, target.reference))
      .find((candidate) => candidate?.principalType === folder.principalType && candidate.principalId === folder.principalId)
      ?.ceiling
  }
  const group = resourceGroupPrincipalReference(manifest, reference)
  if (group) {
    return manifest.targets
      .filter((target) => target.scope === "grant")
      .map((target) => revokedGroupMember(manifest, target.reference))
      .find((candidate) => candidate?.memberType === group.principalType && candidate.memberId === group.principalId)
      ?.ceiling
  }
  return undefined
}

function actorForRun(manifest: RevocationCleanupManifest, run: ChatRun | DocumentIngestRun): AppUser {
  return {
    userId: run.createdBy,
    email: run.userEmail,
    cognitoGroups: [...(run.userGroups ?? [])],
    accountStatus: "active",
    tenantId: manifest.tenantId
  }
}

function permissionAtLeast(permission: CleanupPermission, required: Exclude<CleanupPermission, "none">): boolean {
  const rank = { none: 0, readOnly: 1, full: 2 } as const
  return rank[permission] >= rank[required]
}

function permissionDecisionUnavailable(reason: string): boolean {
  return [
    "actor_tenant_unresolved",
    "identity_unverified",
    "ordinary_policy_unavailable",
    "resource_integrity_unverified",
    "resource_tenant_unresolved",
    "tenant_mismatch"
  ].includes(reason)
}

function ingestFolderIds(run: DocumentIngestRun): string[] {
  const values = [run.metadata?.folderIds, run.metadata?.folderId, run.metadata?.groupIds, run.metadata?.groupId]
    .flatMap((value) => typeof value === "string" ? [value] : Array.isArray(value) ? value : [])
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
  return [...new Set(values)]
}

function validateCleanupIdentity(manifest: RevocationCleanupManifest): void {
  if (!manifest.tenantId.trim() || !manifest.operationId.trim() || !manifest.resourceId.trim()) {
    throw new RevocationCleanupValidationError("Cleanup identity is incomplete")
  }
}

function action(prefix: string, value: string): string {
  return `${prefix}${encodeURIComponent(value)}`
}

function objectAction(key: string): string {
  return action(objectActionPrefix, key)
}

function benchmarkObjectAction(key: string): string {
  return action(benchmarkObjectActionPrefix, key)
}

function evidenceVectorAction(key: string): string {
  return action(evidenceVectorActionPrefix, key)
}

function memoryVectorAction(key: string): string {
  return action(memoryVectorActionPrefix, key)
}

function decodeAction(reference: string, prefix: string): string | undefined {
  if (!reference.startsWith(prefix)) return undefined
  try {
    const decoded = decodeURIComponent(reference.slice(prefix.length))
    if (!decoded || hasPathEscape(decoded)) throw new Error("invalid action")
    return decoded
  } catch {
    throw new RevocationCleanupValidationError("Cleanup action reference is invalid")
  }
}

function isActionReference(reference: string): boolean {
  return [objectActionPrefix, benchmarkObjectActionPrefix, evidenceVectorActionPrefix, memoryVectorActionPrefix, chatRunActionPrefix, ingestRunActionPrefix, benchmarkRunActionPrefix, publicationPointerActionPrefix]
    .some((prefix) => reference.startsWith(prefix))
}

function assertSafeTenantObjectKey(manifest: RevocationCleanupManifest, key: string): void {
  if (!isSafeTenantObjectKey(manifest, key)) {
    throw new RevocationCleanupValidationError("Object cleanup target escaped its tenant partition")
  }
}

function isSafeTenantObjectKey(manifest: RevocationCleanupManifest, key: string, _shouldThrow = false): boolean {
  return !hasPathEscape(key) && key.startsWith(`${tenantArtifactRoot(manifest.tenantId)}/`)
}

function assertSafeCacheObjectKey(manifest: RevocationCleanupManifest, key: string): void {
  if (!isSafeCacheObjectKey(manifest, key)) {
    throw new RevocationCleanupValidationError("Cache cleanup target escaped its tenant partition")
  }
}

function isSafeCacheObjectKey(manifest: RevocationCleanupManifest, key: string, _shouldThrow = false): boolean {
  return !hasPathEscape(key) && tenantCachePrefixes(manifest.tenantId).some((prefix) => key.startsWith(prefix))
}

function assertSafeTenantVectorKey(manifest: RevocationCleanupManifest, key: string): void {
  if (!isSafeTenantVectorKey(manifest, key)) throw new RevocationCleanupValidationError("Vector cleanup target escaped its tenant partition")
}

function isSafeTenantVectorKey(manifest: RevocationCleanupManifest, key: string): boolean {
  return !hasPathEscape(key) && key.startsWith(tenantVectorPrefix(manifest.tenantId)) && !key.includes("/")
}

function extractTenantVectorKey(manifest: RevocationCleanupManifest, reference: string): string | undefined {
  const prefix = tenantVectorPrefix(manifest.tenantId)
  const offset = reference.indexOf(prefix)
  if (offset < 0) return undefined
  const key = reference.slice(offset)
  assertSafeTenantVectorKey(manifest, key)
  return key
}

function tenantVectorPrefix(tenantId: string): string {
  return `tenant-${tenantPartitionId(tenantId).replace(/^tenant:/u, "")}-`
}

function tenantCachePrefixes(tenantId: string): string[] {
  const embeddingPartition = createHash("sha256").update(tenantId).digest("hex").slice(0, 24)
  return [
    `embedding-cache/${embeddingPartition}/`,
    `${tenantArtifactRoot(tenantId)}/lexical-index/`
  ]
}

function qualityTenantSamplePrefix(tenantId: string): string {
  const partition = encodeURIComponent(tenantPartitionId(tenantId)).replace(/%/gu, "_")
  return `quality-control/source-samples/${partition}/`
}

function assertSafeListPrefix(manifest: RevocationCleanupManifest, prefix: string): void {
  const allowed = [`${tenantArtifactRoot(manifest.tenantId)}/`, ...tenantCachePrefixes(manifest.tenantId)]
  if (hasPathEscape(prefix) || !allowed.some((candidate) => prefix.startsWith(candidate))) {
    throw new RevocationCleanupValidationError("Cleanup discovery prefix escaped its tenant partition")
  }
}

function isSafeTenantDebugObjectKey(manifest: RevocationCleanupManifest, key: string): boolean {
  return !hasPathEscape(key) && key.startsWith(`debug-runs/${tenantPartitionId(manifest.tenantId)}/`)
}

function isSafeBenchmarkObjectKey(manifest: RevocationCleanupManifest, key: string): boolean {
  return manifest.resourceType === "benchmark_run"
    && !hasPathEscape(key)
    && key.startsWith(`runs/${tenantPartitionId(manifest.tenantId)}/${manifest.resourceId}/`)
}

function assertSafeBenchmarkObjectKey(manifest: RevocationCleanupManifest, key: string): void {
  if (!isSafeBenchmarkObjectKey(manifest, key)) throw new RevocationCleanupValidationError("Benchmark cleanup target escaped its run partition")
}

function isSafeTenantStagePrefix(manifest: RevocationCleanupManifest, reference: string): boolean {
  if (hasPathEscape(reference)) return false
  return reference.startsWith("staging/") || reference.startsWith("published/")
}

function assertSafeStageObjectKey(manifest: RevocationCleanupManifest, key: string): void {
  if (hasPathEscape(key)) throw new RevocationCleanupValidationError("Staged cleanup target is invalid")
  const prefixes = manifest.targets
    .filter((target) => target.scope === "staged_index" && isSafeTenantStagePrefix(manifest, target.reference))
    .map((target) => `${tenantArtifactRoot(manifest.tenantId)}/${canonicalRelativePrefix(target.reference)}/`)
  if (!prefixes.some((prefix) => key.startsWith(prefix))) {
    throw new RevocationCleanupValidationError("Staged cleanup target escaped its publication namespace")
  }
}

function canonicalRelativePrefix(reference: string): string {
  const normalized = reference.replace(/^\/+|\/+$/gu, "")
  if (!normalized || hasPathEscape(normalized)) throw new RevocationCleanupValidationError("Cleanup prefix is invalid")
  return normalized
}

function isLogicalChunkReference(reference: string): boolean {
  const [documentId, chunkId, ...extra] = reference.split(":")
  return extra.length === 0
    && Boolean(documentId)
    && Boolean(chunkId)
    && !hasPathEscape(reference)
    && !reference.includes("\\")
}

function isLogicalOldIndexReference(reference: string): boolean {
  return Boolean(reference)
    && !reference.includes(":")
    && !reference.includes("/")
    && !reference.includes("\\")
    && !hasPathEscape(reference)
}

function assertLogicalReference(reference: string): void {
  if (!reference.trim() || hasPathEscape(reference) || reference.startsWith("/") || reference.includes("\\")) {
    throw new RevocationCleanupValidationError("Logical cleanup target is invalid")
  }
}

function hasPathEscape(value: string): boolean {
  return value.startsWith("/")
    || value.includes("\\")
    || value.split("/").some((segment) => segment === ".." || segment === ".")
    || [...value].some((character) => (character.codePointAt(0) ?? 0) <= 0x1f)
}

function uniqueReferences<T extends RevocationCleanupTargetReference>(references: readonly T[]): T[] {
  const byKey = new Map<string, T>()
  for (const reference of references) byKey.set(`${reference.scope}\u0000${reference.reference}`, reference)
  return [...byKey.values()].sort((left, right) => left.reference.localeCompare(right.reference))
}

function isActiveRunStatus(status: string): boolean {
  return status === "queued" || status === "running"
}

function isContentScope(scope: RevocationCleanupScope): boolean {
  return scope === "source" || scope === "chunk" || scope === "memory"
}

function isIndexScope(scope: RevocationCleanupScope): boolean {
  return scope === "active_index" || scope === "staged_index" || scope === "old_index"
}

function permitsDestructiveContentCleanup(manifest: RevocationCleanupManifest): boolean {
  if (manifest.resourceType !== "document" && manifest.resourceType !== "temporary_attachment") return false
  return [
    "classification_restricted",
    "expired",
    "archived",
    "deleted",
    "account_revoked"
  ].includes(manifest.trigger)
}

function permitsDestructiveIndexCleanup(manifest: RevocationCleanupManifest): boolean {
  return permitsDestructiveContentCleanup(manifest)
    || ((manifest.resourceType === "document" || manifest.resourceType === "temporary_attachment") && manifest.trigger === "index_rollback")
}

function isMissingError(error: unknown): boolean {
  const value = error as { code?: string; name?: string; $metadata?: { httpStatusCode?: number } }
  return value?.code === "ENOENT" || value?.name === "NoSuchKey" || value?.name === "NotFound" || value?.$metadata?.httpStatusCode === 404
}

function failureName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown_read_failure"
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}
