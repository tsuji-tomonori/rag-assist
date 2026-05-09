import { oc, type ContractRouterClient } from "@orpc/contract"
import { BenchmarkQueryRequestSchema, BenchmarkQueryResponseSchema, BenchmarkSearchRequestSchema, BenchmarkSearchResponseSchema } from "./schemas/benchmark.js"
import { ChatRequestSchema, ChatResponseSchema, ChatRunStartResponseSchema } from "./schemas/chat.js"
import { HealthResponseSchema } from "./schemas/system.js"

export const apiContract = {
  system: {
    health: oc
      .route({ method: "GET", path: "/health" })
      .output(HealthResponseSchema)
  },
  chat: {
    create: oc
      .route({ method: "POST", path: "/chat" })
      .input(ChatRequestSchema)
      .output(ChatResponseSchema),
    startRun: oc
      .route({ method: "POST", path: "/chat-runs" })
      .input(ChatRequestSchema)
      .output(ChatRunStartResponseSchema)
  },
  benchmark: {
    query: oc
      .route({ method: "POST", path: "/benchmark/query" })
      .input(BenchmarkQueryRequestSchema)
      .output(BenchmarkQueryResponseSchema),
    search: oc
      .route({ method: "POST", path: "/benchmark/search" })
      .input(BenchmarkSearchRequestSchema)
      .output(BenchmarkSearchResponseSchema)
  }
} as const

export type ApiContract = typeof apiContract
export type ApiClient = ContractRouterClient<ApiContract>
