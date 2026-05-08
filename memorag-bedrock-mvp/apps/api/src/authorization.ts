import { HTTPException } from "hono/http-exception"
import type { AppUser } from "./auth.js"

export type Permission =
  | "chat:create"
  | "chat:read:own"
  | "chat:read:shared"
  | "chat:share:own"
  | "chat:delete:own"
  | "chat:admin:read_all"
  | "answer:edit"
  | "answer:publish"
  | "rag:group:create"
  | "rag:group:assign_manager"
  | "rag:doc:read"
  | "rag:doc:write:group"
  | "rag:doc:delete:group"
  | "rag:index:rebuild:group"
  | "rag:alias:read"
  | "rag:alias:write:group"
  | "rag:alias:review:group"
  | "rag:alias:disable:group"
  | "rag:alias:publish:group"
  | "benchmark:read"
  | "benchmark:query"
  | "benchmark:run"
  | "benchmark:seed_corpus"
  | "benchmark:cancel"
  | "benchmark:download"
  | "usage:read:own"
  | "usage:read:all_users"
  | "cost:read:own"
  | "cost:read:all"
  | "user:create"
  | "user:read"
  | "user:suspend"
  | "user:unsuspend"
  | "user:delete"
  | "access:role:create"
  | "access:role:update"
  | "access:role:assign"
  | "access:policy:read"

export type Role =
  | "CHAT_USER"
  | "ANSWER_EDITOR"
  | "RAG_GROUP_MANAGER"
  | "BENCHMARK_OPERATOR"
  | "BENCHMARK_RUNNER"
  | "USER_ADMIN"
  | "ACCESS_ADMIN"
  | "COST_AUDITOR"
  | "SYSTEM_ADMIN"

export type RouteAuthorizationMode =
  | "public"
  | "authenticated"
  | "required"
  | "requesterOrPermission"
  | "ownedRun"
  | "benchmarkSeedRunOrOwnedRun"
  | "benchmarkSeedOrPermission"
  | "benchmarkSeedListOrPermission"
  | "benchmarkSeedDeleteOrPermission"
  | "documentUploadSession"

export type RouteAuthorizationPolicy = {
  method: string
  path: string
  mode: RouteAuthorizationMode
  permission?: Permission
  permissions?: Permission[]
  conditionalPermissions?: Permission[]
  notes?: string[]
}

export type RouteAuthorizationMetadata = {
  mode: RouteAuthorizationMode
  requiredPermissions: Permission[]
  conditionalPermissions: Permission[]
  allowedRoles: Role[]
  deniedRoles: Role[]
  conditionalDeniedRoles: Role[]
  notes: string[]
  errors: Array<{
    status: 401 | 403
    when: string
    body: { error: string; details?: string }
  }>
}

export const rolePermissions: Record<Role, Permission[]> = {
  CHAT_USER: ["chat:create", "chat:read:own", "chat:read:shared", "chat:share:own", "chat:delete:own", "usage:read:own", "cost:read:own", "rag:doc:read"],
  ANSWER_EDITOR: ["answer:edit", "answer:publish"],
  RAG_GROUP_MANAGER: [
    "rag:group:create","rag:group:assign_manager","rag:doc:read","rag:doc:write:group","rag:doc:delete:group","rag:index:rebuild:group",
    "rag:alias:read","rag:alias:write:group","rag:alias:review:group","rag:alias:disable:group","rag:alias:publish:group",
    "benchmark:read","benchmark:run"
  ],
  BENCHMARK_OPERATOR: ["benchmark:read", "benchmark:run"],
  BENCHMARK_RUNNER: ["benchmark:query", "benchmark:seed_corpus"],
  USER_ADMIN: ["user:create", "user:read", "user:suspend", "user:unsuspend", "user:delete", "usage:read:all_users"],
  ACCESS_ADMIN: ["access:role:create", "access:role:update", "access:role:assign", "access:policy:read"],
  COST_AUDITOR: ["cost:read:all"],
  SYSTEM_ADMIN: [
    "chat:create","chat:read:own","chat:read:shared","chat:share:own","chat:delete:own","chat:admin:read_all",
    "answer:edit","answer:publish","rag:group:create","rag:group:assign_manager","rag:doc:read","rag:doc:write:group","rag:doc:delete:group","rag:index:rebuild:group",
    "rag:alias:read","rag:alias:write:group","rag:alias:review:group","rag:alias:disable:group","rag:alias:publish:group",
    "benchmark:read","benchmark:query","benchmark:run","benchmark:seed_corpus","benchmark:cancel","benchmark:download",
    "usage:read:own","usage:read:all_users","cost:read:own","cost:read:all","user:create","user:read","user:suspend","user:unsuspend","user:delete",
    "access:role:create","access:role:update","access:role:assign","access:policy:read"
  ]
}

