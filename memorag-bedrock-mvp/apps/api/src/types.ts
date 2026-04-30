export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export type VectorKind = "chunk" | "memory"

export type VectorMetadata = {
  kind: VectorKind
  documentId: string
  fileName: string
  chunkId?: string
  memoryId?: string
  objectKey?: string
  sourceUri?: string
  text?: string
  createdAt: string
}

export type VectorRecord = {
  key: string
  vector: number[]
  metadata: VectorMetadata
}

export type RetrievedVector = {
  key: string
  score: number
  distance?: number
  metadata: VectorMetadata
}

export type DocumentManifest = {
  documentId: string
  fileName: string
  mimeType?: string
  metadata?: Record<string, JsonValue>
  sourceObjectKey: string
  manifestObjectKey: string
  vectorKeys: string[]
  chunkCount: number
  memoryCardCount: number
  createdAt: string
}

export type MemoryCard = {
  id: string
  summary: string
  keywords: string[]
  likelyQuestions: string[]
  constraints: string[]
  text: string
}

export type Chunk = {
  id: string
  text: string
  startChar: number
  endChar: number
}

export type Citation = {
  documentId: string
  fileName: string
  chunkId?: string
  score: number
  text: string
}
