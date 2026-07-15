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

export type UsageMeasurementSource = "provider" | "tokenizer_estimate" | "missing"
export type UsageQuantityUnit = "input_token" | "output_token" | "cache_read_token" | "cache_write_token" | "request"
export type UsageQuery = { periodStart?: string; periodEnd?: string; subjectId?: string; runId?: string; modelId?: string; feature?: string; provider?: string; limit?: number; cursor?: string }
export type UsageQuantity = { unit: UsageQuantityUnit; value?: number; source: UsageMeasurementSource }
export type UsageEvent = {
  schemaVersion: 1; eventId: string; tenantId: string; subjectId?: string; runId?: string; feature?: string; provider?: string; region?: string; modelId?: string
  quantities: UsageQuantity[]; status: "succeeded" | "failed"; errorCode?: string; idempotencyKey: string; occurredAt: string; recordedAt: string
}
export type UsageCompleteness = {
  eventCount: number; actualQuantityCount: number; estimatedQuantityCount: number; missingQuantityCount: number
  unknownSubjectCount: number; unknownRunCount: number; unknownModelCount: number; unknownFeatureCount: number; unpricedQuantityCount: number
  state: "complete" | "partial" | "missing"
}
export type UsageBreakdown = { key: string; label: string; actualQuantity: number; estimatedQuantity: number; missingQuantityCount: number; eventCount: number }
export type UsageSummaryPage = {
  query: Omit<UsageQuery, "cursor">; events: UsageEvent[]; nextCursor?: string; truncated: boolean; asOf: string; source: "usage_event_store"; rolloutMode: "disabled" | "shadow" | "active"
  completeness: UsageCompleteness
  breakdowns: { bySubject: UsageBreakdown[]; byFeature: UsageBreakdown[]; byProvider: UsageBreakdown[]; byModel: UsageBreakdown[] }
}
export type CostAuditItem = {
  eventId: string; subjectId: string; runId: string; feature: string; provider: string; region: string; modelId: string; unit: UsageQuantityUnit
  quantity?: number; measurementSource: UsageMeasurementSource; pricingState: "actual" | "estimate" | "unpriced"; catalogVersion?: string; priceSource?: string
  unitCostUsd?: number; costUsd?: number; occurredAt: string
}
export type CostAuditSummary = {
  query: Omit<UsageQuery, "cursor">; currency: "USD"; pricedCostUsd: number; items: CostAuditItem[]; nextCursor?: string; truncated: boolean
  asOf: string; source: "usage_event_store+versioned_price_catalog"; rolloutMode: "disabled" | "shadow" | "active"; catalogVersions: string[]; completeness: UsageCompleteness
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
  exportType: "audit_log" | "usage_summary" | "cost_summary"
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
