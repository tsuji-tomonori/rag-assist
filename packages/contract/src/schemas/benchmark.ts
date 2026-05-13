import { z } from "zod"
import { ChatRequestSchema, ChatResponseSchema } from "./chat.js"
import { SearchRequestSchema, SearchResponseSchema } from "./search.js"

const BenchmarkSearchForbiddenUserGroups = new Set([
  "SYSTEM_ADMIN",
  "RAG_GROUP_MANAGER",
  "BENCHMARK_OPERATOR",
  "BENCHMARK_RUNNER",
  "ANSWER_EDITOR",
  "USER_ADMIN",
  "ACCESS_ADMIN",
  "COST_AUDITOR"
])

export const BenchmarkQueryRequestSchema = ChatRequestSchema.extend({
  id: z.string().optional(),
  benchmarkSuiteId: z.string().optional()
})

export const BenchmarkQueryResponseSchema = ChatResponseSchema.extend({
  id: z.string().optional()
})

export const BenchmarkSearchRequestSchema = SearchRequestSchema.extend({
  benchmarkSuiteId: z.string().optional(),
  user: z.object({
    userId: z.string().min(1).max(160).optional(),
    groups: z.array(z.string().min(1).max(160)).max(20).optional()
  }).optional()
}).superRefine((value, ctx) => {
  for (const group of value.user?.groups ?? []) {
    if (BenchmarkSearchForbiddenUserGroups.has(group)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["user", "groups"],
        message: `Benchmark search user cannot include privileged group ${group}`
      })
    }
  }
})

export const BenchmarkSearchResponseSchema = SearchResponseSchema

export type BenchmarkQueryRequest = z.input<typeof BenchmarkQueryRequestSchema>
export type BenchmarkQueryResponse = z.output<typeof BenchmarkQueryResponseSchema>
export type BenchmarkSearchRequest = z.input<typeof BenchmarkSearchRequestSchema>
export type BenchmarkSearchResponse = z.output<typeof BenchmarkSearchResponseSchema>
