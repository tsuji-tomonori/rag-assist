import type { ObjectStore } from "../../../adapters/object-store.js"
import { tenantPartitionId } from "../../../security/tenant-partition.js"
import type {
  RegisterRevocationCleanupInput,
  RevocationCleanupManifest
} from "./revocation-cleanup-coordinator.js"
import { ObjectStoreRevocationCleanupTenantRegistry } from "./revocation-cleanup-tenant-registry.js"

export const REVOCATION_CLEANUP_REPAIR_SCHEMA_VERSION = 1 as const

export type RevocationCleanupRepairIntent = Readonly<{
  schemaVersion: typeof REVOCATION_CLEANUP_REPAIR_SCHEMA_VERSION
  status: "prepared" | "deny_committed" | "cleanup_registered" | "cleanup_completed" | "abandoned"
  operationId: string
  tenantId: string
  resourceType: RevocationCleanupManifest["resourceType"]
  resourceId: string
  expectedBeforeDenyVersion: string
  cleanupRegistration: RegisterRevocationCleanupInput & { operationId: string }
  createdAt: string
  updatedAt: string
}>

export type PrepareRevocationCleanupRepairInput = Readonly<{
  expectedBeforeDenyVersion: string
  cleanupRegistration: RegisterRevocationCleanupInput & { operationId: string }
  preparedAt: string
}>

/**
 * Shared deny-first repair outbox and resource fence.
 *
 * The intent is written before the authoritative policy CAS. A worker can
 * therefore regenerate a missing cleanup manifest after a process crash or a
 * cleanup-ledger outage. `prepared`, `deny_committed`, and
 * `cleanup_registered` are also a fence: a permission-increasing mutation must
 * not commit while destructive/derived cleanup for the same resource can run.
 */
export class ObjectStoreRevocationCleanupRepairOutbox {
  constructor(private readonly objectStore: ObjectStore) {}

  async get(
    tenantId: string,
    resourceType: RevocationCleanupManifest["resourceType"],
    resourceId: string,
    operationId: string
  ): Promise<RevocationCleanupRepairIntent | undefined> {
    return (await this.read(repairKey(tenantId, resourceType, resourceId, operationId)))?.value
  }

  async prepare(input: PrepareRevocationCleanupRepairInput): Promise<RevocationCleanupRepairIntent> {
    validatePrepareInput(input)
    const registration = input.cleanupRegistration
    await new ObjectStoreRevocationCleanupTenantRegistry(this.objectStore).register(registration.tenantId)
    const key = repairKey(registration.tenantId, registration.resourceType, registration.resourceId, registration.operationId)
    const existing = await this.read(key)
    if (existing) {
      assertSameIntent(existing.value, input)
      return existing.value
    }
    const intent: RevocationCleanupRepairIntent = {
      schemaVersion: REVOCATION_CLEANUP_REPAIR_SCHEMA_VERSION,
      status: "prepared",
      operationId: registration.operationId,
      tenantId: registration.tenantId,
      resourceType: registration.resourceType,
      resourceId: registration.resourceId,
      expectedBeforeDenyVersion: input.expectedBeforeDenyVersion,
      cleanupRegistration: registration,
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
      assertSameIntent(winner.value, input)
      return winner.value
    }
  }

