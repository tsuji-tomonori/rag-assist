import { randomUUID } from "node:crypto"

import type { AppUser } from "../../../../auth.js"
import { ResourceOperationAuthorizationError } from "../../../../security/production-resource-operation-authorizer.js"
import { config } from "../../../../config.js"
import type { Dependencies } from "../../../../dependencies.js"
import { folderPermissionSatisfies } from "../../../../authorization.js"
import { normalizeSearchTopK, ragRuntimePolicy } from "../../../../chat-orchestration/runtime-policy.js"
import { FolderPermissionService } from "../../../../folders/folder-permission-service.js"
import { DocumentPermissionService } from "../../../../documents/document-permission-service.js"
import { loadChunksForManifest } from "../../../_shared/storage/manifest-chunks.js"
import { isQualityApprovedForNormalRag, qualityProfileCacheKey } from "../../../_shared/policies/quality-policy.js"
import { createPublicationPointerSnapshot, isManifestCurrentPublication, type PublicationPointerSnapshot } from "../../../_shared/publication/staged-publication-coordinator.js"
import {
  CURRENT_RAG_ELIGIBILITY_POLICY_VERSION,
  currentEligibilitySnapshotFromAuthoritativeState,
  evaluateCurrentRagEligibility,
  type CurrentRagEligibilitySnapshot
} from "../../../_shared/security/current-rag-eligibility.js"
import { ObjectStoreRevocationCleanupCoordinator } from "../../../_shared/security/revocation-cleanup-coordinator.js"
import { loadPublishedAliasMap } from "../../../../search/alias-artifacts.js"
import {
  DEBUG_TRACE_SANITIZE_POLICY_VERSION,
  DEBUG_TRACE_SCHEMA_VERSION,
  type Citation,
  type DebugTrace,
  type DocumentManifest,
  type JsonValue,
  type ReplaySourceSnapshot,
  type ReplayVersionManifest,
  type RetrievedVector,
  type SearchScope,
  type VectorMetadata
} from "../../../../types.js"
import type { VectorFilter, VectorStore } from "../../../../adapters/vector-store.js"
import { sanitizeAuthorizedResourceMetadata } from "../../../../security/public-resource-response.js"
import { RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION } from "../../../../security/resource-operation-authorization.js"
import { tenantPartitionId } from "../../../../security/tenant-partition.js"
import { ProductionRagObservationProducer, bestEffortCapture } from "../../../quality-control/production-rag-observation-producer.js"
import { assertRagSafetyInterlock } from "../../../quality-control/production-rag-monitor.js"
import {
  classifyDegradationTrigger,
  measurePartialRuntimeRagGuards,
  safeDegradationDecision,
  type SafeDegradationDecision
} from "../../../_shared/security/safe-degradation-policy.js"
import { buildReplayVersionManifest } from "../../../_shared/replay/replay-version-manifest.js"
import { replaySourceSnapshotFromManifest } from "../../../_shared/replay/replay-source-snapshot.js"
import { sanitizeDebugTraceForPersistence } from "../../../_shared/security/trace-sanitizer.js"
import { UNTRUSTED_CONTENT_POLICY_VERSION } from "../../../_shared/security/untrusted-content-policy.js"
import { temporaryScopeIds } from "../../../_shared/security/session-local-evidence-scope.js"
import {
  readTenantManifest,
  readTenantManifestByKey,
  tenantLexicalIndexPrefix,
  tenantManifestPrefix
} from "../../../_shared/storage/tenant-artifacts.js"

export type SearchInput = {
  query: string
  conversationId?: string
  topK?: number
  lexicalTopK?: number
  semanticTopK?: number
  embeddingModelId?: string
  semanticVector?: number[]
  filters?: {
    tenantId?: string
    department?: string
    source?: string
    docType?: string
    benchmarkSuiteId?: string
    documentId?: string
  }
  scope?: SearchScope
}

export type SearchResult = {
  id: string
  documentId: string
  documentVersion?: string
  fileName: string
  chunkId?: string
  text: string
  score: number
  rrfScore: number
  lexicalScore?: number
  semanticScore?: number
  lexicalRank?: number
  semanticRank?: number
  matchedTerms: string[]
  sources: ("lexical" | "semantic")[]
  createdAt?: string
  metadata?: Record<string, JsonValue>
}

export type SearchResponse = {
  query: string
  results: SearchResult[]
  diagnostics: {
    indexVersion: string
    aliasVersion: string
    lexicalCount: number
    semanticCount: number
    fusedCount: number
    latencyMs: number
    profileId: string
    profileVersion: string
    traceId: string
    replayVersionManifest: ReplayVersionManifest
    topGap: number | null
    lexicalSemanticOverlap: number
    scoreDistribution: {
      top: number | null
      median: number | null
      p90: number | null
      min: number | null
      max: number | null
    }
    adaptiveDecision?: {
      strategy: "fixed" | "adaptive"
      reason: string
      effectiveTopK: number
      effectiveMinScore: number
    }
    index?: {
      visibleManifestCount: number
      indexedChunkCount: number
      cache: "memory" | "artifact" | "built"
      loadMs: number
      degradationDecision?: SafeDegradationDecision
    }
  }
}

type WeightedToken = {
  term: string
  weight: number
}

type Posting = {
  docOrdinal: number
  tf: number
}

type LexicalDocument = {
  id: string
  documentId: string
  documentVersion?: string
  fileName: string
  chunkId: string
  text: string
  len: number
  createdAt: string
  metadata?: Record<string, JsonValue>
  replaySourceSnapshot?: ReplaySourceSnapshot
}

type LexicalIndex = {
  version: string
  nDocs: number
  avgDocLen: number
  docs: LexicalDocument[]
  df: Map<string, number>
  postings: Map<string, Posting[]>
  dictionary: string[]
  aliases: AliasMap
  aliasVersion: string
  diagnostics?: LexicalIndexDiagnostics
}

type LexicalIndexDiagnostics = {
  visibleManifestCount: number
  indexedChunkCount: number
  cache: "memory" | "artifact" | "built"
  loadMs: number
  degradationDecision?: SafeDegradationDecision
}

type SerializedLexicalIndex = {
  schemaVersion: 1
  signature: string
  index: {
    version: string
    nDocs: number
    avgDocLen: number
    docs: LexicalDocument[]
    df: Array<[string, number]>
    postings: Array<[string, Posting[]]>
    dictionary: string[]
    aliases: AliasMap
    aliasVersion: string
  }
  createdAt: string
}

type LexicalHit = {
  id: string
  score: number
  matchedTerms: string[]
}

type CachedIndex = {
  signature: string
  index: LexicalIndex
}

type AliasMap = Record<string, string[]>

type SearchAuthorizationDeps = Pick<Dependencies, "documentGroupStore" | "folderPolicyStore" | "userGroupStore" | "groupMembershipStore">
type SearchObjectDeps = SearchAuthorizationDeps & Pick<Dependencies,
  "objectStore" | "localTestIngestAdmissionContext" | "legacyGlobalDocumentArtifacts"
>

let cachedIndex: CachedIndex | undefined

