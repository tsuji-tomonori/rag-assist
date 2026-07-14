import type { AppUser } from "../../auth.js"
import { config } from "../../config.js"
import type { Dependencies } from "../../dependencies.js"
import { DocumentPermissionService } from "../../documents/document-permission-service.js"
import { isQualityApprovedForNormalRag } from "../../rag/quality.js"
import { createPublicationPointerSnapshot, isManifestCurrentPublication, type PublicationPointerSnapshot } from "../../rag/_shared/publication/staged-publication-coordinator.js"
import { currentEligibilitySnapshotFromAuthoritativeState, evaluateCurrentRagEligibility } from "../../rag/_shared/security/current-rag-eligibility.js"
import type { DocumentManifest, JsonValue, RetrievedVector, SearchScope, VectorMetadata } from "../../types.js"
import type { VectorFilter } from "../../adapters/vector-store.js"
import { ragRuntimePolicy } from "../runtime-policy.js"
import type { ChatOrchestrationState, ChatOrchestrationUpdate } from "../state.js"
import { readTenantManifest, readTenantManifestByKey, tenantManifestPrefix } from "../../rag/_shared/storage/tenant-artifacts.js"

export function createRetrieveMemoryNode(deps: Dependencies, user: AppUser) {
  return async function retrieveMemory(state: ChatOrchestrationState): Promise<ChatOrchestrationUpdate> {
    if (!state.useMemory) {
      return { memoryCards: [] }
    }

    const vector = await deps.textModel.embed(state.normalizedQuery ?? state.question, {
      modelId: state.embeddingModelId,
      dimensions: config.embeddingDimensions
    })

    const queryTopK = Math.min(
      ragRuntimePolicy.retrieval.memoryPrefetchMaxTopK,
      Math.max(state.memoryTopK, Math.ceil(state.memoryTopK * ragRuntimePolicy.retrieval.memoryPrefetchMultiplier))
    )
    const filters = state.searchFilters
    const tenantId = resolveCurrentMemoryTenant(user, filters?.tenantId)
    const publicationSnapshot = createPublicationPointerSnapshot()
    const authorizedDocumentIds = await loadAuthorizedMemoryDocumentIds(deps, user, tenantId, filters, state.searchScope, publicationSnapshot)
    const memoryCards = (await filterAccessibleMemoryHits(deps, await queryAuthorizedMemoryHits(deps, vector, queryTopK, {
      kind: "memory",
      documentId: filters?.documentId,
      tenantId,
      department: filters?.department,
      source: filters?.source,
      docType: filters?.docType,
      benchmarkSuiteId: filters?.benchmarkSuiteId
    }, authorizedDocumentIds), user, filters, state.searchScope, publicationSnapshot))
      .slice(0, state.memoryTopK)
    return { memoryCards }
  }
}

async function filterAccessibleMemoryHits(
  deps: Dependencies,
  hits: RetrievedVector[],
  user: AppUser,
  filters: ChatOrchestrationState["searchFilters"],
  scope?: SearchScope,
  publicationSnapshot: PublicationPointerSnapshot = createPublicationPointerSnapshot()
): Promise<RetrievedVector[]> {
  const manifestCache = new Map<string, DocumentManifest | undefined>()
  const documentPermissions = new DocumentPermissionService(deps)
  const result: RetrievedVector[] = []
  for (const hit of hits) {
    if (!memoryMetadataMatchesFilters(hit.metadata, filters)) continue
    if (!canAccessMemoryVectorMetadata(hit.metadata, user, Boolean(deps.localTestIngestAdmissionContext))) continue
    const manifest = await getCachedManifest(deps, manifestCache, user, hit.metadata.documentId)
    if (!manifest || !isActiveManifest(manifest, Boolean(deps.localTestIngestAdmissionContext)) || !(await isManifestCurrentPublication(deps, manifest, publicationSnapshot)) || !manifestMatchesScope(manifest, scope) || !isQualityApprovedForNormalRag(manifest, {
      allowLegacyLocalTestFixture: Boolean(deps.localTestIngestAdmissionContext)
    })) continue
    const permissionDecision = await documentPermissions.resolveEffectiveDocumentPermissionDecision(user, manifest)
    if (permissionDecision.permission !== "readOnly" && permissionDecision.permission !== "full") continue
    const current = await currentEligibilitySnapshotFromAuthoritativeState({
      objectStore: deps.objectStore,
      manifest,
      authorizationAllowed: true,
      qualityAllowed: isQualityApprovedForNormalRag(manifest, { allowLegacyLocalTestFixture: Boolean(deps.localTestIngestAdmissionContext) }),
      purpose: "normal_answer",
      roles: user.cognitoGroups,
      allowLocalTestFixture: Boolean(deps.localTestIngestAdmissionContext)
    })
    if (!evaluateCurrentRagEligibility({
      actor: user,
      identityVerified: Boolean(user.userId && user.tenantId),
      purpose: "normal_answer",
      envelope: hit.metadata.securityEnvelope,
      current
    }).allowed && !isExplicitLocalFixture(deps, manifest, hit.metadata)) continue
    result.push(hit)
  }
  return result
}

