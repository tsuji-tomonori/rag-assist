import { z } from "zod"
import { JsonValueSchema } from "../json.js"
import { RAG_CONTRACT_LIMITS } from "../limits.js"
import { SearchScopeSchema } from "./chat.js"

export const MandatoryRagGuardSchema = z.enum([
  "authentication",
  "authorization",
  "classification_usage",
  "prompt_injection",
  "tool_policy",
  "grounding",
  "citation",
  "output_secret",
  "trace_redaction"
])

export const RagGuardOutcomeSchema = z.object({
  guard: MandatoryRagGuardSchema,
  observed: z.boolean(),
  passed: z.boolean(),
  evidence: z.string(),
  observedAt: z.string().datetime()
})

export const SafeDegradationDecisionSchema = z.object({
  policyVersion: z.literal("rag-safe-degradation-v1"),
  trigger: z.enum(["dependency_error", "timeout", "overload", "cost_limit", "circuit_open", "unsafe_profile"]),
  stage: z.string(),
  action: z.enum(["limited_answer", "refuse", "fail"]),
  enforcedGuards: z.array(MandatoryRagGuardSchema),
  missingGuards: z.array(MandatoryRagGuardSchema),
  safeToReturnContent: z.boolean(),
  guardOutcomes: z.array(RagGuardOutcomeSchema)
})

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
  documentVersion: z.string().optional(),
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
    traceId: z.string(),
    replayVersionManifest: z.object({
      schemaVersion: z.literal(1),
      sourceSnapshots: z.array(z.object({
        documentId: z.string(),
        documentVersion: z.string().nullable(),
        ingestTraceId: z.string().nullable(),
        parserVersion: z.string().nullable(),
        ocrVersion: z.string().nullable(),
        chunkerVersion: z.string().nullable(),
        chunkingPolicyVersion: z.string().nullable(),
        embeddingModelId: z.string().nullable(),
        embeddingDimensions: z.number().int().nullable(),
        indexVersion: z.string().nullable(),
        promptVersion: z.string().nullable(),
        pipelineVersion: z.string().nullable()
      })),
      parserVersion: z.string().nullable(),
      ocrVersion: z.string().nullable(),
      chunkerVersion: z.string().nullable(),
      chunkingPolicyVersion: z.string().nullable(),
      embedding: z.object({ modelId: z.string().nullable(), dimensions: z.number().int().nullable() }),
      policyVersions: z.object({
        ragProfile: z.string().nullable(),
        retrieval: z.string().nullable(),
        answer: z.string().nullable(),
        authorization: z.string().nullable(),
        eligibility: z.string().nullable(),
        untrustedContent: z.string().nullable(),
        traceSanitization: z.string().nullable()
      }),
      indexVersion: z.string().nullable(),
      modelVersions: z.object({ answer: z.string().nullable(), clue: z.string().nullable() }),
      promptVersion: z.string().nullable(),
      pipelineVersion: z.string().nullable(),
      datasetVersion: z.string().nullable(),
      queryTransformation: z.object({
        originalQuestionHash: z.string(),
        normalizedQueryHash: z.string().nullable(),
        expandedQuerySetHash: z.string().nullable()
      }),
      decisions: z.object({
        candidateCount: z.number().int().nonnegative(),
        deniedCandidateCount: z.number().int().nonnegative(),
        finalEvidenceCount: z.number().int().nonnegative(),
        responseStatus: z.enum(["success", "warning", "error"]),
        decisionCode: z.enum(["completed", "refused", "rejected", "failed", "cancelled"]),
        reasonCodes: z.array(z.enum([
          "authorization_denied",
          "safety_interlock",
          "dependency_error",
          "admission_rejected",
          "publication_not_eligible",
          "permission_revoked",
          "execution_error",
          "insufficient_evidence",
          "clarification_required",
          "output_secret_detected",
          "cancelled"
        ])),
        totalLatencyMs: z.number().nonnegative()
      }),
      nondeterministicFactors: z.array(z.string()),
      missingVersions: z.array(z.string())
    }),
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
      loadMs: z.number().int().nonnegative(),
      degradationDecision: SafeDegradationDecisionSchema.optional()
    }).optional()
  })
})

export type SearchRequest = z.input<typeof SearchRequestSchema>
export type SearchResult = z.output<typeof SearchResultSchema>
export type SearchResponse = z.output<typeof SearchResponseSchema>