export async function searchRag(
  deps: Dependencies,
  input: SearchInput,
  user: AppUser,
  publicationSnapshot: PublicationPointerSnapshot = createPublicationPointerSnapshot(),
  traceContext: Readonly<{ requestTraceId?: string }> = {}
): Promise<SearchResponse> {
  const started = Date.now()
  const startedAt = new Date()
  const traceId = `search_${randomUUID()}`
  let tenantId: string | undefined = authoritativeTraceTenant(user)
  let observedIndexVersion: string | undefined
  let observedEmbeddingModelId: string | undefined
  let observedEmbeddingDimensions: number | undefined
  try {
    await assertRagSafetyInterlock({
      objectStore: deps.objectStore,
      runtimeProfileVersion: ragRuntimePolicy.profile.version,
      operation: "search"
    })
    tenantId = resolveAuthoritativeSearchTenant(user, input.filters?.tenantId)
  const effectiveFilters = { ...(input.filters ?? {}), tenantId }
  const requestedTopK = normalizeSearchTopK(input.topK)
  const lexicalTopK = clampInt(input.lexicalTopK ?? ragRuntimePolicy.retrieval.lexicalTopK, 0, ragRuntimePolicy.retrieval.searchRagMaxSourceTopK)
  const semanticTopK = clampInt(input.semanticTopK ?? ragRuntimePolicy.retrieval.semanticTopK, 0, ragRuntimePolicy.retrieval.searchRagMaxSourceTopK)
  const topK = ragRuntimePolicy.retrieval.adaptiveEnabled
    ? clampInt(Math.max(requestedTopK, Math.ceil(requestedTopK * 1.5)), requestedTopK, ragRuntimePolicy.retrieval.searchRagMaxTopK)
    : requestedTopK
  const index = await getLexicalIndex(deps, user, effectiveFilters, input.scope, publicationSnapshot)
  observedIndexVersion = index.version
  const queryTokens = tokenizeQuery(input.query)

  const lexicalHits = lexicalTopK > 0 ? bm25Search(index, queryTokens, lexicalTopK, { k1: ragRuntimePolicy.retrieval.bm25K1, b: ragRuntimePolicy.retrieval.bm25B }) : []
  const authorizedDocumentIds = [...new Set(index.docs.map((document) => document.documentId))]
  const vectorFilter = {
    kind: "chunk" as const,
    documentId: effectiveFilters.documentId,
    tenantId,
    department: effectiveFilters.department,
    source: effectiveFilters.source,
    docType: effectiveFilters.docType,
    benchmarkSuiteId: effectiveFilters.benchmarkSuiteId,
    lifecycleStatus: "active" as const,
    ragEligibility: "eligible" as const
  }
  const semanticQueryTopK = Math.min(
    ragRuntimePolicy.retrieval.searchRagMaxSourceTopK,
    Math.max(semanticTopK, Math.ceil(semanticTopK * ragRuntimePolicy.retrieval.searchSemanticPrefetchMultiplier))
  )
  let semanticVector = input.semanticVector
  if (semanticTopK > 0 && authorizedDocumentIds.length > 0 && !semanticVector) {
    observedEmbeddingModelId = input.embeddingModelId ?? config.embeddingModelId
    observedEmbeddingDimensions = config.embeddingDimensions
    semanticVector = await deps.textModel.embed(input.query, {
      modelId: observedEmbeddingModelId,
      dimensions: observedEmbeddingDimensions
    })
  }
  const semanticHits =
    semanticTopK > 0 && authorizedDocumentIds.length > 0
      ? (
          await filterAccessibleVectorHits(
            deps,
            await queryAuthorizedSemanticHits(
              deps.evidenceVectorStore,
              semanticVector!,
              semanticQueryTopK,
              vectorFilter,
              authorizedDocumentIds
            ),
            user,
            input.scope,
            publicationSnapshot
          )
        ).slice(0, semanticTopK)
      : []

  const fused = rrfFuse(
    [
      lexicalHits.map((hit) => ({ id: hit.id, score: hit.score })),
      semanticHits.map((hit) => ({ id: semanticLogicalId(hit), score: hit.score }))
    ],
    { k: ragRuntimePolicy.retrieval.rrfK, weights: ragRuntimePolicy.retrieval.rrfWeights }
  )

  const lexicalById = new Map(lexicalHits.map((hit, idx) => [hit.id, { ...hit, rank: idx + 1 }]))
  const semanticById = new Map(semanticHits.map((hit, idx) => [semanticLogicalId(hit), { ...hit, rank: idx + 1 }]))
  const docsById = new Map(index.docs.map((doc) => [doc.id, doc]))

  const fusedCandidates = fused
    .map((hit) => toSearchResult(hit, docsById.get(hit.id), lexicalById.get(hit.id), semanticById.get(hit.id)))
    .filter((result): result is SearchResult => result !== undefined)
  const currentCandidates = await filterCurrentSearchResults(
    deps,
    fusedCandidates,
    user,
    input.scope,
    publicationSnapshot
  )
  const reranked = cheapRerank(input.query, currentCandidates)
  const diagnostics = buildSearchDiagnostics({
    indexVersion: index.version,
    aliasVersion: index.aliasVersion,
    lexicalHits,
    semanticHits,
    fusedCount: currentCandidates.length,
    results: reranked,
    requestedTopK,
    effectiveTopK: topK,
    latencyMs: Date.now() - started,
    indexDiagnostics: index.diagnostics
  })
  const decision = diagnostics.adaptiveDecision ?? { effectiveMinScore: -1, effectiveTopK: requestedTopK }
  const results = reranked.filter((result) => result.score >= decision.effectiveMinScore).slice(0, decision.effectiveTopK)
  const replayVersionManifest = searchReplayVersionManifest({
    input,
    results,
    sourceResults: currentCandidates,
    sourceSnapshots: replaySourceSnapshotsForResults(index.docs, currentCandidates),
    indexVersion: index.version,
    embeddingModelId: observedEmbeddingModelId,
    embeddingDimensions: observedEmbeddingDimensions,
    candidateCount: fusedCandidates.length,
    deniedCandidateCount: Math.max(0, fusedCandidates.length - currentCandidates.length),
    latencyMs: diagnostics.latencyMs,
    responseStatus: "success"
  })

  const response: SearchResponse = {
    query: input.query,
    results,
    diagnostics: {
      indexVersion: index.version,
      aliasVersion: index.aliasVersion,
      lexicalCount: lexicalHits.length,
      semanticCount: semanticHits.length,
      fusedCount: currentCandidates.length,
      latencyMs: diagnostics.latencyMs,
      profileId: diagnostics.profileId,
      profileVersion: diagnostics.profileVersion,
      traceId,
      replayVersionManifest,
      topGap: diagnostics.topGap,
      lexicalSemanticOverlap: diagnostics.lexicalSemanticOverlap,
      scoreDistribution: diagnostics.scoreDistribution,
      adaptiveDecision: diagnostics.adaptiveDecision,
      index: diagnostics.index
    }
  }
  await persistSearchDebugTrace(deps, {
    traceId,
    tenantId,
    user,
    input,
    results,
    startedAt,
    replayVersionManifest,
    requestTraceId: traceContext.requestTraceId,
    status: "success",
    latencyMs: response.diagnostics.latencyMs
  })
  await bestEffortCapture("search_runtime", () => new ProductionRagObservationProducer(deps.objectStore).captureSearchRuntime({
    latencyMs: response.diagnostics.latencyMs,
    indexVersion: response.diagnostics.indexVersion,
    profileId: response.diagnostics.profileId,
    profileVersion: response.diagnostics.profileVersion,
    embeddingModelId: input.embeddingModelId ?? config.embeddingModelId,
    tenantId,
    roles: user.cognitoGroups,
    searchScope: input.scope,
    succeeded: true,
    artifactId: traceId
  }))
  return response
  } catch (error) {
    const latencyMs = Date.now() - started
    const failureCode = searchFailureCode(error)
    if (tenantId) {
      const replayVersionManifest = searchReplayVersionManifest({
        input,
        results: [],
        sourceResults: [],
        sourceSnapshots: [],
        indexVersion: observedIndexVersion,
        embeddingModelId: observedEmbeddingModelId,
        embeddingDimensions: observedEmbeddingDimensions,
        candidateCount: 0,
        deniedCandidateCount: 0,
        latencyMs,
        responseStatus: "error",
        decisionCode: "failed",
        reasonCodes: [failureCode]
      })
      await bestEffortCapture("search_debug_trace_failure", async () => {
        await persistSearchDebugTrace(deps, {
          traceId,
          tenantId: tenantId!,
          user,
          input,
          results: [],
          startedAt,
          replayVersionManifest,
          requestTraceId: traceContext.requestTraceId,
          status: "error",
          reason: failureCode,
          latencyMs
        })
        return { recorded: 1 }
      })
    }
    await bestEffortCapture("search_runtime_failure", () => new ProductionRagObservationProducer(deps.objectStore).captureSearchRuntime({
      latencyMs,
      indexVersion: observedIndexVersion,
      profileId: ragRuntimePolicy.retrieval.profileId,
      profileVersion: ragRuntimePolicy.retrieval.profileVersion,
      embeddingModelId: input.embeddingModelId ?? config.embeddingModelId,
      tenantId,
      roles: user.cognitoGroups,
      searchScope: input.scope,
      succeeded: false,
      failureCode,
      artifactId: traceId
    }))
    throw error
  }
}

function searchFailureCode(error: unknown): "authorization_denied" | "safety_interlock" | "dependency_error" {
  if (error instanceof ResourceOperationAuthorizationError || (error instanceof Error && /permission|forbidden|tenant/i.test(error.message))) {
    return "authorization_denied"
  }
  if (error instanceof Error && (error.name === "RagSafetyInterlockError" || error.message.includes("safety state"))) {
    return "safety_interlock"
  }
  return "dependency_error"
}

