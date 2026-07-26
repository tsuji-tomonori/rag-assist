import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalVectorStore } from "../adapters/local-vector-store.js"
import { MockBedrockTextModel } from "../adapters/mock-bedrock.js"
import { createDependencies, type Dependencies } from "../dependencies.js"
import type { MemoryCard } from "../types.js"
import { MemoRagService } from "./memorag-service.js"

test("FR-020 public ingest persists document, section, and concept memory with raw-evidence trace metadata", async (t) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-multi-abstraction-"))
  t.after(() => rm(dataDir, { recursive: true, force: true }))
  const objectStore = new LocalObjectStore(dataDir)
  const memoryVectorStore = new LocalVectorStore(dataDir, "memory-vectors.json")
  const evidenceVectorStore = new LocalVectorStore(dataDir, "evidence-vectors.json")
  const deps: Dependencies = {
    ...createDependencies(),
    objectStore,
    benchmarkArtifactStore: objectStore,
    memoryVectorStore,
    evidenceVectorStore,
    textModel: new MockBedrockTextModel(),
    localTestIngestAdmissionContext: {
      mode: "local_test_fixture",
      fixtureId: "fr-020-multi-abstraction",
      tenantId: "tenant-fr-020",
      ownerUserId: "owner-fr-020"
    }
  }
  const service = new MemoRagService(deps)

  const manifest = await service.ingest({
    fileName: "operations-handbook.md",
    text: [
      "# Incident response",
      "Incident response defines triage and escalation for service incidents.",
      "## Escalation policy",
      "Escalation policy assigns an incident owner and records the decision rationale.",
      "## Recovery review",
      "Recovery review confirms follow-up actions and preserves the source evidence."
    ].join("\n\n"),
    metadata: {
      source: "operations-handbook",
      docType: "policy",
      department: "reliability"
    }
  })

  assert.ok(manifest.memoryCardsObjectKey)
  const ledger = JSON.parse(await objectStore.getText(manifest.memoryCardsObjectKey)) as {
    memoryCards?: MemoryCard[]
  }
  const cards = ledger.memoryCards ?? []
  assert.deepEqual(new Set(cards.map((card) => card.level)), new Set(["document", "section", "concept"]))

  const rawChunkIds = new Set(manifest.chunks?.map((chunk) => chunk.id) ?? [])
  assert.ok(rawChunkIds.size > 0)
  assert.ok(cards.every((card) => (card.sourceChunkIds?.length ?? 0) > 0))
  assert.ok(cards.every((card) => card.sourceChunkIds?.every((chunkId) => rawChunkIds.has(chunkId))))
  assert.ok(cards.filter((card) => card.level === "section").every((card) => (card.sectionPath?.length ?? 0) > 0))

  const memoryRecords = await memoryVectorStore.getByKeys(manifest.memoryVectorKeys ?? [])
  assert.equal(memoryRecords.length, cards.length)
  assert.ok(memoryRecords.every((record) => record.metadata.kind === "memory"))
  assert.ok(memoryRecords.every((record) => record.metadata.tenantId === "tenant-fr-020"))
  assert.ok(memoryRecords.every((record) => record.metadata.source === "operations-handbook"))
  assert.ok(memoryRecords.every((record) => record.metadata.docType === "policy"))
  assert.ok(memoryRecords.every((record) => record.metadata.department === "reliability"))
  assert.ok(memoryRecords.every((record) => Array.isArray(record.metadata.sourceChunkIds)))
  assert.ok(memoryRecords.every((record) => record.metadata.securityEnvelope?.tenantId === "tenant-fr-020"))
  assert.ok(memoryRecords.every((record) => record.metadata.securityEnvelope?.documentId === manifest.documentId))
  assert.ok(memoryRecords.every((record) => record.metadata.securityEnvelope?.documentVersion === manifest.documentVersion))
  assert.ok(memoryRecords.every((record) => record.metadata.securityEnvelope?.authorizationRef.id.length))
  assert.ok(memoryRecords.every((record) => record.metadata.securityEnvelope?.sourceLocator.sourceChunkIds?.every((chunkId) => rawChunkIds.has(chunkId))))

  const evidenceRecords = await evidenceVectorStore.getByKeys(manifest.vectorKeys.filter((key) => !manifest.memoryVectorKeys?.includes(key)))
  assert.ok(evidenceRecords.length > 0)
  assert.ok(evidenceRecords.every((record) => record.metadata.kind === "chunk"))
  assert.ok(evidenceRecords.every((record) => record.metadata.securityEnvelope?.tenantId === "tenant-fr-020"))
  assert.ok(evidenceRecords.every((record) => record.metadata.securityEnvelope?.documentId === manifest.documentId))
  assert.ok(evidenceRecords.every((record) => record.metadata.securityEnvelope?.documentVersion === manifest.documentVersion))
  assert.ok(evidenceRecords.every((record) => record.metadata.securityEnvelope?.authorizationRef.id.length))
  assert.ok(evidenceRecords.every((record) => record.metadata.sourceLocation !== undefined))
  assert.ok(evidenceRecords.every((record) => (
    JSON.stringify(record.metadata.securityEnvelope?.sourceLocator) === JSON.stringify(record.metadata.sourceLocation)
  )))
})
