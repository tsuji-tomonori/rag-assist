import assert from "node:assert/strict"
import test from "node:test"

import type { Dependencies } from "../../../dependencies.js"
import type {
  DerivedRecordSecurityEnvelope,
  DocumentGroup,
  DocumentManifest,
  DocumentShareGrant,
  RetrievedVector,
  VersionedRecordReference
} from "../../../types.js"
import { manifestMatchesCurrentSessionScope, reauthorizeCurrentEvidence, sessionContextAuthorizesTemporaryManifest } from "./current-evidence-reauthorizer.js"

const timestamp = "2026-07-11T00:00:00.000Z"

test("citation reauthorization applies an ordinary document deny before a folder allow and exposes the versioned reason", async () => {
  const references = {
    authorizationRef: reference("authorization"),
    classificationRef: reference("classification"),
    usagePolicyRef: reference("usage"),
    qualityRef: reference("quality"),
    lifecycleRef: reference("lifecycle"),
    provenanceRef: reference("provenance")
  }
  const envelope: DerivedRecordSecurityEnvelope = {
    schemaVersion: 1,
    documentId: "doc-citation-deny",
    documentVersion: "document-v1",
    tenantId: "tenant-a",
    ...references,
    sourceLocator: { startChar: 0, endChar: 15 },
    envelopeHash: "b".repeat(64)
  }
  const manifest: DocumentManifest = {
    documentId: envelope.documentId,
    documentVersion: envelope.documentVersion,
    fileName: "citation-deny.md",
    sourceObjectKey: "documents/doc-citation-deny.md",
    manifestObjectKey: "manifests/doc-citation-deny.json",
    vectorKeys: ["citation-deny-vector"],
    memoryVectorKeys: [],
    chunkCount: 1,
    memoryCardCount: 0,
    lifecycleStatus: "active",
    securityEnvelope: envelope,
    admission: {
      schemaVersion: 1,
      status: "approved",
      tenantId: "tenant-a",
      ownerUserId: "folder-admin",
      ...references,
      inspectionStatus: "passed",
      reasons: [],
      rejectedProtectedMetadataKeys: [],
      admittedAt: timestamp
    },
    createdAt: timestamp,
    metadata: {
      tenantId: "tenant-a",
      ownerUserId: "folder-admin",
      scopeType: "folder",
      folderIds: ["shared-folder"],
      knowledgeQualityStatus: "approved",
      verificationStatus: "verified",
      freshnessStatus: "current",
      supersessionStatus: "current",
      extractionQualityStatus: "high",
      ragEligibility: "eligible"
    }
  }
  const folder: DocumentGroup = {
    groupId: "shared-folder",
    tenantId: "tenant-a",
    adminPrincipalType: "user",
    adminPrincipalId: "folder-admin",
    name: "Shared folder",
    ownerUserId: "folder-admin",
    visibility: "shared",
    sharedUserIds: ["reader"],
    sharedGroups: [],
    managerUserIds: ["folder-admin"],
    hasExplicitPolicy: true,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp
  }
  const deny: DocumentShareGrant = {
    documentShareGrantId: "deny-reader",
    tenantId: "tenant-a",
    documentId: manifest.documentId,
    principalType: "user",
    principalId: "reader",
    permissionLevel: "deny",
    createdBy: "folder-admin",
    reason: "citation must honor the current deny",
    createdAt: timestamp,
    updatedAt: timestamp
  }
  const chunk: RetrievedVector = {
    key: "citation-deny-vector",
    score: 0.99,
    metadata: {
      kind: "chunk",
      documentId: manifest.documentId,
      documentVersion: manifest.documentVersion,
      fileName: manifest.fileName,
      chunkId: "chunk-1",
      text: "Evidence that must no longer be cited.",
      tenantId: "tenant-a",
      lifecycleStatus: "active",
      ragEligibility: "eligible",
      securityEnvelope: envelope,
      createdAt: timestamp
    }
  }
  const objects = new Map<string, string>([
    [manifest.manifestObjectKey, JSON.stringify(manifest)],
    ["documents/share-grants/tenant-a/doc-citation-deny.json", JSON.stringify({ schemaVersion: 1, grants: [deny] })]
  ])
  const missing = (key: string) => Object.assign(new Error(`not found: ${key}`), { code: "ENOENT" })
  const deps = {
    localTestIngestAdmissionContext: { mode: "local_test_fixture", fixtureId: "citation-reauthorization-test" },
    objectStore: {
      getText: async (key: string) => {
        const value = objects.get(key)
        if (value === undefined) throw missing(key)
        return value
      },
      getTextWithVersion: async (key: string) => {
        const value = objects.get(key)
        if (value === undefined) throw missing(key)
        return { text: value, version: "fixture-v1" }
      },
      listKeys: async (prefix: string) => [...objects.keys()].filter((key) => key.startsWith(prefix))
    },
    documentGroupStore: {
      list: async () => [folder],
      get: async (groupId: string) => groupId === folder.groupId ? folder : undefined
    },
    folderPolicyStore: { list: async () => [], get: async () => undefined, findByFolderId: async () => undefined },
    userGroupStore: { list: async () => [], get: async () => undefined },
    groupMembershipStore: { list: async () => [], listByGroupId: async () => [] }
  } as unknown as Dependencies

  const result = await reauthorizeCurrentEvidence({
    deps,
    user: {
      userId: "reader",
      cognitoGroups: ["CHAT_USER"],
      accountStatus: "active",
      tenantId: "tenant-a"
    },
    chunks: [chunk],
    purpose: "citation",
    now: new Date(timestamp)
  })

  assert.deepEqual(result.eligible, [])
  assert.deepEqual(result.denied, [{
    key: chunk.key,
    documentId: manifest.documentId,
    reason: "authorization_denied",
    authorizationReason: "ordinary_policy_denied"
  }])
})