function searchReplayVersionManifest(input: {
  input: SearchInput
  results: SearchResult[]
  sourceResults: SearchResult[]
  sourceSnapshots: ReplaySourceSnapshot[]
  indexVersion?: string
  embeddingModelId?: string
  embeddingDimensions?: number
  candidateCount: number
  deniedCandidateCount: number
  latencyMs: number
  responseStatus: "success" | "error"
  decisionCode?: ReplayVersionManifest["decisions"]["decisionCode"]
  reasonCodes?: ReplayVersionManifest["decisions"]["reasonCodes"]
}): ReplayVersionManifest {
  return buildReplayVersionManifest({
    citations: searchCitations(input.sourceResults),
    sourceSnapshots: input.sourceSnapshots,
    observedVersions: {
      embeddingModelId: input.embeddingModelId,
      embeddingDimensions: input.embeddingDimensions,
      indexVersion: input.indexVersion
    },
    ragProfile: {
      id: ragRuntimePolicy.profile.id,
      version: ragRuntimePolicy.profile.version,
      retrievalProfileId: ragRuntimePolicy.profile.retrieval.id,
      retrievalProfileVersion: ragRuntimePolicy.profile.retrieval.version,
      answerPolicyId: ragRuntimePolicy.profile.answerPolicy.id,
      answerPolicyVersion: ragRuntimePolicy.profile.answerPolicy.version
    },
    policyVersions: {
      authorization: RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION,
      eligibility: CURRENT_RAG_ELIGIBILITY_POLICY_VERSION,
      untrustedContent: UNTRUSTED_CONTENT_POLICY_VERSION,
      traceSanitization: DEBUG_TRACE_SANITIZE_POLICY_VERSION
    },
    question: input.input.query,
    normalizedQuery: normalize(input.input.query),
    candidateCount: input.candidateCount,
    deniedCandidateCount: input.deniedCandidateCount,
    finalEvidenceCount: input.results.length,
    responseStatus: input.responseStatus,
    decisionCode: input.decisionCode,
    reasonCodes: input.reasonCodes,
    totalLatencyMs: input.latencyMs,
    nondeterministicFactors: [
      "embedding-provider-service-revision",
      "dependency-latency-and-retry-schedule",
      "concurrent-authorization-and-lifecycle-updates"
    ]
  })
}

function replaySourceSnapshotsForResults(
  documents: LexicalDocument[],
  results: SearchResult[]
): ReplaySourceSnapshot[] {
  const byDocumentId = new Map(documents.map((document) => [document.documentId, document.replaySourceSnapshot]))
  return [...new Set(results.map((result) => result.documentId))]
    .map((documentId) => byDocumentId.get(documentId))
    .filter((snapshot): snapshot is ReplaySourceSnapshot => Boolean(snapshot))
}

function searchCitations(results: SearchResult[]): Citation[] {
  return results.map((result) => ({
    documentId: result.documentId,
    documentVersion: result.documentVersion,
    fileName: result.fileName,
    chunkId: result.chunkId,
    score: result.score,
    text: result.text,
    authorizationDecision: "allowed"
  }))
}

async function persistSearchDebugTrace(deps: Dependencies, input: {
  traceId: string
  tenantId: string
  user: AppUser
  input: SearchInput
  results: SearchResult[]
  startedAt: Date
  replayVersionManifest: ReplayVersionManifest
  requestTraceId?: string
  status: "success" | "error"
  reason?: string
  latencyMs: number
}): Promise<void> {
  const completedAt = new Date()
  const citations = searchCitations(input.results)
  const trace = sanitizeDebugTraceForPersistence({
    schemaVersion: DEBUG_TRACE_SCHEMA_VERSION,
    runId: input.traceId,
    requestTraceId: input.requestTraceId ?? input.traceId,
    parentTraceIds: input.replayVersionManifest.sourceSnapshots
      .map((snapshot) => snapshot.ingestTraceId)
      .filter((traceId): traceId is string => Boolean(traceId)),
    tenantPartitionId: tenantPartitionId(input.tenantId),
    actorPartitionId: tenantPartitionId(`${input.tenantId}:actor:${input.user.userId}`),
    targetType: "rag_run",
    question: input.input.query,
    modelId: "",
    embeddingModelId: input.input.embeddingModelId ?? config.embeddingModelId,
    clueModelId: "",
    replayVersionManifest: input.replayVersionManifest,
    decision: input.replayVersionManifest.decisions,
    ragProfile: {
      id: ragRuntimePolicy.profile.id,
      version: ragRuntimePolicy.profile.version,
      retrievalProfileId: ragRuntimePolicy.profile.retrieval.id,
      retrievalProfileVersion: ragRuntimePolicy.profile.retrieval.version,
      answerPolicyId: ragRuntimePolicy.profile.answerPolicy.id,
      answerPolicyVersion: ragRuntimePolicy.profile.answerPolicy.version
    },
    topK: normalizeSearchTopK(input.input.topK),
    memoryTopK: 0,
    minScore: -1,
    startedAt: input.startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    totalLatencyMs: input.latencyMs,
    status: input.status,
    answerPreview: "",
    isAnswerable: input.status === "success",
    citations,
    retrieved: citations,
    finalEvidence: citations,
    steps: [{
      id: 1,
      label: "authorized-search",
      status: input.status,
      latencyMs: input.latencyMs,
      summary: input.reason ?? `authorized=${citations.length}, denied=${Math.max(0, input.replayVersionManifest.decisions.candidateCount - citations.length)}`,
      hitCount: citations.length,
      startedAt: input.startedAt.toISOString(),
      completedAt: completedAt.toISOString()
    }]
  } satisfies DebugTrace)
  const key = `debug-runs/${trace.tenantPartitionId}/${trace.startedAt.slice(0, 10)}/${trace.runId}.json`
  await deps.objectStore.putText(key, JSON.stringify(trace, null, 2), "application/json")
}

export async function getLexicalIndex(
  deps: SearchObjectDeps,
  user: AppUser,
  filters?: SearchInput["filters"],
  scope?: SearchScope,
  publicationSnapshot: PublicationPointerSnapshot = createPublicationPointerSnapshot()
): Promise<LexicalIndex> {
  const started = Date.now()
  const tenantId = resolveAuthoritativeSearchTenant(user, filters?.tenantId)
  const keys = (await deps.objectStore.listKeys(tenantManifestPrefix(deps, tenantId))).filter((key) => key.endsWith(".json")).sort()
  const manifests = await Promise.all(keys.map((key) => readTenantManifestByKey(deps, tenantId, key)))
  await registerTemporaryAttachmentCleanupCandidates(deps, manifests, user, scope)
  const access = new FolderPermissionService(deps)
  const documentAccess = new DocumentPermissionService(deps)
  const allowLocalFixture = Boolean(deps.localTestIngestAdmissionContext)
  const activeCandidates = manifests.filter((manifest) => isActiveManifest(manifest, allowLocalFixture))
  const currentPublication = await Promise.all(activeCandidates.map((manifest) => isManifestCurrentPublication(deps, manifest, publicationSnapshot)))
  const activeManifests = activeCandidates.filter((_, index) => currentPublication[index])
  const accessible = await Promise.all(activeManifests.map(async (manifest) => [manifest, await canAccessManifest(manifest, user, documentAccess)] as const))
  const visible = accessible
    .filter(([, allowed]) => allowed)
    .map(([manifest]) => manifest)
    .filter((manifest) => manifestMatchesFilters(manifest, filters))
  const scoped = await filterManifestsByScope(visible, scope, user, access)
  const qualityApproved = scoped
    .filter((manifest) => isQualityApprovedForNormalRag(manifest, {
      allowLegacyLocalTestFixture: Boolean(deps.localTestIngestAdmissionContext)
    }))
  const currentEligibility = await Promise.all(qualityApproved.map(async (manifest) => {
    const current = await currentEligibilitySnapshotFromAuthoritativeState({
      objectStore: deps.objectStore,
      manifest,
      authorizationAllowed: true,
      qualityAllowed: true,
      purpose: "normal_answer",
      roles: user.cognitoGroups,
      allowLocalTestFixture: allowLocalFixture
    })
    return isCurrentRecordEligible({
      user,
      manifest,
      envelope: manifest.securityEnvelope,
      current,
      allowLocalFixture
    })
  }))
  const approved = qualityApproved.filter((_, index) => currentEligibility[index])
  const publishedAliases = await loadPublishedAliasMap(deps, filters, approved.map((manifest) => manifest.metadata))
  const aliases = mergeAliases([publishedAliases.aliases, ...approved.map((manifest) => aliasMapFromMetadata(manifest.metadata))])
  const combinedAliasSignature = stableStringifyAliasMap(aliases)
  const aliasSignature = publishedAliases.version === "none" ? combinedAliasSignature : `${publishedAliases.version}:${combinedAliasSignature}`
  const signature = [
    `tenant:${tenantId}`,
    ...approved
      .map((manifest) => `${manifest.documentId}:${manifest.chunkCount}:${manifest.createdAt}:${stringValue(manifest.metadata?.folderProjectionVersion) ?? "unversioned-folder-projection"}:${qualityProfileCacheKey(manifest)}:${JSON.stringify(replaySourceSnapshotFromManifest(manifest))}:${stableStringifyAliasMap(aliasMapFromMetadata(manifest.metadata))}`)
    .sort()
      .concat(`aliases:${publishedAliases.version}:${stableStringifyAliasMap(publishedAliases.aliases)}`)
  ].join("|")
  if (cachedIndex && cachedIndex.signature === signature) {
    cachedIndex.index.diagnostics = indexDiagnostics(approved.length, cachedIndex.index.nDocs, "memory", started, cachedIndex.index.diagnostics?.degradationDecision)
    return cachedIndex.index
  }
  const artifactLoad = await loadLexicalIndexArtifact(deps, tenantId, signature)
  if (artifactLoad.index) {
    artifactLoad.index.diagnostics = indexDiagnostics(approved.length, artifactLoad.index.nDocs, "artifact", started)
    cachedIndex = { signature, index: artifactLoad.index }
    return artifactLoad.index
  }
  if (artifactLoad.degradationDecision?.action === "fail") {
    throw new Error("Lexical cache fallback blocked because mandatory guard outcomes were not observed")
  }

  const docs: LexicalDocument[] = []
  for (const manifest of approved) {
    const chunks = await loadChunksForManifest(deps, manifest)
    const current = await currentEligibilitySnapshotFromAuthoritativeState({
      objectStore: deps.objectStore,
      manifest,
      authorizationAllowed: true,
      qualityAllowed: isQualityApprovedForNormalRag(manifest, {
        allowLegacyLocalTestFixture: Boolean(deps.localTestIngestAdmissionContext)
      }),
      purpose: "normal_answer",
      roles: user.cognitoGroups,
      allowLocalTestFixture: allowLocalFixture
    })
    for (const chunk of chunks.filter((candidate) => isCurrentRecordEligible({
      user,
      manifest,
      envelope: candidate.securityEnvelope,
      current,
      allowLocalFixture
    }))) {
      docs.push({
        id: `${manifest.documentId}-${chunk.id}`,
        documentId: manifest.documentId,
        documentVersion: manifest.documentVersion,
        fileName: manifest.fileName,
        chunkId: chunk.id,
        text: chunk.text,
        len: 0,
        createdAt: manifest.createdAt,
        metadata: manifest.metadata,
        replaySourceSnapshot: replaySourceSnapshotFromManifest(manifest)
      })
    }
  }

  const index = buildLexicalIndex(docs, versionLabel("lexical", signature || "empty"), aliases, aliasVersionLabel(aliasSignature))
  index.diagnostics = indexDiagnostics(approved.length, index.nDocs, "built", started, artifactLoad.degradationDecision)
  if (config.publishLexicalIndexOnSearch) await publishLexicalIndexArtifact(deps, tenantId, signature, index)
  cachedIndex = { signature, index }
  return index
}

