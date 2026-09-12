import {
adminAuditActions,
adminSections,
adminUserSortKeys,
adminUserStatuses,
aliasAuditActions,
aliasSortKeys,
aliasStatuses,
type AdminWorkspaceUrlState
} from "../../features/admin/urlState.js"
import type { DocumentWorkspaceUrlState } from "../../features/documents/components/DocumentWorkspace.js"
import {
buildAppViewUrl,
decodeRouteSegment,
parseAppRoute,
type AppRouteIssue,
type ParsedAppRoute
} from "../routing/appRoute.js"
import type { AppView } from "../types.js"

import type { AppRouteNotice } from "./useAppShellState.js"

const documentSortKeys = new Set(["updatedDesc", "updatedAsc", "fileNameAsc", "chunkDesc", "typeAsc"])

export function readAppRouteFromLocation(): ParsedAppRoute {
  if (typeof window === "undefined") return { view: "chat", needsNormalization: false }
  return parseAppRoute(window.location)
}

export function readDocumentWorkspaceUrlStateFromLocation(): DocumentWorkspaceUrlState {
  if (typeof window === "undefined") return {}
  const params = new URLSearchParams(window.location.search)
  const pathState = readDocumentWorkspacePathState(window.location.pathname)
  const sort = params.get("sort")
  const page = parseDocumentPage(params.get("page"))
  const pageSize = parseDocumentPageSize(params.get("pageSize"))
  return {
    ...pathState,
    folderId: params.get("group") || pathState.folderId,
    documentId: params.get("document") || pathState.documentId,
    migrationId: params.get("migration") || pathState.migrationId,
    folderQuery: params.get("folderQuery") || undefined,
    query: params.get("query") || undefined,
    type: params.get("type") || undefined,
    status: params.get("status") || undefined,
    groupFilter: params.get("documentGroup") || undefined,
    sort: sort && documentSortKeys.has(sort) ? sort as DocumentWorkspaceUrlState["sort"] : undefined,
    page,
    pageSize
  }
}

export function readAdminWorkspaceUrlStateFromLocation(): AdminWorkspaceUrlState {
  if (typeof window === "undefined") return {}
  const params = new URLSearchParams(window.location.search)
  const section = params.get("section")
  const aliasStatus = params.get("aliasStatus")
  const auditAction = params.get("auditAction")
  const sort = params.get("sort")
  const userStatus = params.get("userStatus")
  const userSort = params.get("userSort")
  return {
    section: section && adminSections.has(section as NonNullable<AdminWorkspaceUrlState["section"]>)
      ? section as AdminWorkspaceUrlState["section"]
      : undefined,
    query: params.get("adminQuery") || undefined,
    userStatus: userStatus && adminUserStatuses.has(userStatus as never) ? userStatus as AdminWorkspaceUrlState["userStatus"] : undefined,
    userSort: userSort && adminUserSortKeys.has(userSort as never) ? userSort as AdminWorkspaceUrlState["userSort"] : undefined,
    aliasStatus: aliasStatus && aliasStatuses.has(aliasStatus as NonNullable<AdminWorkspaceUrlState["aliasStatus"]>)
      ? aliasStatus as AdminWorkspaceUrlState["aliasStatus"]
      : undefined,
    auditAction: auditAction && (
      adminAuditActions.has(auditAction as never) || aliasAuditActions.has(auditAction as never)
    ) ? auditAction as AdminWorkspaceUrlState["auditAction"] : undefined,
    sort: sort && aliasSortKeys.has(sort as NonNullable<AdminWorkspaceUrlState["sort"]>)
      ? sort as AdminWorkspaceUrlState["sort"]
      : undefined,
    selected: params.get("selected") || undefined
  }
}

export function readDocumentWorkspacePathState(pathname: string): Pick<DocumentWorkspaceUrlState, "folderId" | "documentId" | "migrationId"> {
  const groupsMatch = pathname.match(/^\/documents\/groups\/([^/]+)$/)
  const folderId = groupsMatch?.[1] ? decodeRouteSegment(groupsMatch[1]) : undefined
  if (folderId) return { folderId }
  const migrationMatch = pathname.match(/^\/documents\/reindex-migrations\/([^/]+)$/)
  const migrationId = migrationMatch?.[1] ? decodeRouteSegment(migrationMatch[1]) : undefined
  if (migrationId) return { migrationId }
  const documentMatch = pathname.match(/^\/documents\/([^/]+)$/)
  const documentId = documentMatch?.[1] ? decodeRouteSegment(documentMatch[1]) : undefined
  if (documentId && documentMatch?.[1] !== "reindex-migrations" && documentMatch?.[1] !== "groups") return { documentId }
  return {}
}

export function writeDocumentWorkspaceUrlStateToLocation(state: DocumentWorkspaceUrlState, historyMode: "push" | "replace") {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  const pathState = documentWorkspacePathState(state)
  url.pathname = pathState.pathname
  url.searchParams.delete("view")
  setSearchParam(url, "group", pathState.pathKey === "folderId" ? undefined : state.folderId)
  setSearchParam(url, "document", pathState.pathKey === "documentId" ? undefined : state.documentId)
  setSearchParam(url, "migration", pathState.pathKey === "migrationId" ? undefined : state.migrationId)
  setSearchParam(url, "folderQuery", state.folderQuery)
  setSearchParam(url, "query", state.query)
  setSearchParam(url, "type", state.type)
  setSearchParam(url, "status", state.status)
  setSearchParam(url, "documentGroup", state.groupFilter)
  setSearchParam(url, "sort", state.sort)
  setSearchParam(url, "page", state.page && state.page > 1 ? String(state.page) : undefined)
  setSearchParam(url, "pageSize", state.pageSize && state.pageSize !== 25 ? String(state.pageSize) : undefined)
  writeBrowserUrl(url, historyMode)
}

