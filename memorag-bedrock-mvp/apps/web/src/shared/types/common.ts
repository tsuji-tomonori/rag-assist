export type Citation = {
  documentId: string
  fileName: string
  chunkId?: string
  score: number
  text: string
}

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
  | "benchmark:read"
  | "benchmark:run"
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

export type CurrentUser = {
  userId: string
  email?: string
  groups: string[]
  permissions: Permission[]
}