test("MT-RETRIEVE-003-006/MT-ANSWER-003 answer-time reauthorization enforces current temporary owner, tenant, scope, and TTL", () => {
  const manifest = {
    documentId: "temporary-doc",
    fileName: "temporary.txt",
    sourceObjectKey: "documents/temporary.txt",
    manifestObjectKey: "manifests/temporary.json",
    vectorKeys: [],
    chunkCount: 1,
    memoryCardCount: 0,
    createdAt: timestamp,
    lifecycleStatus: "active",
    metadata: {
      scopeType: "chat",
      tenantId: "tenant-a",
      ownerUserId: "owner-1",
      temporaryScopeId: "tmp-2",
      expiresAt: "2026-07-12T00:00:00.000Z"
    }
  } as DocumentManifest
  const owner = { userId: "owner-1", tenantId: "tenant-a", cognitoGroups: ["CHAT_USER"], accountStatus: "active" as const }
  const scope = { mode: "temporary" as const, includeTemporary: true, temporaryScopeId: "tmp-1", temporaryScopeIds: ["tmp-1", "tmp-2"] }

  assert.equal(manifestMatchesCurrentSessionScope(manifest, owner, scope, new Date("2026-07-11T12:00:00.000Z")), true)
  assert.equal(manifestMatchesCurrentSessionScope(manifest, { ...owner, userId: "other" }, scope, new Date("2026-07-11T12:00:00.000Z")), false)
  assert.equal(manifestMatchesCurrentSessionScope(manifest, { ...owner, tenantId: "tenant-b" }, scope, new Date("2026-07-11T12:00:00.000Z")), false)
  assert.equal(manifestMatchesCurrentSessionScope(manifest, owner, { ...scope, temporaryScopeIds: ["tmp-1"] }, new Date("2026-07-11T12:00:00.000Z")), false)
  assert.equal(manifestMatchesCurrentSessionScope(manifest, owner, scope, new Date("2026-07-12T00:00:00.000Z")), false)
  const activeContext = {
    schemaVersion: 1 as const,
    sessionId: "conversation-1",
    temporaryEvidence: [{
      temporaryScopeId: "tmp-2",
      documentId: "temporary-doc",
      status: "active" as const,
      expiresAt: "2026-07-12T00:00:00.000Z",
      updatedAt: timestamp
    }],
    updatedAt: timestamp
  }
  assert.equal(sessionContextAuthorizesTemporaryManifest(activeContext, "conversation-1", manifest, new Date("2026-07-11T12:00:00.000Z")), true)
  assert.equal(sessionContextAuthorizesTemporaryManifest({
    ...activeContext,
    temporaryEvidence: activeContext.temporaryEvidence.map((reference) => ({ ...reference, status: "revoked" as const }))
  }, "conversation-1", manifest, new Date("2026-07-11T12:00:00.000Z")), false, "mid-run terminal context removes the source before answer/citation finalization")
})

function reference(id: string): VersionedRecordReference {
  return { id, version: "v1", hash: "a".repeat(64) }
}