async function registerTemporaryAttachmentCleanupCandidates(
  deps: SearchObjectDeps,
  manifests: readonly DocumentManifest[],
  user: AppUser,
  scope: SearchScope | undefined
): Promise<void> {
  const coordinator = new ObjectStoreRevocationCleanupCoordinator(deps.objectStore)
  const now = new Date()
  for (const manifest of manifests) {
    const metadata = manifest.metadata ?? {}
    if (stringValue(metadata.scopeType) !== "chat") continue
    const tenantId = stringValue(metadata.tenantId)
    const ownerUserId = stringValue(metadata.ownerUserId)
    const temporaryScopeId = stringValue(metadata.temporaryScopeId)
    const expiresAt = stringValue(metadata.expiresAt)
    if (!tenantId || !ownerUserId || !temporaryScopeId || !expiresAt) continue

    const expiryTime = Date.parse(expiresAt)
    const expired = !Number.isFinite(expiryTime) || expiryTime <= now.getTime()
    const ownerSuspended = ownerUserId === user.userId && user.accountStatus !== "active"
    const requestedScopeIds = temporaryScopeIds(scope)
    const requestedScopeId = requestedScopeIds[0]
    const staleConversation = ownerUserId === user.userId
      && Boolean(requestedScopeId)
      && Boolean(scope?.includeTemporary || scope?.mode === "temporary")
      && !requestedScopeIds.includes(temporaryScopeId)
    if (!expired && !ownerSuspended && !staleConversation) continue

    const trigger = expired ? "expired" as const
      : ownerSuspended ? "account_revoked" as const
        : "temporary_scope_mismatch" as const
    const knownTargets = expired
      ? temporaryAttachmentTargets(manifest)
      : staleConversation
      ? [
          { scope: "cache" as const, reference: `temporary:${manifest.documentId}:scope:${requestedScopeId}` },
          { scope: "queued_run" as const, reference: `temporary-scope:${requestedScopeId}` }
        ]
      : temporaryAttachmentTargets(manifest)
    await coordinator.register({
      operationId: `temporary:${trigger}:${manifest.documentId}:${trigger === "expired" ? expiresAt : requestedScopeId ?? user.userId}`,
      tenantId,
      resourceType: "temporary_attachment",
      resourceId: manifest.documentId,
      trigger,
      deniedPurposes: ["normal_rag", "evaluation"],
      authoritativeDenyVersion: trigger === "expired" ? `expiry:${expiresAt}` : `${trigger}:${manifest.updatedAt ?? manifest.createdAt}`,
      authoritativeDenyConfirmedAt: trigger === "expired" && Number.isFinite(expiryTime) ? expiresAt : now.toISOString(),
      knownTargets
    })
  }
}

function temporaryAttachmentTargets(manifest: DocumentManifest) {
  return [
    { scope: "source" as const, reference: manifest.sourceObjectKey },
    { scope: "source" as const, reference: manifest.manifestObjectKey },
    ...(manifest.structuredBlocksObjectKey ? [{ scope: "chunk" as const, reference: manifest.structuredBlocksObjectKey }] : []),
    ...(manifest.chunks ?? []).map((chunk) => ({ scope: "chunk" as const, reference: `${manifest.documentId}:${chunk.id}` })),
    ...(manifest.memoryCardsObjectKey ? [{ scope: "memory" as const, reference: manifest.memoryCardsObjectKey }] : []),
    ...(manifest.memoryVectorKeys ?? []).map((reference) => ({ scope: "memory" as const, reference })),
    ...[...manifest.vectorKeys, ...(manifest.evidenceVectorKeys ?? [])].map((reference) => ({ scope: "active_index" as const, reference })),
    { scope: "cache" as const, reference: `temporary:${manifest.documentId}` },
    { scope: "queued_run" as const, reference: `temporary:${manifest.documentId}` }
  ]
}

export function buildLexicalIndex(inputDocs: LexicalDocument[], version: string, aliases: AliasMap = {}, aliasVersion?: string): LexicalIndex {
  const postings = new Map<string, Posting[]>()
  const df = new Map<string, number>()
  const dictionarySet = new Set<string>()
  let totalLen = 0

  const docs = inputDocs.map((doc, docOrdinal) => {
    const tokens = weightedDocumentTokens(doc.fileName, doc.text)
    const termWeights = new Map<string, number>()
    for (const token of tokens) termWeights.set(token.term, (termWeights.get(token.term) ?? 0) + token.weight)
    for (const [term, tf] of termWeights) {
      dictionarySet.add(term)
      const list = postings.get(term) ?? []
      list.push({ docOrdinal, tf })
      postings.set(term, list)
      df.set(term, (df.get(term) ?? 0) + 1)
    }
    const len = Math.max(1, tokens.reduce((sum, token) => sum + token.weight, 0))
    totalLen += len
    return { ...doc, len }
  })

  return {
    version,
    nDocs: docs.length,
    avgDocLen: docs.length > 0 ? totalLen / docs.length : 1,
    docs,
    df,
    postings,
    dictionary: [...dictionarySet],
    aliases: normalizeAliasMap(aliases),
    aliasVersion: aliasVersion ?? aliasVersionLabel(stableStringifyAliasMap(aliases))
  }
}