export const applicationRoles = Object.keys(rolePermissions) as Role[]

export const routeAuthorizationPolicies: RouteAuthorizationPolicy[] = [
  { method: "get", path: "/health", mode: "public", notes: ["認証なしで実行できます。"] },
  { method: "get", path: "/me", mode: "authenticated", notes: ["認証済みユーザーであれば role に関係なく実行できます。"] },
  { method: "post", path: "/admin/users", mode: "required", permission: "user:create" },
  { method: "get", path: "/admin/users", mode: "required", permission: "user:read" },
  { method: "get", path: "/admin/audit-log", mode: "required", permission: "access:policy:read" },
  { method: "post", path: "/admin/users/{userId}/roles", mode: "required", permission: "access:role:assign", notes: ["自分自身の role 更新は 403 を返します。", "SYSTEM_ADMIN を付与する場合、実行者も SYSTEM_ADMIN role である必要があります。"] },
  { method: "post", path: "/admin/users/{userId}/suspend", mode: "required", permission: "user:suspend" },
  { method: "post", path: "/admin/users/{userId}/unsuspend", mode: "required", permission: "user:unsuspend" },
  { method: "delete", path: "/admin/users/{userId}", mode: "required", permission: "user:delete" },
  { method: "get", path: "/admin/roles", mode: "required", permission: "access:policy:read" },
  { method: "get", path: "/admin/aliases", mode: "required", permission: "rag:alias:read" },
  { method: "post", path: "/admin/aliases", mode: "required", permission: "rag:alias:write:group" },
  { method: "post", path: "/admin/aliases/{aliasId}/update", mode: "required", permission: "rag:alias:write:group" },
  { method: "post", path: "/admin/aliases/{aliasId}/review", mode: "required", permission: "rag:alias:review:group" },
  { method: "post", path: "/admin/aliases/{aliasId}/disable", mode: "required", permission: "rag:alias:disable:group" },
  { method: "post", path: "/admin/aliases/publish", mode: "required", permission: "rag:alias:publish:group" },
  { method: "get", path: "/admin/aliases/audit-log", mode: "required", permission: "rag:alias:read" },
  { method: "get", path: "/admin/usage", mode: "required", permission: "usage:read:all_users" },
  { method: "get", path: "/admin/costs", mode: "required", permission: "cost:read:all" },
  { method: "get", path: "/documents", mode: "benchmarkSeedListOrPermission", permission: "rag:doc:read", conditionalPermissions: ["benchmark:seed_corpus"], notes: ["BENCHMARK_RUNNER は benchmark seed 文書の一覧に限定して実行できます。"] },
  { method: "get", path: "/document-groups", mode: "required", permission: "rag:doc:read" },
  { method: "post", path: "/document-groups", mode: "required", permission: "rag:group:create" },
  { method: "post", path: "/document-groups/{groupId}/share", mode: "required", permission: "rag:group:assign_manager" },
  { method: "post", path: "/documents", mode: "benchmarkSeedOrPermission", permission: "rag:doc:write:group", conditionalPermissions: ["benchmark:seed_corpus"], notes: ["BENCHMARK_RUNNER は benchmark seed 用 upload body の場合だけ実行できます。"] },
  { method: "post", path: "/documents/uploads", mode: "documentUploadSession", permission: "rag:doc:write:group", conditionalPermissions: ["chat:create", "benchmark:seed_corpus"], notes: ["purpose=document は rag:doc:write:group、purpose=chatAttachment は chat:create、purpose=benchmarkSeed は benchmark:seed_corpus が必要です。"] },
  { method: "post", path: "/documents/uploads/{uploadId}/content", mode: "documentUploadSession", permission: "rag:doc:write:group", conditionalPermissions: ["chat:create", "benchmark:seed_corpus"], notes: ["uploadId の object key が実行者 scope 外の場合は 403 を返します。"] },
  { method: "post", path: "/documents/uploads/{uploadId}/ingest", mode: "documentUploadSession", permission: "rag:doc:write:group", conditionalPermissions: ["chat:create", "benchmark:seed_corpus"], notes: ["upload purpose と scope に応じた permission を確認します。"] },
  { method: "post", path: "/document-ingest-runs", mode: "documentUploadSession", permission: "rag:doc:write:group", conditionalPermissions: ["chat:create", "benchmark:seed_corpus"], notes: ["upload purpose と scope に応じた permission を確認します。"] },
  { method: "get", path: "/document-ingest-runs/{runId}", mode: "benchmarkSeedRunOrOwnedRun", permission: "chat:read:own", conditionalPermissions: ["benchmark:seed_corpus"], notes: ["chat:read:own は自分が作成した run のみ参照できます。BENCHMARK_RUNNER は自分が作成した benchmark seed run のみ参照できます。"] },
  { method: "get", path: "/document-ingest-runs/{runId}/events", mode: "benchmarkSeedRunOrOwnedRun", permission: "chat:read:own", conditionalPermissions: ["benchmark:seed_corpus"], notes: ["chat:read:own は自分が作成した run のみ購読できます。BENCHMARK_RUNNER は自分が作成した benchmark seed run のみ購読できます。"] },
  { method: "post", path: "/documents/{documentId}/reindex", mode: "required", permission: "rag:index:rebuild:group" },
  { method: "get", path: "/documents/reindex-migrations", mode: "required", permission: "rag:index:rebuild:group" },
  { method: "post", path: "/documents/{documentId}/reindex/stage", mode: "required", permission: "rag:index:rebuild:group" },
  { method: "post", path: "/documents/reindex-migrations/{migrationId}/cutover", mode: "required", permission: "rag:index:rebuild:group" },
  { method: "post", path: "/documents/reindex-migrations/{migrationId}/rollback", mode: "required", permission: "rag:index:rebuild:group" },
  { method: "delete", path: "/documents/{documentId}", mode: "benchmarkSeedDeleteOrPermission", permission: "rag:doc:delete:group", conditionalPermissions: ["benchmark:seed_corpus"], notes: ["BENCHMARK_RUNNER は benchmark seed 文書だけ削除できます。"] },
  { method: "post", path: "/chat", mode: "required", permission: "chat:create", conditionalPermissions: ["chat:admin:read_all"], notes: ["includeDebug または debug が true の場合は chat:admin:read_all も必要です。"] },
  { method: "post", path: "/chat-runs", mode: "required", permission: "chat:create", conditionalPermissions: ["chat:admin:read_all"], notes: ["includeDebug または debug が true の場合は chat:admin:read_all も必要です。"] },
  { method: "get", path: "/chat-runs/{runId}/events", mode: "ownedRun", permission: "chat:read:own", conditionalPermissions: ["chat:admin:read_all"], notes: ["chat:read:own は自分が作成した run のみ購読できます。chat:admin:read_all は他ユーザーの run も購読できます。"] },
  { method: "post", path: "/search", mode: "required", permission: "rag:doc:read" },
  { method: "post", path: "/questions", mode: "required", permission: "chat:create" },
  { method: "get", path: "/questions", mode: "required", permission: "answer:edit" },
  { method: "get", path: "/questions/{questionId}", mode: "requesterOrPermission", permission: "answer:edit", notes: ["問い合わせ作成者本人は answer:edit がなくても実行できます。その場合 internalMemo は返しません。"] },
  { method: "post", path: "/questions/{questionId}/answer", mode: "required", permission: "answer:publish" },
  { method: "post", path: "/questions/{questionId}/resolve", mode: "requesterOrPermission", permission: "answer:publish", notes: ["問い合わせ作成者本人は answer:publish がなくても、回答済み問い合わせだけ解決できます。"] },
  { method: "get", path: "/conversation-history", mode: "required", permission: "chat:read:own", notes: ["実行者自身の会話履歴だけ返します。"] },
  { method: "post", path: "/conversation-history", mode: "required", permission: "chat:create", notes: ["実行者自身の会話履歴として保存します。"] },
  { method: "delete", path: "/conversation-history/{id}", mode: "required", permission: "chat:delete:own", notes: ["実行者自身の会話履歴だけ削除できます。"] },
  { method: "get", path: "/debug-runs", mode: "required", permission: "chat:admin:read_all" },
  { method: "get", path: "/debug-runs/{runId}", mode: "required", permission: "chat:admin:read_all" },
  { method: "post", path: "/debug-runs/{runId}/download", mode: "required", permission: "chat:admin:read_all" },
  { method: "post", path: "/benchmark/query", mode: "required", permission: "benchmark:query" },
  { method: "post", path: "/benchmark/search", mode: "required", permission: "benchmark:query" },
  { method: "get", path: "/benchmark-suites", mode: "required", permission: "benchmark:read" },
  { method: "post", path: "/benchmark-runs", mode: "required", permission: "benchmark:run" },
  { method: "get", path: "/benchmark-runs", mode: "required", permission: "benchmark:read" },
  { method: "get", path: "/benchmark-runs/{runId}", mode: "required", permission: "benchmark:read" },
  { method: "post", path: "/benchmark-runs/{runId}/cancel", mode: "required", permission: "benchmark:cancel" },
  { method: "post", path: "/benchmark-runs/{runId}/download", mode: "required", permission: "benchmark:download" }
]

