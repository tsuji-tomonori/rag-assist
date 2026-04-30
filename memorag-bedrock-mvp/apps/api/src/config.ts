import path from "node:path"
import { config as loadDotEnv } from "dotenv"

loadDotEnv({ path: path.resolve(process.cwd(), ".env") })
loadDotEnv({ path: path.resolve(process.cwd(), "../../.env"), override: false })

function boolEnv(name: string, defaultValue = false): boolean {
  const value = process.env[name]
  if (value === undefined) return defaultValue
  return ["1", "true", "yes", "on"].includes(value.toLowerCase())
}

function numberEnv(name: string, defaultValue: number): number {
  const raw = process.env[name]
  if (!raw) return defaultValue
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : defaultValue
}

export const config = {
  region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1",
  port: numberEnv("PORT", 8787),
  mockBedrock: boolEnv("MOCK_BEDROCK", false),
  useLocalVectorStore: boolEnv("USE_LOCAL_VECTOR_STORE", process.env.NODE_ENV !== "production"),
  localDataDir: process.env.LOCAL_DATA_DIR ?? ".local-data",
  docsBucketName: process.env.DOCS_BUCKET_NAME ?? "",
  vectorBucketName: process.env.VECTOR_BUCKET_NAME ?? "local-vector-bucket",
  memoryVectorIndexName: process.env.MEMORY_VECTOR_INDEX_NAME ?? process.env.VECTOR_INDEX_NAME ?? "memory-index",
  evidenceVectorIndexName: process.env.EVIDENCE_VECTOR_INDEX_NAME ?? process.env.VECTOR_INDEX_NAME ?? "evidence-index",
  defaultModelId: process.env.DEFAULT_MODEL_ID ?? "amazon.nova-lite-v1:0",
  defaultMemoryModelId: process.env.DEFAULT_MEMORY_MODEL_ID ?? process.env.DEFAULT_MODEL_ID ?? "amazon.nova-lite-v1:0",
  embeddingModelId: process.env.EMBEDDING_MODEL_ID ?? "amazon.titan-embed-text-v2:0",
  embeddingDimensions: numberEnv("EMBEDDING_DIMENSIONS", 1024),
  minRetrievalScore: numberEnv("MIN_RETRIEVAL_SCORE", 0.20),
  maxUploadChars: numberEnv("MAX_UPLOAD_CHARS", 500_000),
  chunkSizeChars: numberEnv("CHUNK_SIZE_CHARS", 1200),
  chunkOverlapChars: numberEnv("CHUNK_OVERLAP_CHARS", 200)
} as const
