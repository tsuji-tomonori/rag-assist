export type Citation = {
  documentId: string
  fileName: string
  chunkId?: string
  score: number
  text: string
}

export type Permission = ApplicationPermission

export type CurrentUser = {
  userId: string
  email?: string
  groups: string[]
  permissions: Permission[]
}
import type { ApplicationPermission } from "@memorag-mvp/contract/access-control"
