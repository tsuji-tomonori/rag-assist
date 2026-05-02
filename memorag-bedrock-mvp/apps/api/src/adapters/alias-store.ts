import { randomUUID } from "node:crypto"
import type { AppUser } from "../auth.js"
import type { ObjectStore } from "./object-store.js"

export type AliasType = "oneWay" | "equivalent" | "typo" | "placeholder"
export type AliasStatus = "draft" | "active" | "disabled" | "rejected"
export type AliasSource = "manual" | "analytics" | "llmSuggestion"

export type AliasScope = {
  tenantId: string
  source?: string
  docType?: string
  department?: string
  aclGroups?: string[]
  allowedUsers?: string[]
}

export type AliasDefinition = {
  schemaVersion: 1
  aliasId: string
  from: string
  to: string[]
  type: AliasType
  weight: number
  scope: AliasScope
  status: AliasStatus
  source: AliasSource
  reason: string
  createdBy: string
  updatedBy: string
  reviewedBy?: string
  version: string
  createdAt: string
  updatedAt: string
  reviewedAt?: string
  disabledAt?: string
}

export type AliasAuditAction = "created" | "updated" | "reviewed" | "disabled"

export type AliasAuditLogEntry = {
  schemaVersion: 1
  eventId: string
  aliasId: string
  action: AliasAuditAction
  actorUserId: string
  actorEmail?: string
  at: string
  beforeStatus?: AliasStatus
  afterStatus: AliasStatus
  reason?: string
  aliasVersion: string
  scope: AliasScope
}

export type CreateAliasInput = {
  from: string
  to: string[]
  type?: AliasType
  weight?: number
  scope: AliasScope
  source?: AliasSource
  reason: string
}

export type UpdateAliasInput = Partial<Pick<CreateAliasInput, "from" | "to" | "type" | "weight" | "scope" | "source" | "reason">>

export type ReviewAliasInput = {
  decision: "approve" | "reject"
  reason?: string
}

export type DisableAliasInput = {
  reason?: string
}

export class AliasStore {
  constructor(private readonly objectStore: ObjectStore) {}

  async create(input: CreateAliasInput, user: AppUser): Promise<AliasDefinition> {
    const now = new Date().toISOString()
    const alias: AliasDefinition = {
      schemaVersion: 1,
      aliasId: randomUUID(),
      from: input.from,
      to: [...input.to],
      type: input.type ?? "oneWay",
      weight: input.weight ?? 1,
      scope: normalizeScope(input.scope),
      status: "draft",
      source: input.source ?? "manual",
      reason: input.reason,
      createdBy: user.userId,
      updatedBy: user.userId,
      version: versionLabel("alias-draft", now),
      createdAt: now,
      updatedAt: now
    }
    await this.writeAlias(alias)
    await this.writeAudit(alias, "created", user, undefined, alias.status, alias.reason, now)
    return alias
  }

