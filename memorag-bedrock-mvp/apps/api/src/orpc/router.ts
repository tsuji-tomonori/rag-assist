import { implement, ORPCError } from "@orpc/server"
import { apiContract } from "@memorag-mvp/contract"
import type { AppUser } from "../auth.js"
import { hasPermission } from "../authorization.js"
import type { Dependencies } from "../dependencies.js"
import type { MemoRagService } from "../rag/memorag-service.js"
import type { BenchmarkSearchRequest } from "@memorag-mvp/contract"

export type OrpcContext = {
  deps: Dependencies
  service: MemoRagService
  user: AppUser
}

const api = implement(apiContract).$context<OrpcContext>()

export const orpcRouter = api.router({
  system: {
    health: api.system.health.handler(async () => ({
      ok: true,
      service: "memorag-bedrock-mvp",
      timestamp: new Date().toISOString()
    }))
  },
  chat: {
    create: api.chat.create.handler(async ({ input, context }) => {
      requireOrpcPermission(context.user, "chat:create")
      if ((input.includeDebug ?? input.debug ?? false) === true) {
        requireOrpcPermission(context.user, "chat:admin:read_all")
      }
      return context.service.chat(input, context.user)
    }),
    startRun: api.chat.startRun.handler(async ({ input, context }) => {
      requireOrpcPermission(context.user, "chat:create")
      if ((input.includeDebug ?? input.debug ?? false) === true) {
        requireOrpcPermission(context.user, "chat:admin:read_all")
      }
      return context.service.startChatRun(input, context.user)
    })
  },
  benchmark: {
    query: api.benchmark.query.handler(async ({ input, context }) => {
      requireOrpcPermission(context.user, "benchmark:query")
      const result = await context.service.chat({
        ...input,
        includeDebug: input.includeDebug ?? true,
        searchFilters: {
          source: "benchmark-runner",
          docType: "benchmark-corpus",
          benchmarkSuiteId: input.benchmarkSuiteId
        }
      }, context.user)
      return { id: input.id, ...result }
    }),
    search: api.benchmark.search.handler(async ({ input, context }) => {
      requireOrpcPermission(context.user, "benchmark:query")
      const { user: requestUser, benchmarkSuiteId, ...searchInput } = input
      if (requestUser) {
        throw new ORPCError("BAD_REQUEST", { message: "Benchmark search user override is not supported" })
      }

      const benchmarkFilterSuiteId = benchmarkSuiteId ?? searchInput.filters?.benchmarkSuiteId
      if (benchmarkFilterSuiteId) {
        searchInput.filters = {
          ...(searchInput.filters ?? {}),
          source: "benchmark-runner",
          docType: "benchmark-corpus",
          benchmarkSuiteId: benchmarkFilterSuiteId
        }
      }
      return context.service.search(searchInput, benchmarkSearchUser(context.user, requestUser))
    })
  }
})

function requireOrpcPermission(user: AppUser, permission: Parameters<typeof hasPermission>[1]) {
  if (!hasPermission(user, permission)) {
    throw new ORPCError("FORBIDDEN", { message: `Forbidden: missing ${permission}` })
  }
}

function benchmarkSearchUser(runnerUser: AppUser, requestUser: BenchmarkSearchRequest["user"]): AppUser {
  if (!requestUser) return runnerUser
  throw new ORPCError("BAD_REQUEST", { message: "Benchmark search user override is not supported" })
}