  async listPending(tenantId: string, limit = 100): Promise<RevocationCleanupRepairIntent[]> {
    assertIdentifier(tenantId, "tenantId")
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) throw new Error("Revocation cleanup repair limit is invalid")
    const prefix = tenantRepairPrefix(tenantId)
    const keys = await this.objectStore.listKeys(prefix)
    const intents: RevocationCleanupRepairIntent[] = []
    for (const key of keys.sort()) {
      if (!key.startsWith(prefix) || !key.endsWith(".json")) throw new Error("Revocation cleanup repair listing escaped its tenant partition")
      const stored = await this.read(key)
      if (!stored) throw new Error("Listed revocation cleanup repair disappeared")
      assertCanonicalKey(key, stored.value)
      if (stored.value.status === "prepared" || stored.value.status === "deny_committed") intents.push(stored.value)
    }
    return intents
      .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt) || left.operationId.localeCompare(right.operationId))
      .slice(0, limit)
  }

  async assertResourceFenceReleased(
    tenantId: string,
    resourceType: RevocationCleanupManifest["resourceType"],
    resourceId: string
  ): Promise<void> {
    const prefix = resourceRepairPrefix(tenantId, resourceType, resourceId)
    const keys = await this.objectStore.listKeys(prefix)
    for (const key of keys) {
      if (!key.startsWith(prefix) || !key.endsWith(".json")) throw new Error("Revocation cleanup resource fence listing escaped its resource partition")
      const stored = await this.read(key)
      if (!stored) throw new Error("Listed revocation cleanup resource fence disappeared")
      assertCanonicalKey(key, stored.value)
      if (["prepared", "deny_committed", "cleanup_registered"].includes(stored.value.status)) {
        throw new RevocationCleanupFenceError()
      }
    }
  }

  markDenyCommitted(intent: Pick<RevocationCleanupRepairIntent, "tenantId" | "resourceType" | "resourceId" | "operationId">, updatedAt: string) {
    return this.transition(intent, "deny_committed", updatedAt)
  }

  markCleanupRegistered(intent: Pick<RevocationCleanupRepairIntent, "tenantId" | "resourceType" | "resourceId" | "operationId">, updatedAt: string) {
    return this.transition(intent, "cleanup_registered", updatedAt)
  }

  markCleanupCompleted(intent: Pick<RevocationCleanupRepairIntent, "tenantId" | "resourceType" | "resourceId" | "operationId">, updatedAt: string) {
    return this.transition(intent, "cleanup_completed", updatedAt)
  }

  markAbandoned(intent: Pick<RevocationCleanupRepairIntent, "tenantId" | "resourceType" | "resourceId" | "operationId">, updatedAt: string) {
    return this.transition(intent, "abandoned", updatedAt)
  }

  private async transition(
    identity: Pick<RevocationCleanupRepairIntent, "tenantId" | "resourceType" | "resourceId" | "operationId">,
    status: RevocationCleanupRepairIntent["status"],
    updatedAt: string
  ): Promise<RevocationCleanupRepairIntent> {
    assertTimestamp(updatedAt, "updatedAt")
    const key = repairKey(identity.tenantId, identity.resourceType, identity.resourceId, identity.operationId)
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const stored = await this.read(key)
      if (!stored) throw new Error("Revocation cleanup repair intent was not found")
      assertIdentity(stored.value, identity)
      if (stored.value.status === status || stored.value.status === "cleanup_completed" || stored.value.status === "abandoned") return stored.value
      if (!transitionAllowed(stored.value.status, status)) throw new Error("Revocation cleanup repair transition is invalid")
      const next: RevocationCleanupRepairIntent = { ...stored.value, status, updatedAt }
      try {
        await this.objectStore.putTextIfVersion(key, JSON.stringify(next, null, 2), stored.version, "application/json")
        return next
      } catch (error) {
        if (!isConditionalWriteError(error) || attempt === 5) throw error
      }
    }
    throw new Error("Revocation cleanup repair transition did not converge")
  }

  private async read(key: string): Promise<{ value: RevocationCleanupRepairIntent; version: string } | undefined> {
    try {
      const stored = await this.objectStore.getTextWithVersion(key)
      const value = JSON.parse(stored.text) as RevocationCleanupRepairIntent
      validateStored(value)
      return { value, version: stored.version }
    } catch (error) {
      if (isMissingObjectError(error)) return undefined
      throw error
    }
  }
}

export class RevocationCleanupFenceError extends Error {
  constructor() {
    super("A revocation cleanup resource fence is active")
    this.name = "RevocationCleanupFenceError"
  }
}

function transitionAllowed(
  current: RevocationCleanupRepairIntent["status"],
  next: RevocationCleanupRepairIntent["status"]
): boolean {
  if (next === "abandoned") return current === "prepared" || current === "deny_committed"
  if (next === "deny_committed") return current === "prepared"
  if (next === "cleanup_registered") return current === "deny_committed"
  if (next === "cleanup_completed") return current === "cleanup_registered" || current === "deny_committed"
  return false
}

function tenantRepairPrefix(tenantId: string): string {
  return `security/revocation-cleanup-repairs/${tenantPartitionId(tenantId)}/`
}

function resourceRepairPrefix(
  tenantId: string,
  resourceType: RevocationCleanupManifest["resourceType"],
  resourceId: string
): string {
  assertIdentifier(resourceType, "resourceType")
  assertIdentifier(resourceId, "resourceId")
  return `${tenantRepairPrefix(tenantId)}${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}/`
}

