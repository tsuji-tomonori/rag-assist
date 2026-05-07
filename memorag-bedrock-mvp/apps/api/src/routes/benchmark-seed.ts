import { z } from "@hono/zod-openapi"
import { HTTPException } from "hono/http-exception"
import { hasPermission } from "../authorization.js"
import { DocumentManifestSchema, DocumentUploadRequestSchema, IngestUploadedDocumentRequestSchema } from "../schemas.js"
import type { AppUser } from "../auth.js"
import type { MemoRagService } from "../rag/memorag-service.js"

const benchmarkSeedSuites = new Set([
  "smoke-agent-v1",
  "standard-agent-v1",
  "clarification-smoke-v1",
  "allganize-rag-evaluation-ja-v1",
  "mmrag-docqa-v1"
])
const maxBenchmarkSeedTextChars = 1_000_000
const maxBenchmarkSeedBase64Chars = 10_000_000
const benchmarkSeedMetadataKeys = new Set([
  "benchmarkSeed",
  "benchmarkSuiteId",
  "benchmarkSourceHash",
  "benchmarkIngestSignature",
  "benchmarkCorpusSkipMemory",
  "benchmarkEmbeddingModelId",
  "aclGroups",
  "docType",
  "lifecycleStatus",
  "source",
  "searchAliases"
])

type UploadPurpose = "document" | "benchmarkSeed"

export function authorizeDocumentUpload(user: AppUser, body: z.infer<typeof DocumentUploadRequestSchema>) {
  if (hasPermission(user, "rag:doc:write:group")) return
  if (hasPermission(user, "benchmark:seed_corpus") && isBenchmarkSeedUpload(body)) return
  throw new HTTPException(403, { message: "Forbidden: benchmark seed upload requires isolated benchmark metadata" })
}

export function isBenchmarkSeedUpload(body: z.infer<typeof DocumentUploadRequestSchema>): boolean {
  if (!isBenchmarkSeedUploadMetadata(body)) return false
  if (body.text !== undefined) return isBenchmarkSeedTextUpload(body)
  if (body.contentBase64 !== undefined) return isBenchmarkSeedPdfUpload(body)
  return false
}

function isBenchmarkSeedDocumentManifest(manifest: z.infer<typeof DocumentManifestSchema>): boolean {
  const metadata = manifest.metadata
  return (manifest.lifecycleStatus ?? "active") === "active"
    && metadata?.benchmarkSeed === true
    && typeof metadata.benchmarkSuiteId === "string"
    && benchmarkSeedSuites.has(metadata.benchmarkSuiteId)
    && metadata.source === "benchmark-runner"
    && metadata.docType === "benchmark-corpus"
    && Array.isArray(metadata.aclGroups)
    && metadata.aclGroups.length === 1
    && metadata.aclGroups[0] === "BENCHMARK_RUNNER"
}

export function isBenchmarkSeedUploadedObjectIngest(body: z.infer<typeof IngestUploadedDocumentRequestSchema>): boolean {
  if (!isBenchmarkSeedUploadMetadata(body)) return false
  if (!isSafeBenchmarkSeedFileName(body.fileName)) return false
  if (body.mimeType === "application/pdf") return /\.pdf$/i.test(body.fileName)
  if (!body.mimeType || body.mimeType === "text/markdown" || body.mimeType === "text/plain") return /\.(md|txt)$/i.test(body.fileName)
  return false
}

function isBenchmarkSeedUploadMetadata(body: {
  fileName: string
  metadata?: Record<string, unknown>
}): boolean {
  const metadata = body.metadata
  if (!metadata) return false
  if (!Object.keys(metadata).every((key) => benchmarkSeedMetadataKeys.has(key))) return false
  if (metadata.benchmarkSeed !== true) return false
  if (typeof metadata.benchmarkSuiteId !== "string" || !benchmarkSeedSuites.has(metadata.benchmarkSuiteId)) return false
  if (typeof metadata.benchmarkSourceHash !== "string" || metadata.benchmarkSourceHash.length === 0) return false
  if (typeof metadata.benchmarkIngestSignature !== "string" || metadata.benchmarkIngestSignature.length === 0) return false
  if (typeof metadata.benchmarkCorpusSkipMemory !== "boolean") return false
  if (typeof metadata.benchmarkEmbeddingModelId !== "string" || metadata.benchmarkEmbeddingModelId.length === 0) return false
  if (metadata.source !== "benchmark-runner") return false
  if (metadata.docType !== "benchmark-corpus") return false
  if (metadata.lifecycleStatus !== "active") return false
  if (!Array.isArray(metadata.aclGroups) || metadata.aclGroups.length !== 1 || metadata.aclGroups[0] !== "BENCHMARK_RUNNER") return false
  if (metadata.searchAliases !== undefined && !isBenchmarkSearchAliases(metadata.searchAliases)) return false
  if (!isSafeBenchmarkSeedFileName(body.fileName)) return false
  return true
}

function isBenchmarkSeedTextUpload(body: z.infer<typeof DocumentUploadRequestSchema>): boolean {
  if (!body.text || body.text.length > maxBenchmarkSeedTextChars || body.contentBase64 || body.textractJson) return false
  if (!/\.(md|txt)$/i.test(body.fileName)) return false
  return !body.mimeType || body.mimeType === "text/markdown" || body.mimeType === "text/plain"
}

function isBenchmarkSearchAliases(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return Object.entries(value).every(([term, expansions]) =>
    typeof term === "string"
      && term.trim().length > 0
      && Array.isArray(expansions)
      && expansions.length > 0
      && expansions.every((item) => typeof item === "string" && item.trim().length > 0)
  )
}

function isBenchmarkSeedPdfUpload(body: z.infer<typeof DocumentUploadRequestSchema>): boolean {
  if (!body.contentBase64 || body.text || body.textractJson) return false
  if (!/\.pdf$/i.test(body.fileName)) return false
  if (body.mimeType !== "application/pdf") return false
  return isValidBenchmarkSeedBase64(body.contentBase64)
}

function isSafeBenchmarkSeedFileName(fileName: string): boolean {
  return fileName.length > 0 && !fileName.includes("/") && !fileName.includes("\\")
}

function isValidBenchmarkSeedBase64(value: string): boolean {
  if (value.length === 0 || value.length > maxBenchmarkSeedBase64Chars || value.length % 4 !== 0) return false
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false
  return Buffer.byteLength(value, "base64") > 0
}

export function authorizeUploadedDocumentIngest(user: AppUser, purpose: UploadPurpose, body: z.infer<typeof IngestUploadedDocumentRequestSchema>) {
  if (purpose === "benchmarkSeed") {
    if (hasPermission(user, "benchmark:seed_corpus") && isBenchmarkSeedUploadedObjectIngest(body)) return
    throw new HTTPException(403, { message: "Forbidden: benchmark seed upload requires isolated benchmark metadata" })
  }
  if (hasPermission(user, "rag:doc:write:group")) return
  throw new HTTPException(403, { message: "Forbidden: missing rag:doc:write:group" })
}

export async function authorizeDocumentDelete(service: MemoRagService, user: AppUser, documentId: string) {
  if (hasPermission(user, "rag:doc:delete:group")) return
  if (!hasPermission(user, "benchmark:seed_corpus")) {
    throw new HTTPException(403, { message: "Forbidden: missing document delete permission" })
  }
  const manifest = (await service.listDocuments(user)).find((document) => document.documentId === documentId)
  if (!manifest || !isBenchmarkSeedDocumentManifest(manifest)) {
    throw new HTTPException(403, { message: "Forbidden: benchmark seed delete requires isolated benchmark metadata" })
  }
}
