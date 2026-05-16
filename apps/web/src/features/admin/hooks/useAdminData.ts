import { useState } from "react"
import { listAccessRoles } from "../api/accessRolesApi.js"
import { assignUserRoles, createManagedUser, deleteManagedUser, listManagedUsers, suspendManagedUser, unsuspendManagedUser } from "../api/adminUsersApi.js"
import { createAlias, disableAlias, listAliasAuditLog, listAliases, publishAliases, reviewAlias, updateAlias } from "../api/aliasesApi.js"
import { listAdminAuditLog } from "../api/auditLogApi.js"
import { getCostAuditSummary } from "../api/costApi.js"
import { listUsageSummaries } from "../api/usageApi.js"
import type { AccessRoleDefinition, AliasAuditLogItem, AliasDefinition, CostAuditSummary, ManagedUser, ManagedUserAuditLogEntry, UserUsageSummary } from "../types.js"

export function useAdminData({
  canReadAdminAuditLog,
  canReadUsage,
  canReadCosts,
  canReadUsers,
  canOpenAdminSettings,
  canReadAliases,
  canWriteAliases,
  canReviewAliases,
  canDisableAliases,
  canPublishAliases,
  setLoading,
  setError
}: {
  canReadAdminAuditLog: boolean
  canReadUsage: boolean
  canReadCosts: boolean
  canReadUsers: boolean
  canOpenAdminSettings: boolean
  canReadAliases: boolean
  canWriteAliases: boolean
  canReviewAliases: boolean
  canDisableAliases: boolean
  canPublishAliases: boolean
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}) {
  const [managedUsers, setManagedUsers] = useState<ManagedUser[] | null>(null)
  const [adminAuditLog, setAdminAuditLog] = useState<ManagedUserAuditLogEntry[] | null>(null)
  const [accessRoles, setAccessRoles] = useState<AccessRoleDefinition[] | null>(null)
  const [usageSummaries, setUsageSummaries] = useState<UserUsageSummary[] | null>(null)
  const [costAudit, setCostAudit] = useState<CostAuditSummary | null>(null)
  const [aliases, setAliases] = useState<AliasDefinition[] | null>(null)
  const [aliasAuditLog, setAliasAuditLog] = useState<AliasAuditLogItem[] | null>(null)

  async function refreshManagedUsers() {
    setManagedUsers(await listManagedUsers())
  }

  async function refreshAdminAuditLog() {
    setAdminAuditLog(await listAdminAuditLog())
  }

  async function refreshAccessRoles() {
    setAccessRoles(await listAccessRoles())
  }

  async function refreshUsageSummaries() {
    setUsageSummaries(await listUsageSummaries())
  }

  async function refreshCostAudit() {
    setCostAudit(await getCostAuditSummary())
  }

  async function refreshAliases() {
    const [nextAliases, nextAuditLog] = await Promise.all([listAliases(), listAliasAuditLog()])
    setAliases(nextAliases)
    setAliasAuditLog(nextAuditLog)
  }

  async function refreshAdminData() {
    await Promise.all([
      canReadUsers ? refreshManagedUsers() : Promise.resolve(),
      canReadAdminAuditLog ? refreshAdminAuditLog() : Promise.resolve(),
      canOpenAdminSettings ? refreshAccessRoles() : Promise.resolve(),
      canReadUsage ? refreshUsageSummaries() : Promise.resolve(),
      canReadCosts ? refreshCostAudit() : Promise.resolve(),
      canReadAliases ? refreshAliases() : Promise.resolve()
    ])
  }

  async function refreshAdminSideEffects() {
    await Promise.all([
      canReadAdminAuditLog ? refreshAdminAuditLog() : Promise.resolve(),
      canReadUsage ? refreshUsageSummaries() : Promise.resolve(),
      canReadCosts ? refreshCostAudit() : Promise.resolve(),
      canReadAliases ? refreshAliases() : Promise.resolve()
    ])
  }

  async function onAssignUserRoles(userId: string, groups: string[]) {
    setLoading(true)
    setError(null)
    try {
      const updated = await assignUserRoles(userId, groups)
      setManagedUsers((prev) => [updated, ...(prev ?? []).filter((user) => user.userId !== userId)].sort((a, b) => a.email.localeCompare(b.email)))
      await refreshAdminSideEffects()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onCreateManagedUser(input: { email: string; displayName?: string; groups?: string[] }) {
    setLoading(true)
    setError(null)
    try {
      const created = await createManagedUser(input)
      setManagedUsers((prev) => [created, ...(prev ?? []).filter((user) => user.userId !== created.userId)].sort((a, b) => a.email.localeCompare(b.email)))
      await refreshAdminSideEffects()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onSetManagedUserStatus(userId: string, action: "suspend" | "unsuspend" | "delete") {
    setLoading(true)
    setError(null)
    try {
      const updated =
        action === "suspend" ? await suspendManagedUser(userId) : action === "unsuspend" ? await unsuspendManagedUser(userId) : await deleteManagedUser(userId)
      setManagedUsers((prev) => {
        const current = prev ?? []
        if (updated.status === "deleted") return current.filter((user) => user.userId !== userId)
        return [updated, ...current.filter((user) => user.userId !== userId)].sort((a, b) => a.email.localeCompare(b.email))
      })
      await refreshAdminSideEffects()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onCreateAlias(input: { term: string; expansions: string[]; scope?: AliasDefinition["scope"] }) {
    if (!canWriteAliases) return
    setLoading(true)
    setError(null)
    try {
      await createAlias(input)
      await refreshAliases()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onUpdateAlias(aliasId: string, input: { term?: string; expansions?: string[]; scope?: AliasDefinition["scope"] }) {
    if (!canWriteAliases) return
    setLoading(true)
    setError(null)
    try {
      await updateAlias(aliasId, input)
      await refreshAliases()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onReviewAlias(aliasId: string, decision: "approve" | "reject", comment?: string) {
    if (!canReviewAliases) return
    setLoading(true)
    setError(null)
    try {
      const reviewed = await reviewAlias(aliasId, decision, comment)
      const [nextAliases, nextAuditLog] = await Promise.all([listAliases(), listAliasAuditLog()])
      setAliases(nextAliases === null ? null : nextAliases.map((alias) => {
        if (alias.aliasId !== aliasId) return alias
        return reviewed.aliasId === aliasId
          ? reviewed
          : {
              ...alias,
              status: decision === "approve" ? "approved" : "draft",
              updatedAt: new Date().toISOString()
            }
      }))
      setAliasAuditLog(nextAuditLog)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onDisableAlias(aliasId: string) {
    if (!canDisableAliases) return
    setLoading(true)
    setError(null)
    try {
      await disableAlias(aliasId)
      await refreshAliases()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onPublishAliases() {
    if (!canPublishAliases) return
    setLoading(true)
    setError(null)
    try {
      await publishAliases()
      await refreshAliases()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return {
    managedUsers,
    adminAuditLog,
    accessRoles,
    usageSummaries,
    costAudit,
    aliases,
    aliasAuditLog,
    refreshManagedUsers,
    refreshAdminAuditLog,
    refreshAccessRoles,
    refreshUsageSummaries,
    refreshCostAudit,
    refreshAliases,
    refreshAdminData,
    onAssignUserRoles,
    onCreateManagedUser,
    onSetManagedUserStatus,
    onCreateAlias,
    onUpdateAlias,
    onReviewAlias,
    onDisableAlias,
    onPublishAliases
  }
}