  async list(): Promise<AliasDefinition[]> {
    const keys = await this.aliasKeys()
    const aliases = await Promise.all(keys.map((key) => this.readAliasKey(key)))
    return aliases.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async update(aliasId: string, input: UpdateAliasInput, user: AppUser): Promise<AliasDefinition> {
    const alias = await this.getRequired(aliasId)
    if (alias.status !== "draft") throw new Error("Only draft aliases can be updated")
    const now = new Date().toISOString()
    const updated: AliasDefinition = {
      ...alias,
      from: input.from ?? alias.from,
      to: input.to ? [...input.to] : alias.to,
      type: input.type ?? alias.type,
      weight: input.weight ?? alias.weight,
      scope: input.scope ? normalizeScope(input.scope) : alias.scope,
      source: input.source ?? alias.source,
      reason: input.reason ?? alias.reason,
      updatedBy: user.userId,
      version: versionLabel("alias-draft", now),
      updatedAt: now
    }
    if (aliasKey(alias) !== aliasKey(updated)) await this.objectStore.deleteObject(aliasKey(alias))
    await this.writeAlias(updated)
    await this.writeAudit(updated, "updated", user, alias.status, updated.status, input.reason, now)
    return updated
  }

  async review(aliasId: string, input: ReviewAliasInput, user: AppUser): Promise<AliasDefinition> {
    const alias = await this.getRequired(aliasId)
    if (alias.status !== "draft") throw new Error("Only draft aliases can be reviewed")
    const now = new Date().toISOString()
    const reviewed: AliasDefinition = {
      ...alias,
      status: input.decision === "approve" ? "active" : "rejected",
      updatedBy: user.userId,
      reviewedBy: user.userId,
      reviewedAt: now,
      updatedAt: now,
      version: versionLabel(input.decision === "approve" ? "alias" : "alias-rejected", now)
    }
    await this.writeAlias(reviewed)
    await this.writeAudit(reviewed, "reviewed", user, alias.status, reviewed.status, input.reason, now)
    return reviewed
  }

  async disable(aliasId: string, input: DisableAliasInput, user: AppUser): Promise<AliasDefinition> {
    const alias = await this.getRequired(aliasId)
    if (alias.status !== "active") throw new Error("Only active aliases can be disabled")
    const now = new Date().toISOString()
    const disabled: AliasDefinition = {
      ...alias,
      status: "disabled",
      updatedBy: user.userId,
      disabledAt: now,
      updatedAt: now,
      version: versionLabel("alias-disabled", now)
    }
    await this.writeAlias(disabled)
    await this.writeAudit(disabled, "disabled", user, alias.status, disabled.status, input.reason, now)
    return disabled
  }

  async auditLog(limit = 100): Promise<AliasAuditLogEntry[]> {
    const keys = (await this.objectStore.listKeys("aliases/audit-log/")).filter((key) => key.endsWith(".json")).sort().reverse().slice(0, limit)
    const entries = await Promise.all(keys.map(async (key) => JSON.parse(await this.objectStore.getText(key)) as AliasAuditLogEntry))
    return entries.sort((a, b) => b.at.localeCompare(a.at))
  }

  private async getRequired(aliasId: string): Promise<AliasDefinition> {
    const aliases = await this.list()
    const alias = aliases.find((candidate) => candidate.aliasId === aliasId)
    if (!alias) throw new Error("Alias not found")
    return alias
  }

  private async aliasKeys(): Promise<string[]> {
    return (await this.objectStore.listKeys("aliases/")).filter((key) => key.endsWith(".json") && key.includes("/definitions/"))
  }

  private async readAliasKey(key: string): Promise<AliasDefinition> {
    return JSON.parse(await this.objectStore.getText(key)) as AliasDefinition
  }

  private async writeAlias(alias: AliasDefinition): Promise<void> {
    await this.objectStore.putText(aliasKey(alias), JSON.stringify(alias, null, 2), "application/json")
  }

  private async writeAudit(
    alias: AliasDefinition,
    action: AliasAuditAction,
    user: AppUser,
    beforeStatus: AliasStatus | undefined,
    afterStatus: AliasStatus,
    reason: string | undefined,
    at: string
  ): Promise<void> {
    const eventId = randomUUID()
    const entry: AliasAuditLogEntry = {
      schemaVersion: 1,
      eventId,
      aliasId: alias.aliasId,
      action,
      actorUserId: user.userId,
      actorEmail: user.email,
      at,
      beforeStatus,
      afterStatus,
      reason,
      aliasVersion: alias.version,
      scope: alias.scope
    }
    await this.objectStore.putText(`aliases/audit-log/${compactDate(at)}-${eventId}.json`, JSON.stringify(entry, null, 2), "application/json")
  }
}

function aliasKey(alias: Pick<AliasDefinition, "aliasId" | "scope">): string {
  const scope = normalizeScope(alias.scope)
  return [
    "aliases",
    `tenantId=${encodePart(scope.tenantId)}`,
    `source=${encodePart(scope.source ?? "_global")}`,
    `docType=${encodePart(scope.docType ?? "_global")}`,
    "definitions",
    `${alias.aliasId}.json`
  ].join("/")
}

function normalizeScope(scope: AliasScope): AliasScope {
  return {
    tenantId: scope.tenantId,
    source: scope.source,
    docType: scope.docType,
    department: scope.department,
    aclGroups: sortedUnique(scope.aclGroups),
    allowedUsers: sortedUnique(scope.allowedUsers)
  }
}

function sortedUnique(values: string[] | undefined): string[] | undefined {
  const unique = [...new Set((values ?? []).filter(Boolean))].sort()
  return unique.length > 0 ? unique : undefined
}

function encodePart(value: string): string {
  return encodeURIComponent(value)
}

function versionLabel(prefix: string, at: string): string {
  return `${prefix}-${compactDate(at)}`
}

function compactDate(value: string): string {
  return value.replace(/[-:.]/g, "").replace("T", "-").replace("Z", "Z")
}
