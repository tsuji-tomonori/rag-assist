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
  operationEvidence?: {
    auditIntentId: string
    sessionRevocation: "confirmed" | "not_required"
    propagationState: "current" | "reconciliation_required"
    effectivePermissions: string[]
  }
  capability?: {
    canAssignRoles: boolean
    canSuspend: boolean
    canUnsuspend: boolean
    canDelete: boolean
    blockers: string[]
  }
  effectivePermissions?: string[]
  projection?: {
    source: "authoritative_identity" | "local_ledger"
    asOf: string
    reconciliationState: "current" | "pending"
  }
}

export type ManagedUserDeletionPreflight = {
  targetUserId: string
  requiresSuccessor: boolean
  ownedResources: {
    folders: number
    resourceGroups: number
    documents: number
    total: number
  }
  eligibleSuccessors: Array<{
    userId: string
    email: string
    displayName?: string
    status: "active"
  }>
}

export type ManagedUserAuditAction = string

export type ManagedUserAuditLogEntry = {
  auditId: string
  action: ManagedUserAuditAction
  result?: "pending" | "success" | "denied" | "conflict" | "failed"
  reason?: string
  tenantId?: string
  targetType?: string
  actorUserId: string
  actorEmail?: string
  targetUserId: string
  targetEmail?: string
  policyVersion?: string
  source?: "security_audit_outbox" | "legacy_admin_ledger"
  beforeStatus?: ManagedUserStatus
  afterStatus?: ManagedUserStatus
  beforeGroups: string[]
  afterGroups: string[]
  createdAt: string
  completedAt?: string
}

export type AdminListPageMetadata = {
  total: number
  nextCursor?: string
  truncated: boolean
  source: string
  asOf: string
  version?: string
}

export type ManagedUserAuditLogPage = AdminListPageMetadata & {
  auditLog: ManagedUserAuditLogEntry[]
}

export type ManagedUserListPage = AdminListPageMetadata & {
  version: string
  users: ManagedUser[]
}

export type ManagedUserListQuery = {
  cursor?: string
  limit?: number
  query?: string
  status?: "active" | "suspended"
  sort?: "emailAsc" | "updatedDesc"
}

export type AccessRoleDefinition = {
  role: string
  displayName: string
  description: string
  kind: "systemPreset"
  permissions: Permission[]
}

export type AccessRoleList = {
  roles: AccessRoleDefinition[]
  catalogVersion: string
  source: string
  asOf: string
}

export type UserUsageSummary = {
  userId: string
  email: string
  displayName?: string
  chatMessages?: number
  conversationCount?: number
  questionCount?: number
  documentCount?: number
  benchmarkRunCount?: number
  debugRunCount?: number
  availableMetrics: Array<"chatMessages" | "conversationCount" | "questionCount" | "documentCount" | "benchmarkRunCount" | "debugRunCount">
  unavailableMetrics: Array<"chatMessages" | "conversationCount" | "questionCount" | "documentCount" | "benchmarkRunCount" | "debugRunCount">
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
  available: boolean
  unavailableReason?: string
  periodStart: string
  periodEnd: string
  currency?: "USD"
  totalEstimatedUsd?: number
  items?: CostAuditItem[]
  users?: UserCostSummary[]
  pricingCatalogUpdatedAt?: string
}

export type AliasDefinition = {
  aliasId: string
  version: string
  term: string
  expansions: string[]
  scope?: {
    tenantId?: string
    department?: string
    source?: string
    docType?: string
  }
  status: "draft" | "approved" | "disabled"
  createdBy: string
  createdAt: string
  updatedAt: string
  reviewedBy?: string
  reviewedAt?: string
  reviewComment?: string
  publishedVersion?: string
}

export type AliasAuditLogItem = {
  auditId: string
  aliasId?: string
  tenantId: string
  action: "create" | "update" | "review" | "transition" | "disable" | "publish"
  actorUserId: string
  result: "success" | "denied" | "conflict" | "failed"
  reason: string
  beforeStatus?: AliasDefinition["status"]
  afterStatus?: AliasDefinition["status"]
  aliasVersion?: string
  createdAt: string
  detail: string
}

export type AliasListPage = AdminListPageMetadata & {
  aliases: AliasDefinition[]
}

export type AliasAuditLogPage = AdminListPageMetadata & {
  auditLog: AliasAuditLogItem[]
}

export type AliasListQuery = {
  cursor?: string
  limit?: number
  query?: string
  status?: AliasDefinition["status"]
  sort?: "updatedDesc" | "termAsc"
}

export type AliasAuditLogQuery = {
  cursor?: string
  limit?: number
  query?: string
  action?: AliasAuditLogItem["action"]
  aliasId?: string
}

export type AdminAuditLogQuery = {
  cursor?: string
  limit?: number
  query?: string
  action?: ManagedUserAuditAction
}

export type AdminExportArtifact = {
  exportType: "audit_log" | "cost_summary"
  url: string
  expiresInSeconds: number
  objectKey: string
  generatedAt: string
  redaction: {
    policyVersion: string
    redactedFields: string[]
    notes: string[]
  }
}
