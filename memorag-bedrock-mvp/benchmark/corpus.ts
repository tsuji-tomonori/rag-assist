import { createHash } from "node:crypto"
import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"

type DocumentManifest = {
  fileName?: string
  chunkCount?: number
  lifecycleStatus?: string
  embeddingModelId?: string
  pipelineVersions?: {
    embeddingModelId?: string
  }
  metadata?: Record<string, unknown>
}

type DocumentListResponse = {
  documents?: DocumentManifest[]
}

export type SeededDocument = {
  fileName: string
  status: "skipped" | "uploaded"
  chunkCount: number
  sourceHash: string
  ingestSignature: string
}

type SeedCorpusOptions = {
  apiBaseUrl: string
  authToken?: string
  corpusDir?: string
  suiteId: string
  skipMemory: boolean
  embeddingModelId?: string
  fetchImpl?: typeof fetch
  log?: (message: string) => void
}

const benchmarkIngestSignatureVersion = "benchmark-corpus-seed-v2"
const benchmarkCorpusAclGroups = ["BENCHMARK_RUNNER"]
const benchmarkCorpusDocType = "benchmark-corpus"
const benchmarkCorpusSource = "benchmark-runner"
const supportedExtensions = new Set([".md", ".txt", ".pdf"])

export async function seedBenchmarkCorpus(options: SeedCorpusOptions): Promise<SeededDocument[]> {
  if (!options.corpusDir) return []

  const fetcher = options.fetchImpl ?? fetch
  const files = await listCorpusFiles(options.corpusDir)
  if (files.length === 0) throw new Error(`Benchmark corpus directory has no supported files: ${options.corpusDir}`)

  const existingDocuments = await listDocuments(options.apiBaseUrl, options.authToken, fetcher)
  const seeded: SeededDocument[] = []

  for (const filePath of files) {
    const fileName = path.basename(filePath)
    const content = await readFile(filePath)
    const sourceHash = sha256(content)
    const ingestSignature = createBenchmarkIngestSignature({
      sourceHash,
      suiteId: options.suiteId,
      skipMemory: options.skipMemory,
      embeddingModelId: options.embeddingModelId
    })
    const existing = existingDocuments.find((document) =>
      isMatchingSeedDocument(document, fileName, options.suiteId, sourceHash, ingestSignature, options)
    )
    if (existing) {
      seeded.push({ fileName, status: "skipped", chunkCount: existing.chunkCount ?? 0, sourceHash, ingestSignature })
      options.log?.(`Benchmark corpus already active: ${fileName}`)
      continue
    }

    const uploaded = await uploadDocument({
      apiBaseUrl: options.apiBaseUrl,
      authToken: options.authToken,
      fetcher,
      fileName,
      content,
      mimeType: mimeTypeFor(fileName),
      suiteId: options.suiteId,
      sourceHash,
      ingestSignature,
      skipMemory: options.skipMemory,
      embeddingModelId: options.embeddingModelId
    })
    seeded.push({ fileName, status: "uploaded", chunkCount: uploaded.chunkCount ?? 0, sourceHash, ingestSignature })
    options.log?.(`Benchmark corpus uploaded: ${fileName} (${uploaded.chunkCount ?? 0} chunks)`)
  }

  return seeded
}

export function benchmarkCorpusDirFromEnv(env: NodeJS.ProcessEnv, fallback?: string): string | undefined {
  const value = env.BENCHMARK_CORPUS_DIR?.trim()
  if (value) return value
  return fallback
}

export function benchmarkCorpusSkipMemoryFromEnv(env: NodeJS.ProcessEnv): boolean {
  return env.BENCHMARK_CORPUS_SKIP_MEMORY?.toLowerCase() !== "false"
}

export function createBenchmarkIngestSignature(input: {
  sourceHash: string
  suiteId: string
  skipMemory: boolean
  embeddingModelId?: string
}): string {
  return sha256(JSON.stringify({
    version: benchmarkIngestSignatureVersion,
    sourceHash: input.sourceHash,
    suiteId: input.suiteId,
    skipMemory: input.skipMemory,
    embeddingModelId: input.embeddingModelId ?? "api-default"
  }))
}

