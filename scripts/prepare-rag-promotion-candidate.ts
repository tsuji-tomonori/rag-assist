import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  evaluateRagQualityPolicy,
  RAG_QUALITY_PROVENANCE_DIMENSIONS,
  RAG_REQUIRED_SIGNAL_IDS,
  type RagQualityObservation,
  type RagQualityPolicyProfile,
  type RagQualityProvenanceDimension
} from "../packages/contract/src/rag-quality-control.js"

export type RagPromotionPreparation = {
  ready: boolean
  policyId: string
  policyVersion: string
  matchedObservationCount: number
  ignoredFileCount: number
  missingObservations: string[]
}

export async function prepareRagPromotionCandidate(input: {
  policyPath: string
  observationsDirectory: string
  outputDirectory: string
}): Promise<RagPromotionPreparation> {
  const policy = JSON.parse(await readFile(input.policyPath, "utf-8")) as RagQualityPolicyProfile
  assertApprovedPolicy(policy)

  const files = await listJsonFiles(input.observationsDirectory)
  const latest = new Map<string, RagQualityObservation>()
  let ignoredFileCount = 0
  for (const file of files) {
    const observation = await readMatchingObservation(file, policy)
    if (!observation) {
      ignoredFileCount += 1
      continue
    }
    const key = observationKey(observation.signalId, observation.slice)
    const current = latest.get(key)
    if (!current || current.observedAt < observation.observedAt) latest.set(key, observation)
  }

  const requiredKeys = RAG_REQUIRED_SIGNAL_IDS.flatMap((signalId) => (
    policy.requiredSlices[signalId] ?? ["overall"]
  ).map((slice) => observationKey(signalId, slice)))
  const missingObservations = requiredKeys.filter((key) => !latest.has(key)).map(displayObservationKey)
  const observations = requiredKeys.flatMap((key) => {
    const observation = latest.get(key)
    return observation ? [observation] : []
  })
  const result: RagPromotionPreparation = {
    ready: missingObservations.length === 0,
    policyId: policy.profileId,
    policyVersion: policy.version,
    matchedObservationCount: observations.length,
    ignoredFileCount,
    missingObservations
  }

  await mkdir(input.outputDirectory, { recursive: true })
  await Promise.all([
    writeFile(path.join(input.outputDirectory, "policy.json"), `${JSON.stringify(policy, null, 2)}\n`, "utf-8"),
    writeFile(path.join(input.outputDirectory, "observations.json"), `${JSON.stringify(observations, null, 2)}\n`, "utf-8"),
    writeFile(path.join(input.outputDirectory, "preparation.json"), `${JSON.stringify(result, null, 2)}\n`, "utf-8")
  ])
  return result
}

function assertApprovedPolicy(policy: RagQualityPolicyProfile): void {
  const serialized = JSON.stringify(policy)
  if (/__[A-Z0-9_]+__/.test(serialized)) throw new Error("Approved RAG quality policy contains unresolved placeholders.")
  const decision = evaluateRagQualityPolicy(policy, [], new Date().toISOString())
  const policyErrors = new Set([
    "policy_invalid",
    "missing_threshold",
    "duplicate_threshold",
    "threshold_unapproved"
  ])
  if (decision.results.some((result) => policyErrors.has(result.reason))) {
    throw new Error("RAG quality policy is invalid, incomplete, or unapproved.")
  }
}

async function readMatchingObservation(
  file: string,
  policy: RagQualityPolicyProfile
): Promise<RagQualityObservation | undefined> {
  try {
    const candidate = JSON.parse(await readFile(file, "utf-8")) as RagQualityObservation
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return
    if (
      candidate.profileId !== policy.profileId
      || candidate.profileVersion !== policy.version
      || candidate.workloadProfileVersion !== policy.workloadProfileVersion
      || candidate.runtimeProfileVersion !== policy.runtimeProfileVersion
      || candidate.priceCatalogVersion !== policy.priceCatalogVersion
      || !RAG_REQUIRED_SIGNAL_IDS.includes(candidate.signalId)
      || !candidate.slice?.trim()
      || !Number.isFinite(Date.parse(candidate.observedAt))
      || !matchingProvenance(candidate, policy)
    ) return
    return candidate
  } catch {
    return
  }
}

function matchingProvenance(
  observation: RagQualityObservation,
  policy: RagQualityPolicyProfile
): boolean {
  const source = observation.source
  if (
    !source?.producerVersion?.trim()
    || !Array.isArray(source.artifactTypes)
    || source.artifactTypes.length === 0
    || !Array.isArray(source.artifactIds)
    || source.artifactIds.length === 0
    || !Array.isArray(source.missingVersionDimensions)
    || source.missingVersionDimensions.length > 0
  ) return false
  const expected: Readonly<Record<RagQualityProvenanceDimension, string>> = {
    dataset: policy.evidenceVersions.dataset,
    model: policy.evidenceVersions.model,
    index: policy.evidenceVersions.index,
    prompt: policy.evidenceVersions.prompt,
    pipeline: policy.evidenceVersions.pipeline,
    parser: policy.evidenceVersions.parser,
    chunker: policy.evidenceVersions.chunker,
    runtime: policy.runtimeProfileVersion,
    workload: policy.workloadProfileVersion,
    price: policy.priceCatalogVersion
  }
  return RAG_QUALITY_PROVENANCE_DIMENSIONS.every((dimension) => {
    const values = source.versionDimensions?.[dimension]
    return Array.isArray(values) && values.length === 1 && values[0] === expected[dimension]
  })
}

async function listJsonFiles(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true })
    const files = await Promise.all(entries.map(async (entry) => {
      const child = path.join(directory, entry.name)
      if (entry.isDirectory()) return listJsonFiles(child)
      return entry.isFile() && entry.name.endsWith(".json") ? [child] : []
    }))
    return files.flat().sort()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
}

function observationKey(signalId: string, slice: string): string {
  return `${signalId}\u0000${slice}`
}

function displayObservationKey(key: string): string {
  const [signalId, slice] = key.split("\u0000")
  return `${signalId}[${slice}]`
}

function argumentValue(argv: string[], key: string): string {
  const index = argv.indexOf(key)
  const value = index >= 0 ? argv[index + 1] : undefined
  if (!value || value.startsWith("--")) throw new Error(`${key} is required`)
  return value
}

async function main(argv: string[]): Promise<void> {
  const result = await prepareRagPromotionCandidate({
    policyPath: argumentValue(argv, "--policy"),
    observationsDirectory: argumentValue(argv, "--observations-dir"),
    outputDirectory: argumentValue(argv, "--output-dir")
  })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