export function bm25Search(index: LexicalIndex, rawTokens: string[], topK: number, options: { k1?: number; b?: number } = {}): LexicalHit[] {
  if (index.nDocs === 0 || rawTokens.length === 0) return []
  const queryTokens = expandQueryTerms(rawTokens, index.dictionary, index.aliases)
  const scores = new Map<number, number>()
  const matched = new Map<number, Set<string>>()

  for (const token of queryTokens) {
    const list = index.postings.get(token.term)
    if (!list) continue
    const df = index.df.get(token.term) ?? 0
    for (const posting of list) {
      const doc = index.docs[posting.docOrdinal]
      if (!doc) continue
      const score = bm25Score({
        tf: posting.tf * token.weight,
        df,
        docLen: doc.len,
        avgDocLen: index.avgDocLen,
        nDocs: index.nDocs,
        k1: options.k1,
        b: options.b
      })
      const abbreviationBonus = token.weight >= 5 ? token.weight * 0.35 : 0
      scores.set(posting.docOrdinal, (scores.get(posting.docOrdinal) ?? 0) + score + abbreviationBonus)
      const terms = matched.get(posting.docOrdinal) ?? new Set<string>()
      terms.add(token.term)
      matched.set(posting.docOrdinal, terms)
    }
  }

  return [...scores.entries()]
    .map(([docOrdinal, score]) => ({
      id: index.docs[docOrdinal]?.id ?? "",
      score,
      matchedTerms: [...(matched.get(docOrdinal) ?? new Set<string>())]
    }))
    .filter((hit) => hit.id)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

export function rrfFuse(
  resultLists: { id: string; score?: number }[][],
  options: { k?: number; weights?: number[] } = {}
): { id: string; score: number }[] {
  const k = options.k ?? 60
  const weights = options.weights ?? resultLists.map(() => 1)
  const scores = new Map<string, number>()

  resultLists.forEach((list, listIdx) => {
    const weight = weights[listIdx] ?? 1
    list.forEach((item, rankIdx) => {
      const prev = scores.get(item.id) ?? 0
      scores.set(item.id, prev + weight / (k + rankIdx + 1))
    })
  })

  return [...scores.entries()].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score)
}

export function bm25Score(params: {
  tf: number
  df: number
  docLen: number
  avgDocLen: number
  nDocs: number
  k1?: number
  b?: number
}): number {
  const k1 = params.k1 ?? 1.2
  const b = params.b ?? 0.75
  const idf = Math.log(1 + (params.nDocs - params.df + 0.5) / (params.df + 0.5))
  const norm = params.tf + k1 * (1 - b + b * (params.docLen / params.avgDocLen))
  return idf * ((params.tf * (k1 + 1)) / norm)
}

function toSearchResult(
  fused: { id: string; score: number },
  doc: LexicalDocument | undefined,
  lexical: (LexicalHit & { rank: number }) | undefined,
  semantic: (RetrievedVector & { rank: number }) | undefined
): SearchResult | undefined {
  const semanticMetadata = semantic?.metadata
  const documentId = doc?.documentId ?? semanticMetadata?.documentId
  const fileName = doc?.fileName ?? semanticMetadata?.fileName
  const text = doc?.text ?? semanticMetadata?.text
  if (!documentId || !fileName || !text) return undefined

  return {
    id: lexical ? fused.id : semantic?.key ?? fused.id,
    documentId,
    documentVersion: doc?.documentVersion ?? semanticMetadata?.documentVersion,
    fileName,
    chunkId: doc?.chunkId ?? semanticMetadata?.chunkId,
    text,
    score: fused.score,
    rrfScore: fused.score,
    lexicalScore: lexical?.score,
    semanticScore: semantic?.score,
    lexicalRank: lexical?.rank,
    semanticRank: semantic?.rank,
    matchedTerms: lexical?.matchedTerms ?? [],
    sources: [lexical ? "lexical" : undefined, semantic ? "semantic" : undefined].filter((value): value is "lexical" | "semantic" => Boolean(value)),
    createdAt: doc?.createdAt ?? semanticMetadata?.createdAt,
    metadata: sanitizeSearchMetadata(doc?.metadata ?? semanticMetadata)
  }
}

function cheapRerank(query: string, results: SearchResult[]): SearchResult[] {
  const normalizedQuery = normalize(query)
  const queryTokens = new Set(tokenizeQuery(query))
  return results
    .map((result) => {
      let score = result.rrfScore
      const normalizedText = normalize(`${result.fileName}\n${result.text}`)
      if (normalizedQuery && normalizedText.includes(normalizedQuery)) score += ragRuntimePolicy.profile.retrieval.scoring.exactQueryBonus
      if (normalizedQuery && normalize(result.fileName).includes(normalizedQuery)) score += ragRuntimePolicy.profile.retrieval.scoring.fileNameBonus
      const textTokens = new Set(tokenizeQuery(result.text))
      const covered = [...queryTokens].filter((token) => textTokens.has(token)).length
      score += covered * ragRuntimePolicy.profile.retrieval.scoring.tokenCoverageBonus
      score += searchLayoutBoost(result, queryTokens)
      if (result.createdAt) {
        const ageDays = (Date.now() - new Date(result.createdAt).getTime()) / 86_400_000
        if (Number.isFinite(ageDays) && ageDays < 90) score += ragRuntimePolicy.profile.retrieval.scoring.recencyBonus
      }
      return { ...result, score }
    })
    .sort((a, b) => b.score - a.score)
}

function searchLayoutBoost(result: SearchResult, queryTokens: Set<string>): number {
  const metadata = result.metadata ?? {}
  const heading = stringMetadata(metadata.heading)
  const sectionPath = Array.isArray(metadata.sectionPath) ? metadata.sectionPath.filter((item): item is string => typeof item === "string") : []
  const figureCaption = stringMetadata(metadata.figureCaption)
  const chunkKind = stringMetadata(metadata.chunkKind)
  const layoutText = [heading, sectionPath.join(" "), figureCaption].filter(Boolean).join(" ")
  const layoutTokens = new Set(tokenizeQuery(layoutText))
  const layoutCoverage = [...queryTokens].filter((token) => layoutTokens.has(token)).length
  let boost = Math.min(0.06, layoutCoverage * 0.015)
  const queryText = [...queryTokens].join(" ")
  if (heading && containsAnyToken(heading, queryTokens)) boost += 0.03
  if (sectionPath.some((section) => containsAnyToken(section, queryTokens))) boost += 0.025
  if (chunkKind === "table" && /table|表|一覧|金額|上限|比較/u.test(queryText)) boost += 0.025
  if (chunkKind === "list" && /list|一覧|手順|項目|条件/u.test(queryText)) boost += 0.02
  if (chunkKind === "figure" && /figure|図|画像|チャート|スライド/u.test(queryText)) boost += 0.02
  return boost
}

function containsAnyToken(text: string, queryTokens: Set<string>): boolean {
  const normalized = normalize(text)
  return [...queryTokens].some((token) => normalized.includes(token))
}

function stringMetadata(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined
}

function buildSearchDiagnostics(input: {
  indexVersion: string
  aliasVersion: string
  lexicalHits: LexicalHit[]
  semanticHits: RetrievedVector[]
  fusedCount: number
  results: SearchResult[]
  requestedTopK: number
  effectiveTopK: number
  latencyMs: number
  indexDiagnostics?: LexicalIndexDiagnostics
}): Omit<SearchResponse["diagnostics"], "traceId" | "replayVersionManifest"> {
  const scores = input.results.map((result) => result.score).sort((a, b) => a - b)
  const top = input.results[0]?.score ?? null
  const second = input.results[1]?.score ?? null
  const lexicalIds = new Set(input.lexicalHits.map((hit) => hit.id))
  const semanticIds = new Set(input.semanticHits.map(semanticLogicalId))
  const unionSize = new Set([...lexicalIds, ...semanticIds]).size
  const overlap = unionSize === 0 ? 0 : [...lexicalIds].filter((id) => semanticIds.has(id)).length / unionSize
  const gap = top !== null && second !== null ? Number((top - second).toFixed(6)) : null
  const adaptiveDecision = ragRuntimePolicy.retrieval.adaptiveEnabled
    ? {
        strategy: "adaptive" as const,
        reason: gap !== null && gap < ragRuntimePolicy.retrieval.adaptiveTopGapExpandBelow ? "small_top_gap_expand_candidates" : overlap >= ragRuntimePolicy.retrieval.adaptiveOverlapBoostAtLeast ? "lexical_semantic_overlap_supports_precision" : "score_distribution_floor",
        effectiveTopK: input.effectiveTopK,
        effectiveMinScore: adaptiveEffectiveMinScore(scores, ragRuntimePolicy.retrieval.adaptiveMinCombinedScore, ragRuntimePolicy.retrieval.adaptiveScoreFloorQuantile)
      }
    : {
        strategy: "fixed" as const,
        reason: "adaptive retrieval is opt-in",
        effectiveTopK: input.requestedTopK,
        effectiveMinScore: -1
      }

  return {
    indexVersion: input.indexVersion,
    aliasVersion: input.aliasVersion,
    lexicalCount: input.lexicalHits.length,
    semanticCount: input.semanticHits.length,
    fusedCount: input.fusedCount,
    latencyMs: input.latencyMs,
    profileId: ragRuntimePolicy.retrieval.profileId,
    profileVersion: ragRuntimePolicy.retrieval.profileVersion,
    topGap: gap,
    lexicalSemanticOverlap: Number(overlap.toFixed(4)),
    scoreDistribution: {
      top,
      median: percentileScore(scores, 0.5),
      p90: percentileScore(scores, 0.9),
      min: scores[0] ?? null,
      max: scores.at(-1) ?? null
    },
    adaptiveDecision,
    index: input.indexDiagnostics
  }
}

