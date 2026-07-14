import type { Dependencies } from "../../../dependencies.js"
import type { DocumentManifest } from "../../../types.js"
import { tenantPartitionId } from "../../../security/tenant-partition.js"

type TenantArtifactPolicy = Pick<
  Dependencies,
  "localTestIngestAdmissionContext" | "legacyGlobalDocumentArtifacts"
>

type TenantManifestDeps = TenantArtifactPolicy & Pick<Dependencies, "objectStore">

/**
 * The old global layout is available only through an explicit local/test
 * compatibility seam. createDependencies() never enables this in production.
 */
export function usesLegacyGlobalDocumentArtifacts(policy: TenantArtifactPolicy): boolean {
  return Boolean(
    policy.localTestIngestAdmissionContext
    && policy.legacyGlobalDocumentArtifacts !== false
  )
}

export function tenantArtifactRoot(tenantId: string): string {
  return `tenant-artifacts/${tenantPartitionSegment(tenantId)}`
}

export function tenantDocumentArtifactKey(
  policy: TenantArtifactPolicy,
  tenantId: string,
  legacyRelativeKey: string
): string {
  const relativeKey = normalizeRelativeKey(legacyRelativeKey)
  return usesLegacyGlobalDocumentArtifacts(policy)
    ? relativeKey
    : `${tenantArtifactRoot(tenantId)}/${relativeKey}`
}

export function tenantDocumentArtifactPrefix(
  policy: TenantArtifactPolicy,
  tenantId: string,
  legacyRelativePrefix: string
): string {
  const relativePrefix = normalizeRelativeKey(legacyRelativePrefix)
  return usesLegacyGlobalDocumentArtifacts(policy)
    ? relativePrefix
    : `${tenantArtifactRoot(tenantId)}/${relativePrefix}`
}

export function tenantManifestKey(
  policy: TenantArtifactPolicy,
  tenantId: string,
  documentId: string
): string {
  return tenantDocumentArtifactKey(policy, tenantId, `manifests/${encodeIdentifier(documentId)}.json`)
}

export function tenantManifestPrefix(policy: TenantArtifactPolicy, tenantId: string): string {
  return tenantDocumentArtifactPrefix(policy, tenantId, "manifests/")
}

export function tenantLexicalIndexPrefix(policy: TenantArtifactPolicy, tenantId: string): string {
  return tenantDocumentArtifactPrefix(policy, tenantId, "lexical-index/")
}

export function tenantVectorKey(
  policy: TenantArtifactPolicy,
  tenantId: string,
  legacyKey: string
): string {
  const normalizedKey = legacyKey.trim()
  if (!normalizedKey) throw new Error("Vector key is required")
  return usesLegacyGlobalDocumentArtifacts(policy)
    ? normalizedKey
    : `tenant-${tenantPartitionSegment(tenantId)}-${normalizedKey}`
}

export async function readTenantManifest(
  deps: TenantManifestDeps,
  tenantId: string,
  documentId: string
): Promise<DocumentManifest> {
  const key = tenantManifestKey(deps, tenantId, documentId)
  const manifest = JSON.parse(await deps.objectStore.getText(key)) as DocumentManifest
  assertManifestTenant(manifest, tenantId, key, { allowMissingTenant: usesLegacyGlobalDocumentArtifacts(deps) })
  return manifest
}

export async function readTenantManifestByKey(
  deps: TenantManifestDeps,
  tenantId: string,
  key: string
): Promise<DocumentManifest> {
  const manifest = JSON.parse(await deps.objectStore.getText(key)) as DocumentManifest
  assertManifestTenant(manifest, tenantId, key, { allowMissingTenant: usesLegacyGlobalDocumentArtifacts(deps) })
  if (!usesLegacyGlobalDocumentArtifacts(deps) && !key.startsWith(`${tenantArtifactRoot(tenantId)}/`)) {
    throw new Error("Document manifest escaped its authoritative tenant partition")
  }
  return manifest
}

export function assertManifestTenant(
  manifest: DocumentManifest,
  tenantId: string,
  key?: string,
  options: { allowMissingTenant?: boolean } = {}
): void {
  const normalizedTenantId = requiredTenantId(tenantId)
  const manifestTenantId = manifest.admission?.tenantId?.trim()
    || stringValue(manifest.metadata?.tenantId)?.trim()
  if ((!manifestTenantId && !options.allowMissingTenant) || (manifestTenantId && manifestTenantId !== normalizedTenantId)) {
    throw new Error(`Document manifest tenant mismatch${key ? `: ${key}` : ""}`)
  }
}

function tenantPartitionSegment(tenantId: string): string {
  return tenantPartitionId(requiredTenantId(tenantId)).replace(/^tenant:/, "")
}

function requiredTenantId(tenantId: string): string {
  const normalized = tenantId.trim()
  if (!normalized) throw new Error("Authoritative tenant is required")
  return normalized
}

function normalizeRelativeKey(key: string): string {
  const normalized = key.replace(/^\/+/, "")
  if (!normalized || normalized.includes("..")) throw new Error("Artifact key is invalid")
  return normalized
}

function encodeIdentifier(value: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error("Document identifier is required")
  return encodeURIComponent(normalized)
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}
