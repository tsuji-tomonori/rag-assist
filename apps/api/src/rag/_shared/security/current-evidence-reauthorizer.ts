import type { AppUser } from "../../../auth.js"
import type { Dependencies } from "../../../dependencies.js"
import { DocumentPermissionService } from "../../../documents/document-permission-service.js"
import type { ResourcePermissionDecisionReasonCode } from "../../../security/resource-permission-decision.js"
import type { DocumentManifest, RetrievedVector } from "../../../types.js"
import { isQualityApprovedForNormalRag } from "../policies/quality-policy.js"
import { createPublicationPointerSnapshot, isManifestCurrentPublication } from "../publication/staged-publication-coordinator.js"
import { loadChunksForManifest } from "../storage/manifest-chunks.js"
import { readTenantManifest } from "../storage/tenant-artifacts.js"
import {
  currentEligibilitySnapshotFromAuthoritativeState,
  evaluateCurrentRagEligibility,
  type CurrentRagEligibilityReason,
  type RagUsePurpose
} from "./current-rag-eligibility.js"

export type CurrentEvidenceReauthorizationResult = {
  eligible: RetrievedVector[]
  denied: Array<{
    key: string
    documentId: string
    reason: CurrentRagEligibilityReason
    authorizationReason?: ResourcePermissionDecisionReasonCode
  }>
}

export async function reauthorizeCurrentEvidence(input: {
  deps: Dependencies
  user: AppUser
  chunks: RetrievedVector[]
  purpose: RagUsePurpose
  now?: Date
}): Promise<CurrentEvidenceReauthorizationResult> {
  const manifestCache = new Map<string, DocumentManifest | undefined>()
  const manifestChunkCache = new Map<string, Awaited<ReturnType<typeof loadChunksForManifest>>>()
  const decisionCache = new Map<string, {
    current: Awaited<ReturnType<typeof currentEligibilitySnapshotFromAuthoritativeState>>
    authorizationReason: ResourcePermissionDecisionReasonCode
  }>()
  const documentPermissions = new DocumentPermissionService(input.deps)
  const publicationSnapshot = createPublicationPointerSnapshot()
  const eligible: RetrievedVector[] = []
  const denied: CurrentEvidenceReauthorizationResult["denied"] = []

  for (const chunk of input.chunks) {
    const documentId = chunk.metadata.documentId
    let manifest = manifestCache.get(documentId)
    if (!manifestCache.has(documentId)) {
      manifest = await loadManifest(input.deps, input.user, documentId)
      manifestCache.set(documentId, manifest)
    }
    if (!manifest) {
      denied.push({ key: chunk.key, documentId, reason: "lifecycle_inactive" })
      continue
    }
    if (!(await isManifestCurrentPublication(input.deps, manifest, publicationSnapshot))) {
      denied.push({ key: chunk.key, documentId, reason: "lifecycle_inactive" })
      continue
    }

    let cachedDecision = decisionCache.get(documentId)
    if (!cachedDecision) {
      const permissionDecision = await documentPermissions.resolveEffectiveDocumentPermissionDecision(input.user, manifest)
      cachedDecision = {
        current: await currentEligibilitySnapshotFromAuthoritativeState({
          objectStore: input.deps.objectStore,
          manifest,
          authorizationAllowed: permissionDecision.permission === "readOnly" || permissionDecision.permission === "full",
          qualityAllowed: isQualityApprovedForNormalRag(manifest, {
            allowLegacyLocalTestFixture: Boolean(input.deps.localTestIngestAdmissionContext)
          }),
          purpose: input.purpose,
          roles: input.user.cognitoGroups,
          allowLocalTestFixture: Boolean(input.deps.localTestIngestAdmissionContext)
        }),
        authorizationReason: permissionDecision.reasonCode
      }
      decisionCache.set(documentId, cachedDecision)
    }
    const envelope = chunk.metadata.securityEnvelope ?? await loadAuthoritativeChunkEnvelope(
      input.deps,
      manifestChunkCache,
      manifest,
      chunk.metadata.chunkId
    )
    const decision = evaluateCurrentRagEligibility({
      actor: input.user,
      identityVerified: Boolean(input.user.userId && input.user.tenantId),
      purpose: input.purpose,
      envelope,
      current: cachedDecision.current,
      now: input.now
    })
    if (decision.allowed) eligible.push(chunk)
    else denied.push({
      key: chunk.key,
      documentId,
      reason: decision.reason,
      authorizationReason: cachedDecision.authorizationReason
    })
  }
  return { eligible, denied }
}

async function loadAuthoritativeChunkEnvelope(
  deps: Dependencies,
  cache: Map<string, Awaited<ReturnType<typeof loadChunksForManifest>>>,
  manifest: DocumentManifest,
  chunkId: string | undefined
) {
  if (!chunkId) return undefined
  let chunks = cache.get(manifest.documentId)
  if (!chunks) {
    try {
      chunks = await loadChunksForManifest(deps, manifest)
    } catch {
      return undefined
    }
    cache.set(manifest.documentId, chunks)
  }
  return chunks.find((chunk) => chunk.id === chunkId)?.securityEnvelope
}

async function loadManifest(
  deps: Pick<Dependencies, "objectStore" | "localTestIngestAdmissionContext" | "legacyGlobalDocumentArtifacts">,
  user: AppUser,
  documentId: string
): Promise<DocumentManifest | undefined> {
  try {
    const tenantId = user.tenantId?.trim()
    if (!tenantId) return undefined
    return await readTenantManifest(deps, tenantId, documentId)
  } catch {
    return undefined
  }
}