function semanticLogicalId(hit: RetrievedVector): string {
  const chunkId = hit.metadata.chunkId
  return chunkId ? `${hit.metadata.documentId}-${chunkId}` : hit.key
}

function indexDiagnostics(
  visibleManifestCount: number,
  indexedChunkCount: number,
  cache: LexicalIndexDiagnostics["cache"],
  started: number,
  degradationDecision?: SafeDegradationDecision
): LexicalIndexDiagnostics {
  return {
    visibleManifestCount,
    indexedChunkCount,
    cache,
    loadMs: Date.now() - started,
    degradationDecision
  }
}

export function adaptiveEffectiveMinScore(scores: number[], minCombinedScore: number, scoreFloorQuantile: number): number {
  return Math.max(minCombinedScore, percentileScore([...scores].sort((a, b) => a - b), scoreFloorQuantile) ?? minCombinedScore)
}

function percentileScore(scores: number[], p: number): number | null {
  if (scores.length === 0) return null
  const index = Math.min(scores.length - 1, Math.max(0, Math.ceil(scores.length * p) - 1))
  const value = scores[index]
  return value === undefined ? null : Number(value.toFixed(6))
}

function weightedDocumentTokens(title: string, body: string): WeightedToken[] {
  return [
    ...tokenizeQuery(title).map((term) => ({ term, weight: 3 })),
    ...tokenizeQuery(body).map((term) => ({ term, weight: 1 })),
    ...ngramTokens(title, 2, 3).map((term) => ({ term, weight: 0.6 })),
    ...ngramTokens(body, 2, 3).map((term) => ({ term, weight: 0.35 }))
  ]
}

function expandQueryTerms(rawTerms: string[], dictionary: string[], aliases: AliasMap): WeightedToken[] {
  const terms = new Map<string, number>()
  for (const term of rawTerms) {
    terms.set(term, Math.max(terms.get(term) ?? 0, 1))
    for (const alias of aliases[term] ?? []) terms.set(normalize(alias), Math.max(terms.get(normalize(alias)) ?? 0, 1.6))
    for (const ngram of ngramTokens(term, 2, 3)) terms.set(ngram, Math.max(terms.get(ngram) ?? 0, 0.45))
  }

  for (const term of rawTerms) {
    for (const candidate of prefixCandidates(term, dictionary)) terms.set(candidate, Math.max(terms.get(candidate) ?? 0, 0.5))
    for (const candidate of cjkAbbreviationCandidates(term, dictionary)) terms.set(candidate, Math.max(terms.get(candidate) ?? 0, 12))
    if (shouldFuzzy(term)) {
      for (const candidate of fuzzyCandidates(term, dictionary)) terms.set(candidate, Math.max(terms.get(candidate) ?? 0, 0.35))
    }
  }

  return [...terms.entries()].map(([term, weight]) => ({ term, weight }))
}

export function tokenizeQuery(text: string): string[] {
  const normalized = normalize(text)
  const ascii = normalized.match(/[a-z0-9_-]+/g) ?? []
  const japaneseRuns = normalized.match(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー]+/gu) ?? []
  const japanese = japaneseRuns.flatMap((run) => {
    if (run.length <= 2) return [run]
    return [run, ...ngramTokens(run, 2, 3)]
  })
  return [...new Set([...ascii, ...japanese].filter((term) => term.length > 0))]
}

function ngramTokens(text: string, min: number, max: number): string[] {
  const chars = [...normalize(text).replace(/[\s\p{P}]/gu, "")]
  const grams: string[] = []
  for (let size = min; size <= max; size += 1) {
    if (chars.length < size) continue
    for (let i = 0; i <= chars.length - size; i += 1) grams.push(chars.slice(i, i + size).join(""))
  }
  return grams
}

function prefixCandidates(term: string, dictionary: string[]): string[] {
  if (term.length < 2) return []
  return dictionary.filter((candidate) => candidate.length > term.length && candidate.startsWith(term)).slice(0, 20)
}

function cjkAbbreviationCandidates(term: string, dictionary: string[]): string[] {
  if (!isCjkAbbreviationTerm(term)) return []
  return dictionary
    .filter((candidate) => candidate.length > term.length && candidate.length <= Math.max(8, term.length * 12))
    .filter((candidate) => isCjkAbbreviationExpansion(term, candidate))
    .slice(0, 20)
}

function fuzzyCandidates(term: string, dictionary: string[]): string[] {
  const maxDistance = term.length > 7 ? 2 : 1
  return dictionary
    .filter((candidate) => candidate !== term && shouldFuzzy(candidate) && Math.abs(candidate.length - term.length) <= maxDistance)
    .filter((candidate) => levenshteinDistance(term, candidate, maxDistance) <= maxDistance)
    .slice(0, 10)
}

function shouldFuzzy(term: string): boolean {
  return term.length >= 4 && /^[a-z0-9_-]+$/.test(term)
}

function isCjkAbbreviationTerm(term: string): boolean {
  return term.length >= 2 && term.length <= 6 && isCjkText(term)
}

function isCjkText(value: string): boolean {
  return /^[\p{Script=Katakana}\p{Script=Han}ー]+$/u.test(value)
}

function isCjkAbbreviationExpansion(term: string, candidate: string): boolean {
  return isCjkText(candidate) && candidate[0] === term[0] && !candidate.includes(term) && isOrderedSubsequence(term, candidate)
}

function isOrderedSubsequence(short: string, long: string): boolean {
  let index = 0
  for (const char of short) {
    index = long.indexOf(char, index)
    if (index < 0) return false
    index += char.length
  }
  return true
}

function levenshteinDistance(a: string, b: string, maxDistance: number): number {
  let prev = Array.from({ length: b.length + 1 }, (_, idx) => idx)
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i]
    let rowMin = curr[0] ?? i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const value = Math.min((curr[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost)
      curr[j] = value
      rowMin = Math.min(rowMin, value)
    }
    if (rowMin > maxDistance) return rowMin
    prev = curr
  }
  return prev[b.length] ?? maxDistance + 1
}

function normalize(text: string): string {
  return text.normalize("NFKC").toLowerCase().trim()
}

async function canAccessManifest(manifest: DocumentManifest, user: AppUser, documentAccess: DocumentPermissionService): Promise<boolean> {
  const decision = await documentAccess.resolveEffectiveDocumentPermissionDecision(user, manifest)
  return decision.permission === "readOnly" || decision.permission === "full"
}

function isActiveManifest(manifest: DocumentManifest, allowLocalFixture = false): boolean {
  if ((manifest.lifecycleStatus ?? stringValue(manifest.metadata?.lifecycleStatus)) !== "active") return false
  if (allowLocalFixture && !manifest.securityEnvelope) {
    const expiresAt = stringValue(manifest.metadata?.expiresAt)
    return !expiresAt || new Date(expiresAt).getTime() > Date.now()
  }
  if (!manifest.securityEnvelope || manifest.securityEnvelope.tenantId !== stringValue(manifest.metadata?.tenantId)) return false
  const expiresAt = stringValue(manifest.metadata?.expiresAt)
  return !expiresAt || new Date(expiresAt).getTime() > Date.now()
}

