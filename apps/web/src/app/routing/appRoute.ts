import type { AppView } from "../types.js"

export type AppRouteIssue = "invalid-path" | "invalid-view" | "invalid-query" | "conflicting-view"

export type ParsedAppRoute = {
  view: AppView
  issue?: AppRouteIssue
  needsNormalization: boolean
}

export type AppViewAccess = {
  canAnswerQuestions: boolean
  canReadBenchmarkRuns: boolean
  canReadDocuments: boolean
  canSeeAdminSettings: boolean
}

const appViews = new Set<AppView>([
  "chat",
  "assignee",
  "history",
  "favorites",
  "benchmark",
  "admin",
  "documents",
  "profile"
])

export const documentStateSearchParams = [
  "group",
  "document",
  "migration",
  "folderQuery",
  "query",
  "type",
  "status",
  "documentGroup",
  "sort",
  "page",
  "pageSize"
] as const

export const adminStateSearchParams = [
  "section",
  "adminQuery",
  "aliasStatus",
  "auditAction",
  "sort",
  "selected"
] as const

const documentSortKeys = new Set(["updatedDesc", "updatedAsc", "fileNameAsc", "chunkDesc", "typeAsc"])
const documentSearchParamSet = new Set<string>(documentStateSearchParams)
const adminSearchParamSet = new Set<string>(adminStateSearchParams)
const adminSections = new Set(["overview", "users", "roles", "usage-cost", "audit", "alias"])
const aliasStatuses = new Set(["draft", "approved", "disabled"])
const aliasSortKeys = new Set(["updatedDesc", "termAsc"])
const adminAuditActions = new Set([
  "user:create",
  "role:assign",
  "user:suspend",
  "user:unsuspend",
  "user:delete",
  "create",
  "update",
  "review",
  "transition",
  "disable",
  "publish"
])

export function parseAppRoute(location: Pick<Location, "pathname" | "search"> & { hash?: string }): ParsedAppRoute {
  const params = new URLSearchParams(location.search)
  const viewParam = params.get("view")
  const hasHash = Boolean(location.hash)

  if (isSupportedDocumentPath(location.pathname)) {
    const issue = viewParam && viewParam !== "documents"
      ? "conflicting-view"
      : hasInvalidDocumentQuery(params) || hasHash
        ? "invalid-query"
        : undefined
    return {
      view: "documents",
      issue,
      needsNormalization: viewParam !== null || issue !== undefined
    }
  }

  if (location.pathname !== "/") {
    return { view: "chat", issue: "invalid-path", needsNormalization: true }
  }

  const invalidQuery = hasInvalidViewQuery(params, viewParam) || hasHash
  if (viewParam === null) {
    return invalidQuery
      ? { view: "chat", issue: "invalid-query", needsNormalization: true }
      : { view: "chat", needsNormalization: false }
  }
  if (viewParam === "documents") {
    const issue = hasInvalidDocumentQuery(params) || hasHash ? "invalid-query" : undefined
    return { view: "documents", issue, needsNormalization: true }
  }
  if (viewParam === "chat") {
    return { view: "chat", issue: invalidQuery ? "invalid-query" : undefined, needsNormalization: true }
  }
  if (appViews.has(viewParam as AppView)) {
    return {
      view: viewParam as AppView,
      issue: invalidQuery ? "invalid-query" : undefined,
      needsNormalization: invalidQuery
    }
  }
  return { view: "chat", issue: "invalid-view", needsNormalization: true }
}

export function buildAppViewUrl(currentHref: string, view: AppView): string {
  const url = new URL(currentHref)
  const currentRoute = parseAppRoute(url)

  if (view === "documents") {
    if (currentRoute.view !== "documents" || !isSupportedDocumentPath(url.pathname)) {
      url.pathname = "/documents"
      url.search = ""
    }
    sanitizeDocumentSearchParams(url.searchParams)
    url.searchParams.delete("view")
    url.hash = ""
    return relativeUrl(url)
  }

  if (view === "admin") {
    url.pathname = "/"
    if (currentRoute.view !== "admin") url.search = ""
    sanitizeAdminSearchParams(url.searchParams)
    url.searchParams.set("view", "admin")
    url.hash = ""
    return relativeUrl(url)
  }

  url.pathname = "/"
  url.search = ""
  if (view !== "chat") url.searchParams.set("view", view)
  url.hash = ""
  return relativeUrl(url)
}

