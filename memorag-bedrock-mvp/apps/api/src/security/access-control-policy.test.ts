import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import app from "../app.js"
import { routeAuthorizationMetadata, routeAuthorizationPolicies, type RouteAuthorizationPolicy as RoutePolicy } from "../authorization.js"

const appSourcePath = path.resolve(process.cwd(), "src/app.ts")
const routeSourceDir = path.resolve(process.cwd(), "src/routes")

const protectedMiddlewarePaths = [
  "/me",
  "/admin/*",
  "/documents",
  "/documents/*",
  "/document-groups",
  "/document-groups/*",
  "/document-ingest-runs",
  "/document-ingest-runs/*",
  "/chat",
  "/chat-runs",
  "/chat-runs/*",
  "/search",
  "/questions",
  "/questions/*",
  "/conversation-history",
  "/conversation-history/*",
  "/debug-runs",
  "/debug-runs/*",
  "/benchmark/query",
  "/benchmark/search",
  "/benchmark-runs",
  "/benchmark-runs/*",
  "/benchmark-suites"
]

const routePolicies: RoutePolicy[] = routeAuthorizationPolicies.filter((policy) => policy.mode !== "public")

test("protected API paths keep auth middleware coverage", async () => {
  const source = await readRouteSources()
  const middlewareBlock = findAuthMiddlewareBlock(source)

  for (const protectedPath of protectedMiddlewarePaths) {
    assert.match(
      middlewareBlock,
      new RegExp(`["']${escapeRegex(protectedPath)}["']`),
      `${protectedPath} must stay covered by authMiddleware`
    )
  }
})

test("protected API routes keep route-level permission checks", async () => {
  const source = await readRouteSources()

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
        /function authorizeDocumentDelete[\s\S]*?benchmark:seed_corpus[\s\S]*?isBenchmarkSeedDocumentManifest/,
        `${policy.method.toUpperCase()} ${policy.path} must restrict benchmark seed deletes`
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
  const expectedProtectedRoutes = routePolicies.map(routeKey).sort()

  const actualProtectedRoutes = extractRoutes(source)
    .filter((route) => isProtectedRoute(route.path))
    .map(routeKey)
    .sort()

  assert.deepEqual(actualProtectedRoutes, expectedProtectedRoutes)
})

test("question routes must be explicitly reviewed before they change", async () => {
  const source = await readRouteSources()
  const expectedQuestionRoutes = routePolicies
    .filter((policy) => policy.path.startsWith("/questions"))
    .map(routeKey)
    .sort()

  const actualQuestionRoutes = extractRoutes(source)
    .filter((route) => route.path.startsWith("/questions"))
    .map(routeKey)
    .sort()

  assert.deepEqual(actualQuestionRoutes, expectedQuestionRoutes)
})

test("OpenAPI authorization metadata matches route authorization policies", async () => {
  const response = await app.request("/openapi.json")
  assert.equal(response.status, 200)
  const document = await response.json() as {
    paths?: Record<string, Record<string, { responses?: Record<string, unknown>; "x-memorag-authorization"?: unknown }>>
  }

  for (const policy of routeAuthorizationPolicies) {
    const operation = document.paths?.[policy.path]?.[policy.method]
    assert.ok(operation, `${policy.method.toUpperCase()} ${policy.path} must exist in OpenAPI`)
    assert.deepEqual(
      operation["x-memorag-authorization"],
      routeAuthorizationMetadata(policy),
      `${policy.method.toUpperCase()} ${policy.path} OpenAPI authorization metadata must match policy`
    )
    if (policy.mode !== "public") {
      assert.ok(operation.responses?.["401"], `${policy.method.toUpperCase()} ${policy.path} must document 401`)
    }
    if (policy.mode !== "public" && policy.mode !== "authenticated") {
      assert.ok(operation.responses?.["403"], `${policy.method.toUpperCase()} ${policy.path} must document 403`)
    }
  }
})

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
  const start = source.indexOf("const protectedApiPaths = [")
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

function isProtectedRoute(routePath: string): boolean {
  return protectedMiddlewarePaths.some((protectedPath) => {
    if (!protectedPath.endsWith("/*")) return routePath === protectedPath
    return routePath.startsWith(protectedPath.slice(0, -1))
  })
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
