import { readFile, writeFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"

import {
  evaluateRagQualityPolicy,
  type RagQualityDecision,
  type RagQualityObservation,
  type RagQualityPolicyProfile
} from "@memorag-mvp/contract/rag-quality-control"

export async function evaluatePromotionFiles(input: {
  policyPath: string
  observationsPath: string
  outputPath?: string
  evaluatedAt?: string
}): Promise<RagQualityDecision> {
  if (!input.policyPath.trim()) throw new Error("A versioned --policy path is required; promotion has no implicit threshold defaults.")
  if (!input.observationsPath.trim()) throw new Error("An --observations path is required; missing signals are not treated as green.")
  const policy = JSON.parse(await readFile(input.policyPath, "utf-8")) as RagQualityPolicyProfile
  const observations = JSON.parse(await readFile(input.observationsPath, "utf-8")) as RagQualityObservation[]
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) throw new Error("The promotion policy artifact must be a JSON object.")
  if (!Array.isArray(observations)) throw new Error("The promotion observations artifact must be a JSON array.")
  const decision = evaluateRagQualityPolicy(policy, observations, input.evaluatedAt)
  if (input.outputPath) await writeFile(input.outputPath, `${JSON.stringify(decision, null, 2)}\n`, "utf-8")
  return decision
}

async function main(argv: string[]): Promise<void> {
  const policyPath = argumentValue(argv, "--policy") ?? process.env.RAG_QUALITY_POLICY_PATH ?? ""
  const observationsPath = argumentValue(argv, "--observations") ?? process.env.RAG_QUALITY_OBSERVATIONS_PATH ?? ""
  const outputPath = argumentValue(argv, "--output")
  const decision = await evaluatePromotionFiles({ policyPath, observationsPath, outputPath })
  process.stdout.write(`${JSON.stringify({
    status: decision.status,
    policyId: decision.policyId,
    policyVersion: decision.policyVersion,
    blockingReasons: decision.blockingReasons,
    criticalViolation: decision.criticalViolation
  })}\n`)
  if (decision.status !== "pass") process.exitCode = 1
}

function argumentValue(argv: string[], key: string): string | undefined {
  const index = argv.indexOf(key)
  const value = index >= 0 ? argv[index + 1] : undefined
  return value && !value.startsWith("--") ? value : undefined
}

const entryPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined
if (entryPath === import.meta.url) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 2
  })
}
