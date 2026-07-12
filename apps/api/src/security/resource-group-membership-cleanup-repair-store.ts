import type { ObjectStore } from "../adapters/object-store.js"
import type { RegisterRevocationCleanupInput } from "../rag/_shared/security/revocation-cleanup-coordinator.js"
import { tenantPartitionId } from "./tenant-partition.js"

export const RESOURCE_GROUP_MEMBERSHIP_CLEANUP_REPAIR_SCHEMA_VERSION = 1 as const

export type ResourceGroupMembershipCleanupRepairIntent = Readonly<{
  schemaVersion: typeof RESOURCE_GROUP_MEMBERSHIP_CLEANUP_REPAIR_SCHEMA_VERSION
  status: "prepared" | "deny_committed" | "cleanup_registered" | "abandoned"
  operationId: string
  auditIntentId: string
  tenantId: string
  groupId: string
  expectedBeforeVersion: string
  cleanupRegistration: RegisterRevocationCleanupInput & { operationId: string }
  createdAt: string
  updatedAt: string
}>

export type PrepareResourceGroupMembershipCleanupRepairInput = Readonly<{
  auditIntentId: string
  tenantId: string
  groupId: string
  expectedBeforeVersion: string
  cleanupRegistration: RegisterRevocationCleanupInput & { operationId: string }
  preparedAt: string
}>

export interface ResourceGroupMembershipCleanupRepairStore {
  prepare(input: PrepareResourceGroupMembershipCleanupRepairInput): Promise<ResourceGroupMembershipCleanupRepairIntent>
  listPending(tenantId: string, groupId: string): Promise<ResourceGroupMembershipCleanupRepairIntent[]>
  markDenyCommitted(tenantId: string, groupId: string, operationId: string, updatedAt: string): Promise<ResourceGroupMembershipCleanupRepairIntent>
  markCleanupRegistered(tenantId: string, groupId: string, operationId: string, updatedAt: string): Promise<ResourceGroupMembershipCleanupRepairIntent>
  markAbandoned(tenantId: string, groupId: string, operationId: string, updatedAt: string): Promise<ResourceGroupMembershipCleanupRepairIntent>
}

/**
 * Durable pre-commit outbox for membership revocation cleanup registration.
 * A prepared record is persisted before the authoritative membership deny, so
 * a post-commit cleanup-ledger outage cannot leave an untracked revocation.
 */
export class ObjectStoreResourceGroupMembershipCleanupRepairStore implements ResourceGroupMembershipCleanupRepairStore {
  constructor(private readonly objectStore: ObjectStore) {}

  async prepare(input: PrepareResourceGroupMembershipCleanupRepairInput): Promise<ResourceGroupMembershipCleanupRepairIntent> {
    validatePrepareInput(input)
    const key = repairIntentKey(input.tenantId, input.groupId, input.cleanupRegistration.operationId)
    const existing = await this.read(key)
    if (existing) {
      assertSameRepair(existing.value, input)
      return existing.value
    }
    const intent: ResourceGroupMembershipCleanupRepairIntent = {
      schemaVersion: RESOURCE_GROUP_MEMBERSHIP_CLEANUP_REPAIR_SCHEMA_VERSION,
      status: "prepared",
      operationId: input.cleanupRegistration.operationId,
      auditIntentId: input.auditIntentId,
      tenantId: input.tenantId,
      groupId: input.groupId,
      expectedBeforeVersion: input.expectedBeforeVersion,
      cleanupRegistration: input.cleanupRegistration,
      createdAt: input.preparedAt,
      updatedAt: input.preparedAt
    }
    try {
      await this.objectStore.putTextIfVersion(key, JSON.stringify(intent, null, 2), undefined, "application/json")
      return intent
    } catch (error) {
      if (!isConditionalWriteError(error)) throw error
      const winner = await this.read(key)
      if (!winner) throw error
      assertSameRepair(winner.value, input)
      return winner.value
    }
  }