export function normalizeAppRouteUrl(currentHref: string, route: ParsedAppRoute): string {
  const url = new URL(currentHref)
  if (route.view === "admin") {
    url.pathname = "/"
    sanitizeAdminSearchParams(url.searchParams)
    url.searchParams.set("view", "admin")
    url.hash = ""
    return relativeUrl(url)
  }
  if (route.view !== "documents") return buildAppViewUrl(currentHref, route.view)

  if (!isSupportedDocumentPath(url.pathname)) url.pathname = "/documents"
  sanitizeDocumentSearchParams(url.searchParams)
  url.searchParams.delete("view")
  url.hash = ""
  return relativeUrl(url)
}

export function canAccessAppView(view: AppView, access: AppViewAccess): boolean {
  if (view === "assignee") return access.canAnswerQuestions
  if (view === "benchmark") return access.canReadBenchmarkRuns
  if (view === "documents") return access.canReadDocuments
  if (view === "admin") return access.canSeeAdminSettings
  return true
}

export function isSupportedDocumentPath(pathname: string): boolean {
  if (pathname === "/documents") return true

  const groupMatch = pathname.match(/^\/documents\/groups\/([^/]+)$/)
  if (groupMatch?.[1]) return isSafeRouteSegment(groupMatch[1])

  const migrationMatch = pathname.match(/^\/documents\/reindex-migrations\/([^/]+)$/)
  if (migrationMatch?.[1]) return isSafeRouteSegment(migrationMatch[1])

  const documentMatch = pathname.match(/^\/documents\/([^/]+)$/)
  if (!documentMatch?.[1] || documentMatch[1] === "groups" || documentMatch[1] === "reindex-migrations") return false
  return isSafeRouteSegment(documentMatch[1])
}

export function decodeRouteSegment(value: string): string | undefined {
  try {
    const decoded = decodeURIComponent(value)
    if (!decoded || decoded === "." || decoded === ".." || decoded.includes("/") || decoded.includes("\\")) return undefined
    return decoded
  } catch {
    return undefined
  }
}

function isSafeRouteSegment(value: string): boolean {
  return decodeRouteSegment(value) !== undefined
}

function hasInvalidViewQuery(params: URLSearchParams, view: string | null): boolean {
  if (view === "admin") return hasInvalidAdminQuery(params)
  const keys = [...params.keys()]
  return keys.some((key) => key !== "view") || params.getAll("view").length > 1
}

function hasInvalidAdminQuery(params: URLSearchParams): boolean {
  const keys = [...new Set(params.keys())]
  return keys.some((key) => {
    if (key === "view") return params.getAll(key).length !== 1
    if (!adminSearchParamSet.has(key)) return true
    const values = params.getAll(key)
    if (values.length !== 1 || values[0] === "") return true
    return !isValidAdminStateParam(key, values[0]!)
  })
}

function hasInvalidDocumentQuery(params: URLSearchParams): boolean {
  const keys = [...new Set(params.keys())]
  return keys.some((key) => {
    if (key === "view") return params.getAll(key).length > 1
    if (!documentSearchParamSet.has(key)) return true
    const values = params.getAll(key)
    if (values.length !== 1 || values[0] === "") return true
    return !isValidDocumentStateParam(key, values[0]!)
  })
}

function sanitizeDocumentSearchParams(params: URLSearchParams): void {
  for (const key of [...new Set(params.keys())]) {
    if (key === "view") continue
    const values = params.getAll(key)
    if (
      !documentSearchParamSet.has(key)
      || values.length !== 1
      || values[0] === ""
      || !isValidDocumentStateParam(key, values[0]!)
    ) {
      params.delete(key)
    }
  }
}

function sanitizeAdminSearchParams(params: URLSearchParams): void {
  for (const key of [...new Set(params.keys())]) {
    if (key === "view") continue
    const values = params.getAll(key)
    if (
      !adminSearchParamSet.has(key)
      || values.length !== 1
      || values[0] === ""
      || !isValidAdminStateParam(key, values[0]!)
    ) params.delete(key)
  }
}

function isValidAdminStateParam(key: string, value: string): boolean {
  if (key === "section") return adminSections.has(value)
  if (key === "aliasStatus") return aliasStatuses.has(value)
  if (key === "sort") return aliasSortKeys.has(value)
  if (key === "auditAction") return adminAuditActions.has(value)
  return value.length <= 200
}

function isValidDocumentStateParam(key: string, value: string): boolean {
  if (key === "sort") return documentSortKeys.has(value)
  if (key === "page") return /^[1-9]\d{0,5}$/.test(value)
  if (key === "pageSize") return value === "25" || value === "50" || value === "100"
  return true
}

function relativeUrl(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`
}