function memoryMetadataMatchesFilters(
  metadata: VectorMetadata,
  filters: ChatOrchestrationState["searchFilters"]
): boolean {
  if (!filters) return true
  if (filters.documentId && metadata.documentId !== filters.documentId) return false
  if (filters.tenantId && metadata.tenantId !== filters.tenantId) return false
  if (filters.department && metadata.department !== filters.department) return false
  if (filters.source && metadata.source !== filters.source) return false
  if (filters.docType && metadata.docType !== filters.docType) return false
  if (filters.benchmarkSuiteId && metadata.benchmarkSuiteId !== filters.benchmarkSuiteId) return false
  return true
}

function canAccessMemoryVectorMetadata(metadata: VectorMetadata, user: AppUser, allowLocalFixture: boolean): boolean {
  if (allowLocalFixture && !metadata.securityEnvelope) {
    return (metadata.lifecycleStatus ?? "active") === "active" && Boolean(user.tenantId && metadata.tenantId === user.tenantId)
  }
  if (metadata.lifecycleStatus !== "active" || metadata.ragEligibility !== "eligible") return false
  if (!user.tenantId || metadata.tenantId !== user.tenantId) return false
  return Boolean(metadata.securityEnvelope
    && metadata.securityEnvelope.documentId === metadata.documentId
    && metadata.securityEnvelope.tenantId === user.tenantId)
}

async function getCachedManifest(
  deps: Pick<Dependencies, "objectStore" | "localTestIngestAdmissionContext" | "legacyGlobalDocumentArtifacts">,
  cache: Map<string, DocumentManifest | undefined>,
  user: AppUser,
  documentId: string
): Promise<DocumentManifest | undefined> {
  if (cache.has(documentId)) return cache.get(documentId)
  try {
    const tenantId = resolveCurrentMemoryTenant(user, undefined)
    const manifest = await readTenantManifest(deps, tenantId, documentId)
    cache.set(documentId, manifest)
    return manifest
  } catch {
    cache.set(documentId, undefined)
    return undefined
  }
}

function isActiveManifest(manifest: DocumentManifest, allowLocalFixture = false): boolean {
  if ((manifest.lifecycleStatus ?? stringValue(manifest.metadata?.lifecycleStatus)) !== "active") return false
  if (!allowLocalFixture && (!manifest.securityEnvelope || manifest.admission?.status !== "approved")) return false
  const expiresAt = stringValue(manifest.metadata?.expiresAt)
  return !expiresAt || new Date(expiresAt).getTime() > Date.now()
}

function stringValues(value: JsonValue | undefined): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string")
  return []
}

function stringValue(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined
}

function manifestMatchesScope(manifest: DocumentManifest, scope: SearchScope | undefined): boolean {
  const metadata = manifest.metadata ?? {}
  const scopeType = stringValue(metadata.scopeType)
  const temporaryMatch = Boolean(
    scope?.includeTemporary && scope.temporaryScopeId && stringValue(metadata.temporaryScopeId) === scope.temporaryScopeId
  )
  if (!scope || scope.mode === "all" || !scope.mode) {
    if (scopeType !== "chat") return true
    return temporaryMatch
  }
  const groupIds = stringValues(metadata.groupIds ?? metadata.groupId)
  if (scope.mode === "groups") {
    const requested = new Set(scope.groupIds ?? [])
    return temporaryMatch || groupIds.some((groupId) => requested.has(groupId))
  }
  if (scope.mode === "documents") {
    const requested = new Set(scope.documentIds ?? [])
    return temporaryMatch || requested.has(manifest.documentId)
  }
  if (scope.mode === "temporary") {
    return Boolean(scope.temporaryScopeId && stringValue(metadata.temporaryScopeId) === scope.temporaryScopeId)
  }
  return true
}

