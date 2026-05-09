import { z } from "zod"
import { JsonValueSchema } from "../json.js"
import { RAG_CONTRACT_LIMITS } from "../limits.js"
import { SearchScopeSchema } from "./chat.js"

export const SearchRequestSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().min(1).max(RAG_CONTRACT_LIMITS.maxSearchTopK).optional(),
  lexicalTopK: z.number().int().min(0).max(RAG_CONTRACT_LIMITS.maxSearchSourceTopK).optional(),
  semanticTopK: z.number().int().min(0).max(RAG_CONTRACT_LIMITS.maxSearchSourceTopK).optional(),
  embeddingModelId: z.string().optional(),
  filters: z.object({
    tenantId: z.string().optional(),
    department: z.string().optional(),
    source: z.string().optional(),
    docType: z.string().optional(),
    benchmarkSuiteId: z.string().optional(),
    documentId: z.string().optional()
  }).optional(),
  scope: SearchScopeSchema.optional()
})

export const SearchResultSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  fileName: z.string(),
  chunkId: z.string().optional(),
  text: z.string(),
  score: z.number(),
  rrfScore: z.number(),
  lexicalScore: z.number().optional(),
  semanticScore: z.number().optional(),
  lexicalRank: z.number().optional(),
  semanticRank: z.number().optional(),
  matchedTerms: z.array(z.string()),
  sources: z.array(z.enum(["lexical", "semantic"])),
  createdAt: z.string().optional(),
  metadata: z.record(z.string(), JsonValueSchema).optional()
})

export const SearchResponseSchema = z.object({
  query: z.string(),
  results: z.array(SearchResultSchema),
  diagnostics: z.object({
    indexVersion: z.string(),
    aliasVersion: z.string(),
    lexicalCount: z.number().int(),
    semanticCount: z.number().int(),
    fusedCount: z.number().int(),
    latencyMs: z.number().int(),
    profileId: z.string(),
    profileVersion: z.string(),
    topGap: z.number().nullable(),
    lexicalSemanticOverlap: z.number(),
    scoreDistribution: z.object({
      top: z.number().nullable(),
      median: z.number().nullable(),
      p90: z.number().nullable(),
      min: z.number().nullable(),
      max: z.number().nullable()
    }),
    adaptiveDecision: z.object({
      strategy: z.enum(["fixed", "adaptive"]),
      reason: z.string(),
      effectiveTopK: z.number().int(),
      effectiveMinScore: z.number()
    }).optional(),
    index: z.object({
      visibleManifestCount: z.number().int().nonnegative(),
      indexedChunkCount: z.number().int().nonnegative(),
      cache: z.enum(["memory", "artifact", "built"]),
      loadMs: z.number().int().nonnegative()
    }).optional()
  })
})

export type SearchRequest = z.input<typeof SearchRequestSchema>
export type SearchResult = z.output<typeof SearchResultSchema>
export type SearchResponse = z.output<typeof SearchResponseSchema>
