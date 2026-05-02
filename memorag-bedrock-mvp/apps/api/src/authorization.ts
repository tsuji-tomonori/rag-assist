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
  | "usage:read:own"
  | "usage:read:all_users"
  | "cost:read:own"
  | "cost:read:all"
  | "user:read"
  | "user:suspend"
  | "user:unsuspend"
  | "user:delete"
  | "access:role:create"
  | "access:role:update"
  | "access:role:assign"
  | "access:policy:read"

type Role = "CHAT_USER" | "ANSWER_EDITOR" | "RAG_GROUP_MANAGER" | "USER_ADMIN" | "ACCESS_ADMIN" | "COST_AUDITOR" | "SYSTEM_ADMIN"

const rolePermissions: Record<Role, Permission[]> = {
  CHAT_USER: ["chat:create", "chat:read:own", "chat:read:shared", "chat:share:own", "chat:delete:own", "usage:read:own", "cost:read:own", "rag:doc:read"],
  ANSWER_EDITOR: ["answer:edit", "answer:publish"],
  RAG_GROUP_MANAGER: ["rag:doc:read", "rag:doc:write:group", "rag:doc:delete:group", "rag:index:rebuild:group"],
  USER_ADMIN: ["user:read", "user:suspend", "user:unsuspend", "user:delete", "usage:read:all_users"],
  ACCESS_ADMIN: ["access:role:create", "access:role:update", "access:role:assign", "access:policy:read"],
  COST_AUDITOR: ["cost:read:all"],
  SYSTEM_ADMIN: [
    "chat:create","chat:read:own","chat:read:shared","chat:share:own","chat:delete:own","chat:admin:read_all",
    "answer:edit","answer:publish","rag:group:create","rag:group:assign_manager","rag:doc:read","rag:doc:write:group","rag:doc:delete:group","rag:index:rebuild:group",
    "usage:read:own","usage:read:all_users","cost:read:own","cost:read:all","user:read","user:suspend","user:unsuspend","user:delete",
    "access:role:create","access:role:update","access:role:assign","access:policy:read"
  ]
}

export function requirePermission(user: AppUser, permission: Permission) {
  const groups = user.cognitoGroups as Role[]
  const allowed = groups.some((role) => rolePermissions[role]?.includes(permission))
  if (!allowed) throw new HTTPException(403, { message: `Forbidden: missing ${permission}` })
}
