import type { SessionDocumentContext, SearchScope } from "../../../types.js"
import type { SessionScopeNormalizationReason, SessionScopeNormalizationSummary } from "../../../chat-orchestration/types.js"

const TEMPORARY_SCOPE_LIMIT = 20

export type SessionLocalEvidenceScopeResult = {
  searchScope: SearchScope
  summary: SessionScopeNormalizationSummary
}

export function normalizeSessionLocalEvidenceScope(input: {
  requestedScope?: SearchScope
  conversationId?: string
  context?: SessionDocumentContext
  currentlyAuthorizedTemporaryScopeIds?: readonly string[]
  previousCitationAnchorCount?: number
  now?: Date
}): SessionLocalEvidenceScopeResult {
  const requestedScope = input.requestedScope ?? {}
  const allRequestedTemporaryScopeIds = unique([
    ...(requestedScope.temporaryScopeId ? [requestedScope.temporaryScopeId] : []),
    ...(requestedScope.temporaryScopeIds ?? [])
  ])
  const requestedTemporaryScopeIds = allRequestedTemporaryScopeIds.slice(0, TEMPORARY_SCOPE_LIMIT)
  const reasons = new Set<SessionScopeNormalizationReason>()
  const deniedScopeIds = new Set<string>()
  for (const overflowScopeId of allRequestedTemporaryScopeIds.slice(TEMPORARY_SCOPE_LIMIT)) deniedScopeIds.add(overflowScopeId)
  if (allRequestedTemporaryScopeIds.length > TEMPORARY_SCOPE_LIMIT) reasons.add("scope_limit_exceeded")
  const contextMatches = Boolean(input.context && input.conversationId && input.context.sessionId === input.conversationId)

  if (input.conversationId && !input.context) reasons.add("context_not_found")
  if (input.context && !contextMatches) reasons.add("session_mismatch")

  const now = (input.now ?? new Date()).getTime()
  const activeContextScopeIds: string[] = []
  for (const reference of contextMatches ? input.context?.temporaryEvidence ?? [] : []) {
    if (reference.status !== "active") {
      deniedScopeIds.add(reference.temporaryScopeId)
      reasons.add("terminal")
      continue
    }
    const expiry = Date.parse(reference.expiresAt)
    if (!Number.isFinite(expiry) || expiry <= now) {
      deniedScopeIds.add(reference.temporaryScopeId)
      reasons.add("expired")
      continue
    }
    activeContextScopeIds.push(reference.temporaryScopeId)
  }

  const authorized = new Set(input.currentlyAuthorizedTemporaryScopeIds ?? [])
  const authorizedActiveScopeIds = unique(activeContextScopeIds)
    .filter((temporaryScopeId) => {
      if (authorized.has(temporaryScopeId)) return true
      deniedScopeIds.add(temporaryScopeId)
      reasons.add("current_authorization_denied")
      return false
    })
  for (const overflowScopeId of authorizedActiveScopeIds.slice(TEMPORARY_SCOPE_LIMIT)) deniedScopeIds.add(overflowScopeId)
  if (authorizedActiveScopeIds.length > TEMPORARY_SCOPE_LIMIT) reasons.add("scope_limit_exceeded")
  const activeTemporaryScopeIds = authorizedActiveScopeIds.slice(0, TEMPORARY_SCOPE_LIMIT)
  const authoritative = new Set(activeTemporaryScopeIds)
  for (const temporaryScopeId of requestedTemporaryScopeIds) {
    if (authoritative.has(temporaryScopeId)) continue
    deniedScopeIds.add(temporaryScopeId)
    reasons.add("client_scope_not_authoritative")
  }

  return {
    searchScope: {
      ...requestedScope,
      includeTemporary: activeTemporaryScopeIds.length > 0,
      temporaryScopeId: activeTemporaryScopeIds[0],
      temporaryScopeIds: activeTemporaryScopeIds
    },
    summary: {
      acceptedTemporaryScopeCount: activeTemporaryScopeIds.length,
      deniedTemporaryScopeCount: deniedScopeIds.size,
      reasonCodes: [...reasons].sort(),
      previousCitationAnchorCount: input.previousCitationAnchorCount ?? 0
    }
  }
}

export function temporaryScopeIds(scope: SearchScope | undefined): string[] {
  return unique([
    ...(scope?.temporaryScopeId ? [scope.temporaryScopeId] : []),
    ...(scope?.temporaryScopeIds ?? [])
  ]).slice(0, TEMPORARY_SCOPE_LIMIT)
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
