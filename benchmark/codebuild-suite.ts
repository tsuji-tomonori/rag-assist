import { copyFile, mkdir, readFile, rm } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { BenchmarkUseCase } from "@memorag-mvp/contract"

type CodeBuildSuiteManifest = {
  version: 1
  defaults: {
    dataset: string
    output: string
    summary: string
    report: string
  }
  suites: CodeBuildSuite[]
}

type CodeBuildSuite = {
  suiteId: string
  mode: "agent" | "search"
  runner: "agent" | "search" | "conversation"
  dataset: { source: "codebuild-input" | "prepare" | "local"; path?: string }
  corpus?: { dir?: string; suiteId?: string; source?: "local" | "codebuild-bucket"; s3Prefix?: string }
  metadata?: {
    useCase: BenchmarkUseCase
    datasetName?: string
    datasetVersion?: string
    conversionVersion?: string
    evaluatorProfile?: string
  }
  prepare?: {
    script: string
    env?: Record<string, string>
  }
}

type RunnerEnv = NodeJS.ProcessEnv & {
  DATASET: string
  OUTPUT: string
  SUMMARY: string
  REPORT: string
  BENCHMARK_SUITE_ID: string
}

const benchmarkDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(benchmarkDir, "..")
const manifestPath = path.join(benchmarkDir, "suites.codebuild.json")

export async function loadCodeBuildSuiteManifest(): Promise<CodeBuildSuiteManifest> {
  const manifest = JSON.parse(await readFile(manifestPath, "utf-8")) as CodeBuildSuiteManifest
  validateManifest(manifest)
  return manifest
}

export function resolveCodeBuildSuite(manifest: CodeBuildSuiteManifest, suiteId: string): CodeBuildSuite {
  const suite = manifest.suites.find((candidate) => candidate.suiteId === suiteId)
  if (!suite) throw new Error(`Unknown benchmark suite in ${path.relative(repoRoot, manifestPath)}: ${suiteId}`)
  return suite
}

export function createRunnerEnv(manifest: CodeBuildSuiteManifest, suite: CodeBuildSuite, env: NodeJS.ProcessEnv): RunnerEnv {
  const dataset = env.DATASET ?? manifest.defaults.dataset
  const output = env.OUTPUT ?? manifest.defaults.output
  const summary = env.SUMMARY ?? manifest.defaults.summary
  const report = env.REPORT ?? manifest.defaults.report
  const runnerEnv: RunnerEnv = {
    ...env,
    DATASET: dataset,
    OUTPUT: output,
    SUMMARY: summary,
    REPORT: report,
    BENCHMARK_SUITE_ID: suite.suiteId
  }
  if (suite.corpus?.dir) runnerEnv.BENCHMARK_CORPUS_DIR = suite.corpus.dir
  if (suite.corpus?.suiteId) runnerEnv.BENCHMARK_CORPUS_SUITE_ID = suite.corpus.suiteId
  if (suite.metadata?.useCase) runnerEnv.BENCHMARK_USE_CASE = suite.metadata.useCase
  if (suite.metadata?.datasetName) runnerEnv.BENCHMARK_DATASET_NAME = suite.metadata.datasetName
  if (suite.metadata?.datasetVersion) runnerEnv.BENCHMARK_DATASET_VERSION = suite.metadata.datasetVersion
  if (suite.metadata?.conversionVersion) runnerEnv.BENCHMARK_DATASET_CONVERSION_VERSION = suite.metadata.conversionVersion
  if (suite.metadata?.evaluatorProfile) runnerEnv.EVALUATOR_PROFILE = suite.metadata.evaluatorProfile
  runnerEnv.BENCHMARK_DATASET_SOURCE_TYPE = suite.dataset.source
  return suite.prepare?.env ? withTemplateEnv(runnerEnv, suite.prepare.env) : runnerEnv
}

export async function prepareCodeBuildSuite(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const manifest = await loadCodeBuildSuiteManifest()
  const suite = resolveCodeBuildSuite(manifest, env.SUITE_ID ?? env.BENCHMARK_SUITE_ID ?? "standard-agent-v1")
  const runnerEnv = createRunnerEnv(manifest, suite, env)

  if (env.MODE && env.MODE !== suite.mode) {
    throw new Error(`Suite ${suite.suiteId} supports mode ${suite.mode}, but MODE=${env.MODE} was requested`)
  }

  if (suite.prepare) {
    runNpmScript(suite.prepare.script, runnerEnv)
    return
  }

  if (suite.dataset.source === "codebuild-input") {
    await copyCodeBuildInputDataset(runnerEnv)
    await copyCodeBuildInputCorpus(suite, runnerEnv)
    return
  }

  if (suite.dataset.source === "local") {
    if (!suite.dataset.path) throw new Error(`Suite ${suite.suiteId} uses local dataset without path`)
    await copyFile(path.resolve(repoRoot, suite.dataset.path), path.resolve(repoRoot, runnerEnv.DATASET))
    return
  }

  throw new Error(`Suite ${suite.suiteId} declares dataset source ${suite.dataset.source} without prepare script`)
}

