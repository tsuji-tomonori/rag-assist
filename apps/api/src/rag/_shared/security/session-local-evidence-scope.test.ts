import assert from "node:assert/strict"
import test from "node:test"
import { normalizeSessionLocalEvidenceScope } from "./session-local-evidence-scope.js"

const now = new Date("2026-07-17T00:00:00.000Z")

test("MT-TEMP-001/002/003 old single scope remains compatible while authoritative active scopes merge with base scope", () => {
  const result = normalizeSessionLocalEvidenceScope({
    conversationId: "conversation-1",
    requestedScope: {
      mode: "documents",
      documentIds: ["ordinary-doc"],
      includeTemporary: true,
      temporaryScopeId: "tmp-1"
    },
    context: {
      schemaVersion: 1,
      sessionId: "conversation-1",
      temporaryEvidence: [
        reference("tmp-1", "doc-1", "active", "2026-07-18T00:00:00.000Z"),
        reference("tmp-2", "doc-2", "active", "2026-07-19T00:00:00.000Z")
      ],
      updatedAt: now.toISOString()
    },
    currentlyAuthorizedTemporaryScopeIds: ["tmp-1", "tmp-2"],
    now
  })

  assert.deepEqual(result.searchScope, {
    mode: "documents",
    documentIds: ["ordinary-doc"],
    includeTemporary: true,
    temporaryScopeId: "tmp-1",
    temporaryScopeIds: ["tmp-1", "tmp-2"]
  })
  assert.deepEqual(result.summary, {
    acceptedTemporaryScopeCount: 2,
    deniedTemporaryScopeCount: 0,
    reasonCodes: [],
    previousCitationAnchorCount: 0
  })
})

test("MT-TEMP-004/005/006 terminal, expired, mismatched, and client-only scopes cannot be added or revived", () => {
  const result = normalizeSessionLocalEvidenceScope({
    conversationId: "conversation-1",
    requestedScope: { mode: "temporary", temporaryScopeId: "client-only", temporaryScopeIds: ["removed"] },
    context: {
      schemaVersion: 1,
      sessionId: "conversation-1",
      temporaryEvidence: [
        reference("removed", "doc-removed", "removed", "2026-07-20T00:00:00.000Z"),
        reference("expired", "doc-expired", "active", "2026-07-16T00:00:00.000Z"),
        reference("revoked-currently", "doc-revoked", "active", "2026-07-20T00:00:00.000Z")
      ],
      updatedAt: now.toISOString()
    },
    currentlyAuthorizedTemporaryScopeIds: [],
    now
  })

  assert.deepEqual(result.searchScope.temporaryScopeIds, [])
  assert.equal(result.searchScope.includeTemporary, false)
  assert.deepEqual(result.summary.reasonCodes, [
    "client_scope_not_authoritative",
    "current_authorization_denied",
    "expired",
    "terminal"
  ])
  assert.equal(JSON.stringify(result.summary).includes("client-only"), false, "bounded trace summary must not disclose scope ids")

  const mismatch = normalizeSessionLocalEvidenceScope({
    conversationId: "conversation-1",
    requestedScope: { temporaryScopeId: "tmp-other" },
    context: {
      schemaVersion: 1,
      sessionId: "conversation-2",
      temporaryEvidence: [reference("tmp-other", "doc-other", "active", "2026-07-20T00:00:00.000Z")],
      updatedAt: now.toISOString()
    },
    currentlyAuthorizedTemporaryScopeIds: ["tmp-other"],
    now
  })
  assert.deepEqual(mismatch.searchScope.temporaryScopeIds, [])
  assert.deepEqual(mismatch.summary.reasonCodes, ["client_scope_not_authoritative", "session_mismatch"])
})

test("MT-TRACE-001-003 over-limit normalization records a bounded reason instead of silently truncating", () => {
  const scopeIds = Array.from({ length: 22 }, (_, index) => `tmp-${index + 1}`)
  const result = normalizeSessionLocalEvidenceScope({
    requestedScope: { temporaryScopeIds: scopeIds },
    currentlyAuthorizedTemporaryScopeIds: [],
    now
  })

  assert.equal(result.searchScope.temporaryScopeIds?.length, 0)
  assert.equal(result.summary.deniedTemporaryScopeCount, 22)
  assert.deepEqual(result.summary.reasonCodes, ["client_scope_not_authoritative", "scope_limit_exceeded"])
  assert.equal(JSON.stringify(result.summary).includes("tmp-21"), false)
})

function reference(
  temporaryScopeId: string,
  documentId: string,
  status: "active" | "expired" | "removed" | "revoked",
  expiresAt: string
) {
  return { temporaryScopeId, documentId, status, expiresAt, updatedAt: now.toISOString() }
}
