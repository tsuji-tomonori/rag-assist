import type { AppUser } from "../../auth.js"
import { config } from "../../config.js"
import type { Dependencies } from "../../dependencies.js"
import type { DocumentManifest, JsonValue, RetrievedVector, VectorMetadata } from "../../types.js"
import type { QaAgentState, QaAgentUpdate } from "../state.js"

export function createRetrieveMemoryNode(deps: Dependencies, user: AppUser) {
  return async function retrieveMemory(state: QaAgentState): Promise<QaAgentUpdate> {
    if (!state.useMemory) {
      return { memoryCards: [] }
    }

    const vector = await deps.textModel.embed(state.normalizedQuery ?? state.question, {
      modelId: state.embeddingModelId,
      dimensions: config.embeddingDimensions
    })

    const queryTopK = Math.min(100, Math.max(state.memoryTopK, state.memoryTopK * 3))
    const memoryCards = (await filterAccessibleMemoryHits(deps, await deps.memoryVectorStore.query(vector, queryTopK, { kind: "memory" }), user))
      .slice(0, state.memoryTopK)
    return { memoryCards }
  }
}

async function filterAccessibleMemoryHits(deps: Dependencies, hits: RetrievedVector[], user: AppUser): Promise<RetrievedVector[]> {
  const manifestCache = new Map<string, DocumentManifest | undefined>()
  const result: RetrievedVector[] = []
  for (const hit of hits) {
    if (!canAccessMemoryVectorMetadata(hit.metadata, user)) continue
    const manifest = await getCachedManifest(deps, manifestCache, hit.metadata.documentId)
    if (!manifest || !isActiveManifest(manifest) || !canAccessManifest(manifest, user)) continue
    result.push(hit)
  }
  return result
}

function canAccessMemoryVectorMetadata(metadata: VectorMetadata, user: AppUser): boolean {
  if ((metadata.lifecycleStatus ?? "active") !== "active") return false
  if (user.cognitoGroups.includes("SYSTEM_ADMIN")) return true
  return canAccessMetadata(metadata as unknown as Record<string, JsonValue>, user)
}

async function getCachedManifest(
  deps: Pick<Dependencies, "objectStore">,
  cache: Map<string, DocumentManifest | undefined>,
  documentId: string
): Promise<DocumentManifest | undefined> {
  if (cache.has(documentId)) return cache.get(documentId)
  try {
    const manifest = JSON.parse(await deps.objectStore.getText(`manifests/${documentId}.json`)) as DocumentManifest
    cache.set(documentId, manifest)
    return manifest
  } catch {
    cache.set(documentId, undefined)
    return undefined
  }
}

function isActiveManifest(manifest: DocumentManifest): boolean {
  return (manifest.lifecycleStatus ?? stringValue(manifest.metadata?.lifecycleStatus) ?? "active") === "active"
}

function canAccessManifest(manifest: DocumentManifest, user: AppUser): boolean {
  if (user.cognitoGroups.includes("SYSTEM_ADMIN")) return true
  return canAccessMetadata(manifest.metadata ?? {}, user)
}

function canAccessMetadata(metadata: Record<string, JsonValue>, user: AppUser): boolean {
  const groups = new Set(user.cognitoGroups)
  const aclGroups = stringValues(metadata.aclGroups ?? metadata.allowedGroups ?? metadata.aclGroup ?? metadata.group)
  if (aclGroups.length > 0 && !aclGroups.some((group) => groups.has(group))) return false
  const allowedUsers = stringValues(metadata.allowedUsers ?? metadata.userIds ?? metadata.privateToUserId)
  if (allowedUsers.length > 0 && !allowedUsers.includes(user.userId) && (!user.email || !allowedUsers.includes(user.email))) return false
  return true
}

function stringValues(value: JsonValue | undefined): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string")
  return []
}

function stringValue(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined
}
