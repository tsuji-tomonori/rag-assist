export type DocumentRouteState = {
  groupId?: string
  documentId?: string
  migrationId?: string
  query?: string
  status?: string
}

export type DocumentRouteChangeOptions = {
  replace?: boolean
}

export function readDocumentRoute(location: Pick<Location, "pathname" | "search">): { isDocumentRoute: boolean; state: DocumentRouteState } {
  const segments = location.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment))
  if (segments[0] !== "documents") return { isDocumentRoute: false, state: {} }

  const params = new URLSearchParams(location.search)
  const state: DocumentRouteState = {}
  if (segments[1] === "groups" && segments[2]) state.groupId = segments[2]
  else if (segments[1] === "reindex-migrations" && segments[2]) state.migrationId = segments[2]
  else if (segments[1]) state.documentId = segments[1]

  const query = params.get("query")?.trim()
  const status = params.get("status")?.trim()
  if (query) state.query = query
  if (status) state.status = status
  return { isDocumentRoute: true, state }
}

export function buildDocumentRoutePath(state: DocumentRouteState): string {
  let path = "/documents"
  if (state.migrationId) path = `/documents/reindex-migrations/${encodeURIComponent(state.migrationId)}`
  else if (state.documentId) path = `/documents/${encodeURIComponent(state.documentId)}`
  else if (state.groupId) path = `/documents/groups/${encodeURIComponent(state.groupId)}`

  const params = new URLSearchParams()
  if (state.query?.trim()) params.set("query", state.query.trim())
  if (state.status?.trim() && state.status !== "all") params.set("status", state.status.trim())
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

export function documentRouteKey(state: DocumentRouteState): string {
  return JSON.stringify({
    groupId: state.groupId ?? "",
    documentId: state.documentId ?? "",
    migrationId: state.migrationId ?? "",
    query: state.query ?? "",
    status: state.status ?? ""
  })
}
