import { useMemo } from "react"
import type { CurrentUser, Permission } from "../../shared/types/common.js"

export function usePermissions(currentUser: CurrentUser | null) {
  return useMemo(() => {
    const hasPermission = (permission: Permission) => currentUser?.permissions.includes(permission) ?? false
    const canCreateChat = hasPermission("chat:create")
    const canReadDocuments = hasPermission("rag:doc:read")
    const canWriteDocuments = hasPermission("rag:doc:write:group")
    const canDeleteDocuments = hasPermission("rag:doc:delete:group")
    const canReindexDocuments = hasPermission("rag:index:rebuild:group")
    const canReadAliases = hasPermission("rag:alias:read")
    const canWriteAliases = hasPermission("rag:alias:write:group")
    const canReviewAliases = hasPermission("rag:alias:review:group")
    const canDisableAliases = hasPermission("rag:alias:disable:group")
    const canPublishAliases = hasPermission("rag:alias:publish:group")
    const canAnswerQuestions = hasPermission("answer:edit")
    const canReadDebugRuns = hasPermission("chat:admin:read_all")
    const canReadHistory = hasPermission("chat:read:own")
    const canOpenAdminSettings = hasPermission("access:policy:read")
    const canReadBenchmarkRuns = hasPermission("benchmark:read")
    const canRunBenchmark = hasPermission("benchmark:run")
    const canCancelBenchmark = hasPermission("benchmark:cancel")
    const canDownloadBenchmark = hasPermission("benchmark:download")
    const canReadUsers = hasPermission("user:read")
    const canCreateUsers = hasPermission("user:create")
    const canSuspendUsers = hasPermission("user:suspend")
    const canUnsuspendUsers = hasPermission("user:unsuspend")
    const canDeleteUsers = hasPermission("user:delete")
    const canAssignRoles = hasPermission("access:role:assign")
    const canReadUsage = hasPermission("usage:read:all_users")
    const canReadCosts = hasPermission("cost:read:all")
    const canReadAdminAuditLog = canOpenAdminSettings
    const canManageDocuments = canWriteDocuments || canDeleteDocuments || canReindexDocuments
    const canManageAliases = canReadAliases || canWriteAliases || canReviewAliases || canDisableAliases || canPublishAliases
    const canManageUsers = canReadUsers || canCreateUsers || canAssignRoles || canSuspendUsers || canUnsuspendUsers || canDeleteUsers
    const canAuditOperations = canReadUsage || canReadCosts
    const canSeeAdminSettings =
      canOpenAdminSettings || canAnswerQuestions || canManageDocuments || canReadDebugRuns || canReadBenchmarkRuns || canManageUsers || canAuditOperations || canManageAliases

    return {
      canCreateChat,
      canReadDocuments,
      canWriteDocuments,
      canDeleteDocuments,
      canReindexDocuments,
      canReadAliases,
      canWriteAliases,
      canReviewAliases,
      canDisableAliases,
      canPublishAliases,
      canAnswerQuestions,
      canReadDebugRuns,
      canReadHistory,
      canOpenAdminSettings,
      canReadBenchmarkRuns,
      canRunBenchmark,
      canCancelBenchmark,
      canDownloadBenchmark,
      canReadUsers,
      canCreateUsers,
      canSuspendUsers,
      canUnsuspendUsers,
      canDeleteUsers,
      canAssignRoles,
      canReadUsage,
      canReadCosts,
      canReadAdminAuditLog,
      canManageDocuments,
      canManageAliases,
      canManageUsers,
      canAuditOperations,
      canSeeAdminSettings
    }
  }, [currentUser])
}
