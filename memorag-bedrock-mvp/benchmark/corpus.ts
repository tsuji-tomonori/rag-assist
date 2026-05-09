import { createHash } from "node:crypto"
import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"

type DocumentManifest = {
  documentId?: string
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

type UploadSessionResponse = {
  uploadId: string
  uploadUrl: string
  method: "PUT" | "POST"
  headers?: Record<string, string>
  requiresAuth?: boolean
}

type DocumentIngestRun = {
  runId: string
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled"
  manifest?: DocumentManifest
  error?: string
}

type DocumentIngestRunStartResponse = {
  runId: string
  status: DocumentIngestRun["status"]
  eventsPath?: string
}

export type SeededDocument = {
  fileName: string
  status: "skipped" | "skipped_unextractable" | "uploaded"
  chunkCount: number
  sourceHash: string
  ingestSignature: string
  ingestRunId?: string
  skipReason?: string
}

type CorpusFileMetadata = {
  searchAliases?: Record<string, string[]>
}

type SeedCorpusOptions = {
  apiBaseUrl: string
  authToken?: string
  corpusDir?: string
  suiteId: string
  skipMemory: boolean
  embeddingModelId?: string
  fetchImpl?: typeof fetch
  ingestRunPollIntervalMs?: number
  ingestRunTimeoutMs?: number
  log?: (message: string) => void
}

const benchmarkIngestSignatureVersion = "benchmark-corpus-seed-v3"
const benchmarkCorpusAclGroups = ["BENCHMARK_RUNNER"]
const benchmarkCorpusDocType = "benchmark-corpus"
const benchmarkCorpusSource = "benchmark-runner"
const supportedExtensions = new Set([".md", ".txt", ".pdf"])
const defaultIngestRunPollIntervalMs = 5000
const defaultIngestRunTimeoutMs = 30 * 60 * 1000
const uploadSessionRequestHeaderBlocklist = new Set(["content-length", "host", "transfer-encoding"])

export async function seedBenchmarkCorpus(options: SeedCorpusOptions): Promise<SeededDocument[]> {
  if (!options.corpusDir) return []

  const fetcher = options.fetchImpl ?? fetch
  const files = await listCorpusFiles(options.corpusDir)
  if (files.length === 0) throw new Error(`Benchmark corpus directory has no supported files: ${options.corpusDir}`)

  const existingDocuments = await listDocuments(options.apiBaseUrl, options.authToken, fetcher)
  const activeDocuments = await deleteExistingBenchmarkCorpusDocuments({
    apiBaseUrl: options.apiBaseUrl,
    authToken: options.authToken,
    fetcher,
    suiteId: options.suiteId,
    documents: existingDocuments,
    log: options.log
  })
  const seeded: SeededDocument[] = []

  for (const filePath of files) {
    const fileName = path.basename(filePath)
    const content = await readFile(filePath)
    const metadata = await readCorpusFileMetadata(filePath)
    const sourceHash = sha256(content)
    const ingestSignature = createBenchmarkIngestSignature({
      sourceHash,
      suiteId: options.suiteId,
      skipMemory: options.skipMemory,
      embeddingModelId: options.embeddingModelId,
      metadata
    })
    const existing = activeDocuments.find((document) =>
      isMatchingSeedDocument(document, fileName, options.suiteId, sourceHash, ingestSignature, options)
    )
    if (existing) {
      seeded.push({ fileName, status: "skipped", chunkCount: existing.chunkCount ?? 0, sourceHash, ingestSignature })
      options.log?.(`Benchmark corpus already active: ${fileName}`)
      continue
    }

    try {
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
        embeddingModelId: options.embeddingModelId,
        metadata,
        ingestRunPollIntervalMs: options.ingestRunPollIntervalMs,
        ingestRunTimeoutMs: options.ingestRunTimeoutMs
      })
      seeded.push({ fileName, status: "uploaded", chunkCount: uploaded.manifest.chunkCount ?? 0, sourceHash, ingestSignature, ingestRunId: uploaded.ingestRunId })
      const runDetail = uploaded.ingestRunId ? `, run ${uploaded.ingestRunId}` : ""
      options.log?.(`Benchmark corpus uploaded: ${fileName} (${uploaded.manifest.chunkCount ?? 0} chunks${runDetail})`)
    } catch (error) {
      const skipReason = unextractableCorpusSkipReason(error)
      if (!skipReason) throw error
      seeded.push({ fileName, status: "skipped_unextractable", chunkCount: 0, sourceHash, ingestSignature, skipReason })
      options.log?.(`Benchmark corpus skipped: ${fileName} (${skipReason})`)
    }
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

export function benchmarkIngestRunPollIntervalMsFromEnv(env: NodeJS.ProcessEnv): number {
  return positiveIntFromEnv(env.BENCHMARK_INGEST_RUN_POLL_INTERVAL_MS, defaultIngestRunPollIntervalMs)
}

export function benchmarkIngestRunTimeoutMsFromEnv(env: NodeJS.ProcessEnv): number {
  return positiveIntFromEnv(env.BENCHMARK_INGEST_RUN_TIMEOUT_MS, defaultIngestRunTimeoutMs)
}

export function createBenchmarkIngestSignature(input: {
  sourceHash: string
  suiteId: string
  skipMemory: boolean
  embeddingModelId?: string
  metadata?: CorpusFileMetadata
}): string {
  return sha256(JSON.stringify({
    version: benchmarkIngestSignatureVersion,
    sourceHash: input.sourceHash,
    suiteId: input.suiteId,
    skipMemory: input.skipMemory,
    embeddingModelId: input.embeddingModelId ?? "api-default",
    metadata: input.metadata ?? {}
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

async function deleteExistingBenchmarkCorpusDocuments(input: {
  apiBaseUrl: string
  authToken?: string
  fetcher: typeof fetch
  suiteId: string
  documents: DocumentManifest[]
  log?: (message: string) => void
}): Promise<DocumentManifest[]> {
  const remaining: DocumentManifest[] = []
  for (const document of input.documents) {
    if (!isResettableBenchmarkCorpusDocument(document, input.suiteId)) {
      remaining.push(document)
      continue
    }
    const documentId = document.documentId
    const response = await input.fetcher(`${input.apiBaseUrl}/documents/${encodeURIComponent(documentId)}`, {
      method: "DELETE",
      headers: createHeaders(input.authToken)
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`Failed to delete existing benchmark corpus ${document.fileName ?? documentId}: HTTP ${response.status} ${text}`)
    }
    input.log?.(`Benchmark corpus deleted before seed: ${document.fileName ?? documentId}`)
  }
  return remaining
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
  metadata: CorpusFileMetadata
  ingestRunPollIntervalMs?: number
  ingestRunTimeoutMs?: number
}): Promise<{ manifest: DocumentManifest; ingestRunId?: string }> {
  if (!isTextMimeType(input.mimeType)) return uploadDocumentFromUploadSession(input)

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
        source: benchmarkCorpusSource,
        ...input.metadata
      }
    })
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`Failed to upload benchmark corpus ${input.fileName}: HTTP ${response.status} ${text}`)
  const manifest = text ? (JSON.parse(text) as DocumentManifest) : {}
  assertActiveChunkedManifest(input.fileName, manifest)
  return { manifest }
}

