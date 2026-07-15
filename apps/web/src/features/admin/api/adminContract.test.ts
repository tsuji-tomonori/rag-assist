import { describe, expect, it } from "vitest"
import { AdminContractError, buildAdminQuery, decodeAccessRoleList, decodeAliasAuditLogPage, decodeAliasListPage, decodeManagedUserAuditLogPage, decodeManagedUserListPage } from "./adminContract.js"

const alias = {
  aliasId: "alias-1",
  version: "alias-version-1",
  term: "pto",
  expansions: ["有給休暇"],
  scope: { tenantId: "tenant-1" },
  status: "draft",
  createdBy: "user-1",
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-02T00:00:00.000Z"
}

describe("admin API contract decoders", () => {
  it("accepts complete alias page metadata and rejects silent array-only responses", () => {
    expect(decodeAliasListPage({
      aliases: [alias],
      total: 1,
      truncated: false,
      source: "alias-ledger",
      asOf: "2026-05-02T00:00:00.000Z",
      version: "ledger-version-1"
    })).toMatchObject({ total: 1, version: "ledger-version-1", aliases: [alias] })

    expect(() => decodeAliasListPage({ aliases: [alias] })).toThrow(AdminContractError)
    expect(() => decodeAliasListPage({ aliases: [{ ...alias, version: undefined }], total: 1, truncated: false, source: "alias-ledger", asOf: "now", version: "ledger-v1" }))
      .toThrow(AdminContractError)
  })

  it("requires actor/result/reason fields on alias audit evidence", () => {
    const metadata = { total: 1, truncated: false, source: "alias-audit", asOf: "now" }
    expect(() => decodeAliasAuditLogPage({ ...metadata, auditLog: [{ auditId: "audit-1", action: "publish" }] }))
      .toThrow(AdminContractError)
    expect(decodeAliasAuditLogPage({
      ...metadata,
      auditLog: [{
        auditId: "audit-1",
        tenantId: "tenant-1",
        action: "publish",
        actorUserId: "user-1",
        result: "success",
        reason: "検索へ反映",
        createdAt: "now",
        detail: "published"
      }]
    }).auditLog[0]).toMatchObject({ result: "success", reason: "検索へ反映" })
  })

  it("requires approved role display metadata and catalog provenance", () => {
    expect(decodeAccessRoleList({
      roles: [{ role: "CHAT_USER", displayName: "チャット利用者", description: "チャットを利用", kind: "systemPreset", permissions: ["chat:create"] }],
      catalogVersion: "role-v2",
      source: "role-catalog",
      asOf: "now"
    })).toMatchObject({ catalogVersion: "role-v2" })
    expect(() => decodeAccessRoleList({ roles: [{ role: "CHAT_USER", permissions: [] }] }))
      .toThrow(AdminContractError)
  })

  it("serializes only provided query fields", () => {
    expect(buildAdminQuery({ query: "休暇", status: "draft", cursor: undefined, limit: 50 }))
      .toBe("?query=%E4%BC%91%E6%9A%87&status=draft&limit=50")
  })

  it("requires server capability, projection evidence, and common audit result metadata", () => {
    const metadata = { total: 1, truncated: false, source: "authoritative_identity", asOf: "now", version: "ledger-v1" }
    const user = {
      userId: "user-1",
      email: "user@example.com",
      status: "active",
      groups: ["CHAT_USER"],
      createdAt: "now",
      updatedAt: "now",
      capability: { canAssignRoles: true, canSuspend: true, canUnsuspend: false, canDelete: true, blockers: [] },
      effectivePermissions: ["chat:create"],
      projection: { source: "authoritative_identity", asOf: "now", reconciliationState: "current" }
    }
    expect(decodeManagedUserListPage({ ...metadata, users: [user] }).users[0]).toMatchObject({ capability: { canAssignRoles: true } })
    expect(() => decodeManagedUserListPage({ ...metadata, version: undefined, users: [user] })).toThrow(AdminContractError)
    expect(() => decodeManagedUserListPage({ ...metadata, users: [{ ...user, capability: undefined }] })).toThrow(AdminContractError)

    const audit = {
      auditId: "security_mutation_1",
      action: "role:assign",
      result: "denied",
      reason: "self mutation",
      tenantId: "tenant-1",
      targetType: "applicationRolePrincipal",
      actorUserId: "user-1",
      targetUserId: "user-1",
      policyVersion: "role-v1",
      source: "security_audit_outbox",
      beforeGroups: ["CHAT_USER"],
      afterGroups: ["CHAT_USER"],
      createdAt: "now"
    }
    expect(decodeManagedUserAuditLogPage({ ...metadata, auditLog: [audit] }).auditLog[0]?.result).toBe("denied")
    expect(() => decodeManagedUserAuditLogPage({ ...metadata, auditLog: [{ ...audit, result: undefined }] })).toThrow(AdminContractError)
  })
})