export function routeAuthorizationKey(method: string, path: string): string {
  return `${method.toLowerCase()} ${path}`
}

export const routeAuthorizationPolicyByKey = new Map(
  routeAuthorizationPolicies.map((policy) => [routeAuthorizationKey(policy.method, policy.path), policy])
)

export function getPermissionsForGroups(groups: string[]): Permission[] {
  const permissions = new Set<Permission>()
  for (const group of groups) {
    for (const permission of rolePermissions[group as Role] ?? []) {
      permissions.add(permission)
    }
  }
  return [...permissions]
}

export function rolesWithAnyPermission(permissions: Permission[]): Role[] {
  if (permissions.length === 0) return []
  return applicationRoles.filter((role) => permissions.some((permission) => rolePermissions[role].includes(permission)))
}

export function routeAuthorizationMetadata(policy: RouteAuthorizationPolicy): RouteAuthorizationMetadata {
  const requiredPermissions = policy.permissions ?? (policy.permission ? [policy.permission] : [])
  const conditionalPermissions = policy.conditionalPermissions ?? []
  const effectivePermissions = [...requiredPermissions, ...conditionalPermissions]
  const allowedRoles = policy.mode === "public" || policy.mode === "authenticated"
    ? [...applicationRoles]
    : rolesWithAnyPermission(effectivePermissions)
  const deniedRoles = applicationRoles.filter((role) => !allowedRoles.includes(role))
  const conditionalDeniedRoles = conditionalPermissions.length === 0
    ? []
    : allowedRoles.filter((role) => !conditionalPermissions.some((permission) => rolePermissions[role].includes(permission)))
  const errors: RouteAuthorizationMetadata["errors"] = []
  if (policy.mode !== "public") {
    errors.push({ status: 401, when: "Authorization header がない、または Bearer token を検証できない場合。", body: { error: "Unauthorized" } })
  }
  if (policy.mode !== "public" && policy.mode !== "authenticated") {
    errors.push({
      status: 403,
      when: requiredPermissions.length > 0
        ? `必要 permission (${requiredPermissions.join(", ")}) または条件付き permission を満たさない場合。`
        : "認可条件を満たさない場合。",
      body: { error: requiredPermissions[0] ? `Forbidden: missing ${requiredPermissions[0]}` : "Forbidden" }
    })
  }
  return {
    mode: policy.mode,
    requiredPermissions,
    conditionalPermissions,
    allowedRoles,
    deniedRoles,
    conditionalDeniedRoles,
    notes: policy.notes ?? [],
    errors
  }
}

export function requirePermission(user: AppUser, permission: Permission) {
  if (!hasPermission(user, permission)) throw new HTTPException(403, { message: `Forbidden: missing ${permission}` })
}

export function hasPermission(user: AppUser, permission: Permission) {
  return getPermissionsForGroups(user.cognitoGroups).includes(permission)
}