async function filterAccessibleVectorHits(
  deps: SearchObjectDeps,
  hits: RetrievedVector[],
  user: AppUser,
  scope?: SearchScope,
  publicationSnapshot: PublicationPointerSnapshot = createPublicationPointerSnapshot()
): Promise<RetrievedVector[]> {
  const manifestCache = new Map<string, DocumentManifest | undefined>()
  const access = new FolderPermissionService(deps)
  const documentAccess = new DocumentPermissionService(deps)
  const allowLocalFixture = Boolean(deps.localTestIngestAdmissionContext)
  const result: RetrievedVector[] = []
  for (const hit of hits) {
    if (!canAccessVectorMetadata(hit.metadata, user, allowLocalFixture)) continue
    const manifest = await getCachedManifest(deps, manifestCache, user, hit.metadata.documentId)
    if (!manifest || !isActiveManifest(manifest, allowLocalFixture) || !(await isManifestCurrentPublication(deps, manifest, publicationSnapshot))) continue
    const authorizationAllowed = await canAccessManifest(manifest, user, documentAccess)
    const qualityAllowed = isQualityApprovedForNormalRag(manifest, {
      allowLegacyLocalTestFixture: Boolean(deps.localTestIngestAdmissionContext)
    })
    const current = await currentEligibilitySnapshotFromAuthoritativeState({
      objectStore: deps.objectStore,
      manifest,
      authorizationAllowed,
      qualityAllowed,
      purpose: "normal_answer",
      roles: user.cognitoGroups,
      allowLocalTestFixture: allowLocalFixture
    })
    if (!isCurrentRecordEligible({ user, manifest, envelope: hit.metadata.securityEnvelope, current, allowLocalFixture })) continue
    if (!(await canUseManifestInSearch(manifest, user, documentAccess))) continue
    if (!(await authorizeFolderSearchScope(manifest, scope, user, access))) continue
    if (!(await manifestMatchesScopeForUser(manifest, scope, user, access))) continue
    result.push(hit)
  }
  return result
}

/** Rechecks every fused candidate immediately before body-bearing results leave search. */
async function filterCurrentSearchResults(
  deps: SearchObjectDeps,
  candidates: SearchResult[],
  user: AppUser,
  scope?: SearchScope,
  publicationSnapshot: PublicationPointerSnapshot = createPublicationPointerSnapshot()
): Promise<SearchResult[]> {
  const manifestCache = new Map<string, DocumentManifest | undefined>()
  const chunkCache = new Map<string, Awaited<ReturnType<typeof loadChunksForManifest>>>()
  const currentCache = new Map<string, CurrentRagEligibilitySnapshot>()
  const documentAccess = new DocumentPermissionService(deps)
  const folderAccess = new FolderPermissionService(deps)
  const allowLocalFixture = Boolean(deps.localTestIngestAdmissionContext)
  const eligible: SearchResult[] = []

  for (const candidate of candidates) {
    const manifest = await getCachedManifest(deps, manifestCache, user, candidate.documentId)
    if (!manifest || !isActiveManifest(manifest, allowLocalFixture)) continue
    if (!(await isManifestCurrentPublication(deps, manifest, publicationSnapshot))) continue
    if (!(await manifestMatchesScopeForUser(manifest, scope, user, folderAccess))) continue

    let current = currentCache.get(manifest.documentId)
    if (!current) {
      const permissionDecision = await documentAccess.resolveEffectiveDocumentPermissionDecision(user, manifest)
      const qualityAllowed = isQualityApprovedForNormalRag(manifest, {
        allowLegacyLocalTestFixture: allowLocalFixture
      })
      current = await currentEligibilitySnapshotFromAuthoritativeState({
        objectStore: deps.objectStore,
        manifest,
        authorizationAllowed: permissionDecision.permission === "readOnly" || permissionDecision.permission === "full",
        qualityAllowed,
        purpose: "normal_answer",
        roles: user.cognitoGroups,
        allowLocalTestFixture: allowLocalFixture
      })
      currentCache.set(manifest.documentId, current)
    }

    let envelope = manifest.securityEnvelope
    if (candidate.chunkId) {
      let chunks = chunkCache.get(manifest.documentId)
      if (!chunks) {
        try {
          chunks = await loadChunksForManifest(deps, manifest)
        } catch {
          continue
        }
        chunkCache.set(manifest.documentId, chunks)
      }
      envelope = chunks.find((chunk) => chunk.id === candidate.chunkId)?.securityEnvelope
    }
    if (!isCurrentRecordEligible({ user, manifest, envelope, current, allowLocalFixture })) continue
    if (!(await canUseManifestInSearch(manifest, user, documentAccess))) continue
    if (!(await authorizeFolderSearchScope(manifest, scope, user, folderAccess))) continue
    eligible.push(candidate)
  }
  return eligible
}

async function getCachedManifest(
  deps: Pick<Dependencies, "objectStore" | "localTestIngestAdmissionContext" | "legacyGlobalDocumentArtifacts">,
  cache: Map<string, DocumentManifest | undefined>,
  user: AppUser,
  documentId: string
): Promise<DocumentManifest | undefined> {
  if (cache.has(documentId)) return cache.get(documentId)
  try {
    const tenantId = resolveAuthoritativeSearchTenant(user, undefined)
    const manifest = await readTenantManifest(deps, tenantId, documentId)
    cache.set(documentId, manifest)
    return manifest
  } catch {
    cache.set(documentId, undefined)
    return undefined
  }
}

function canAccessVectorMetadata(metadata: VectorMetadata, user: AppUser, allowLocalFixture = false): boolean {
  if (allowLocalFixture && !metadata.securityEnvelope) {
    if ((metadata.lifecycleStatus ?? "active") !== "active") return false
    if (metadata.ragEligibility && metadata.ragEligibility !== "eligible") return false
    // The explicit local-test seam still requires an authoritative tenant.
    // Folder/document grants are evaluated against the current manifest below;
    // legacy ACL fields on a reconstructed vector must not be treated as truth.
    return Boolean(user.tenantId && metadata.tenantId === user.tenantId)
  }
  if (metadata.lifecycleStatus !== "active" || metadata.ragEligibility !== "eligible") return false
  if (!user.tenantId || metadata.tenantId !== user.tenantId) return false
  return Boolean(
    metadata.securityEnvelope &&
    metadata.securityEnvelope.documentId === metadata.documentId &&
    metadata.securityEnvelope.tenantId === user.tenantId
  )
}

function isCurrentRecordEligible(input: {
  user: AppUser
  manifest: DocumentManifest
  envelope: VectorMetadata["securityEnvelope"]
  current: CurrentRagEligibilitySnapshot
  allowLocalFixture: boolean
}): boolean {
  if (input.allowLocalFixture && !input.manifest.securityEnvelope && !input.envelope) return true
  return evaluateCurrentRagEligibility({
    actor: input.user,
    identityVerified: Boolean(input.user.userId && input.user.tenantId),
    purpose: "normal_answer",
    envelope: input.envelope,
    current: input.current
  }).allowed
}

async function queryAuthorizedSemanticHits(
  store: VectorStore,
  vector: number[],
  topK: number,
  filter: Omit<VectorFilter, "documentIds">,
  authorizedDocumentIds: string[]
): Promise<RetrievedVector[]> {
  const batches = chunkValues(authorizedDocumentIds, 50)
  const hits = (await Promise.all(
    batches.map((documentIds) => store.query(vector, topK, { ...filter, documentIds }))
  )).flat()
  return hits.sort((left, right) => right.score - left.score).slice(0, topK)
}

function resolveAuthoritativeSearchTenant(user: AppUser, requestedTenantId: string | undefined): string {
  const trustedTenantId = user.tenantId?.trim()
  if (trustedTenantId) {
    if (requestedTenantId && requestedTenantId !== trustedTenantId) throw new Error("Forbidden")
    return trustedTenantId
  }
  if (config.authEnabled) throw new Error("Forbidden")
  const explicitLocalTenant = requestedTenantId?.trim() || config.localAuthTenantId.trim()
  if (!explicitLocalTenant) throw new Error("Local/test tenant is not configured")
  return explicitLocalTenant
}

function authoritativeTraceTenant(user: AppUser): string | undefined {
  const trustedTenantId = user.tenantId?.trim()
  if (trustedTenantId) return trustedTenantId
  if (config.authEnabled) return undefined
  return config.localAuthTenantId.trim() || undefined
}

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size))
  return chunks
}

function manifestMatchesFilters(manifest: DocumentManifest, filters: SearchInput["filters"] = {}): boolean {
  if (filters.documentId && manifest.documentId !== filters.documentId) return false
  const metadata = manifest.metadata ?? {}
  if (filters.tenantId && stringValue(metadata.tenantId) !== filters.tenantId) return false
  if (filters.department && stringValue(metadata.department) !== filters.department) return false
  if (filters.source && stringValue(metadata.source) !== filters.source) return false
  if (filters.docType && stringValue(metadata.docType) !== filters.docType) return false
  if (filters.benchmarkSuiteId && stringValue(metadata.benchmarkSuiteId) !== filters.benchmarkSuiteId) return false
  return true
}

