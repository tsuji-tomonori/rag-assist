import assert from "node:assert/strict"
import test from "node:test"
import type { RetrievedVector } from "../types.js"
import { buildFinalEvidenceSet } from "./online/post-retrieval/evidence/final-evidence-set.js"

function chunk(key: string, overrides: Partial<RetrievedVector["metadata"]> = {}): RetrievedVector {
  return {
    key,
    score: 0.91,
    metadata: {
      kind: "chunk",
      documentId: `doc-${key}`,
      documentVersion: "sha256-v3",
      fileName: `${key}.md`,
      chunkId: key,
      text: `evidence ${key}`,
      sectionPath: ["Policy", "Scope"],
      sourceLocation: { pageStart: 2, pageEnd: 2, startChar: 40, endChar: 75, sourceBlockId: `block-${key}` },
      authorityStatus: "authoritative",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      tenantId: "tenant-a",
      lifecycleStatus: "active",
      ragEligibility: "eligible",
      createdAt: "2026-01-01T00:00:00.000Z",
      ...overrides
    }
  }
}

test("FR-073 evidence set preserves topic, role, version, period, locator, and current authorization", () => {
  const evidence = buildFinalEvidenceSet([
    chunk("support"),
    chunk("conflict"),
    chunk("old", { effectiveUntil: "2026-02-01T00:00:00.000Z" }),
    chunk("background", { authorityStatus: "secondary" })
  ], {
    supportingChunkKeys: ["support"],
    conflictingChunkKeys: ["conflict"],
    topicsByChunkKey: new Map([["support", "expense deadline"], ["conflict", "expense deadline"]]),
    asOf: new Date("2026-07-11T00:00:00.000Z"),
    authorizationEvaluatedAt: "2026-07-11T00:00:01.000Z"
  })

  assert.deepEqual(evidence.map((item) => item.evidenceRole), ["supporting", "conflicting", "outdated", "background"])
  assert.equal(evidence[0]?.topic, "expense deadline")
  assert.equal(evidence[0]?.documentVersion, "sha256-v3")
  assert.equal(evidence[0]?.effectiveFrom, "2026-01-01T00:00:00.000Z")
  assert.deepEqual(evidence[0]?.sourceLocator, { pageStart: 2, pageEnd: 2, startChar: 40, endChar: 75, sourceBlockId: "block-support" })
  assert.equal(evidence[0]?.authorizationDecision, "allowed")
  assert.equal(evidence[0]?.authorizationEvaluatedAt, "2026-07-11T00:00:01.000Z")
  assert.equal(evidence[3]?.authorityStatus, "secondary")
})

test("FR-073 unresolved same-scope conflict remains represented instead of being silently dropped", () => {
  const evidence = buildFinalEvidenceSet([chunk("a"), chunk("b")], {
    conflictingChunkKeys: ["a", "b"],
    topicsByChunkKey: new Map([["a", "retention"], ["b", "retention"]]),
    authorizationEvaluatedAt: "2026-07-11T00:00:00.000Z"
  })
  assert.deepEqual(evidence.map((item) => [item.topic, item.evidenceRole]), [
    ["retention", "conflicting"],
    ["retention", "conflicting"]
  ])
})
