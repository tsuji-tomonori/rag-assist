import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import app from "../app.js"
import type { Permission, RouteAuthorizationMode } from "../authorization.js"

const appSourcePath = path.resolve(process.cwd(), "src/app.ts")
const routeSourceDir = path.resolve(process.cwd(), "src/routes")

const publicMiddlewarePaths = ["/health", "/openapi.json"]

type RoutePolicy = {
  method: string
  path: string
  mode: RouteAuthorizationMode
  permission?: Permission
  operationKey?: string
  resourceCondition?: string
  errorDisclosure?: string
}

const operationMatrixSubset = new Map<string, { operationKey: string; resourceCondition: string }>([
  ["POST /chat", { operationKey: "chat.send", resourceCondition: "documentGroupRead" }],
  ["POST /chat-runs", { operationKey: "chat.run.start", resourceCondition: "documentGroupRead" }],
  ["GET /chat-runs/{runId}/events", { operationKey: "chat.run.events.read", resourceCondition: "ownedRun" }],
  ["POST /search", { operationKey: "document.search", resourceCondition: "documentGroupRead" }],
  ["GET /conversation-history", { operationKey: "history.read.self", resourceCondition: "self" }],
  ["POST /questions", { operationKey: "support.ticket.create.self", resourceCondition: "self" }],
  ["GET /questions/{questionId}", { operationKey: "support.ticket.read", resourceCondition: "requester" }],
  ["POST /questions/{questionId}/resolve", { operationKey: "support.ticket.close", resourceCondition: "requester" }],
  ["GET /document-groups", { operationKey: "folder.read", resourceCondition: "documentGroupRead" }],
  ["POST /document-groups", { operationKey: "folder.create.group", resourceCondition: "documentGroupFull" }],
  ["POST /document-groups/{groupId}/share", { operationKey: "folder.share", resourceCondition: "documentGroupFull" }],
  ["GET /documents", { operationKey: "document.read", resourceCondition: "benchmarkSeedScope" }],
  ["POST /documents", { operationKey: "document.upload", resourceCondition: "benchmarkSeedScope" }],
  ["POST /documents/uploads", { operationKey: "document.upload_session.create", resourceCondition: "documentUploadSession" }],
  ["POST /benchmark-runs", { operationKey: "benchmark.run", resourceCondition: "documentGroupRead" }],
  ["POST /admin/users/{userId}/roles", { operationKey: "role.assign", resourceCondition: "roleAssignment" }]
])

test("auth middleware uses a public allowlist instead of protected path enumeration", async () => {
  const source = await readRouteSources()
  const middlewareBlock = findAuthMiddlewareBlock(source)

  for (const publicPath of publicMiddlewarePaths) {
    assert.match(
      middlewareBlock,
      new RegExp(`["']${escapeRegex(publicPath)}["']`),
      `${publicPath} must stay in the explicit public allowlist`
    )
  }
  assert.doesNotMatch(middlewareBlock, /protectedApiPaths/, "protected path enumeration must not return")
  assert.match(middlewareBlock, /publicApiPaths\.has\(c\.req\.path\)/, "auth middleware must bypass only publicApiPaths")
  assert.match(middlewareBlock, /return authMiddleware\(c, next\)/, "non-public paths must reach authMiddleware")
})

