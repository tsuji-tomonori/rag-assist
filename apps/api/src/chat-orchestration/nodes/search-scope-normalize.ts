import type { ChatOrchestrationState, ChatOrchestrationUpdate, NormalizedSearchScope, PreviousCitationAnchor } from "../state.js"
import type { SearchScope } from "../../types.js"

export async function normalizeSearchScopeNode(state: ChatOrchestrationState): Promise<ChatOrchestrationUpdate> {
  const normalizedSearchScope = normalizeSearchScope({
    sessionId: state.conversation?.conversationId,
    userSelectedScope: state.searchScope,
    sessionDefaultScope: { mode: "all" },
    sessionDocumentContext: state.sessionDocumentContext,
    removedTemporaryScopeIds: state.removedTemporaryScopeIds,
    previousCitationAnchors: state.conversationState?.previousCitationAnchors ?? [],
    now: new Date(state.temporalContext?.nowIso ?? Date.now())
  })

  return {
    normalizedSearchScope,
    searchScope: toRetrieverSearchScope(normalizedSearchScope)
  }
}

export function normalizeSearchScope(input: {
  sessionId?: string
  userSelectedScope?: SearchScope
  sessionDefaultScope: SearchScope
  sessionDocumentContext?: ChatOrchestrationState["sessionDocumentContext"]
  removedTemporaryScopeIds?: string[]
  previousCitationAnchors?: PreviousCitationAnchor[]
  now: Date
}): NormalizedSearchScope {
  const baseScope = input.userSelectedScope ?? input.sessionDefaultScope
  const removed = new Set(input.removedTemporaryScopeIds ?? [])
  const disabled = new Set(input.sessionDocumentContext?.disabledTemporaryScopeIds ?? [])
  const excludedTemporaryScopes: NormalizedSearchScope["excludedTemporaryScopes"] = []
  const requestedTemporaryScopeIds = temporaryScopeIdsFrom(baseScope)
  const contextSessionMatches =
    !input.sessionDocumentContext?.sessionId || !input.sessionId || input.sessionDocumentContext.sessionId === input.sessionId
  const activeFromContext = contextSessionMatches ? input.sessionDocumentContext?.activeTemporaryScopeIds ?? [] : []
  const candidateTemporaryScopeIds = unique([...requestedTemporaryScopeIds, ...activeFromContext])
  const expiresAtByTemporaryScopeId = input.sessionDocumentContext?.expiresAtByTemporaryScopeId ?? {}
  const activeTemporaryScopeIds: string[] = []

  for (const temporaryScopeId of candidateTemporaryScopeIds) {
    if (!contextSessionMatches && requestedTemporaryScopeIds.includes(temporaryScopeId)) {
      excludedTemporaryScopes.push({ temporaryScopeId, reason: "session_mismatch" })
      continue
    }
    if (removed.has(temporaryScopeId)) {
      excludedTemporaryScopes.push({ temporaryScopeId, reason: "removed" })
      continue
    }
    if (disabled.has(temporaryScopeId)) {
      excludedTemporaryScopes.push({ temporaryScopeId, reason: "disabled" })
      continue
    }
    if (isExpired(expiresAtByTemporaryScopeId[temporaryScopeId], input.now)) {
      excludedTemporaryScopes.push({ temporaryScopeId, reason: "expired" })
      continue
    }
    activeTemporaryScopeIds.push(temporaryScopeId)
  }

  const previousCitationAnchors = uniqueAnchors([
    ...(input.previousCitationAnchors ?? []),
    ...(input.sessionDocumentContext?.previousCitationAnchors ?? [])
  ])

  return {
    baseScope,
    mode: baseScope.mode ?? "all",
    groupIds: baseScope.groupIds ?? [],
    documentIds: baseScope.documentIds ?? [],
    includeTemporary: activeTemporaryScopeIds.length > 0,
    temporaryScopeId: activeTemporaryScopeIds[0],
    temporaryScopeIds: activeTemporaryScopeIds,
    previousCitationAnchors,
    excludedTemporaryScopes
  }
}

function toRetrieverSearchScope(scope: NormalizedSearchScope): SearchScope {
  return {
    mode: scope.mode,
    groupIds: scope.groupIds,
    documentIds: scope.documentIds,
    includeTemporary: scope.temporaryScopeIds.length > 0,
    temporaryScopeId: scope.temporaryScopeIds[0],
    temporaryScopeIds: scope.temporaryScopeIds
  }
}

function temporaryScopeIdsFrom(scope: SearchScope): string[] {
  return unique([
    ...(scope.temporaryScopeId ? [scope.temporaryScopeId] : []),
    ...(scope.temporaryScopeIds ?? [])
  ].filter(Boolean))
}

function isExpired(expiresAt: string | undefined, now: Date): boolean {
  if (!expiresAt) return false
  const expiresAtMs = Date.parse(expiresAt)
  if (Number.isNaN(expiresAtMs)) return false
  return expiresAtMs <= now.getTime()
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function uniqueAnchors(anchors: PreviousCitationAnchor[]): PreviousCitationAnchor[] {
  const seen = new Set<string>()
  const result: PreviousCitationAnchor[] = []
  for (const anchor of anchors) {
    if (!anchor.documentId && !anchor.fileName && !anchor.chunkId) continue
    const key = [anchor.documentId, anchor.fileName, anchor.chunkId, anchor.pageStart, anchor.pageEnd].join(":")
    if (seen.has(key)) continue
    seen.add(key)
    result.push(anchor)
  }
  return result
}
