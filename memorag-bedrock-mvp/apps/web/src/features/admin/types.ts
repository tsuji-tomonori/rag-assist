import type { Permission } from "../../shared/types/common.js"

export type ManagedUserStatus = "active" | "suspended" | "deleted"

export type ManagedUser = {
  userId: string
  email: string
  displayName?: string
  status: ManagedUserStatus
  groups: string[]
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}

export type ManagedUserAuditAction = "user:create" | "role:assign" | "user:suspend" | "user:unsuspend" | "user:delete"

export type ManagedUserAuditLogEntry = {
  auditId: string
  action: ManagedUserAuditAction
  actorUserId: string
  actorEmail?: string
  targetUserId: string
  targetEmail: string
  beforeStatus?: ManagedUserStatus
  afterStatus?: ManagedUserStatus
  beforeGroups: string[]
  afterGroups: string[]
  createdAt: string
}

export type AccessRoleDefinition = {
  role: string
  permissions: Permission[]
}

export type UserUsageSummary = {
  userId: string
  email: string
  displayName?: string
  chatMessages: number
  conversationCount: number
  questionCount: number
  documentCount: number
  benchmarkRunCount: number
  debugRunCount: number
  lastActivityAt?: string
}

export type CostAuditItem = {
  service: string
  category: string
  usage: number
  unit: string
  unitCostUsd: number
  estimatedCostUsd: number
  confidence: "actual_usage" | "estimated_usage" | "manual_estimate"
}

export type UserCostSummary = {
  userId: string
  email: string
  estimatedCostUsd: number
}

export type CostAuditSummary = {
  periodStart: string
  periodEnd: string
  currency: "USD"
  totalEstimatedUsd: number
  items: CostAuditItem[]
  users: UserCostSummary[]
  pricingCatalogUpdatedAt: string
}
