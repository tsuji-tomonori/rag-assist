import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

type RoutePolicy = {
  method: string
  path: string
  permission?: string
  mode?: "authenticated" | "required" | "requesterOrPermission" | "ownedRun" | "benchmarkSeedOrPermission" | "benchmarkSeedListOrPermission" | "benchmarkSeedDeleteOrPermission" | "documentUploadSession"
}

const appSourcePath = path.resolve(process.cwd(), "src/app.ts")

const protectedMiddlewarePaths = [
  "/me",
  "/admin/*",
  "/documents",
  "/documents/*",
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

const routePolicies: RoutePolicy[] = [
  { method: "get", path: "/me", mode: "authenticated" },
  { method: "post", path: "/admin/users", permission: "user:create" },
  { method: "get", path: "/admin/users", permission: "user:read" },
  { method: "get", path: "/admin/audit-log", permission: "access:policy:read" },
  { method: "post", path: "/admin/users/{userId}/roles", permission: "access:role:assign" },
  { method: "post", path: "/admin/users/{userId}/suspend", permission: "user:suspend" },
  { method: "post", path: "/admin/users/{userId}/unsuspend", permission: "user:unsuspend" },
  { method: "delete", path: "/admin/users/{userId}", permission: "user:delete" },
  { method: "get", path: "/admin/roles", permission: "access:policy:read" },
  { method: "get", path: "/admin/aliases", permission: "rag:alias:read" },
  { method: "post", path: "/admin/aliases", permission: "rag:alias:write:group" },
  { method: "post", path: "/admin/aliases/{aliasId}/update", permission: "rag:alias:write:group" },
  { method: "post", path: "/admin/aliases/{aliasId}/review", permission: "rag:alias:review:group" },
  { method: "post", path: "/admin/aliases/{aliasId}/disable", permission: "rag:alias:disable:group" },
  { method: "post", path: "/admin/aliases/publish", permission: "rag:alias:publish:group" },
  { method: "get", path: "/admin/aliases/audit-log", permission: "rag:alias:read" },
  { method: "get", path: "/admin/usage", permission: "usage:read:all_users" },
  { method: "get", path: "/admin/costs", permission: "cost:read:all" },
  { method: "get", path: "/documents", permission: "rag:doc:read", mode: "benchmarkSeedListOrPermission" },
  { method: "post", path: "/documents", permission: "rag:doc:write:group", mode: "benchmarkSeedOrPermission" },
  { method: "post", path: "/documents/uploads", permission: "rag:doc:write:group", mode: "documentUploadSession" },
  { method: "post", path: "/documents/uploads/{uploadId}/content", permission: "rag:doc:write:group", mode: "documentUploadSession" },
  { method: "post", path: "/documents/uploads/{uploadId}/ingest", permission: "rag:doc:write:group", mode: "documentUploadSession" },
  { method: "post", path: "/document-ingest-runs", permission: "rag:doc:write:group", mode: "documentUploadSession" },
  { method: "get", path: "/document-ingest-runs/{runId}", permission: "chat:read:own", mode: "ownedRun" },
  { method: "get", path: "/document-ingest-runs/{runId}/events", permission: "chat:read:own", mode: "ownedRun" },
  { method: "post", path: "/documents/{documentId}/reindex", permission: "rag:index:rebuild:group" },
  { method: "get", path: "/documents/reindex-migrations", permission: "rag:index:rebuild:group" },
  { method: "post", path: "/documents/{documentId}/reindex/stage", permission: "rag:index:rebuild:group" },
  { method: "post", path: "/documents/reindex-migrations/{migrationId}/cutover", permission: "rag:index:rebuild:group" },
  { method: "post", path: "/documents/reindex-migrations/{migrationId}/rollback", permission: "rag:index:rebuild:group" },
  { method: "delete", path: "/documents/{documentId}", permission: "rag:doc:delete:group", mode: "benchmarkSeedDeleteOrPermission" },
  { method: "post", path: "/chat", permission: "chat:create" },
  { method: "post", path: "/chat-runs", permission: "chat:create" },
  { method: "get", path: "/chat-runs/{runId}/events", permission: "chat:read:own" },
  { method: "post", path: "/search", permission: "rag:doc:read" },
  { method: "post", path: "/questions", permission: "chat:create" },
  { method: "get", path: "/questions", permission: "answer:edit" },
  { method: "get", path: "/questions/{questionId}", permission: "answer:edit", mode: "requesterOrPermission" },
  { method: "post", path: "/questions/{questionId}/answer", permission: "answer:publish" },
  { method: "post", path: "/questions/{questionId}/resolve", permission: "answer:publish", mode: "requesterOrPermission" },
  { method: "get", path: "/conversation-history", permission: "chat:read:own" },
  { method: "post", path: "/conversation-history", permission: "chat:create" },
  { method: "delete", path: "/conversation-history/{id}", permission: "chat:delete:own" },
  { method: "get", path: "/debug-runs", permission: "chat:admin:read_all" },
  { method: "get", path: "/debug-runs/{runId}", permission: "chat:admin:read_all" },
  { method: "post", path: "/debug-runs/{runId}/download", permission: "chat:admin:read_all" },
  { method: "post", path: "/benchmark/query", permission: "benchmark:query" },
  { method: "post", path: "/benchmark/search", permission: "benchmark:query" },
  { method: "get", path: "/benchmark-suites", permission: "benchmark:read" },
  { method: "post", path: "/benchmark-runs", permission: "benchmark:run" },
  { method: "get", path: "/benchmark-runs", permission: "benchmark:read" },
  { method: "get", path: "/benchmark-runs/{runId}", permission: "benchmark:read" },
  { method: "post", path: "/benchmark-runs/{runId}/cancel", permission: "benchmark:cancel" },
  { method: "post", path: "/benchmark-runs/{runId}/download", permission: "benchmark:download" }
]

test("protected API paths keep auth middleware coverage", async () => {
  const source = await readFile(appSourcePath, "utf8")
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
  const source = await readFile(appSourcePath, "utf8")

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
        /authorizeDocumentUploadSession|authorizeUploadedDocumentIngest/,
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
        /canReadOwnedRun[\s\S]*?createdBy/,
        `${policy.method.toUpperCase()} ${policy.path} must check run ownership`
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
  const source = await readFile(appSourcePath, "utf8")
  const expectedProtectedRoutes = routePolicies.map(routeKey).sort()

  const actualProtectedRoutes = extractRoutes(source)
    .filter((route) => isProtectedRoute(route.path))
    .map(routeKey)
    .sort()

  assert.deepEqual(actualProtectedRoutes, expectedProtectedRoutes)
})

test("question routes must be explicitly reviewed before they change", async () => {
  const source = await readFile(appSourcePath, "utf8")
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

function findAuthMiddlewareBlock(source: string): string {
  const start = source.indexOf("for (const path of [")
  assert.notEqual(start, -1, "authMiddleware path list was not found")
  const end = source.indexOf("}\n\nfunction looseRoute", start)
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
  const nextRouteStart = source.indexOf("\napp.openapi(", handlerStart + 1)
  return source.slice(routeStart, nextRouteStart)
}

function extractRoutes(source: string): Array<Pick<RoutePolicy, "method" | "path">> {
  return [...source.matchAll(/method:\s*["'](get|post|delete)["'],\s*path:\s*["']([^"']+)["']/g)].map((match) => ({
    method: match[1] ?? "",
    path: match[2] ?? ""
  }))
}

function extractOpenApiBlocks(source: string): string[] {
  const starts = [...source.matchAll(/\napp\.openapi\(/g)].map((match) => match.index ?? 0)
  return starts.map((start, index) => {
    const nextStart = starts[index + 1]
    return source.slice(start, nextStart)
  })
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
