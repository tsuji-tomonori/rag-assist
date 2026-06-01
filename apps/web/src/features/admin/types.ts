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

export type AdminExportArtifact = {
  url: string
  expiresInSeconds: number
  objectKey: string
  exportType: "audit_log" | "cost_summary"
  generatedAt: string
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
  chatRequestCount: number
  llmCallCount: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostUsd: number
  actualTokenEventCount: number
  estimatedTokenEventCount: number
  missingTokenEventCount: number
  conversationCount: number
  questionCount: number
  documentCount: number
  benchmarkRunCount: number
  debugRunCount: number
  lastActivityAt?: string
}

export type UsageSummaryBreakdown = {
  key: string
  label: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostUsd: number
  actualTokenEventCount: number
  estimatedTokenEventCount: number
  missingTokenEventCount: number
}

export type UsageSummaryResponse = {
  periodStart: string
  periodEnd: string
  users: UserUsageSummary[]
  breakdowns: {
    byFeature: UsageSummaryBreakdown[]
    byModel: UsageSummaryBreakdown[]
    byGroup: UsageSummaryBreakdown[]
  }
  totals: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    estimatedCostUsd: number
  }
  dataCompleteness: UsageDataCompleteness
}

export type CostAuditItem = {
  service: string
  category: string
  usage: number
  unit: string
  unitCostUsd: number
  estimatedCostUsd: number
  confidence: "actual_usage" | "estimated_usage" | "manual_estimate" | "missing_usage"
  pricingVersion?: string
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
  pricingVersion: string
  pricingCatalogUpdatedAt: string
  dataCompleteness: UsageDataCompleteness
}

export type UsageDataCompleteness = {
  actualTokenEventCount: number
  estimatedTokenEventCount: number
  missingTokenEventCount: number
}

export type AliasDefinition = {
  aliasId: string
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
  action: "create" | "update" | "review" | "disable" | "publish"
  actorUserId: string
  createdAt: string
  detail: string
}