test("protected API routes keep route-level permission checks", async () => {
  const source = await readRouteSources()
  const routePolicies = (await openApiRoutePolicies()).filter((policy) => policy.mode !== "public")

  for (const policy of routePolicies) {
    const block = findRouteBlock(source, policy)
    if (policy.mode === "authenticated") {
      assert.doesNotMatch(
        block,
        /requirePermission|hasPermission/,
        `${policy.method.toUpperCase()} ${policy.path} must remain authenticated-only without extra role checks`
      )
      continue
    }
    assert.ok(policy.permission, `${policy.method.toUpperCase()} ${policy.path} must declare a permission`)
    if (policy.mode === "requesterOrPermission") {
      assert.match(
        block,
        new RegExp(`hasPermission\\([\\s\\S]*?["']${escapeRegex(policy.permission)}["']\\)`),
        `${policy.method.toUpperCase()} ${policy.path} must allow ${policy.permission}`
      )
      assert.match(
        block,
        /requesterUserId[\s\S]*?user\.userId/,
        `${policy.method.toUpperCase()} ${policy.path} must check requester ownership`
      )
    } else if (policy.mode === "benchmarkSeedOrPermission") {
      assert.match(
        block,
        new RegExp(`hasPermission\\([\\s\\S]*?["']${escapeRegex(policy.permission)}["']\\)`),
        `${policy.method.toUpperCase()} ${policy.path} must allow ${policy.permission}`
      )
      assert.match(
        block,
        /benchmark:seed_corpus[\s\S]*?authorizeDocumentUpload/,
        `${policy.method.toUpperCase()} ${policy.path} must restrict benchmark seed uploads`
      )
    } else if (policy.mode === "benchmarkSeedListOrPermission") {
      assert.match(
        block,
        new RegExp(`hasPermission\\([\\s\\S]*?["']${escapeRegex(policy.permission)}["']\\)`),
        `${policy.method.toUpperCase()} ${policy.path} must allow ${policy.permission}`
      )
      assert.match(
        block,
        /benchmark:seed_corpus[\s\S]*?listDocuments/,
        `${policy.method.toUpperCase()} ${policy.path} must only allow benchmark seed document listing`
      )
    } else if (policy.mode === "benchmarkSeedDeleteOrPermission") {
      assert.match(
        block,
        /authorizeDocumentDelete[\s\S]*?deleteDocument/,
        `${policy.method.toUpperCase()} ${policy.path} must use scoped delete authorization`
      )
      assert.match(
        source,
        new RegExp(`function authorizeDocumentDelete[\\s\\S]*?hasPermission\\([\\s\\S]*?["']${escapeRegex(policy.permission)}["']\\)`),
        `${policy.method.toUpperCase()} ${policy.path} must allow ${policy.permission}`
      )
      assert.match(
        source,
        /function authorizeDocumentDelete[\s\S]*?benchmark:seed_corpus[\s\S]*?getDocumentManifest[\s\S]*?isBenchmarkSeedDocumentManifest/,
        `${policy.method.toUpperCase()} ${policy.path} must restrict benchmark seed deletes to the target manifest`
      )
    } else if (policy.mode === "documentUploadSession") {
      assert.match(
        block,
        /authorizeDocumentUploadSession|authorizeUploadedDocumentIngest|authorizeScopedIngest/,
        `${policy.method.toUpperCase()} ${policy.path} must use scoped upload-session authorization`
      )
    } else if (policy.mode === "ownedRun") {
      assert.match(
        block,
        new RegExp(`requirePermission\\([\\s\\S]*?["']${escapeRegex(policy.permission)}["']\\)`),
        `${policy.method.toUpperCase()} ${policy.path} must require ${policy.permission}`
      )
      assert.match(
        block,
        /canReadOwnedRun[\s\S]*?createdBy|createdBy[\s\S]*?user\.userId/,
        `${policy.method.toUpperCase()} ${policy.path} must check run ownership`
      )
    } else if (policy.mode === "benchmarkSeedRunOrOwnedRun") {
      assert.match(
        block,
        /canReadDocumentIngestRun[\s\S]*?run/,
        `${policy.method.toUpperCase()} ${policy.path} must use scoped document ingest run authorization`
      )
      assert.match(
        source,
        new RegExp(`function canReadDocumentIngestRun[\\s\\S]*?hasPermission\\([\\s\\S]*?["']${escapeRegex(policy.permission)}["']\\)`),
        `${policy.method.toUpperCase()} ${policy.path} must preserve ${policy.permission} for owned document ingest runs`
      )
      assert.match(
        source,
        /function canReadDocumentIngestRun[\s\S]*?benchmark:seed_corpus[\s\S]*?purpose === "benchmarkSeed"[\s\S]*?isBenchmarkSeedUploadedObjectIngest/,
        `${policy.method.toUpperCase()} ${policy.path} must restrict BENCHMARK_RUNNER reads to isolated benchmark seed runs`
      )
    } else {
      assert.match(
        block,
        new RegExp(`requirePermission\\([\\s\\S]*?["']${escapeRegex(policy.permission)}["']\\)`),
        `${policy.method.toUpperCase()} ${policy.path} must require ${policy.permission}`
      )
    }
  }
})