async function listCorpusFiles(corpusDir: string): Promise<string[]> {
  const entries = await readdir(corpusDir)
  const files: string[] = []
  for (const entry of entries) {
    const filePath = path.join(corpusDir, entry)
    const entryStat = await stat(filePath)
    if (!entryStat.isFile()) continue
    if (!supportedExtensions.has(path.extname(entry).toLowerCase())) continue
    files.push(filePath)
  }
  return files.sort()
}

async function listDocuments(apiBaseUrl: string, authToken: string | undefined, fetcher: typeof fetch): Promise<DocumentManifest[]> {
  const response = await fetcher(`${apiBaseUrl}/documents`, {
    method: "GET",
    headers: createHeaders(authToken)
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`Failed to list documents before benchmark corpus seed: HTTP ${response.status} ${text}`)
  const body = text ? (JSON.parse(text) as DocumentListResponse) : {}
  return body.documents ?? []
}

async function uploadDocument(input: {
  apiBaseUrl: string
  authToken?: string
  fetcher: typeof fetch
  fileName: string
  content: Buffer
  mimeType: string
  suiteId: string
  sourceHash: string
  ingestSignature: string
  skipMemory: boolean
  embeddingModelId?: string
}): Promise<DocumentManifest> {
  const response = await input.fetcher(`${input.apiBaseUrl}/documents`, {
    method: "POST",
    headers: createHeaders(input.authToken),
    body: JSON.stringify({
      fileName: input.fileName,
      ...(isTextMimeType(input.mimeType) ? { text: input.content.toString("utf-8") } : { contentBase64: input.content.toString("base64") }),
      mimeType: input.mimeType,
      embeddingModelId: input.embeddingModelId,
      skipMemory: input.skipMemory,
      metadata: {
        benchmarkSeed: true,
        benchmarkSuiteId: input.suiteId,
        benchmarkSourceHash: input.sourceHash,
        benchmarkIngestSignature: input.ingestSignature,
        benchmarkCorpusSkipMemory: input.skipMemory,
        benchmarkEmbeddingModelId: input.embeddingModelId ?? "api-default",
        aclGroups: benchmarkCorpusAclGroups,
        docType: benchmarkCorpusDocType,
        lifecycleStatus: "active",
        source: benchmarkCorpusSource
      }
    })
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`Failed to upload benchmark corpus ${input.fileName}: HTTP ${response.status} ${text}`)
  const manifest = text ? (JSON.parse(text) as DocumentManifest) : {}
  if ((manifest.lifecycleStatus ?? "active") !== "active") throw new Error(`Benchmark corpus ${input.fileName} is not active after upload`)
  if ((manifest.chunkCount ?? 0) <= 0) throw new Error(`Benchmark corpus ${input.fileName} produced no chunks`)
  return manifest
}

function isMatchingSeedDocument(
  document: DocumentManifest,
  fileName: string,
  suiteId: string,
  sourceHash: string,
  ingestSignature: string,
  options: SeedCorpusOptions
): boolean {
  const documentEmbeddingModelId = document.embeddingModelId ?? document.pipelineVersions?.embeddingModelId ?? document.metadata?.benchmarkEmbeddingModelId
  return document.fileName === fileName
    && (document.lifecycleStatus ?? "active") === "active"
    && (document.chunkCount ?? 0) > 0
    && document.metadata?.benchmarkSeed === true
    && document.metadata?.benchmarkSuiteId === suiteId
    && document.metadata?.benchmarkSourceHash === sourceHash
    && document.metadata?.benchmarkIngestSignature === ingestSignature
    && document.metadata?.benchmarkCorpusSkipMemory === options.skipMemory
    && document.metadata?.source === benchmarkCorpusSource
    && document.metadata?.docType === benchmarkCorpusDocType
    && hasBenchmarkCorpusAcl(document.metadata?.aclGroups)
    && (!options.embeddingModelId || documentEmbeddingModelId === options.embeddingModelId)
}

function hasBenchmarkCorpusAcl(value: unknown): boolean {
  return Array.isArray(value)
    && value.length === benchmarkCorpusAclGroups.length
    && benchmarkCorpusAclGroups.every((group) => value.includes(group))
}

function createHeaders(authToken: string | undefined): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
  }
}

function mimeTypeFor(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase()
  if (extension === ".md") return "text/markdown"
  if (extension === ".pdf") return "application/pdf"
  return "text/plain"
}

function isTextMimeType(mimeType: string): boolean {
  return mimeType === "text/markdown" || mimeType === "text/plain"
}

function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex")
}
