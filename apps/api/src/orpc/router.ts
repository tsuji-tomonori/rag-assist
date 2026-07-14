import { implement, ORPCError } from "@orpc/server"
import { apiContract } from "@memorag-mvp/contract"
import type { AppUser } from "../auth.js"
import { hasPermission } from "../authorization.js"
import {
  BenchmarkEvaluationContextError,
  prepareBenchmarkQueryInvocation,
  prepareBenchmarkSearchInvocation
} from "../benchmark/evaluation-context.js"
import type { Dependencies } from "../dependencies.js"
import type { MemoRagService } from "../rag/memorag-service.js"

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
      const invocation = benchmarkOrpc(() => prepareBenchmarkQueryInvocation(input, context.user))
      const result = await context.service.chat(invocation.serviceInput, invocation.subject)
      return { id: invocation.id, ...result }
    }),
    search: api.benchmark.search.handler(async ({ input, context }) => {
      requireOrpcPermission(context.user, "benchmark:query")
      const invocation = benchmarkOrpc(() => prepareBenchmarkSearchInvocation(input, context.user))
      return context.service.search(invocation.serviceInput, invocation.subject)
    })
  }
})

function requireOrpcPermission(user: AppUser, permission: Parameters<typeof hasPermission>[1]) {
  if (!hasPermission(user, permission)) {
    throw new ORPCError("FORBIDDEN", { message: `Forbidden: missing ${permission}` })
  }
}

function benchmarkOrpc<T>(resolve: () => T): T {
  try {
    return resolve()
  } catch (error) {
    if (!(error instanceof BenchmarkEvaluationContextError)) throw error
    if (error.status === 400) throw new ORPCError("BAD_REQUEST", { message: error.message })
    if (error.status === 403) throw new ORPCError("FORBIDDEN", { message: error.message })
    throw new ORPCError("SERVICE_UNAVAILABLE", { message: error.message })
  }
}