test("protected API routes must be explicitly reviewed before they change", async () => {
  const source = await readRouteSources()
  const documentedProtectedRoutes = (await openApiRoutePolicies())
    .filter((policy) => policy.mode !== "public")
    .map(routeKey)
    .sort()

  const actualProtectedRoutes = extractRoutes(source)
    .filter((route) => !publicMiddlewarePaths.includes(route.path))
    .map(routeKey)
    .sort()

  assert.deepEqual(actualProtectedRoutes, documentedProtectedRoutes)
})

test("question routes must be explicitly reviewed before they change", async () => {
  const source = await readRouteSources()
  const expectedQuestionRoutes = (await openApiRoutePolicies())
    .filter((policy) => policy.path.startsWith("/questions"))
    .map(routeKey)
    .sort()

  const actualQuestionRoutes = extractRoutes(source)
    .filter((route) => route.path.startsWith("/questions"))
    .map(routeKey)
    .sort()

  assert.deepEqual(actualQuestionRoutes, expectedQuestionRoutes)
})

test("protected API routes document authorization metadata and auth error responses in OpenAPI", async () => {
  const policies = await openApiRoutePolicies()

  for (const policy of policies) {
    const operation = policy.operation
    assert.ok(operation["x-memorag-authorization"], `${policy.method.toUpperCase()} ${policy.path} must document x-memorag-authorization`)
    if (policy.mode !== "public") {
      assert.ok(operation.responses?.["401"], `${policy.method.toUpperCase()} ${policy.path} must document 401`)
    }
    if (policy.mode !== "public" && policy.mode !== "authenticated") {
      assert.ok(operation.responses?.["403"], `${policy.method.toUpperCase()} ${policy.path} must document 403`)
    }
  }
})

test("protected API routes document three-layer authorization metadata", async () => {
  const policies = await openApiRoutePolicies()

  for (const policy of policies) {
    const route = routeKey(policy)
    const auth = policy.operation["x-memorag-authorization"]
    if (policy.mode !== "public") {
      assert.ok(auth?.resourceCondition, `${route} must document resourceCondition`)
      assert.ok(auth?.errorDisclosure, `${route} must document errorDisclosure`)
      if (policy.mode !== "authenticated") assert.equal(auth.errorDisclosure, "generic", `${route} must default to generic 403 disclosure`)
    }

    const expected = operationMatrixSubset.get(route)
    if (!expected) continue
    assert.equal(auth?.operationKey, expected.operationKey, `${route} must document operationKey`)
    assert.equal(auth?.resourceCondition, expected.resourceCondition, `${route} must document resourceCondition from chapter 20 subset`)
  }
})

test("authorization metadata uses generic forbidden error bodies by default", async () => {
  const policies = await openApiRoutePolicies()

  for (const policy of policies.filter((item) => item.mode !== "public" && item.mode !== "authenticated")) {
    const forbidden = policy.operation["x-memorag-authorization"]?.errors?.find((error) => error.status === 403)
    assert.equal(forbidden?.body?.error, "Forbidden", `${routeKey(policy)} must not expose internal permission names in default 403 metadata`)
  }
})