export function writeAdminWorkspaceUrlStateToLocation(state: AdminWorkspaceUrlState, historyMode: "push" | "replace") {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  url.pathname = "/"
  url.search = ""
  url.searchParams.set("view", "admin")
  setSearchParam(url, "section", state.section && state.section !== "overview" ? state.section : undefined)
  setSearchParam(url, "adminQuery", state.query)
  setSearchParam(url, "userStatus", state.userStatus)
  setSearchParam(url, "userSort", state.userSort && state.userSort !== "emailAsc" ? state.userSort : undefined)
  setSearchParam(url, "aliasStatus", state.aliasStatus)
  setSearchParam(url, "auditAction", state.auditAction)
  setSearchParam(url, "sort", state.sort && state.sort !== "updatedDesc" ? state.sort : undefined)
  setSearchParam(url, "selected", state.selected)
  url.hash = ""
  writeBrowserUrl(url, historyMode)
}

export function aliasListQueryForState(state: AdminWorkspaceUrlState) {
  return {
    limit: 50,
    query: state.query,
    status: state.aliasStatus,
    sort: state.sort ?? "updatedDesc" as const
  }
}

export function adminUserQueryForState(state: AdminWorkspaceUrlState) {
  return {
    limit: 50,
    query: state.query,
    status: state.userStatus,
    sort: state.userSort ?? "emailAsc" as const
  }
}

export function aliasAuditQueryForState(state: AdminWorkspaceUrlState) {
  return {
    limit: 50,
    query: state.query,
    action: state.auditAction && aliasAuditActions.has(state.auditAction as never)
      ? state.auditAction as "create" | "update" | "review" | "transition" | "disable" | "publish"
      : undefined,
    aliasId: state.selected
  }
}

export function adminAuditQueryForState(state: AdminWorkspaceUrlState) {
  return {
    limit: 50,
    query: state.query,
    action: state.auditAction && adminAuditActions.has(state.auditAction as never)
      ? state.auditAction as "user:create" | "role:assign" | "user:suspend" | "user:unsuspend" | "user:delete"
      : undefined
  }
}

export function parseDocumentPage(value: string | null): number | undefined {
  if (!value || !/^[1-9]\d{0,5}$/.test(value)) return undefined
  return Number(value)
}

export function parseDocumentPageSize(value: string | null): number | undefined {
  if (value !== "25" && value !== "50" && value !== "100") return undefined
  return Number(value)
}

export function documentWorkspacePathState(state: DocumentWorkspaceUrlState): {
  pathname: string
  pathKey?: "folderId" | "documentId" | "migrationId"
} {
  if (state.migrationId) {
    const migrationId = encodeDocumentPathSegment(state.migrationId)
    return migrationId
      ? { pathname: `/documents/reindex-migrations/${migrationId}`, pathKey: "migrationId" }
      : { pathname: "/documents" }
  }
  if (state.documentId) {
    const documentId = encodeDocumentPathSegment(state.documentId)
    return documentId
      ? { pathname: `/documents/${documentId}`, pathKey: "documentId" }
      : { pathname: "/documents" }
  }
  if (state.folderId) {
    const folderId = encodeDocumentPathSegment(state.folderId)
    return folderId
      ? { pathname: `/documents/groups/${folderId}`, pathKey: "folderId" }
      : { pathname: "/documents" }
  }
  return { pathname: "/documents" }
}

export function encodeDocumentPathSegment(value?: string): string | undefined {
  if (!value) return undefined
  const encoded = encodeURIComponent(value)
  return decodeRouteSegment(encoded) ? encoded : undefined
}

export function writeAppViewToLocation(view: AppView, historyMode: "push" | "replace") {
  if (typeof window === "undefined") return
  writeRelativeUrl(buildAppViewUrl(window.location.href, view), historyMode)
}

export function setSearchParam(url: URL, key: string, value?: string) {
  if (value) url.searchParams.set(key, value)
  else url.searchParams.delete(key)
}

export function writeRelativeUrl(relativeUrl: string, historyMode: "push" | "replace") {
  if (typeof window === "undefined") return
  writeBrowserUrl(new URL(relativeUrl, window.location.href), historyMode)
}

export function writeBrowserUrl(url: URL, historyMode: "push" | "replace") {
  const nextUrl = `${url.pathname}${url.search}${url.hash}`
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (nextUrl === currentUrl) return
  if (historyMode === "push") window.history.pushState(window.history.state, "", nextUrl)
  else window.history.replaceState(window.history.state, "", nextUrl)
}

export function routeNoticeForIssue(issue?: AppRouteIssue): AppRouteNotice | null {
  if (!issue) return null
  return {
    kind: "invalid",
    message: "URLの画面指定を確認できなかったため、安全な開始画面または正規URLへ移動しました。"
  }
}
