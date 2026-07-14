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
  "query",
  "type",
  "status",
  "documentGroup",
  "sort"
] as const

const documentSortKeys = new Set(["updatedDesc", "updatedAsc", "fileNameAsc", "chunkDesc", "typeAsc"])
const documentSearchParamSet = new Set<string>(documentStateSearchParams)

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

  const invalidQuery = hasInvalidViewQuery(params) || hasHash
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

  url.pathname = "/"
  url.search = ""
  if (view !== "chat") url.searchParams.set("view", view)
  url.hash = ""
  return relativeUrl(url)
}

export function normalizeAppRouteUrl(currentHref: string, route: ParsedAppRoute): string {
  const url = new URL(currentHref)
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

function hasInvalidViewQuery(params: URLSearchParams): boolean {
  const keys = [...params.keys()]
  return keys.some((key) => key !== "view") || params.getAll("view").length > 1
}

function hasInvalidDocumentQuery(params: URLSearchParams): boolean {
  const keys = [...new Set(params.keys())]
  return keys.some((key) => {
    if (key === "view") return params.getAll(key).length > 1
    if (!documentSearchParamSet.has(key)) return true
    const values = params.getAll(key)
    if (values.length !== 1 || values[0] === "") return true
    return key === "sort" && !documentSortKeys.has(values[0]!)
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
      || (key === "sort" && !documentSortKeys.has(values[0]!))
    ) {
      params.delete(key)
    }
  }
}

function relativeUrl(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`
}
