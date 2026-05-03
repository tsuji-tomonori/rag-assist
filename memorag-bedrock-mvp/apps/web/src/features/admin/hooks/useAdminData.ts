import { useState } from "react"
import {
  assignUserRoles,
  createManagedUser,
  deleteManagedUser,
  getCostAuditSummary,
  listAccessRoles,
  listAdminAuditLog,
  listManagedUsers,
  listUsageSummaries,
  suspendManagedUser,
  unsuspendManagedUser,
  type AccessRoleDefinition,
  type CostAuditSummary,
  type ManagedUser,
  type ManagedUserAuditLogEntry,
  type UserUsageSummary
} from "../../../api.js"

export function useAdminData({
  canReadAdminAuditLog,
  canReadUsage,
  canReadCosts,
  canReadUsers,
  canOpenAdminSettings,
  setLoading,
  setError
}: {
  canReadAdminAuditLog: boolean
  canReadUsage: boolean
  canReadCosts: boolean
  canReadUsers: boolean
  canOpenAdminSettings: boolean
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}) {
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([])
  const [adminAuditLog, setAdminAuditLog] = useState<ManagedUserAuditLogEntry[]>([])
  const [accessRoles, setAccessRoles] = useState<AccessRoleDefinition[]>([])
  const [usageSummaries, setUsageSummaries] = useState<UserUsageSummary[]>([])
  const [costAudit, setCostAudit] = useState<CostAuditSummary | null>(null)

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

  async function refreshAdminData() {
    await Promise.all([
      canReadUsers ? refreshManagedUsers() : Promise.resolve(),
      canReadAdminAuditLog ? refreshAdminAuditLog() : Promise.resolve(),
      canOpenAdminSettings ? refreshAccessRoles() : Promise.resolve(),
      canReadUsage ? refreshUsageSummaries() : Promise.resolve(),
      canReadCosts ? refreshCostAudit() : Promise.resolve()
    ])
  }

  async function refreshAdminSideEffects() {
    await Promise.all([
      canReadAdminAuditLog ? refreshAdminAuditLog() : Promise.resolve(),
      canReadUsage ? refreshUsageSummaries() : Promise.resolve(),
      canReadCosts ? refreshCostAudit() : Promise.resolve()
    ])
  }

  async function onAssignUserRoles(userId: string, groups: string[]) {
    setLoading(true)
    setError(null)
    try {
      const updated = await assignUserRoles(userId, groups)
      setManagedUsers((prev) => [updated, ...prev.filter((user) => user.userId !== userId)].sort((a, b) => a.email.localeCompare(b.email)))
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
      setManagedUsers((prev) => [created, ...prev.filter((user) => user.userId !== created.userId)].sort((a, b) => a.email.localeCompare(b.email)))
      await refreshAdminSideEffects()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onSetManagedUserStatus(userId: string, action: "suspend" | "unsuspend" | "delete") {
    if (action === "delete" && !window.confirm("このユーザーを管理台帳から削除状態にします。続行しますか？")) return
    setLoading(true)
    setError(null)
    try {
      const updated =
        action === "suspend" ? await suspendManagedUser(userId) : action === "unsuspend" ? await unsuspendManagedUser(userId) : await deleteManagedUser(userId)
      setManagedUsers((prev) => {
        if (updated.status === "deleted") return prev.filter((user) => user.userId !== userId)
        return [updated, ...prev.filter((user) => user.userId !== userId)].sort((a, b) => a.email.localeCompare(b.email))
      })
      await refreshAdminSideEffects()
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
    refreshManagedUsers,
    refreshAdminAuditLog,
    refreshAccessRoles,
    refreshUsageSummaries,
    refreshCostAudit,
    refreshAdminData,
    onAssignUserRoles,
    onCreateManagedUser,
    onSetManagedUserStatus
  }
}
