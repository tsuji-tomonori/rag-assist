import { useRef, useState } from "react"
import { listAccessRoles } from "../api/accessRolesApi.js"
import { assignUserRoles, createManagedUser, deleteManagedUser, getManagedUserDeletionPreflight, listManagedUsers, suspendManagedUser, unsuspendManagedUser } from "../api/adminUsersApi.js"
import { createAlias, disableAlias, listAliasAuditLog, listAliases, publishAliases, reviewAlias, transitionAliasToDraft, updateAlias } from "../api/aliasesApi.js"
import { createAdminAuditExport, listAdminAuditLog } from "../api/auditLogApi.js"
import { createCostExport, getCostAuditSummary } from "../api/costApi.js"
import { createUsageExport, listUsageSummaries } from "../api/usageApi.js"
import type {
  AccessRoleList,
  AdminAuditLogQuery,
  AliasAuditLogPage,
  AliasAuditLogQuery,
  AliasDefinition,
  AliasListPage,
  AliasListQuery,
  CostAuditSummary,
  ManagedUser,
  ManagedUserAuditLogPage,
  ManagedUserDeletionPreflight,
  ManagedUserListPage,
  ManagedUserListQuery,
  UsageQuery,
  UsageSummaryPage
} from "../types.js"
import {
  confirmedOperation,
  failedOperation,
  partialOperation,
  type OperationEvidence,
  type OperationOutcome
} from "../../../shared/ui/operationOutcome.js"

const defaultPageLimit = 50

