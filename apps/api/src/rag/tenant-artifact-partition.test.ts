import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

import { LocalDocumentGroupStore } from "../adapters/local-document-group-store.js"
import { LocalFolderPolicyStore } from "../adapters/local-folder-policy-store.js"
import { LocalGroupMembershipStore } from "../adapters/local-group-membership-store.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalUserGroupStore } from "../adapters/local-user-group-store.js"
import { LocalVectorStore } from "../adapters/local-vector-store.js"
import { MockBedrockTextModel } from "../adapters/mock-bedrock.js"
import type { AppUser } from "../auth.js"
import type { Dependencies } from "../dependencies.js"
import type { LocalTestFixtureAdmissionContext, MemoryCard } from "../types.js"
import { MemoRagService } from "./memorag-service.js"
import {
  readTenantManifest,
  tenantArtifactRoot,
  tenantManifestKey,
  tenantManifestPrefix
} from "./_shared/storage/tenant-artifacts.js"
import { runIngestPipeline } from "./offline/pre-retrieval/ingestion/ingest-run.service.js"
import { searchRag } from "./online/retrieval/hybrid/hybrid-retriever.js"

test("FR-060 same documentId is physically partitioned and never reveals the other tenant body or candidates", async (t) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "tenant-artifacts-"))
  t.after(async () => {
    const { rm } = await import("node:fs/promises")
    await rm(dataDir, { recursive: true, force: true })
  })
  const objectStore = new LocalObjectStore(dataDir)
  const evidenceVectorStore = new LocalVectorStore(dataDir, "evidence-vectors.json")
  const memoryVectorStore = new LocalVectorStore(dataDir, "memory-vectors.json")
  const deps = {
    objectStore,
    evidenceVectorStore,
    memoryVectorStore,
    textModel: new MockBedrockTextModel(),
    documentGroupStore: new LocalDocumentGroupStore(dataDir),
    folderPolicyStore: new LocalFolderPolicyStore(dataDir),
    userGroupStore: new LocalUserGroupStore(dataDir),
    groupMembershipStore: new LocalGroupMembershipStore(dataDir),
    localTestIngestAdmissionContext: {
      mode: "local_test_fixture",
      fixtureId: "tenant-artifact-partition"
    },
    // The eligibility seam remains local, while artifact layout deliberately
    // exercises the production tenant namespace rather than the legacy layout.
    legacyGlobalDocumentArtifacts: false
  } as unknown as Dependencies

  const actorA = actor("tenant-a", "owner-a")
  const actorB = actor("tenant-b", "owner-b")
  const sharedDocumentId = "same-document-id"
  const manifestA = await ingestTenantDocument(deps, {
    tenantId: actorA.tenantId!,
    ownerUserId: actorA.userId,
    documentId: sharedDocumentId,
    fileName: "tenant-a.md",
    marker: "alpha-exclusive-evidence"
  })
  const manifestB = await ingestTenantDocument(deps, {
    tenantId: actorB.tenantId!,
    ownerUserId: actorB.userId,
    documentId: sharedDocumentId,
    fileName: "tenant-b.md",
    marker: "bravo-exclusive-evidence"
  })

  assert.equal(manifestA.documentId, manifestB.documentId)
  assert.notEqual(manifestA.manifestObjectKey, manifestB.manifestObjectKey)
  assert.notEqual(manifestA.sourceObjectKey, manifestB.sourceObjectKey)
  assert.notEqual(manifestA.structuredBlocksObjectKey, manifestB.structuredBlocksObjectKey)
  assert.notEqual(manifestA.memoryCardsObjectKey, manifestB.memoryCardsObjectKey)
  const tenantBVectorKeys = new Set(manifestB.vectorKeys)
  assert.equal(manifestA.vectorKeys.some((key) => tenantBVectorKeys.has(key)), false)
  assert.ok(manifestA.manifestObjectKey.startsWith(`${tenantArtifactRoot(actorA.tenantId!)}/`))
  assert.ok(manifestB.manifestObjectKey.startsWith(`${tenantArtifactRoot(actorB.tenantId!)}/`))
  assert.equal(await objectStore.getText(manifestA.sourceObjectKey), "alpha-exclusive-evidence")
  assert.equal(await objectStore.getText(manifestB.sourceObjectKey), "bravo-exclusive-evidence")
  await assert.rejects(() => objectStore.getText(`manifests/${sharedDocumentId}.json`))
  const legacyOnlyDocumentId = "legacy-global-only"
  await objectStore.putText(`manifests/${legacyOnlyDocumentId}.json`, JSON.stringify({
    ...manifestB,
    documentId: legacyOnlyDocumentId,
    manifestObjectKey: `manifests/${legacyOnlyDocumentId}.json`
  }))
  await assert.rejects(
    () => readTenantManifest(deps, actorA.tenantId!, legacyOnlyDocumentId),
    /ENOENT/
  )

  assert.deepEqual(await objectStore.listKeys(tenantManifestPrefix(deps, actorA.tenantId!)), [
    tenantManifestKey(deps, actorA.tenantId!, sharedDocumentId)
  ])
  assert.deepEqual(await objectStore.listKeys(tenantManifestPrefix(deps, actorB.tenantId!)), [
    tenantManifestKey(deps, actorB.tenantId!, sharedDocumentId)
  ])

  const service = new MemoRagService(deps)
  assert.deepEqual((await service.listDocuments(actorA)).map((item) => item.fileName), ["tenant-a.md"])
  assert.deepEqual((await service.listDocuments(actorB)).map((item) => item.fileName), ["tenant-b.md"])
  assert.deepEqual(await service.getDocumentExtractedText(actorA, sharedDocumentId), {
    text: "alpha-exclusive-evidence",
    fileName: "tenant-a.md"
  })
  assert.deepEqual(await service.getDocumentExtractedText(actorB, sharedDocumentId), {
    text: "bravo-exclusive-evidence",
    fileName: "tenant-b.md"
  })

  const resultA = await searchRag(deps, { query: "alpha-exclusive-evidence", topK: 5 }, actorA)
  const resultB = await searchRag(deps, { query: "bravo-exclusive-evidence", topK: 5 }, actorB)
  const resultAAfterTenantB = await searchRag(deps, { query: "alpha-exclusive-evidence", topK: 5 }, actorA)
  assert.deepEqual(resultA.results.map((item) => item.fileName), ["tenant-a.md"])
  assert.deepEqual(resultB.results.map((item) => item.fileName), ["tenant-b.md"])
  assert.deepEqual(resultAAfterTenantB.results.map((item) => item.fileName), ["tenant-a.md"])
  assert.equal(resultA.results.some((item) => item.text.includes("bravo-exclusive-evidence")), false)
  assert.equal(resultB.results.some((item) => item.text.includes("alpha-exclusive-evidence")), false)

  const tenantAVectors = await evidenceVectorStore.query([1, 0, 0], 20, { tenantId: actorA.tenantId })
  const tenantBVectors = await evidenceVectorStore.query([1, 0, 0], 20, { tenantId: actorB.tenantId })
  assert.ok(tenantAVectors.length > 0)
  assert.ok(tenantBVectors.length > 0)
  assert.equal(tenantAVectors.every((item) => item.metadata.tenantId === actorA.tenantId), true)
  assert.equal(tenantBVectors.every((item) => item.metadata.tenantId === actorB.tenantId), true)
})

async function ingestTenantDocument(deps: Dependencies, input: {
  tenantId: string
  ownerUserId: string
  documentId: string
  fileName: string
  marker: string
}) {
  const admissionContext: LocalTestFixtureAdmissionContext = {
    mode: "local_test_fixture",
    fixtureId: `fixture-${input.tenantId}`,
    tenantId: input.tenantId,
    ownerUserId: input.ownerUserId
  }
  return runIngestPipeline(deps, {
    fileName: input.fileName,
    text: input.marker,
    structuredBlocks: [{ id: "block-1", kind: "text", text: input.marker }],
    admissionContext,
    artifactIdOverride: input.documentId
  }, async (): Promise<MemoryCard[]> => [{
    id: "memory-1",
    level: "document",
    summary: input.marker,
    keywords: [input.marker],
    likelyQuestions: [],
    constraints: [],
    text: input.marker
  }])
}

function actor(tenantId: string, userId: string): AppUser {
  return {
    userId,
    tenantId,
    accountStatus: "active",
    cognitoGroups: ["CHAT_USER"]
  }
}
