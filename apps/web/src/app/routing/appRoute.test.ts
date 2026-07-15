import { describe, expect, it } from "vitest"
import {
  buildAppViewUrl,
  canAccessAppView,
  decodeRouteSegment,
  isSupportedDocumentPath,
  normalizeAppRouteUrl,
  parseAppRoute
} from "./appRoute.js"

describe("appRoute", () => {
  it("parses canonical view routes and supported document deep links", () => {
    expect(parseAppRoute({ pathname: "/", search: "" })).toEqual({
      view: "chat",
      needsNormalization: false
    })
    expect(parseAppRoute({ pathname: "/", search: "?view=history" })).toEqual({
      view: "history",
      needsNormalization: false
    })
    expect(parseAppRoute({ pathname: "/documents/groups/group-1", search: "?query=policy" })).toEqual({
      view: "documents",
      needsNormalization: false
    })
  })

  it("classifies invalid, obsolete, conflicting, and legacy routes for safe normalization", () => {
    expect(parseAppRoute({ pathname: "/", search: "?view=obsolete" })).toEqual({
      view: "chat",
      issue: "invalid-view",
      needsNormalization: true
    })
    expect(parseAppRoute({ pathname: "/obsolete", search: "" })).toEqual({
      view: "chat",
      issue: "invalid-path",
      needsNormalization: true
    })
    expect(parseAppRoute({ pathname: "/documents/doc-1", search: "?view=admin" })).toEqual({
      view: "documents",
      issue: "conflicting-view",
      needsNormalization: true
    })
    expect(parseAppRoute({ pathname: "/", search: "?view=documents&query=policy" })).toEqual({
      view: "documents",
      needsNormalization: true
    })
    expect(parseAppRoute({ pathname: "/", search: "?view=history&unknown=value" })).toEqual({
      view: "history",
      issue: "invalid-query",
      needsNormalization: true
    })
    expect(parseAppRoute({ pathname: "/", search: "?view=history&view=admin" })).toEqual({
      view: "history",
      issue: "invalid-query",
      needsNormalization: true
    })
  })

  it("builds canonical URLs without retaining document workspace state across views", () => {
    expect(buildAppViewUrl("https://app.example/documents/doc-1?query=policy&view=documents", "history"))
      .toBe("/?view=history")
    expect(buildAppViewUrl("https://app.example/?view=history", "documents"))
      .toBe("/documents")
    expect(buildAppViewUrl("https://app.example/?view=profile", "chat"))
      .toBe("/")
    expect(buildAppViewUrl("https://app.example/?view=history&unknown=value#stale", "favorites"))
      .toBe("/?view=favorites")
  })

  it("accepts and preserves validated admin section/filter/sort/selection state", () => {
    const search = "?view=admin&section=alias&adminQuery=休暇&aliasStatus=draft&auditAction=review&sort=termAsc&selected=alias-1"
    expect(parseAppRoute({ pathname: "/", search })).toEqual({ view: "admin", needsNormalization: false })
    expect(buildAppViewUrl(`https://app.example/${search}`, "admin"))
      .toBe(`/${search.replace("休暇", "%E4%BC%91%E6%9A%87")}`)
  })

  it("removes unknown or malformed admin state without carrying it to another view", () => {
    const parsed = parseAppRoute({ pathname: "/", search: "?view=admin&section=unknown&sort=unsafe&extra=value" })
    expect(parsed).toEqual({ view: "admin", issue: "invalid-query", needsNormalization: true })
    expect(normalizeAppRouteUrl("https://app.example/?view=admin&section=unknown&sort=unsafe&extra=value", parsed))
      .toBe("/?view=admin")
    expect(buildAppViewUrl("https://app.example/?view=admin&section=alias&selected=alias-1", "history"))
      .toBe("/?view=history")
  })

  it("normalizes legacy document routes while preserving approved restorable state", () => {
    const parsed = parseAppRoute({ pathname: "/", search: "?view=documents&folderQuery=rules&query=policy&sort=updatedDesc&page=2&pageSize=50" })
    expect(normalizeAppRouteUrl("https://app.example/?view=documents&folderQuery=rules&query=policy&sort=updatedDesc&page=2&pageSize=50", parsed))
      .toBe("/documents?folderQuery=rules&query=policy&sort=updatedDesc&page=2&pageSize=50")

    const invalidQuery = parseAppRoute({
      pathname: "/documents/doc-1",
      search: "?query=policy&sort=unknown&extra=value"
    })
    expect(invalidQuery.issue).toBe("invalid-query")
    expect(normalizeAppRouteUrl(
      "https://app.example/documents/doc-1?query=policy&sort=unknown&extra=value#stale",
      invalidQuery
    )).toBe("/documents/doc-1?query=policy")
  })

  it("keeps valid paging state and removes malformed page values", () => {
    expect(parseAppRoute({
      pathname: "/documents/groups/group-1",
      search: "?folderQuery=規定&page=2&pageSize=100"
    })).toEqual({ view: "documents", needsNormalization: false })

    const invalid = parseAppRoute({
      pathname: "/documents/groups/group-1",
      search: "?folderQuery=規定&page=0&pageSize=75"
    })
    expect(invalid.issue).toBe("invalid-query")
    expect(normalizeAppRouteUrl(
      "https://app.example/documents/groups/group-1?folderQuery=規定&page=0&pageSize=75",
      invalid
    )).toBe("/documents/groups/group-1?folderQuery=%E8%A6%8F%E5%AE%9A")
  })

  it("rejects malformed or path-escaping document identifiers", () => {
    expect(isSupportedDocumentPath("/documents/groups/group-1")).toBe(true)
    expect(isSupportedDocumentPath("/documents/groups")).toBe(false)
    expect(isSupportedDocumentPath("/documents/groups/group-1/child")).toBe(false)
    expect(isSupportedDocumentPath("/documents/%2Fadmin")).toBe(false)
    expect(decodeRouteSegment("%E0%A4%A")).toBeUndefined()
  })

  it("resolves protected views from exact UI guards without broadening authorization", () => {
    const noPrivilegedAccess = {
      canAnswerQuestions: false,
      canReadBenchmarkRuns: false,
      canReadDocuments: false,
      canSeeAdminSettings: false
    }
    expect(canAccessAppView("chat", noPrivilegedAccess)).toBe(true)
    expect(canAccessAppView("profile", noPrivilegedAccess)).toBe(true)
    expect(canAccessAppView("assignee", noPrivilegedAccess)).toBe(false)
    expect(canAccessAppView("benchmark", noPrivilegedAccess)).toBe(false)
    expect(canAccessAppView("documents", noPrivilegedAccess)).toBe(false)
    expect(canAccessAppView("admin", noPrivilegedAccess)).toBe(false)
  })
})
