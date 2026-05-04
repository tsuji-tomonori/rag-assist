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

export type Role = "CHAT_USER" | "ANSWER_EDITOR" | "RAG_GROUP_MANAGER" | "BENCHMARK_RUNNER" | "USER_ADMIN" | "ACCESS_ADMIN" | "COST_AUDITOR" | "SYSTEM_ADMIN"

export const rolePermissions: Record<Role, Permission[]> = {
  CHAT_USER: ["chat:create", "chat:read:own", "chat:read:shared", "chat:share:own", "chat:delete:own", "usage:read:own", "cost:read:own", "rag:doc:read"],
  ANSWER_EDITOR: ["answer:edit", "answer:publish"],
  RAG_GROUP_MANAGER: [
    "rag:doc:read","rag:doc:write:group","rag:doc:delete:group","rag:index:rebuild:group",
    "rag:alias:read","rag:alias:write:group","rag:alias:review:group","rag:alias:disable:group","rag:alias:publish:group",
    "benchmark:read","benchmark:run"
  ],
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

export function getPermissionsForGroups(groups: string[]): Permission[] {
  const permissions = new Set<Permission>()
  for (const group of groups) {
    for (const permission of rolePermissions[group as Role] ?? []) {
      permissions.add(permission)
    }
  }
  return [...permissions]
}

export function requirePermission(user: AppUser, permission: Permission) {
  if (!hasPermission(user, permission)) throw new HTTPException(403, { message: `Forbidden: missing ${permission}` })
}

export function hasPermission(user: AppUser, permission: Permission) {
  return getPermissionsForGroups(user.cognitoGroups).includes(permission)
}