function resolveCurrentMemoryTenant(user: AppUser, requestedTenantId: string | undefined): string {
  const tenantId = user.tenantId?.trim()
  if (tenantId) {
    if (requestedTenantId && requestedTenantId !== tenantId) throw new Error("Forbidden")
    return tenantId
  }
  if (config.authEnabled) throw new Error("Forbidden")
  const localTenantId = requestedTenantId?.trim() || config.localAuthTenantId.trim()
  if (!localTenantId) throw new Error("Local/test tenant is not configured")
  return localTenantId
}

async function loadAuthorizedMemoryDocumentIds(
  deps: Dependencies,
  user: AppUser,
  tenantId: string,
  filters: ChatOrchestrationState["searchFilters"],
  scope: SearchScope | undefined,
  publicationSnapshot: PublicationPointerSnapshot
): Promise<string[]> {
  const keys = await deps.objectStore.listKeys(tenantManifestPrefix(deps, tenantId))
  const permissions = new DocumentPermissionService(deps)
  const allowLocalFixture = Boolean(deps.localTestIngestAdmissionContext)
  const authorized: string[] = []
  for (const key of keys.filter((candidate) => candidate.endsWith(".json"))) {
    let manifest: DocumentManifest
    try {
      manifest = await readTenantManifestByKey(deps, tenantId, key)
    } catch {
      continue
    }
    const manifestTenantId = stringValue(manifest.metadata?.tenantId)
    if (manifestTenantId ? manifestTenantId !== tenantId : !allowLocalFixture) continue
    if (!isActiveManifest(manifest, allowLocalFixture) || !(await isManifestCurrentPublication(deps, manifest, publicationSnapshot)) || !manifestMatchesScope(manifest, scope) || !manifestMatchesMemoryFilters(manifest, filters)) continue
    const qualityAllowed = isQualityApprovedForNormalRag(manifest, { allowLegacyLocalTestFixture: allowLocalFixture })
    if (!qualityAllowed) continue
    const permissionDecision = await permissions.resolveEffectiveDocumentPermissionDecision(user, manifest)
    if (permissionDecision.permission !== "readOnly" && permissionDecision.permission !== "full") continue
    if (!allowLocalFixture) {
      const current = await currentEligibilitySnapshotFromAuthoritativeState({
        objectStore: deps.objectStore,
        manifest,
        authorizationAllowed: true,
        qualityAllowed,
        purpose: "normal_answer",
        roles: user.cognitoGroups,
        allowLocalTestFixture: allowLocalFixture
      })
      if (!evaluateCurrentRagEligibility({
        actor: user,
        identityVerified: Boolean(user.userId && user.tenantId),
        purpose: "normal_answer",
        envelope: manifest.securityEnvelope,
        current
      }).allowed) continue
    }
    authorized.push(manifest.documentId)
  }
  return [...new Set(authorized)].sort()
}

function manifestMatchesMemoryFilters(manifest: DocumentManifest, filters: ChatOrchestrationState["searchFilters"]): boolean {
  if (!filters) return true
  const metadata = manifest.metadata ?? {}
  if (filters.documentId && manifest.documentId !== filters.documentId) return false
  if (filters.tenantId && stringValue(metadata.tenantId) !== filters.tenantId) return false
  if (filters.department && stringValue(metadata.department) !== filters.department) return false
  if (filters.source && stringValue(metadata.source) !== filters.source) return false
  if (filters.docType && stringValue(metadata.docType) !== filters.docType) return false
  if (filters.benchmarkSuiteId && stringValue(metadata.benchmarkSuiteId) !== filters.benchmarkSuiteId) return false
  return true
}

async function queryAuthorizedMemoryHits(
  deps: Pick<Dependencies, "memoryVectorStore">,
  vector: number[],
  topK: number,
  filter: Omit<VectorFilter, "documentIds">,
  documentIds: string[]
): Promise<RetrievedVector[]> {
  if (documentIds.length === 0) return []
  const batches: string[][] = []
  for (let index = 0; index < documentIds.length; index += 50) batches.push(documentIds.slice(index, index + 50))
  return (await Promise.all(batches.map((batch) => deps.memoryVectorStore.query(vector, topK, { ...filter, documentIds: batch }))))
    .flat()
    .sort((left, right) => right.score - left.score)
    .slice(0, topK)
}

function isExplicitLocalFixture(deps: Dependencies, manifest: DocumentManifest, metadata: VectorMetadata): boolean {
  return Boolean(deps.localTestIngestAdmissionContext && !manifest.securityEnvelope && !metadata.securityEnvelope)
}