async function uploadDocumentFromUploadSession(input: {
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
  metadata: CorpusFileMetadata
  ingestRunPollIntervalMs?: number
  ingestRunTimeoutMs?: number
}): Promise<{ manifest: DocumentManifest; ingestRunId: string }> {
  const sessionResponse = await input.fetcher(`${input.apiBaseUrl}/documents/uploads`, {
    method: "POST",
    headers: createHeaders(input.authToken),
    body: JSON.stringify({
      fileName: input.fileName,
      mimeType: input.mimeType,
      purpose: "benchmarkSeed"
    })
  })
  const sessionText = await sessionResponse.text()
  if (!sessionResponse.ok) throw new Error(`Failed to create benchmark corpus upload ${input.fileName}: HTTP ${sessionResponse.status} ${sessionText}`)
  const session = sessionText ? (JSON.parse(sessionText) as UploadSessionResponse) : undefined
  if (!session?.uploadId || !session.uploadUrl) throw new Error(`Benchmark corpus upload session was incomplete for ${input.fileName}`)

  const uploadResponse = await input.fetcher(session.uploadUrl, {
    method: session.method,
    headers: createUploadSessionHeaders(session, input.authToken),
    body: new Uint8Array(input.content)
  })
  const uploadText = await uploadResponse.text()
  if (!uploadResponse.ok) throw new Error(`Failed to transfer benchmark corpus ${input.fileName}: HTTP ${uploadResponse.status} ${uploadText}`)

  const response = await input.fetcher(`${input.apiBaseUrl}/document-ingest-runs`, {
    method: "POST",
    headers: createHeaders(input.authToken),
    body: JSON.stringify({
      uploadId: session.uploadId,
      fileName: input.fileName,
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
        source: benchmarkCorpusSource,
        ...input.metadata
      }
    })
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`Failed to start benchmark corpus ingest run ${input.fileName}: HTTP ${response.status} ${text}`)
  const started = text ? (JSON.parse(text) as DocumentIngestRunStartResponse) : undefined
  if (!started?.runId) throw new Error(`Benchmark corpus ingest run start response was incomplete for ${input.fileName}`)
  const run = await waitForDocumentIngestRun({
    apiBaseUrl: input.apiBaseUrl,
    authToken: input.authToken,
    fetcher: input.fetcher,
    fileName: input.fileName,
    runId: started.runId,
    pollIntervalMs: input.ingestRunPollIntervalMs ?? defaultIngestRunPollIntervalMs,
    timeoutMs: input.ingestRunTimeoutMs ?? defaultIngestRunTimeoutMs
  })
  const manifest = run.manifest ?? {}
  assertActiveChunkedManifest(input.fileName, manifest)
  return { manifest, ingestRunId: started.runId }
}