function manifestMatchesScope(manifest: DocumentManifest, scope: SearchScope | undefined): boolean {
  const metadata = manifest.metadata ?? {}
  const scopeType = stringValue(metadata.scopeType)
  const temporaryMatch = Boolean(
    scope?.includeTemporary && temporaryScopeIds(scope).includes(stringValue(metadata.temporaryScopeId) ?? "")
  )
  if (!scope || scope.mode === "all" || !scope.mode) {
    if (scopeType !== "chat") return true
    return temporaryMatch
  }
  const groupIds = folderScopeIds(metadata)
  if (scope.mode === "groups") {
    const requested = new Set(scope.groupIds ?? [])
    return temporaryMatch || groupIds.some((groupId) => requested.has(groupId))
  }
  if (scope.mode === "documents") {
    const requested = new Set(scope.documentIds ?? [])
    return temporaryMatch || requested.has(manifest.documentId)
  }
  if (scope.mode === "temporary") {
    return temporaryScopeIds(scope).includes(stringValue(metadata.temporaryScopeId) ?? "")
  }
  return true
}

async function filterManifestsByScope(
  manifests: DocumentManifest[],
  scope: SearchScope | undefined,
  user: AppUser,
  access: FolderPermissionService
): Promise<DocumentManifest[]> {
  const scoped = await Promise.all(manifests.map(async (manifest) => [manifest, await manifestMatchesScopeForUser(manifest, scope, user, access)] as const))
  return scoped.filter(([, allowed]) => allowed).map(([manifest]) => manifest)
}

async function manifestMatchesScopeForUser(
  manifest: DocumentManifest,
  scope: SearchScope | undefined,
  user: AppUser,
  access: FolderPermissionService
): Promise<boolean> {
  if (!scope || scope.mode !== "groups") return manifestMatchesScope(manifest, scope)
  const metadata = manifest.metadata ?? {}
  const temporaryMatch = Boolean(
    scope.includeTemporary && temporaryScopeIds(scope).includes(stringValue(metadata.temporaryScopeId) ?? "")
  )
  if (temporaryMatch) return true
  const requested = new Set(scope.groupIds ?? [])
  const matchingFolderIds = folderScopeIds(metadata).filter((folderId) => requested.has(folderId))
  if (matchingFolderIds.length === 0) return false
  const decisions = await Promise.all(matchingFolderIds.map((folderId) => access.resolveEffectiveFolderPermissionDecision(user, folderId)))
  return decisions.some((decision) => folderPermissionSatisfies(decision.permission, "readOnly"))
}

async function canUseManifestInSearch(
  manifest: DocumentManifest,
  user: AppUser,
  access: DocumentPermissionService
): Promise<boolean> {
  try {
    await access.assertDocumentOperation(user, manifest, "searchUse", ["currentEligibilityConfirmed"])
    return true
  } catch (error) {
    if (error instanceof ResourceOperationAuthorizationError) return false
    throw error
  }
}

async function authorizeFolderSearchScope(
  manifest: DocumentManifest,
  scope: SearchScope | undefined,
  user: AppUser,
  access: FolderPermissionService
): Promise<boolean> {
  if (!scope || scope.mode !== "groups") return true
  const requested = new Set(scope.groupIds ?? [])
  const matchingFolderIds = folderScopeIds(manifest.metadata).filter((folderId) => requested.has(folderId))
  for (const folderId of matchingFolderIds) {
    try {
      await access.assertFolderOperation(user, folderId, "searchUse", [
        "currentEligibilityConfirmed",
        "documentPermissionsReevaluated"
      ])
      return true
    } catch (error) {
      if (error instanceof ResourceOperationAuthorizationError) continue
      throw error
    }
  }
  return false
}

function stringValues(value: JsonValue | undefined): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string")
  return []
}

function folderScopeIds(metadata: Record<string, JsonValue> | undefined): string[] {
  return stringValues(metadata?.folderIds ?? metadata?.folderId ?? metadata?.groupIds ?? metadata?.groupId)
}

function stringValue(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined
}

function aliasMapFromMetadata(metadata: Record<string, JsonValue> | undefined): AliasMap {
  if (!metadata) return {}
  const raw = metadata.searchAliases ?? metadata.aliases
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const aliases: AliasMap = {}
  for (const [key, value] of Object.entries(raw)) {
    const terms = stringValues(value)
    if (terms.length > 0) aliases[key] = terms
  }
  return aliases
}

function mergeAliases(maps: AliasMap[]): AliasMap {
  const merged = new Map<string, Set<string>>()
  for (const map of maps) {
    for (const [rawKey, rawValues] of Object.entries(map)) {
      const key = normalize(rawKey)
      if (!key) continue
      const values = merged.get(key) ?? new Set<string>()
      for (const rawValue of rawValues) {
        const value = normalize(rawValue)
        if (value) values.add(value)
      }
      if (values.size > 0) merged.set(key, values)
    }
  }
  return Object.fromEntries([...merged.entries()].map(([key, values]) => [key, [...values].sort()]))
}

function normalizeAliasMap(aliases: AliasMap): AliasMap {
  return mergeAliases([aliases])
}

function stableStringifyAliasMap(aliases: AliasMap): string {
  const normalized = normalizeAliasMap(aliases)
  return JSON.stringify(Object.fromEntries(Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b))))
}

function sanitizeSearchMetadata(metadata: Record<string, JsonValue> | VectorMetadata | undefined): Record<string, JsonValue> | undefined {
  return sanitizeAuthorizedResourceMetadata(metadata, metadata?.benchmarkSuiteId ? "benchmark" : "reader")
}

function aliasVersionLabel(aliasSignature: string): string {
  return aliasSignature === "{}" ? "none" : versionLabel("alias", aliasSignature)
}

async function loadLexicalIndexArtifact(
  deps: Pick<Dependencies, "objectStore" | "localTestIngestAdmissionContext" | "legacyGlobalDocumentArtifacts">,
  tenantId: string,
  signature: string
): Promise<{ index?: LexicalIndex; degradationDecision?: SafeDegradationDecision }> {
  if (!signature) return {}
  try {
    const prefix = tenantLexicalIndexPrefix(deps, tenantId)
    const latest = JSON.parse(await deps.objectStore.getText(`${prefix}latest.json`)) as { signature?: string; objectKey?: string }
    if (latest.signature !== signature || !latest.objectKey) return {}
    const artifact = JSON.parse(await deps.objectStore.getText(latest.objectKey)) as SerializedLexicalIndex
    if (artifact.schemaVersion !== 1 || artifact.signature !== signature) return {}
    return { index: deserializeLexicalIndex(artifact.index) }
  } catch (error) {
    if (isMissingLexicalArtifact(error)) return {}
    return {
      degradationDecision: safeDegradationDecision({
        trigger: classifyDegradationTrigger(error),
        stage: "lexical_index_cache",
        requestedAction: "limited_answer",
        guardOutcomes: measurePartialRuntimeRagGuards({
          authentication: { passed: true, evidence: "request_identity_resolved" },
          authorization: { passed: true, evidence: "tenant_authorization_completed_before_cache_read" },
          classification_usage: { passed: true, evidence: "current_eligibility_filter_applied_before_result_return" }
        })
      })
    }
  }
}

function isMissingLexicalArtifact(error: unknown): boolean {
  const candidate = error as { code?: string; name?: string; $metadata?: { httpStatusCode?: number } }
  return candidate.code === "ENOENT" || candidate.name === "NoSuchKey" || candidate.$metadata?.httpStatusCode === 404
}

async function publishLexicalIndexArtifact(
  deps: Pick<Dependencies, "objectStore" | "localTestIngestAdmissionContext" | "legacyGlobalDocumentArtifacts">,
  tenantId: string,
  signature: string,
  index: LexicalIndex
): Promise<void> {
  if (!signature) return
  const prefix = tenantLexicalIndexPrefix(deps, tenantId)
  const objectKey = `${prefix}${index.version.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`
  const artifact: SerializedLexicalIndex = {
    schemaVersion: 1,
    signature,
    index: serializeLexicalIndex(index),
    createdAt: new Date().toISOString()
  }
  await deps.objectStore.putText(objectKey, JSON.stringify(artifact), "application/json")
  await deps.objectStore.putText(`${prefix}latest.json`, JSON.stringify({ signature, objectKey, indexVersion: index.version, aliasVersion: index.aliasVersion }, null, 2), "application/json")
}

function serializeLexicalIndex(index: LexicalIndex): SerializedLexicalIndex["index"] {
  return {
    ...index,
    df: [...index.df.entries()],
    postings: [...index.postings.entries()]
  }
}

function deserializeLexicalIndex(input: SerializedLexicalIndex["index"]): LexicalIndex {
  return {
    ...input,
    df: new Map(input.df),
    postings: new Map(input.postings)
  }
}

function versionLabel(prefix: string, value: string): string {
  return `${prefix}:${hashString(value)}`
}

function hashString(value: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.trunc(value)))
}
