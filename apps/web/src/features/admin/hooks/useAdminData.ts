import { useRef, useState } from "react"
import { listAccessRoles } from "../api/accessRolesApi.js"
import { assignUserRoles, createManagedUser, deleteManagedUser, getManagedUserDeletionPreflight, listManagedUsers, suspendManagedUser, unsuspendManagedUser } from "../api/adminUsersApi.js"
import { createAlias, disableAlias, listAliasAuditLog, listAliases, publishAliases, reviewAlias, updateAlias } from "../api/aliasesApi.js"
import { listAdminAuditLog } from "../api/auditLogApi.js"
import { getCostAuditSummary } from "../api/costApi.js"
import { listUsageSummaries } from "../api/usageApi.js"
import type { AccessRoleDefinition, AliasAuditLogItem, AliasDefinition, CostAuditSummary, ManagedUser, ManagedUserAuditLogEntry, ManagedUserDeletionPreflight, UserUsageSummary } from "../types.js"
import {
  confirmedOperation,
  failedOperation,
  partialOperation,
  type OperationEvidence,
  type OperationOutcome
} from "../../../shared/ui/operationOutcome.js"

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
  const pendingMutationKeysRef = useRef(new Set<string>())

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

  async function confirmAdminMutation<T>({
    value,
    successMessage,
    partialMessage,
    evidence
  }: {
    value: T
    successMessage: string
    partialMessage: string
    evidence?: OperationEvidence
  }): Promise<OperationOutcome<T>> {
    try {
      await refreshAdminSideEffects()
      return confirmedOperation(value, { message: successMessage, evidence })
    } catch (err) {
      console.warn("Failed to refresh admin state after confirmed mutation", err)
      setError(partialMessage)
      return partialOperation(value, partialMessage, evidence)
    }
  }

  async function onAssignUserRoles(userId: string, groups: string[], reason: string): Promise<OperationOutcome<ManagedUser>> {
    const mutationKey = `role:${userId}`
    if (pendingMutationKeysRef.current.has(mutationKey)) return failedOperation(new Error("このユーザーのロールは変更処理中です"))
    pendingMutationKeysRef.current.add(mutationKey)
    setLoading(true)
    setError(null)
    try {
      const updated = await assignUserRoles(userId, groups, reason)
      setManagedUsers((prev) => [updated, ...(prev ?? []).filter((user) => user.userId !== userId)].sort((a, b) => a.email.localeCompare(b.email)))
      return await confirmAdminMutation({
        value: updated,
        successMessage: "API がロール変更を確定し、許可された管理データを更新しました。",
        partialMessage: "ロール変更は確定しましたが、関連する管理データを更新できませんでした。再実行せず更新してください。",
        evidence: { resultReference: updated.userId, version: updated.updatedAt }
      })
    } catch (err) {
      const outcome = failedOperation(err)
      setError(outcome.message)
      return outcome
    } finally {
      pendingMutationKeysRef.current.delete(mutationKey)
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

  async function onPrepareManagedUserDelete(userId: string): Promise<ManagedUserDeletionPreflight | null> {
    setLoading(true)
    setError(null)
    try {
      return await getManagedUserDeletionPreflight(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return null
    } finally {
      setLoading(false)
    }
  }

  async function onSetManagedUserStatus(userId: string, action: "suspend" | "unsuspend" | "delete", successorUserId?: string): Promise<OperationOutcome<ManagedUser>> {
    const mutationKey = `status:${userId}`
    if (pendingMutationKeysRef.current.has(mutationKey)) return failedOperation(new Error("このユーザーの状態は変更処理中です"))
    pendingMutationKeysRef.current.add(mutationKey)
    setLoading(true)
    setError(null)
    try {
      const updated =
        action === "suspend" ? await suspendManagedUser(userId) : action === "unsuspend" ? await unsuspendManagedUser(userId) : await deleteManagedUser(userId, successorUserId)
      setManagedUsers((prev) => {
        const current = prev ?? []
        if (updated.status === "deleted") return current.filter((user) => user.userId !== userId)
        return [updated, ...current.filter((user) => user.userId !== userId)].sort((a, b) => a.email.localeCompare(b.email))
      })
      return await confirmAdminMutation({
        value: updated,
        successMessage: "API がユーザー状態の変更を確定しました。",
        partialMessage: "ユーザー状態の変更は確定しましたが、関連する管理データを更新できませんでした。再実行せず更新してください。",
        evidence: { resultReference: updated.userId, version: updated.updatedAt }
      })
    } catch (err) {
      const outcome = failedOperation(err)
      setError(outcome.message)
      return outcome
    } finally {
      pendingMutationKeysRef.current.delete(mutationKey)
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

  async function onDisableAlias(aliasId: string): Promise<OperationOutcome<AliasDefinition>> {
    if (!canDisableAliases) return failedOperation(new Error("用語展開を無効化する権限がありません"))
    const mutationKey = `alias-disable:${aliasId}`
    if (pendingMutationKeysRef.current.has(mutationKey)) return failedOperation(new Error("この用語展開は無効化処理中です"))
    pendingMutationKeysRef.current.add(mutationKey)
    setLoading(true)
    setError(null)
    try {
      const disabled = await disableAlias(aliasId)
      setAliases((current) => current?.map((alias) => alias.aliasId === disabled.aliasId ? disabled : alias) ?? current)
      return await confirmAdminMutation({
        value: disabled,
        successMessage: "API が用語展開の無効化を確定しました。",
        partialMessage: "無効化は確定しましたが、管理データを更新できませんでした。再実行せず更新してください。",
        evidence: { resultReference: disabled.aliasId, version: disabled.updatedAt }
      })
    } catch (err) {
      const outcome = failedOperation(err)
      setError(outcome.message)
      return outcome
    } finally {
      pendingMutationKeysRef.current.delete(mutationKey)
      setLoading(false)
    }
  }

  async function onPublishAliases(): Promise<OperationOutcome<{ version: string; publishedAt: string; aliasCount: number }>> {
    const mutationKey = "alias-publish"
    if (!canPublishAliases) return failedOperation(new Error("用語展開を公開する権限がありません"))
    if (pendingMutationKeysRef.current.has(mutationKey)) return failedOperation(new Error("用語展開は公開処理中です"))
    pendingMutationKeysRef.current.add(mutationKey)
    setLoading(true)
    setError(null)
    try {
      const published = await publishAliases()
      return await confirmAdminMutation({
        value: published,
        successMessage: "API が用語展開の公開 version を確定しました。",
        partialMessage: "公開 version は確定しましたが、管理データを更新できませんでした。再実行せず更新してください。",
        evidence: { resultReference: published.version, version: published.version }
      })
    } catch (err) {
      const outcome = failedOperation(err)
      setError(outcome.message)
      return outcome
    } finally {
      pendingMutationKeysRef.current.delete(mutationKey)
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
    onPrepareManagedUserDelete,
    onSetManagedUserStatus,
    onCreateAlias,
    onUpdateAlias,
    onReviewAlias,
    onDisableAlias,
    onPublishAliases
  }
}