async function waitForDocumentIngestRun(input: {
  apiBaseUrl: string
  authToken?: string
  fetcher: typeof fetch
  fileName: string
  runId: string
  pollIntervalMs: number
  timeoutMs: number
}): Promise<DocumentIngestRun> {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= input.timeoutMs) {
    const response = await input.fetcher(`${input.apiBaseUrl}/document-ingest-runs/${encodeURIComponent(input.runId)}`, {
      method: "GET",
      headers: createHeaders(input.authToken)
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`Failed to poll benchmark corpus ingest run ${input.fileName} (${input.runId}): HTTP ${response.status} ${text}`)
    }
    const run = text ? (JSON.parse(text) as DocumentIngestRun) : undefined
    if (!run?.runId) throw new Error(`Benchmark corpus ingest run poll response was incomplete for ${input.fileName}`)
    if (run.status === "succeeded") return run
    if (run.status === "failed" || run.status === "cancelled") {
      const reason = run.error ? `: ${run.error}` : ""
      throw new Error(`Benchmark corpus ingest run ${input.runId} ${run.status} for ${input.fileName}${reason}`)
    }
    if (input.pollIntervalMs > 0) await sleep(input.pollIntervalMs)
  }
  throw new Error(`Benchmark corpus ingest run ${input.runId} timed out after ${input.timeoutMs}ms for ${input.fileName}`)
}

function assertActiveChunkedManifest(fileName: string, manifest: DocumentManifest) {
  if ((manifest.lifecycleStatus ?? "active") !== "active") throw new Error(`Benchmark corpus ${fileName} is not active after upload`)
  if ((manifest.chunkCount ?? 0) <= 0) throw new Error(`Benchmark corpus ${fileName} produced no chunks`)
}

async function readCorpusFileMetadata(filePath: string): Promise<CorpusFileMetadata> {
  try {
    const raw = JSON.parse(await readFile(`${filePath}.metadata.json`, "utf-8")) as CorpusFileMetadata
    const searchAliases = normalizeSearchAliases(raw.searchAliases)
    return searchAliases ? { searchAliases } : {}
  } catch (error) {
    if (isMissingFileError(error)) return {}
    throw error
  }
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

function isResettableBenchmarkCorpusDocument(document: DocumentManifest, suiteId: string): document is DocumentManifest & { documentId: string } {
  return typeof document.documentId === "string"
    && document.documentId.length > 0
    && (document.lifecycleStatus ?? "active") === "active"
    && document.metadata?.benchmarkSeed === true
    && document.metadata?.benchmarkSuiteId === suiteId
    && document.metadata?.source === benchmarkCorpusSource
    && document.metadata?.docType === benchmarkCorpusDocType
    && hasBenchmarkCorpusAcl(document.metadata?.aclGroups)
}

function hasBenchmarkCorpusAcl(value: unknown): boolean {
  return Array.isArray(value)
    && value.length === benchmarkCorpusAclGroups.length
    && benchmarkCorpusAclGroups.every((group) => value.includes(group))
}

function normalizeSearchAliases(value: unknown): Record<string, string[]> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const aliases: Record<string, string[]> = {}
  for (const [term, expansions] of Object.entries(value)) {
    if (typeof term !== "string" || !term.trim() || !Array.isArray(expansions)) continue
    const normalizedExpansions = expansions
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
    if (normalizedExpansions.length > 0) aliases[term.trim()] = normalizedExpansions
  }
  return Object.keys(aliases).length > 0 ? aliases : undefined
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT"
}

function createHeaders(authToken: string | undefined): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
  }
}

function createAuthHeaders(authToken: string | undefined): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {}
}

function createUploadSessionHeaders(session: UploadSessionResponse, authToken: string | undefined): Record<string, string> {
  const headers = {
    ...(session.requiresAuth ? createAuthHeaders(authToken) : {}),
    ...(session.headers ?? {})
  }
  for (const headerName of Object.keys(headers)) {
    if (uploadSessionRequestHeaderBlocklist.has(headerName.toLowerCase())) delete headers[headerName]
  }
  return headers
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function positiveIntFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
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

function unextractableCorpusSkipReason(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message : String(error)
  if (/did not contain extractable text/i.test(message)) return "no_extractable_text"
  if (/PDF OCR fallback failed/i.test(message) && /Textract job did not finish within \d+ms/i.test(message)) return "ocr_timeout"
  return undefined
}

function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex")
}