  async listPending(tenantId: string, groupId: string): Promise<ResourceGroupMembershipCleanupRepairIntent[]> {
    const prefix = repairIntentPrefix(tenantId, groupId)
    const keys = await this.objectStore.listKeys(prefix)
    const intents = await Promise.all(keys.map(async (key) => (await this.read(key))?.value))
    return intents
      .filter((intent): intent is ResourceGroupMembershipCleanupRepairIntent => Boolean(intent))
      .filter((intent) => intent.status === "prepared" || intent.status === "deny_committed")
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.operationId.localeCompare(right.operationId))
  }

  markDenyCommitted(tenantId: string, groupId: string, operationId: string, updatedAt: string) {
    return this.transition(tenantId, groupId, operationId, "deny_committed", updatedAt)
  }

  markCleanupRegistered(tenantId: string, groupId: string, operationId: string, updatedAt: string) {
    return this.transition(tenantId, groupId, operationId, "cleanup_registered", updatedAt)
  }

  markAbandoned(tenantId: string, groupId: string, operationId: string, updatedAt: string) {
    return this.transition(tenantId, groupId, operationId, "abandoned", updatedAt)
  }

  private async transition(
    tenantId: string,
    groupId: string,
    operationId: string,
    status: ResourceGroupMembershipCleanupRepairIntent["status"],
    updatedAt: string
  ): Promise<ResourceGroupMembershipCleanupRepairIntent> {
    const key = repairIntentKey(tenantId, groupId, operationId)
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const stored = await this.read(key)
      if (!stored) throw new Error("Resource group membership cleanup repair intent was not found")
      if (stored.value.tenantId !== tenantId || stored.value.groupId !== groupId || stored.value.operationId !== operationId) {
        throw new Error("Resource group membership cleanup repair intent identity mismatch")
      }
      if (stored.value.status === status || stored.value.status === "cleanup_registered" || stored.value.status === "abandoned") {
        return stored.value
      }
      const next: ResourceGroupMembershipCleanupRepairIntent = {
        ...stored.value,
        status,
        updatedAt
      }
      try {
        await this.objectStore.putTextIfVersion(key, JSON.stringify(next, null, 2), stored.version, "application/json")
        return next
      } catch (error) {
        if (!isConditionalWriteError(error) || attempt === 5) throw error
      }
    }
    throw new Error("Resource group membership cleanup repair intent could not be updated")
  }

  private async read(key: string): Promise<{
    value: ResourceGroupMembershipCleanupRepairIntent
    version: string
  } | undefined> {
    try {
      const stored = await this.objectStore.getTextWithVersion(key)
      const value = JSON.parse(stored.text) as ResourceGroupMembershipCleanupRepairIntent
      validateStoredIntent(value)
      return { value, version: stored.version }
    } catch (error) {
      if (isMissingObjectError(error)) return undefined
      throw error
    }
  }
}

function repairIntentPrefix(tenantId: string, groupId: string): string {
  assertIdentifier(tenantId, "tenantId")
  assertIdentifier(groupId, "groupId")
  return `security/resource-group-membership-cleanup-repairs/${tenantPartitionId(tenantId)}/${encodeURIComponent(groupId)}/`
}

function repairIntentKey(tenantId: string, groupId: string, operationId: string): string {
  assertIdentifier(operationId, "operationId")
  return `${repairIntentPrefix(tenantId, groupId)}${encodeURIComponent(operationId)}.json`
}

function validatePrepareInput(input: PrepareResourceGroupMembershipCleanupRepairInput): void {
  for (const [name, value] of [
    ["auditIntentId", input.auditIntentId],
    ["tenantId", input.tenantId],
    ["groupId", input.groupId],
    ["expectedBeforeVersion", input.expectedBeforeVersion],
    ["operationId", input.cleanupRegistration.operationId],
    ["preparedAt", input.preparedAt]
  ] as const) assertIdentifier(value, name)
  if (input.cleanupRegistration.tenantId !== input.tenantId || input.cleanupRegistration.resourceId !== input.groupId) {
    throw new Error("Resource group membership cleanup repair crossed a resource boundary")
  }
}

function validateStoredIntent(intent: ResourceGroupMembershipCleanupRepairIntent): void {
  if (
    intent.schemaVersion !== RESOURCE_GROUP_MEMBERSHIP_CLEANUP_REPAIR_SCHEMA_VERSION ||
    !["prepared", "deny_committed", "cleanup_registered", "abandoned"].includes(intent.status)
  ) throw new Error("Resource group membership cleanup repair intent is invalid")
  validatePrepareInput({
    auditIntentId: intent.auditIntentId,
    tenantId: intent.tenantId,
    groupId: intent.groupId,
    expectedBeforeVersion: intent.expectedBeforeVersion,
    cleanupRegistration: intent.cleanupRegistration,
    preparedAt: intent.createdAt
  })
}

function assertSameRepair(
  intent: ResourceGroupMembershipCleanupRepairIntent,
  input: PrepareResourceGroupMembershipCleanupRepairInput
): void {
  if (
    intent.auditIntentId !== input.auditIntentId ||
    intent.expectedBeforeVersion !== input.expectedBeforeVersion ||
    JSON.stringify(intent.cleanupRegistration) !== JSON.stringify(input.cleanupRegistration)
  ) throw new Error("Resource group membership cleanup repair intent conflicts with an existing operation")
}

function assertIdentifier(value: string, name: string): void {
  if (!value || value.trim() !== value) throw new Error(`${name} is missing or non-canonical`)
}

function isConditionalWriteError(error: unknown): boolean {
  const candidate = error as { code?: string; name?: string; $metadata?: { httpStatusCode?: number } }
  return candidate.code === "PRECONDITION_FAILED" || candidate.name === "PreconditionFailed" || candidate.$metadata?.httpStatusCode === 412
}

function isMissingObjectError(error: unknown): boolean {
  const candidate = error as { Code?: string; code?: string; name?: string; message?: string; $metadata?: { httpStatusCode?: number } }
  return candidate.Code === "NoSuchKey" || candidate.code === "ENOENT" || candidate.name === "NotFound" ||
    candidate.$metadata?.httpStatusCode === 404 || candidate.message?.includes("ENOENT") === true
}
