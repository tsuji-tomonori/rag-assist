import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

import type {
  RagQualityObservation,
  RagQualityPolicyProfile
} from "../packages/contract/src/rag-quality-control.js"
import { buildDevRagQualityPolicy } from "./generate-dev-rag-quality-policy.js"
import { prepareRagPromotionCandidate } from "./prepare-rag-promotion-candidate.js"

test("candidate preparation defers without inventing missing observations", async () => {
  const fixture = await createFixture()
  try {
    const result = await prepareRagPromotionCandidate(fixture)
    const observations = JSON.parse(await readFile(path.join(fixture.outputDirectory, "observations.json"), "utf-8"))

    assert.equal(result.ready, false)
    assert.equal(result.matchedObservationCount, 0)
    assert.equal(result.missingObservations.length, buildDevRagQualityPolicy().gates.length)
    assert.deepEqual(observations, [])
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test("candidate preparation selects the latest exact-profile observation for every gate", async () => {
  const fixture = await createFixture()
  const policy = buildDevRagQualityPolicy()
  try {
    await Promise.all(policy.gates.map(async (gate, index) => {
      const observation = buildObservation(policy, gate.signalId, gate.slice, "2026-07-16T00:05:00.000Z")
      await writeFile(
        path.join(fixture.observationsDirectory, `${String(index).padStart(3, "0")}.json`),
        JSON.stringify(observation),
        "utf-8"
      )
    }))
    const older = buildObservation(policy, policy.gates[0]!.signalId, policy.gates[0]!.slice, "2026-07-16T00:00:00.000Z")
    older.value = 999
    await writeFile(path.join(fixture.observationsDirectory, "older.json"), JSON.stringify(older), "utf-8")
    const mismatched = buildObservation(policy, policy.gates[1]!.signalId, policy.gates[1]!.slice, "2026-07-16T00:10:00.000Z")
    mismatched.runtimeProfileVersion = "other-runtime"
    await writeFile(path.join(fixture.observationsDirectory, "mismatched.json"), JSON.stringify(mismatched), "utf-8")

    const result = await prepareRagPromotionCandidate(fixture)
    const observations = JSON.parse(
      await readFile(path.join(fixture.outputDirectory, "observations.json"), "utf-8")
    ) as RagQualityObservation[]

    assert.equal(result.ready, true)
    assert.equal(result.matchedObservationCount, policy.gates.length)
    assert.equal(result.ignoredFileCount, 1)
    assert.equal(observations[0]!.observedAt, "2026-07-16T00:05:00.000Z")
    assert.notEqual(observations[0]!.value, 999)
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test("candidate preparation rejects unresolved policy placeholders", async () => {
  const fixture = await createFixture()
  const policy = buildDevRagQualityPolicy()
  policy.runtimeProfileVersion = "__RAG_RUNTIME_PROFILE_VERSION__"
  await writeFile(fixture.policyPath, JSON.stringify(policy), "utf-8")
  try {
    await assert.rejects(
      prepareRagPromotionCandidate(fixture),
      /unresolved placeholders/
    )
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

async function createFixture(): Promise<{
  root: string
  policyPath: string
  observationsDirectory: string
  outputDirectory: string
}> {
  const root = await mkdtemp(path.join(tmpdir(), "memorag-promotion-"))
  const policyPath = path.join(root, "policy.json")
  const observationsDirectory = path.join(root, "observations")
  const outputDirectory = path.join(root, "output")
  await mkdir(observationsDirectory)
  await writeFile(policyPath, JSON.stringify(buildDevRagQualityPolicy()), "utf-8")
  return { root, policyPath, observationsDirectory, outputDirectory }
}

function buildObservation(
  policy: RagQualityPolicyProfile,
  signalId: RagQualityObservation["signalId"],
  slice: string,
  observedAt: string
): RagQualityObservation {
  return {
    schemaVersion: 2,
    signalCatalogVersion: policy.signalCatalogVersion,
    profileId: policy.profileId,
    profileVersion: policy.version,
    signalId,
    slice,
    value: 0,
    available: false,
    sampleCount: 0,
    confidence: null,
    observedAt,
    workloadProfileVersion: policy.workloadProfileVersion,
    runtimeProfileVersion: policy.runtimeProfileVersion,
    priceCatalogVersion: policy.priceCatalogVersion,
    source: {
      producerVersion: "test-producer-v1",
      artifactTypes: ["test"],
      artifactIds: ["artifact-1"],
      versionDimensions: {
        dataset: [policy.evidenceVersions.dataset],
        model: [policy.evidenceVersions.model],
        index: [policy.evidenceVersions.index],
        prompt: [policy.evidenceVersions.prompt],
        pipeline: [policy.evidenceVersions.pipeline],
        parser: [policy.evidenceVersions.parser],
        chunker: [policy.evidenceVersions.chunker],
        runtime: [policy.runtimeProfileVersion],
        workload: [policy.workloadProfileVersion],
        price: [policy.priceCatalogVersion]
      },
      missingVersionDimensions: [],
      unavailableReasons: ["test"]
    }
  }
}
