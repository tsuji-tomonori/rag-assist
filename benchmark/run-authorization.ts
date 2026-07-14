import { spawnSync } from "node:child_process"
import { readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

export type BenchmarkAuthorizationBoundary =
  | "protected_read"
  | "external_side_effect"
  | "durable_commit"

export type BenchmarkAuthorizationCheck = (boundary: BenchmarkAuthorizationBoundary) => Promise<void>

type AuthorizationResponse = Readonly<{
  authorized?: unknown
  boundary?: unknown
  runId?: unknown
  tenantId?: unknown
}>

type AuthorizationInvoker = (input: Readonly<{
  functionName: string
  payload: Readonly<{
    tenantId: string
    runId: string
    boundary: BenchmarkAuthorizationBoundary
  }>
}>) => Promise<AuthorizationResponse>

let invocationSequence = 0

/**
 * Reconstructs benchmark authorization immediately before each protected
 * network read or external side effect. Local runners are an explicit no-op;
 * CodeBuild fails closed when the authorization function is not configured.
 */
export function createBenchmarkAuthorizationCheck(options: {
  env?: NodeJS.ProcessEnv
  invoke?: AuthorizationInvoker
} = {}): BenchmarkAuthorizationCheck {
  const env = options.env ?? process.env
  const invoke = options.invoke ?? invokeAuthorizationLambda
  let denied = false
  return async (boundary) => {
    if (denied) throw authorizationFailure()
    const functionName = env.BENCHMARK_AUTHORIZATION_FUNCTION_NAME?.trim()
    if (!functionName) {
      if (env.CODEBUILD_BUILD_ID) {
        denied = true
        throw authorizationFailure()
      }
      return
    }
    const tenantId = env.TENANT_ID?.trim()
    const runId = env.RUN_ID?.trim()
    if (!tenantId || !runId) {
      denied = true
      throw authorizationFailure()
    }

    let response: AuthorizationResponse
    try {
      response = await invoke({ functionName, payload: { tenantId, runId, boundary } })
    } catch {
      denied = true
      throw authorizationFailure()
    }
    if (
      response.authorized !== true
      || response.boundary !== boundary
      || response.runId !== runId
      || response.tenantId !== tenantId
    ) {
      denied = true
      throw authorizationFailure()
    }
  }
}

/** Authorization is evaluated before fetch is called, so a denial dispatches no request. */
export function createCurrentAuthorizedFetch(options: {
  fetchImpl?: typeof fetch
  authorize?: BenchmarkAuthorizationCheck
} = {}): typeof fetch {
  const authorize = options.authorize ?? createBenchmarkAuthorizationCheck()
  return (async (input: URL | RequestInfo, init?: RequestInit) => {
    await authorize(fetchAuthorizationBoundary(input, init))
    const fetchImpl = options.fetchImpl ?? globalThis.fetch
    return fetchImpl(input, init)
  }) as typeof fetch
}

export function fetchAuthorizationBoundary(input: URL | RequestInfo, init?: RequestInit): BenchmarkAuthorizationBoundary {
  const requestMethod = input instanceof Request ? input.method : undefined
  const method = (init?.method ?? requestMethod ?? "GET").toUpperCase()
  return method === "GET" || method === "HEAD" || method === "OPTIONS"
    ? "protected_read"
    : "external_side_effect"
}

async function invokeAuthorizationLambda(input: Parameters<AuthorizationInvoker>[0]): Promise<AuthorizationResponse> {
  invocationSequence += 1
  const responsePath = path.join(tmpdir(), `benchmark-authorization-${process.pid}-${invocationSequence}.json`)
  try {
    const result = spawnSync("aws", [
      "lambda",
      "invoke",
      "--function-name",
      input.functionName,
      "--cli-binary-format",
      "raw-in-base64-out",
      "--payload",
      JSON.stringify(input.payload),
      responsePath
    ], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"]
    })
    if (result.error || result.status !== 0) throw authorizationFailure()
    const metadata = parseJsonObject(result.stdout)
    if (metadata.FunctionError) throw authorizationFailure()
    return parseJsonObject(readFileSync(responsePath, "utf-8"))
  } finally {
    rmSync(responsePath, { force: true })
  }
}

function parseJsonObject(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw authorizationFailure()
  return parsed as Record<string, unknown>
}

function authorizationFailure(): Error {
  return new Error("benchmark_authorization_failed")
}
