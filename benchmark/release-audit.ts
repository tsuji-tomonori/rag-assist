import { createHash } from "node:crypto"
import { readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { BenchmarkRunSchema } from "@memorag-mvp/contract"

export const ragReleaseAuditVersion = "rag-release-audit-v1" as const

export type DatasetSpecificBranchFinding = {
  ruleId: "dataset_expected_field_in_runtime" | "dataset_identity_branch_in_runtime"
  file: string
  line: number
  excerpt: string
}

export type ArtifactManifestFinding = {
  ruleId: string
  detail: string
}

export type RagReleaseAudit = {
  schemaVersion: 1
  auditVersion: typeof ragReleaseAuditVersion
  auditId: string
  observedAt: string
  sourceRoots: string[]
  sourceDigest: string
  summaryDigest: string
  datasetSpecificBranchFindings: DatasetSpecificBranchFinding[]
  artifactManifestFindings: ArtifactManifestFinding[]
  metrics: {
    datasetSpecificBranchCount: number
    artifactManifestMismatchCount: number
  }
}

const expectedRuntimeField = /\b(?:expectedContains|expectedRegex|expectedFiles|expectedFileNames|expectedDocumentIds|expectedPages|expectedFactSlots|expectedAnswer|referenceAnswer)\b/g
const datasetIdentityBranch = /\b(?:if|else\s+if|case)\b[^\n]*(?:benchmarkSuiteId|suiteId|datasetVersion|caseId)[^\n]*(?:===|==|case\s+)[^\n]*["'`][A-Za-z0-9_.:/-]+["'`]/g
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"])

export async function buildRagReleaseAudit(input: {
  repoRoot: string
  sourceRoots: string[]
  summary: unknown
  validateArtifacts?: boolean
}): Promise<RagReleaseAudit> {
  const roots = uniqueSorted(input.sourceRoots.map((root) => normalizedRelativePath(input.repoRoot, root)))
  if (roots.length === 0) throw new Error("At least one --source-root is required")
  const sourceFiles = (await Promise.all(roots.map((root) => listRuntimeSourceFiles(input.repoRoot, root)))).flat().sort()
  const scanned = await Promise.all(sourceFiles.map(async (file) => ({
    file,
    text: await readFile(path.resolve(input.repoRoot, file), "utf-8")
  })))
  const datasetSpecificBranchFindings = scanned.flatMap(({ file, text }) => scanRuntimeSource(file, text))
    .sort(compareSourceFindings)
  const artifactManifestFindings = (input.validateArtifacts === false ? [] : validateArtifactManifest(input.summary))
    .sort((left, right) => left.ruleId.localeCompare(right.ruleId) || left.detail.localeCompare(right.detail))
  const observedAt = normalizedTimestamp((input.summary as { generatedAt?: unknown } | undefined)?.generatedAt)
  const sourceDigest = sha256(scanned.map(({ file, text }) => `${file}\0${sha256(text)}`).join("\n"))
  const summaryDigest = sha256(canonicalJson(input.summary))
  const identity = canonicalJson({
    auditVersion: ragReleaseAuditVersion,
    observedAt,
    roots,
    sourceDigest,
    summaryDigest,
    datasetSpecificBranchFindings,
    artifactManifestFindings
  })
  return {
    schemaVersion: 1,
    auditVersion: ragReleaseAuditVersion,
    auditId: `sha256:${sha256(identity)}`,
    observedAt,
    sourceRoots: roots,
    sourceDigest: `sha256:${sourceDigest}`,
    summaryDigest: `sha256:${summaryDigest}`,
    datasetSpecificBranchFindings,
    artifactManifestFindings,
    metrics: {
      datasetSpecificBranchCount: datasetSpecificBranchFindings.length,
      artifactManifestMismatchCount: artifactManifestFindings.length
    }
  }
}

export function scanRuntimeSource(file: string, text: string): DatasetSpecificBranchFinding[] {
  if (isExcludedRuntimeSource(file)) return []
  const findings: DatasetSpecificBranchFinding[] = []
  for (const [ruleId, pattern] of [
    ["dataset_expected_field_in_runtime", expectedRuntimeField],
    ["dataset_identity_branch_in_runtime", datasetIdentityBranch]
  ] as const) {
    pattern.lastIndex = 0
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0
      const line = 1 + countNewlines(text.slice(0, index))
      const excerpt = text.slice(text.lastIndexOf("\n", index) + 1, nextNewline(text, index)).trim().slice(0, 240)
      findings.push({ ruleId, file, line, excerpt })
    }
  }
  return findings
}

export function validateArtifactManifest(summary: unknown): ArtifactManifestFinding[] {
  const findings: ArtifactManifestFinding[] = []
  const parsed = BenchmarkRunSchema.safeParse(summary)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      findings.push({ ruleId: "artifact_contract_invalid", detail: `${issue.path.join(".") || "root"}: ${issue.message}` })
    }
    return findings
  }
  const artifact = parsed.data
  const raw = summary as Record<string, unknown>
  const datasetVersion = artifact.suite.datasetSource.datasetVersion?.trim()
  if (!datasetVersion) findings.push({ ruleId: "dataset_version_missing", detail: "suite.datasetSource.datasetVersion is required" })
  if (!artifact.suite.datasetSource.conversionVersion?.trim()) {
    findings.push({ ruleId: "dataset_conversion_version_missing", detail: "suite.datasetSource.conversionVersion is required" })
  }
  if (artifact.candidateConfig.benchmarkSuiteId !== artifact.suite.suiteId) {
    findings.push({ ruleId: "candidate_suite_mismatch", detail: `${artifact.candidateConfig.benchmarkSuiteId} != ${artifact.suite.suiteId}` })
  }
  if (artifact.candidateConfig.runner !== artifact.suite.runner) {
    findings.push({ ruleId: "candidate_runner_mismatch", detail: `${artifact.candidateConfig.runner} != ${artifact.suite.runner}` })
  }
  for (const field of [
    "modelId",
    "runtimeProfileVersion",
    "workloadProfileVersion",
    "corpusProfileVersion",
    "aclDistributionVersion",
    "documentSizeProfileVersion",
    "dependencyLatencyProfileVersion",
    "priceCatalogVersion",
    "indexVersion",
    "promptVersion",
    "pipelineVersion",
    "parserVersion",
    "chunkerVersion"
  ] as const) {
    if (!artifact.candidateConfig[field]?.trim()) findings.push({ ruleId: `${field}_missing`, detail: `candidateConfig.${field} is required` })
  }
  const workloadConcurrency = artifact.candidateConfig.workloadConcurrency
  if (typeof workloadConcurrency !== "number" || !Number.isInteger(workloadConcurrency) || workloadConcurrency <= 0) {
    findings.push({ ruleId: "workloadConcurrency_missing", detail: "candidateConfig.workloadConcurrency must be a positive integer" })
  }
  if (artifact.suite.answerPolicy.runtimeDatasetBranchAllowed !== false || artifact.suite.answerPolicy.normalAnswerPolicySeparated !== true) {
    findings.push({ ruleId: "answer_policy_isolation_invalid", detail: "benchmark answer policy does not preserve product-runtime isolation" })
  }
  const succeededPrepare = artifact.datasetPrepareRuns.filter((run) => run.status === "succeeded")
  if (succeededPrepare.length !== 1) {
    findings.push({ ruleId: "dataset_prepare_run_count_invalid", detail: `expected 1 succeeded prepare run, got ${succeededPrepare.length}` })
  }
  const prepare = succeededPrepare[0]
  if (prepare) {
    if (prepare.suiteId !== artifact.suite.suiteId) {
      findings.push({ ruleId: "prepare_suite_mismatch", detail: `${prepare.suiteId} != ${artifact.suite.suiteId}` })
    }
    if (canonicalJson(prepare.datasetSource) !== canonicalJson(artifact.suite.datasetSource)) {
      findings.push({ ruleId: "prepare_dataset_source_mismatch", detail: "dataset prepare source does not match suite dataset source" })
    }
    if (canonicalJson(prepare.seedManifest) !== canonicalJson(artifact.seedManifest)) {
      findings.push({ ruleId: "seed_manifest_mismatch", detail: "top-level and dataset-prepare seed manifests differ" })
    }
    if (canonicalJson(prepare.skipManifest) !== canonicalJson(artifact.skipManifest)) {
      findings.push({ ruleId: "skip_manifest_mismatch", detail: "top-level and dataset-prepare skip manifests differ" })
    }
  }
  const caseIds = artifact.caseResults.map((item) => item.caseId?.trim()).filter((value): value is string => Boolean(value))
  if (caseIds.length !== artifact.caseResults.length) {
    findings.push({ ruleId: "case_identity_missing", detail: `${artifact.caseResults.length - caseIds.length} case result(s) have no caseId` })
  }
  if (new Set(caseIds).size !== caseIds.length) {
    findings.push({ ruleId: "case_identity_duplicate", detail: "case result IDs are not unique" })
  }
  for (const item of artifact.caseResults) {
    const caseId = item.caseId?.trim() || "unknown-case"
    if (!item.slice) findings.push({ ruleId: "case_slice_identity_missing", detail: `${caseId} has no question/tenant-role/OCR/language/multi-evidence/answerability/severity slice` })
    if (!Array.isArray(item.claims) || !Array.isArray(item.citations)) {
      findings.push({ ruleId: "claim_citation_evidence_missing", detail: `${caseId} has no claim-level support/citation evidence` })
    } else {
      const claimIds = new Set(item.claims.map((claim) => claim.claimId))
      const citationIds = new Set(item.citations.map((citation) => citation.citationId))
      if (claimIds.size !== item.claims.length || citationIds.size !== item.citations.length) {
        findings.push({ ruleId: "claim_citation_identity_duplicate", detail: `${caseId} has duplicate claim or citation IDs` })
      }
      for (const claim of item.claims) {
        if (claim.citationIds.some((citationId) => !citationIds.has(citationId))) {
          findings.push({ ruleId: "claim_citation_reference_invalid", detail: `${caseId}:${claim.claimId} references an unknown citation` })
        }
      }
      for (const citation of item.citations) {
        if (citation.claimIds.some((claimId) => !claimIds.has(claimId))) {
          findings.push({ ruleId: "citation_claim_reference_invalid", detail: `${caseId}:${citation.citationId} references an unknown claim` })
        }
      }
    }
    if (["agent", "conversation", "async_agent"].includes(artifact.suite.runner) && !item.task.scenario) {
      findings.push({ ruleId: "business_scenario_evidence_missing", detail: `${caseId} has no actor/goal/success/handoff/severity scenario` })
    }
    if (!item.latency.stages || item.latency.stages.length === 0) {
      findings.push({ ruleId: "stage_latency_evidence_missing", detail: `${caseId} has no endpoint/stage latency outcome` })
    }
  }
  const total = typeof raw.total === "number" ? raw.total : typeof raw.totalTurns === "number" ? raw.totalTurns : undefined
  if (total === undefined || !Number.isInteger(total) || total !== artifact.caseResults.length) {
    findings.push({ ruleId: "case_count_mismatch", detail: `summary total ${String(total)} != caseResults ${artifact.caseResults.length}` })
  }
  const seedNames = artifact.seedManifest.map((item) => item.fileName)
  if (new Set(seedNames).size !== seedNames.length) {
    findings.push({ ruleId: "seed_identity_duplicate", detail: "seed manifest file names are not unique" })
  }
  for (const seed of artifact.seedManifest) {
    if (!seed.sourceHash?.trim() || !seed.ingestSignature?.trim()) {
      findings.push({ ruleId: "seed_integrity_identity_missing", detail: `${seed.fileName} lacks sourceHash or ingestSignature` })
    }
  }
  return findings
}