export async function runCodeBuildSuite(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const manifest = await loadCodeBuildSuiteManifest()
  const suite = resolveCodeBuildSuite(manifest, env.SUITE_ID ?? env.BENCHMARK_SUITE_ID ?? "standard-agent-v1")
  const runnerEnv = createRunnerEnv(manifest, suite, env)

  const script = suite.runner === "search"
    ? "start:search"
    : suite.runner === "conversation"
      ? "start:conversation"
      : "start"
  runNpmScript(script, runnerEnv)
}

async function copyCodeBuildInputDataset(env: RunnerEnv): Promise<void> {
  if (env.DATASET_S3_URI) {
    runCommand("aws", ["s3", "cp", env.DATASET_S3_URI, env.DATASET], env)
    return
  }
  throw new Error("DATASET_S3_URI is required for a codebuild-input benchmark dataset")
}

async function copyCodeBuildInputCorpus(suite: CodeBuildSuite, env: RunnerEnv): Promise<void> {
  if (suite.corpus?.source !== "codebuild-bucket") return
  if (!suite.corpus.dir) throw new Error(`Suite ${suite.suiteId} uses codebuild-bucket corpus without dir`)
  if (!suite.corpus.s3Prefix) throw new Error(`Suite ${suite.suiteId} uses codebuild-bucket corpus without s3Prefix`)
  if (!env.DATASET_S3_URI) throw new Error("DATASET_S3_URI is required to resolve a codebuild-bucket benchmark corpus")

  const datasetBucket = parseS3Bucket(env.DATASET_S3_URI)
  const corpusS3Uri = `s3://${datasetBucket}/${suite.corpus.s3Prefix.replace(/^\/+/, "").replace(/\/+$/, "")}/`
  const corpusDir = path.resolve(repoRoot, suite.corpus.dir)
  await rm(corpusDir, { recursive: true, force: true })
  await mkdir(corpusDir, { recursive: true })
  runCommand("aws", ["s3", "cp", "--recursive", corpusS3Uri, suite.corpus.dir], env)
}

function parseS3Bucket(value: string): string {
  const match = /^s3:\/\/([^/]+)\/(.+)$/.exec(value)
  if (!match) throw new Error(`Expected S3 URI, got: ${value}`)
  const bucket = match[1]
  if (!bucket) throw new Error(`Expected S3 bucket in URI, got: ${value}`)
  return bucket
}

function withTemplateEnv(baseEnv: RunnerEnv, extraEnv: Record<string, string>): RunnerEnv {
  const nextEnv: RunnerEnv = { ...baseEnv }
  for (const [key, value] of Object.entries(extraEnv)) {
    nextEnv[key] = value.replace(/\$\{([A-Z0-9_]+)\}/g, (_match, name: string) => nextEnv[name] ?? "")
  }
  if (nextEnv.BENCHMARK_CORPUS_DIR && !nextEnv.BENCHMARK_CORPUS_SUITE_ID) {
    nextEnv.BENCHMARK_CORPUS_SUITE_ID = baseEnv.BENCHMARK_SUITE_ID
  }
  return nextEnv
}

function runNpmScript(script: string, env: NodeJS.ProcessEnv): void {
  runCommand("npm", ["run", script, "-w", "@memorag-mvp/benchmark"], env)
}

function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv): void {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    stdio: "inherit"
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`)
  }
}

function validateManifest(manifest: CodeBuildSuiteManifest): void {
  if (manifest.version !== 1) throw new Error("benchmark CodeBuild suite manifest version must be 1")
  if (!manifest.defaults?.dataset || !manifest.defaults.output || !manifest.defaults.summary || !manifest.defaults.report) {
    throw new Error("benchmark CodeBuild suite manifest defaults are incomplete")
  }
  const suiteIds = new Set<string>()
  for (const suite of manifest.suites ?? []) {
    if (!suite.suiteId) throw new Error("benchmark CodeBuild suite is missing suiteId")
    if (suiteIds.has(suite.suiteId)) throw new Error(`Duplicate benchmark suite: ${suite.suiteId}`)
    suiteIds.add(suite.suiteId)
    if (!["agent", "search"].includes(suite.mode)) throw new Error(`Suite ${suite.suiteId} has invalid mode`)
    if (!["agent", "search", "conversation"].includes(suite.runner)) throw new Error(`Suite ${suite.suiteId} has invalid runner`)
    if (suite.dataset.source === "prepare" && !suite.prepare) {
      throw new Error(`Suite ${suite.suiteId} uses prepare dataset source without prepare script`)
    }
    if (suite.corpus?.source && !["local", "codebuild-bucket"].includes(suite.corpus.source)) {
      throw new Error(`Suite ${suite.suiteId} has invalid corpus source`)
    }
    if (!suite.metadata?.useCase) throw new Error(`Suite ${suite.suiteId} is missing metadata.useCase`)
  }
}

async function main(): Promise<void> {
  const command = process.argv[2]
  if (command === "prepare") {
    await prepareCodeBuildSuite()
    return
  }
  if (command === "run") {
    await runCodeBuildSuite()
    return
  }
  throw new Error("Usage: tsx codebuild-suite.ts <prepare|run>")
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
