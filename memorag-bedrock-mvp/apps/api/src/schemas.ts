import { z } from "@hono/zod-openapi"

const MetadataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  timestamp: z.string()
})

export const DocumentUploadRequestSchema = z.object({
  fileName: z.string().min(1).openapi({ example: "handbook.md" }),
  text: z.string().optional().openapi({ example: "経費精算は申請から30日以内に行う必要があります。" }),
  contentBase64: z.string().optional(),
  mimeType: z.string().optional().openapi({ example: "text/markdown" }),
  metadata: z.record(MetadataValueSchema).optional(),
  embeddingModelId: z.string().optional().openapi({ example: "amazon.titan-embed-text-v2:0" }),
  memoryModelId: z.string().optional().openapi({ example: "amazon.nova-lite-v1:0" }),
  skipMemory: z.boolean().optional()
})

export const DocumentManifestSchema = z.object({
  documentId: z.string(),
  fileName: z.string(),
  mimeType: z.string().optional(),
  metadata: z.record(MetadataValueSchema).optional(),
  sourceObjectKey: z.string(),
  manifestObjectKey: z.string(),
  vectorKeys: z.array(z.string()),
  chunkCount: z.number(),
  memoryCardCount: z.number(),
  createdAt: z.string()
})

export const DocumentListResponseSchema = z.object({
  documents: z.array(DocumentManifestSchema)
})

export const DeleteDocumentResponseSchema = z.object({
  documentId: z.string(),
  deletedVectorCount: z.number()
})

export const ChatRequestSchema = z.object({
  question: z.string().min(1).openapi({ example: "経費精算の期限は？" }),
  modelId: z.string().optional().openapi({ example: "amazon.nova-lite-v1:0" }),
  embeddingModelId: z.string().optional().openapi({ example: "amazon.titan-embed-text-v2:0" }),
  clueModelId: z.string().optional().openapi({ example: "amazon.nova-lite-v1:0" }),
  topK: z.number().int().min(1).max(20).optional().openapi({ example: 6 }),
  memoryTopK: z.number().int().min(1).max(10).optional().openapi({ example: 4 }),
  minScore: z.number().min(-1).max(1).optional().openapi({ example: 0.20 }),
  strictGrounded: z.boolean().optional().openapi({ example: true }),
  includeDebug: z.boolean().optional().openapi({ example: false })
})

export const CitationSchema = z.object({
  documentId: z.string(),
  fileName: z.string(),
  chunkId: z.string().optional(),
  score: z.number(),
  text: z.string()
})

export const ChatResponseSchema = z.object({
  answer: z.string(),
  isAnswerable: z.boolean(),
  citations: z.array(CitationSchema),
  retrieved: z.array(CitationSchema),
  debug: z.record(z.unknown()).optional()
})

export const BenchmarkQueryRequestSchema = ChatRequestSchema.extend({
  id: z.string().optional()
})

export const BenchmarkQueryResponseSchema = ChatResponseSchema.extend({
  id: z.string().optional()
})

export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.record(z.array(z.string())).optional()
})