function repairKey(
  tenantId: string,
  resourceType: RevocationCleanupManifest["resourceType"],
  resourceId: string,
  operationId: string
): string {
  assertIdentifier(operationId, "operationId")
  return `${resourceRepairPrefix(tenantId, resourceType, resourceId)}${encodeURIComponent(operationId)}.json`
}

function validatePrepareInput(input: PrepareRevocationCleanupRepairInput): void {
  assertIdentifier(input.expectedBeforeDenyVersion, "expectedBeforeDenyVersion")
  assertTimestamp(input.preparedAt, "preparedAt")
  const registration = input.cleanupRegistration
  for (const [name, value] of [
    ["operationId", registration.operationId],
    ["tenantId", registration.tenantId],
    ["resourceId", registration.resourceId],
    ["authoritativeDenyVersion", registration.authoritativeDenyVersion]
  ] as const) assertIdentifier(value, name)
  assertTimestamp(registration.authoritativeDenyConfirmedAt, "authoritativeDenyConfirmedAt")
}

function validateStored(intent: RevocationCleanupRepairIntent): void {
  if (
    intent.schemaVersion !== REVOCATION_CLEANUP_REPAIR_SCHEMA_VERSION
    || !["prepared", "deny_committed", "cleanup_registered", "cleanup_completed", "abandoned"].includes(intent.status)
    || intent.operationId !== intent.cleanupRegistration.operationId
    || intent.tenantId !== intent.cleanupRegistration.tenantId
    || intent.resourceType !== intent.cleanupRegistration.resourceType
    || intent.resourceId !== intent.cleanupRegistration.resourceId
  ) throw new Error("Revocation cleanup repair intent is invalid")
  validatePrepareInput({
    expectedBeforeDenyVersion: intent.expectedBeforeDenyVersion,
    cleanupRegistration: intent.cleanupRegistration,
    preparedAt: intent.createdAt
  })
  assertTimestamp(intent.updatedAt, "updatedAt")
}

function assertSameIntent(intent: RevocationCleanupRepairIntent, input: PrepareRevocationCleanupRepairInput): void {
  if (
    intent.expectedBeforeDenyVersion !== input.expectedBeforeDenyVersion
    || JSON.stringify(intent.cleanupRegistration) !== JSON.stringify(input.cleanupRegistration)
  ) throw new Error("Revocation cleanup repair intent conflicts with an existing operation")
}

function assertCanonicalKey(key: string, intent: RevocationCleanupRepairIntent): void {
  if (key !== repairKey(intent.tenantId, intent.resourceType, intent.resourceId, intent.operationId)) {
    throw new Error("Revocation cleanup repair key is not canonical")
  }
}

function assertIdentity(
  intent: RevocationCleanupRepairIntent,
  identity: Pick<RevocationCleanupRepairIntent, "tenantId" | "resourceType" | "resourceId" | "operationId">
): void {
  if (
    intent.tenantId !== identity.tenantId
    || intent.resourceType !== identity.resourceType
    || intent.resourceId !== identity.resourceId
    || intent.operationId !== identity.operationId
  ) throw new Error("Revocation cleanup repair intent identity mismatch")
}

function assertIdentifier(value: string, name: string): void {
  if (!value || value.trim() !== value) throw new Error(`${name} is missing or non-canonical`)
}

function assertTimestamp(value: string, name: string): void {
  assertIdentifier(value, name)
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new Error(`${name} is invalid`)
}

function isConditionalWriteError(error: unknown): boolean {
  const candidate = error as { code?: string; name?: string; $metadata?: { httpStatusCode?: number } }
  return candidate.code === "PRECONDITION_FAILED" || candidate.name === "PreconditionFailed" || candidate.$metadata?.httpStatusCode === 412
}

function isMissingObjectError(error: unknown): boolean {
  const candidate = error as { Code?: string; code?: string; name?: string; message?: string; $metadata?: { httpStatusCode?: number } }
  return candidate.Code === "NoSuchKey" || candidate.name === "NoSuchKey" || candidate.code === "ENOENT" || candidate.name === "NotFound"
    || candidate.$metadata?.httpStatusCode === 404 || candidate.message?.includes("ENOENT") === true
}
