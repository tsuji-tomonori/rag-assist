import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

type RoutePolicy = {
  method: string
  path: string
  permission: string
}

const appSourcePath = path.resolve(process.cwd(), "src/app.ts")

const protectedMiddlewarePaths = [
  "/documents",
  "/documents/*",
  "/chat",
  "/questions",
  "/questions/*",
  "/conversation-history",
  "/conversation-history/*",
  "/debug-runs",
  "/debug-runs/*",
  "/benchmark/query",
  "/benchmark-runs",
  "/benchmark-runs/*",
  "/benchmark-suites"
]

const routePolicies: RoutePolicy[] = [
  { method: "get", path: "/documents", permission: "rag:doc:read" },
  { method: "post", path: "/documents", permission: "rag:doc:write:group" },
  { method: "delete", path: "/documents/{documentId}", permission: "rag:doc:delete:group" },
  { method: "post", path: "/chat", permission: "chat:create" },
  { method: "post", path: "/questions", permission: "chat:create" },
  { method: "get", path: "/questions", permission: "answer:edit" },
  { method: "get", path: "/questions/{questionId}", permission: "answer:edit" },
  { method: "post", path: "/questions/{questionId}/answer", permission: "answer:publish" },
  { method: "post", path: "/questions/{questionId}/resolve", permission: "answer:publish" },
  { method: "get", path: "/conversation-history", permission: "chat:read:own" },
  { method: "post", path: "/conversation-history", permission: "chat:create" },
  { method: "delete", path: "/conversation-history/{id}", permission: "chat:delete:own" },
  { method: "get", path: "/debug-runs", permission: "chat:admin:read_all" },
  { method: "get", path: "/debug-runs/{runId}", permission: "chat:admin:read_all" },
  { method: "post", path: "/debug-runs/{runId}/download", permission: "chat:admin:read_all" },
  { method: "post", path: "/benchmark/query", permission: "benchmark:run" },
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
    assert.match(
      block,
      new RegExp(`requirePermission\\([\\s\\S]*?["']${escapeRegex(policy.permission)}["']\\)`),
      `${policy.method.toUpperCase()} ${policy.path} must require ${policy.permission}`
    )
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
