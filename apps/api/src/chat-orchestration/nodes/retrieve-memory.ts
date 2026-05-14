import type { AppUser } from "../../auth.js"
import { config } from "../../config.js"
import type { Dependencies } from "../../dependencies.js"
import { isQualityApprovedForNormalRag } from "../../rag/quality.js"
import type { DocumentGroup, DocumentManifest, JsonValue, RetrievedVector, SearchScope, VectorMetadata } from "../../types.js"
import { ragRuntimePolicy } from "../runtime-policy.js"
import type { ChatOrchestrationState, ChatOrchestrationUpdate } from "../state.js"

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
    const memoryCards = (await filterAccessibleMemoryHits(deps, await deps.memoryVectorStore.query(vector, queryTopK, { kind: "memory" }), user, state.searchScope))
      .slice(0, state.memoryTopK)
    return { memoryCards }
  }
}

async function filterAccessibleMemoryHits(deps: Dependencies, hits: RetrievedVector[], user: AppUser, scope?: SearchScope): Promise<RetrievedVector[]> {
  const manifestCache = new Map<string, DocumentManifest | undefined>()
  const groups = await loadDocumentGroups(deps)
  const result: RetrievedVector[] = []
  for (const hit of hits) {
    if (!canAccessMemoryVectorMetadata(hit.metadata, user)) continue
    const manifest = await getCachedManifest(deps, manifestCache, hit.metadata.documentId)
    if (!manifest || !isActiveManifest(manifest) || !canAccessManifest(manifest, user, groups) || !manifestMatchesScope(manifest, scope) || !isQualityApprovedForNormalRag(manifest)) continue
    result.push(hit)
  }
  return result
}

function canAccessMemoryVectorMetadata(metadata: VectorMetadata, user: AppUser): boolean {
  if ((metadata.lifecycleStatus ?? "active") !== "active") return false
  if (user.cognitoGroups.includes("SYSTEM_ADMIN")) return true
  if (metadata.scopeType === "group" || metadata.scopeType === "chat") return true
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
  if ((manifest.lifecycleStatus ?? stringValue(manifest.metadata?.lifecycleStatus) ?? "active") !== "active") return false
  const expiresAt = stringValue(manifest.metadata?.expiresAt)
  return !expiresAt || new Date(expiresAt).getTime() > Date.now()
}

function canAccessManifest(manifest: DocumentManifest, user: AppUser, groups: DocumentGroup[] = []): boolean {
  if (user.cognitoGroups.includes("SYSTEM_ADMIN")) return true
  const metadata = manifest.metadata ?? {}
  if (stringValue(metadata.ownerUserId) === user.userId) return true
  const groupIds = stringValues(metadata.groupIds ?? metadata.groupId)
  if (groupIds.some((groupId) => canAccessDocumentGroup(groups.find((group) => group.groupId === groupId), user))) return true
  if (stringValue(metadata.scopeType) === "group") return false
  return canAccessMetadata(metadata, user)
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

async function loadDocumentGroups(deps: Pick<Dependencies, "documentGroupStore">): Promise<DocumentGroup[]> {
  try {
    return await deps.documentGroupStore.list()
  } catch {
    return []
  }
}

function canAccessDocumentGroup(group: DocumentGroup | undefined, user: AppUser): boolean {
  if (!group) return false
  if (group.ownerUserId === user.userId || group.managerUserIds.includes(user.userId) || group.sharedUserIds.includes(user.userId)) return true
  if (user.email && group.sharedUserIds.includes(user.email)) return true
  if (group.visibility === "org") return true
  return group.sharedGroups.some((sharedGroup) => user.cognitoGroups.includes(sharedGroup))
}
