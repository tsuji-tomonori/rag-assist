import { APPLICATION_ROLES, type ApplicationRole } from "@memorag-mvp/contract/access-control"
import type { AppUser } from "../auth.js"
import type { ChatInput } from "../chat-orchestration/types.js"
import { config } from "../config.js"
import type { SearchInput } from "../rag/online/retrieval/hybrid/hybrid-retriever.js"

type BenchmarkSuiteRegistration = {
  simulatedSubjectId: string
  corpusSuiteId: string
}

const benchmarkSuiteRegistry = {
  "smoke-agent-v1": registration("smoke-agent-v1", "standard-agent-v1"),
  "standard-agent-v1": registration("standard-agent-v1", "standard-agent-v1"),
  "clarification-smoke-v1": registration("clarification-smoke-v1", "standard-agent-v1"),
  "allganize-rag-evaluation-ja-v1": registration("allganize-rag-evaluation-ja-v1"),
  "mmrag-docqa-v1": registration("mmrag-docqa-v1"),
  "mtrag-v1": registration("mtrag-v1"),
  "chatrag-bench-v1": registration("chatrag-bench-v1"),
  "jp-public-pdf-qa-v1": registration("jp-public-pdf-qa-v1"),
  "mlit-pdf-figure-table-rag-seed-v1": registration("mlit-pdf-figure-table-rag-seed-v1"),
  "architecture-drawing-qarag-v0.1": registration("architecture-drawing-qarag-v0.1"),
  "search-smoke-v1": registration("search-smoke-v1", "standard-agent-v1"),
  "search-standard-v1": registration("search-standard-v1", "standard-agent-v1")
} as const satisfies Record<string, BenchmarkSuiteRegistration>

export type ApprovedBenchmarkSuiteId = keyof typeof benchmarkSuiteRegistry

export type BenchmarkEvaluationSettings = {
  enabled: boolean
  tenantId: string
}

export type BenchmarkEvaluationContext = {
  suiteId: ApprovedBenchmarkSuiteId
  corpusSuiteId: string
  subject: AppUser
  filters: NonNullable<SearchInput["filters"]>
}

export class BenchmarkEvaluationContextError extends Error {
  constructor(
    readonly status: 400 | 403 | 503,
    message: string
  ) {
    super(message)
    this.name = "BenchmarkEvaluationContextError"
  }
}

export function benchmarkCorpusOwnerId(suiteId: string): string | undefined {
  const registration = benchmarkSuiteRegistry[suiteId as ApprovedBenchmarkSuiteId]
  return registration ? registration.simulatedSubjectId : undefined
}

export type BenchmarkQueryInvocationInput = Omit<
  ChatInput,
  "searchFilters" | "searchScope" | "asOfDate" | "asOfDateSource"
> & {
  id?: string
  suiteId: string
}

export type BenchmarkSearchInvocationInput = Omit<
  SearchInput,
  "filters" | "scope" | "semanticVector"
> & {
  suiteId: string
}

export function resolveBenchmarkEvaluationContext(
  runner: AppUser,
  requestedSuiteId: string,
  settings: BenchmarkEvaluationSettings = runtimeSettings()
): BenchmarkEvaluationContext {
  if (!isDedicatedBenchmarkRunner(runner)) {
    throw new BenchmarkEvaluationContextError(403, "Forbidden")
  }
  if (!settings.enabled) {
    throw new BenchmarkEvaluationContextError(503, "Benchmark evaluation is unavailable")
  }

  const tenantId = settings.tenantId.trim()
  if (!tenantId || tenantId === runner.tenantId) {
    throw new BenchmarkEvaluationContextError(503, "Benchmark evaluation is unavailable")
  }

  const suiteId = requestedSuiteId.trim()
  const registration = benchmarkSuiteRegistry[suiteId as ApprovedBenchmarkSuiteId]
  if (!registration || suiteId !== requestedSuiteId) {
    throw new BenchmarkEvaluationContextError(400, "Unknown benchmark suite")
  }

  return {
    suiteId: suiteId as ApprovedBenchmarkSuiteId,
    corpusSuiteId: registration.corpusSuiteId,
    subject: {
      userId: registration.simulatedSubjectId,
      cognitoGroups: [],
      accountStatus: "active",
      tenantId
    },
    filters: {
      tenantId,
      source: "benchmark-runner",
      docType: "benchmark-corpus",
      benchmarkSuiteId: registration.corpusSuiteId
    }
  }
}

export function prepareBenchmarkQueryInvocation(
  input: BenchmarkQueryInvocationInput,
  runner: AppUser,
  settings?: BenchmarkEvaluationSettings
): {
  id?: string
  serviceInput: ChatInput
  subject: AppUser
} {
  const { id, suiteId, ...chatInput } = input
  const context = resolveBenchmarkEvaluationContext(runner, suiteId, settings)
  return {
    id,
    serviceInput: {
      ...chatInput,
      includeDebug: chatInput.includeDebug ?? true,
      searchFilters: { ...context.filters }
    },
    subject: { ...context.subject, cognitoGroups: [...context.subject.cognitoGroups] }
  }
}

export function prepareBenchmarkSearchInvocation(
  input: BenchmarkSearchInvocationInput,
  runner: AppUser,
  settings?: BenchmarkEvaluationSettings
): {
  serviceInput: SearchInput
  subject: AppUser
} {
  const { suiteId, ...searchInput } = input
  const context = resolveBenchmarkEvaluationContext(runner, suiteId, settings)
  return {
    serviceInput: {
      ...searchInput,
      filters: { ...context.filters }
    },
    subject: { ...context.subject, cognitoGroups: [...context.subject.cognitoGroups] }
  }
}

function registration(suiteId: string, corpusSuiteId = suiteId): BenchmarkSuiteRegistration {
  return {
    simulatedSubjectId: `benchmark-evaluation:${corpusSuiteId}`,
    corpusSuiteId
  }
}

function runtimeSettings(): BenchmarkEvaluationSettings {
  return {
    enabled: config.benchmarkEvaluationEnabled,
    tenantId: config.benchmarkEvaluationTenantId
  }
}

function isDedicatedBenchmarkRunner(user: AppUser): boolean {
  if (user.accountStatus !== "active" || !user.tenantId?.trim()) return false
  const applicationRoles = user.cognitoGroups.filter(isApplicationRole)
  return applicationRoles.length === 1 && applicationRoles[0] === "BENCHMARK_RUNNER"
}

function isApplicationRole(value: string): value is ApplicationRole {
  return (APPLICATION_ROLES as readonly string[]).includes(value)
}