export function useAdminData({
  canReadAdminAuditLog,
  canExportAdminAuditLog = false,
  canReadUsage,
  canReadCosts,
  canExportUsage = false,
  canExportCosts = false,
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
  canExportAdminAuditLog?: boolean
  canReadUsage: boolean
  canReadCosts: boolean
  canExportUsage?: boolean
  canExportCosts?: boolean
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
  const [managedUserPage, setManagedUserPage] = useState<ManagedUserListPage | null>(null)
  const [adminAuditPage, setAdminAuditPage] = useState<ManagedUserAuditLogPage | null>(null)
  const [accessRoleList, setAccessRoleList] = useState<AccessRoleList | null>(null)
  const [usageSummaries, setUsageSummaries] = useState<UsageSummaryPage | null>(null)
  const [costAudit, setCostAudit] = useState<CostAuditSummary | null>(null)
  const [aliasPage, setAliasPage] = useState<AliasListPage | null>(null)
  const [aliasAuditPage, setAliasAuditPage] = useState<AliasAuditLogPage | null>(null)
  const pendingMutationKeysRef = useRef(new Set<string>())
  const [pendingMutationKeys, setPendingMutationKeys] = useState<string[]>([])
  const managedUserQueryRef = useRef<ManagedUserListQuery>({ limit: defaultPageLimit, sort: "emailAsc" })
  const adminAuditQueryRef = useRef<AdminAuditLogQuery>({ limit: defaultPageLimit })
  const aliasQueryRef = useRef<AliasListQuery>({ limit: defaultPageLimit, sort: "updatedDesc" })
  const aliasAuditQueryRef = useRef<AliasAuditLogQuery>({ limit: defaultPageLimit })
  const usageQueryRef = useRef<UsageQuery>(defaultUsageQuery())
  const costQueryRef = useRef<UsageQuery>(defaultUsageQuery())

  async function refreshManagedUsers(query: ManagedUserListQuery = managedUserQueryRef.current, append = false) {
    const normalized = { limit: defaultPageLimit, sort: "emailAsc" as const, ...query }
    managedUserQueryRef.current = normalized
    const nextPage = await listManagedUsers(normalized)
    setManagedUserPage((current) => append && current
      ? { ...nextPage, users: mergeByKey(current.users, nextPage.users, (user) => user.userId) }
      : nextPage)
  }

  async function refreshAdminAuditLog(query: AdminAuditLogQuery = adminAuditQueryRef.current, append = false) {
    const normalized = { limit: defaultPageLimit, ...query }
    adminAuditQueryRef.current = normalized
    const nextPage = await listAdminAuditLog(normalized)
    setAdminAuditPage((current) => append && current
      ? { ...nextPage, auditLog: mergeByKey(current.auditLog, nextPage.auditLog, (entry) => entry.auditId) }
      : nextPage)
  }

  async function onCreateAdminAuditExport(reason: string) {
    if (!canExportAdminAuditLog) throw new Error("監査履歴を export する権限がありません")
    const { cursor: _cursor, limit: _limit, ...query } = adminAuditQueryRef.current
    return createAdminAuditExport(query, reason)
  }

  async function refreshAccessRoles() {
    setAccessRoleList(await listAccessRoles())
  }

  async function refreshUsageSummaries(query: UsageQuery = usageQueryRef.current, append = false) {
    const normalized = { ...query, limit: defaultPageLimit }
    usageQueryRef.current = normalized
    const nextPage = await listUsageSummaries(normalized)
    setUsageSummaries((current) => append && current && nextPage
      ? { ...nextPage, events: mergeByKey(current.events, nextPage.events, (event) => event.eventId) }
      : nextPage)
  }

  async function refreshCostAudit(query: UsageQuery = costQueryRef.current, append = false) {
    const normalized = { ...query, limit: defaultPageLimit }
    costQueryRef.current = normalized
    const nextPage = await getCostAuditSummary(normalized)
    setCostAudit((current) => append && current && nextPage
      ? { ...nextPage, items: mergeByKey(current.items, nextPage.items, (item) => `${item.eventId}:${item.unit}`), pricedCostUsd: current.pricedCostUsd + nextPage.pricedCostUsd }
      : nextPage)
  }

  async function applyUsageCostQuery(query: UsageQuery) {
    usageQueryRef.current = { ...query, limit: defaultPageLimit }
    costQueryRef.current = { ...query, limit: defaultPageLimit }
    await Promise.all([
      canReadUsage ? refreshUsageSummaries(usageQueryRef.current) : Promise.resolve(),
      canReadCosts ? refreshCostAudit(costQueryRef.current) : Promise.resolve()
    ])
  }

  async function onCreateUsageExport(reason: string) {
    if (!canExportUsage) throw new Error("利用状況を export する権限がありません")
    const { cursor: _cursor, limit: _limit, ...query } = usageQueryRef.current
    return createUsageExport(query, reason)
  }

  async function onCreateCostExport(reason: string) {
    if (!canExportCosts) throw new Error("コスト監査を export する権限がありません")
    const { cursor: _cursor, limit: _limit, ...query } = costQueryRef.current
    return createCostExport(query, reason)
  }

  async function refreshAliases(query: AliasListQuery = aliasQueryRef.current, append = false) {
    const normalized = { limit: defaultPageLimit, sort: "updatedDesc" as const, ...query }
    aliasQueryRef.current = normalized
    const nextPage = await listAliases(normalized)
    setAliasPage((current) => append && current
      ? { ...nextPage, aliases: mergeByKey(current.aliases, nextPage.aliases, (alias) => alias.aliasId) }
      : nextPage)
  }

  async function refreshAliasAuditLog(query: AliasAuditLogQuery = aliasAuditQueryRef.current, append = false) {
    const normalized = { limit: defaultPageLimit, ...query }
    aliasAuditQueryRef.current = normalized
    const nextPage = await listAliasAuditLog(normalized)
    setAliasAuditPage((current) => append && current
      ? { ...nextPage, auditLog: mergeByKey(current.auditLog, nextPage.auditLog, (entry) => entry.auditId) }
      : nextPage)
  }

  async function refreshAdminData() {
    await Promise.all([
      canReadUsers ? refreshManagedUsers() : Promise.resolve(),
      canReadAdminAuditLog ? refreshAdminAuditLog() : Promise.resolve(),
      canOpenAdminSettings ? refreshAccessRoles() : Promise.resolve(),
      canReadUsage ? refreshUsageSummaries() : Promise.resolve(),
      canReadCosts ? refreshCostAudit() : Promise.resolve(),
      canReadAliases ? refreshAliases() : Promise.resolve(),
      canReadAliases ? refreshAliasAuditLog() : Promise.resolve()
    ])
  }

  async function refreshAdminSideEffects() {
    await Promise.all([
      canReadAdminAuditLog ? refreshAdminAuditLog() : Promise.resolve(),
      canReadUsage ? refreshUsageSummaries() : Promise.resolve(),
      canReadCosts ? refreshCostAudit() : Promise.resolve(),
      canReadAliases ? refreshAliases() : Promise.resolve(),
      canReadAliases ? refreshAliasAuditLog() : Promise.resolve()
    ])
  }

  async function confirmAdminMutation<T>({
    value,
    successMessage,
    partialMessage,
    evidence,
    refresh = refreshAdminSideEffects
  }: {
    value: T
    successMessage: string
    partialMessage: string
    evidence?: OperationEvidence
    refresh?: () => Promise<void>
  }): Promise<OperationOutcome<T>> {
    try {
      await refresh()
      return confirmedOperation(value, { message: successMessage, evidence })
    } catch (err) {
      console.warn("Failed to refresh admin state after confirmed mutation", err)
      setError(partialMessage)
      return partialOperation(value, partialMessage, evidence)
    }
  }

  async function onAssignUserRoles(userId: string, groups: string[], reason: string): Promise<OperationOutcome<ManagedUser>> {
    return runMutation(`role:${userId}`, "このユーザーのロールは変更処理中です", async () => {
      const updated = await assignUserRoles(userId, groups, reason)
      setManagedUserPage((current) => current ? { ...current, users: upsertManagedUser(current.users, updated) } : current)
      return confirmAdminMutation({
        value: updated,
        successMessage: updated.operationEvidence?.sessionRevocation === "confirmed"
          ? "API がロール変更、session 失効、有効 permission の反映を確定しました。"
          : "API がロール変更を確定し、許可された管理データを更新しました。",
        partialMessage: "ロール変更は確定しましたが、関連する管理データを更新できませんでした。再実行せず更新してください。",
        evidence: {
          resultReference: updated.userId,
          version: updated.updatedAt,
          auditReference: updated.operationEvidence?.auditIntentId
        }
      })
    })
  }

  async function onCreateManagedUser(input: { email: string; displayName?: string; groups?: string[] }) {
    setLoading(true)
    setError(null)
    try {
      const created = await createManagedUser(input)
      setManagedUserPage((current) => current ? { ...current, users: upsertManagedUser(current.users, created) } : current)
      await refreshAdminSideEffects()
    } catch (err) {
      setError(errorMessage(err))
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
      setError(errorMessage(err))
      return null
    } finally {
      setLoading(false)
    }
  }

  async function onSetManagedUserStatus(userId: string, action: "suspend" | "unsuspend" | "delete", successorUserId?: string): Promise<OperationOutcome<ManagedUser>> {
    return runMutation(`status:${userId}`, "このユーザーの状態は変更処理中です", async () => {
      const updated = action === "suspend"
        ? await suspendManagedUser(userId)
        : action === "unsuspend"
          ? await unsuspendManagedUser(userId)
          : await deleteManagedUser(userId, successorUserId)
      setManagedUserPage((current) => current ? {
        ...current,
        users: updated.status === "deleted"
          ? current.users.filter((user) => user.userId !== userId)
          : upsertManagedUser(current.users, updated)
      } : current)
      return confirmAdminMutation({
        value: updated,
        successMessage: updated.operationEvidence?.sessionRevocation === "confirmed"
          ? "API がユーザー状態、session 失効、権限反映を確定しました。"
          : "API がユーザー状態の変更を確定しました。",
        partialMessage: "ユーザー状態の変更は確定しましたが、関連する管理データを更新できませんでした。再実行せず更新してください。",
        evidence: {
          resultReference: updated.userId,
          version: updated.updatedAt,
          auditReference: updated.operationEvidence?.auditIntentId
        }
      })
    })
  }

  async function onCreateAlias(input: { term: string; expansions: string[]; scope?: AliasDefinition["scope"] }): Promise<OperationOutcome<AliasDefinition>> {
    if (!canWriteAliases) return failedOperation(new Error("用語展開を作成する権限がありません"))
    return runMutation("alias-create", "用語展開は作成処理中です", async () => {
      const created = await createAlias(input)
      updateAliasPage(created)
      return confirmAliasMutation(created, "API が用語展開の下書きを作成しました。", "作成は確定しましたが、一覧または監査ログを更新できませんでした。再実行せず更新してください。")
    })
  }

  async function onUpdateAlias(aliasId: string, input: {
    term?: string
    expansions?: string[]
    scope?: AliasDefinition["scope"]
    expectedVersion: string
    reason: string
  }): Promise<OperationOutcome<AliasDefinition>> {
    if (!canWriteAliases) return failedOperation(new Error("用語展開を更新する権限がありません"))
    return runAliasMutation(`alias-update:${aliasId}`, aliasId, () => updateAlias(aliasId, input), "API が用語展開を更新しました。")
  }

  async function onReviewAlias(aliasId: string, decision: "approve" | "reject", expectedVersion: string, reason: string): Promise<OperationOutcome<AliasDefinition>> {
    if (!canReviewAliases) return failedOperation(new Error("用語展開をレビューする権限がありません"))
    return runAliasMutation(`alias-review:${aliasId}`, aliasId, () => reviewAlias(aliasId, decision, expectedVersion, reason), "API がレビュー結果を確定しました。")
  }

  async function onTransitionAlias(aliasId: string, expectedVersion: string, reason: string): Promise<OperationOutcome<AliasDefinition>> {
    if (!canWriteAliases) return failedOperation(new Error("用語展開を下書きへ戻す権限がありません"))
    return runAliasMutation(`alias-transition:${aliasId}`, aliasId, () => transitionAliasToDraft(aliasId, expectedVersion, reason), "API が下書きへの遷移を確定しました。")
  }

  async function onDisableAlias(aliasId: string, expectedVersion: string, reason: string): Promise<OperationOutcome<AliasDefinition>> {
    if (!canDisableAliases) return failedOperation(new Error("用語展開を無効化する権限がありません"))
    return runAliasMutation(`alias-disable:${aliasId}`, aliasId, () => disableAlias(aliasId, expectedVersion, reason), "API が用語展開の無効化を確定しました。")
  }

  async function onPublishAliases(expectedVersion: string, reason: string): Promise<OperationOutcome<{ version: string; publishedAt: string; aliasCount: number }>> {
    if (!canPublishAliases) return failedOperation(new Error("用語展開を公開する権限がありません"))
    return runMutation("alias-publish", "用語展開は公開処理中です", async () => {
      const published = await publishAliases(expectedVersion, reason)
      return confirmAdminMutation({
        value: published,
        successMessage: "API が用語展開の公開 version を確定しました。",
        partialMessage: "公開 version は確定しましたが、一覧または監査ログを更新できませんでした。再実行せず更新してください。",
        evidence: { resultReference: published.version, version: published.version },
        refresh: refreshAliasData
      })
    })
  }

  async function runAliasMutation(
    mutationKey: string,
    aliasId: string,
    mutation: () => Promise<AliasDefinition>,
    successMessage: string
  ): Promise<OperationOutcome<AliasDefinition>> {
    return runMutation(mutationKey, "この用語展開は変更処理中です", async () => {
      const updated = await mutation()
      updateAliasPage(updated)
      return confirmAliasMutation(updated, successMessage, "変更は確定しましたが、一覧または監査ログを更新できませんでした。再実行せず更新してください。", aliasId)
    })
  }

  async function confirmAliasMutation(
    alias: AliasDefinition,
    successMessage: string,
    partialMessage: string,
    resultReference = alias.aliasId
  ): Promise<OperationOutcome<AliasDefinition>> {
    return confirmAdminMutation({
      value: alias,
      successMessage,
      partialMessage,
      evidence: { resultReference, version: alias.version },
      refresh: refreshAliasData
    })
  }

  async function refreshAliasData() {
    await Promise.all([refreshAliases(), refreshAliasAuditLog()])
  }

  function updateAliasPage(alias: AliasDefinition) {
    setAliasPage((current) => current
      ? { ...current, aliases: mergeByKey([alias], current.aliases, (item) => item.aliasId) }
      : current)
  }

  async function runMutation<T>(
    mutationKey: string,
    duplicateMessage: string,
    mutation: () => Promise<OperationOutcome<T>>
  ): Promise<OperationOutcome<T>> {
    if (pendingMutationKeysRef.current.has(mutationKey)) return failedOperation(new Error(duplicateMessage))
    pendingMutationKeysRef.current.add(mutationKey)
    setPendingMutationKeys([...pendingMutationKeysRef.current])
    setLoading(true)
    setError(null)
    try {
      return await mutation()
    } catch (err) {
      const outcome: OperationOutcome<T> = failedOperation(err)
      setError(outcome.message)
      return outcome
    } finally {
      pendingMutationKeysRef.current.delete(mutationKey)
      setPendingMutationKeys([...pendingMutationKeysRef.current])
      setLoading(false)
    }
  }

  return {
    managedUsers: managedUserPage?.users ?? null,
    managedUserPage,
    adminAuditLog: adminAuditPage?.auditLog ?? null,
    adminAuditPage,
    accessRoles: accessRoleList?.roles ?? null,
    accessRoleList,
    usageSummaries,
    costAudit,
    aliases: aliasPage?.aliases ?? null,
    aliasPage,
    aliasAuditLog: aliasAuditPage?.auditLog ?? null,
    aliasAuditPage,
    pendingAdminMutationKeys: pendingMutationKeys,
    refreshManagedUsers,
    loadMoreManagedUsers: () => managedUserPage?.nextCursor
      ? refreshManagedUsers({ ...managedUserQueryRef.current, cursor: managedUserPage.nextCursor }, true)
      : Promise.resolve(),
    refreshAdminAuditLog,
    refreshAccessRoles,
    refreshUsageSummaries,
    refreshCostAudit,
    applyUsageCostQuery,
    loadMoreUsage: () => usageSummaries?.nextCursor ? refreshUsageSummaries({ ...usageQueryRef.current, cursor: usageSummaries.nextCursor }, true) : Promise.resolve(),
    loadMoreCosts: () => costAudit?.nextCursor ? refreshCostAudit({ ...costQueryRef.current, cursor: costAudit.nextCursor }, true) : Promise.resolve(),
    onCreateUsageExport,
    onCreateCostExport,
    refreshAliases,
    refreshAliasAuditLog,
    refreshAdminData,
    onAssignUserRoles,
    onCreateAdminAuditExport,
    onCreateManagedUser,
    onPrepareManagedUserDelete,
    onSetManagedUserStatus,
    onCreateAlias,
    onUpdateAlias,
    onReviewAlias,
    onTransitionAlias,
    onDisableAlias,
    onPublishAliases
  }
}

function defaultUsageQuery(): UsageQuery {
  const periodEnd = new Date()
  const periodStart = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), 1))
  return { periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString(), limit: defaultPageLimit }
}

function upsertManagedUser(current: ManagedUser[], updated: ManagedUser): ManagedUser[] {
  return [updated, ...current.filter((user) => user.userId !== updated.userId)]
    .sort((left, right) => left.email.localeCompare(right.email))
}

function mergeByKey<T>(first: readonly T[], second: readonly T[], key: (value: T) => string): T[] {
  const seen = new Set<string>()
  return [...first, ...second].filter((item) => {
    const itemKey = key(item)
    if (seen.has(itemKey)) return false
    seen.add(itemKey)
    return true
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