async function listRuntimeSourceFiles(repoRoot: string, root: string): Promise<string[]> {
  const absoluteRoot = path.resolve(repoRoot, root)
  const entries = await readdir(absoluteRoot, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && sourceExtensions.has(path.extname(entry.name)))
    .map((entry) => normalizedRelativePath(repoRoot, path.join(entry.parentPath, entry.name)))
    .filter((file) => !isExcludedRuntimeSource(file))
}

function isExcludedRuntimeSource(file: string): boolean {
  return /(?:^|\/)(?:node_modules|dist|coverage|generated|lambda-dist)(?:\/|$)/.test(file)
    || /(?:\.test|\.spec)\.[cm]?[jt]sx?$/.test(file)
    || /(?:^|\/)benchmark(?:\/|$)/.test(file)
    || /(?:^|\/)routes\/benchmark-(?:routes|seed)\.[cm]?[jt]sx?$/.test(file)
}

function normalizedRelativePath(repoRoot: string, file: string): string {
  const absolute = path.isAbsolute(file) ? file : path.resolve(repoRoot, file)
  const relative = path.relative(repoRoot, absolute).split(path.sep).join("/")
  if (relative === ".." || relative.startsWith("../")) throw new Error(`Source root escapes repository: ${file}`)
  return relative || "."
}