async function openApiRoutePolicies(): Promise<Array<RoutePolicy & {
  operation: {
    responses?: Record<string, unknown>
    "x-memorag-authorization"?: {
      mode?: RouteAuthorizationMode
      requiredPermissions?: Permission[]
      operationKey?: string
      resourceCondition?: string
      errorDisclosure?: string
      errors?: Array<{ status?: number; body?: { error?: string } }>
    }
  }
}>> {
  const response = await app.request("/openapi.json")
  assert.equal(response.status, 200)
  const document = await response.json() as {
    paths?: Record<string, Record<string, {
      responses?: Record<string, unknown>
      "x-memorag-authorization"?: {
        mode?: RouteAuthorizationMode
        requiredPermissions?: Permission[]
        operationKey?: string
        resourceCondition?: string
        errorDisclosure?: string
        errors?: Array<{ status?: number; body?: { error?: string } }>
      }
    }>>
  }
  const policies: Array<RoutePolicy & { operation: NonNullable<NonNullable<typeof document.paths>[string][string]> }> = []
  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      const auth = operation["x-memorag-authorization"]
      if (!auth?.mode) continue
      policies.push({
        method,
        path,
        mode: auth.mode,
        permission: auth.requiredPermissions?.[0],
        operationKey: auth.operationKey,
        resourceCondition: auth.resourceCondition,
        errorDisclosure: auth.errorDisclosure,
        operation
      })
    }
  }
  return policies
}

async function readRouteSources(): Promise<string> {
  const routeFiles = (await readdir(routeSourceDir))
    .filter((fileName) => fileName.endsWith(".ts"))
    .map((fileName) => path.join(routeSourceDir, fileName))
    .sort()
  const routeSourcePaths = [appSourcePath, ...routeFiles]
  const sources = await Promise.all(routeSourcePaths.map((sourcePath) => readFile(sourcePath, "utf8")))
  return sources.join("\n")
}

function findAuthMiddlewareBlock(source: string): string {
  const start = source.indexOf("const publicApiPaths = new Set")
  assert.notEqual(start, -1, "authMiddleware path list was not found")
  const end = source.indexOf("registerApiRoutes(app, deps, service)", start)
  assert.notEqual(end, -1, "authMiddleware path list end was not found")
  return source.slice(start, end)
}

function findRouteBlock(source: string, policy: RoutePolicy): string {
  if (policy.path === "/chat") return findNamedRouteBlock(source, "chatRoute")

  const block = extractOpenApiBlocks(source).find(
    (candidate) =>
      new RegExp(`method:\\s*["']${escapeRegex(policy.method)}["']`).test(candidate) &&
      new RegExp(`path:\\s*["']${escapeRegex(policy.path)}["']`).test(candidate)
  )
  assert.ok(block, `${policy.method.toUpperCase()} ${policy.path} route was not found`)
  return block
}

function findNamedRouteBlock(source: string, routeName: string): string {
  const routeStart = source.indexOf(`const ${routeName} = looseRoute`)
  assert.notEqual(routeStart, -1, `${routeName} definition was not found`)
  const handlerStart = source.indexOf(`app.openapi(${routeName}`, routeStart)
  assert.notEqual(handlerStart, -1, `${routeName} handler was not found`)
  const nextRouteStart = findNextOpenApiStart(source, handlerStart + 1)
  return source.slice(routeStart, nextRouteStart)
}

function extractRoutes(source: string): Array<Pick<RoutePolicy, "method" | "path">> {
  return [...source.matchAll(/method:\s*["'](get|post|delete)["'],\s*path:\s*["']([^"']+)["']/g)].map((match) => ({
    method: match[1] ?? "",
    path: match[2] ?? ""
  }))
}

function extractOpenApiBlocks(source: string): string[] {
  const starts = [...source.matchAll(/\n\s*app\.openapi\(/g)].map((match) => match.index ?? 0)
  return starts.map((start, index) => {
    const nextStart = starts[index + 1]
    return source.slice(start, nextStart)
  })
}

function findNextOpenApiStart(source: string, startIndex: number): number {
  const match = /\n\s*app\.openapi\(/g
  match.lastIndex = startIndex
  return match.exec(source)?.index ?? source.length
}

function routeKey(route: Pick<RoutePolicy, "method" | "path">): string {
  return `${route.method.toUpperCase()} ${route.path}`
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