function normalizedTimestamp(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return "1970-01-01T00:00:00.000Z"
  return new Date(value).toISOString()
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value))
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, sortJson(item)]))
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

function countNewlines(value: string): number {
  return value.match(/\n/g)?.length ?? 0
}

function nextNewline(value: string, index: number): number {
  const found = value.indexOf("\n", index)
  return found === -1 ? value.length : found
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort()
}

function compareSourceFindings(left: DatasetSpecificBranchFinding, right: DatasetSpecificBranchFinding): number {
  return left.file.localeCompare(right.file) || left.line - right.line || left.ruleId.localeCompare(right.ruleId) || left.excerpt.localeCompare(right.excerpt)
}

async function main(argv: string[]): Promise<void> {
  const repoRoot = path.resolve(argumentValue(argv, "--repo-root") ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."))
  const sourceAuditOnly = argv.includes("--source-audit-only")
  const summaryPath = sourceAuditOnly ? undefined : requiredArgument(argv, "--summary")
  const outputPath = requiredArgument(argv, "--output")
  const sourceRoots = argumentValues(argv, "--source-root")
  const summary = summaryPath
    ? JSON.parse(await readFile(path.resolve(repoRoot, summaryPath), "utf-8")) as unknown
    : { generatedAt: "1970-01-01T00:00:00.000Z", purpose: "runtime-source-audit" }
  const audit = await buildRagReleaseAudit({ repoRoot, sourceRoots, summary, validateArtifacts: !sourceAuditOnly })
  await writeFile(path.resolve(repoRoot, outputPath), `${JSON.stringify(audit, null, 2)}\n`, "utf-8")
  process.stdout.write(`${JSON.stringify({ auditId: audit.auditId, metrics: audit.metrics })}\n`)
  if (!argv.includes("--report-only") && (audit.metrics.datasetSpecificBranchCount > 0 || audit.metrics.artifactManifestMismatchCount > 0)) {
    process.exitCode = 1
  }
}

function argumentValue(argv: string[], key: string): string | undefined {
  const index = argv.indexOf(key)
  const value = index >= 0 ? argv[index + 1] : undefined
  return value && !value.startsWith("--") ? value : undefined
}

function argumentValues(argv: string[], key: string): string[] {
  const values: string[] = []
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== key) continue
    const value = argv[index + 1]
    if (value && !value.startsWith("--")) values.push(value)
  }
  return values
}

function requiredArgument(argv: string[], key: string): string {
  const value = argumentValue(argv, key)
  if (!value) throw new Error(`${key} is required`)
  return value
}

const entryPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined
if (entryPath === import.meta.url) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 2
  })
}
