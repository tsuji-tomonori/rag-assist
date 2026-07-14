import { randomUUID } from "node:crypto"
import {
  APPLICATION_ROLES,
  isApplicationRole,
  type ApplicationRole
} from "@memorag-mvp/contract/access-control"
import type { ObjectStore } from "../adapters/object-store.js"
import { tenantPartitionId } from "./tenant-partition.js"

export const APPLICATION_ROLE_MUTATION_LOCK_SCHEMA_VERSION = 1 as const

export type ApplicationRoleMutationLockPhase =
  | "held"
  | "identity_mutation"
  | "managed_commit"
  | "managed_committed"
  | "recovering"
  | "released"

export type ApplicationRoleMutationLockRecord = Readonly<{
  schemaVersion: typeof APPLICATION_ROLE_MUTATION_LOCK_SCHEMA_VERSION
  tenantId: string
  operationId: string
  auditIntentId: string
  fencingToken: string
  phase: ApplicationRoleMutationLockPhase
  recoveryAction?: "rollback_identity" | "complete_managed" | "reconcile_managed"
  targetUserId: string
  targetUsername: string
  expectedRoles: readonly ApplicationRole[]
  desiredRoles: readonly ApplicationRole[]
  leaseExpiresAt: string
  revision: number
  createdAt: string
  updatedAt: string
}>

export type ApplicationRoleMutationLease = Readonly<{
  record: ApplicationRoleMutationLockRecord
  version: string
}>

export class ApplicationRoleMutationLockConflictError extends Error {
  constructor(message = "Another application-role mutation is active for the tenant") {
    super(message)
    this.name = "ApplicationRoleMutationLockConflictError"
  }
}

export class ApplicationRoleMutationLockLostError extends Error {
  constructor(message = "Application-role mutation fence was lost") {
    super(message)
    this.name = "ApplicationRoleMutationLockLostError"
  }
}

export class ApplicationRoleMutationRecoveryRequiredError extends Error {
  constructor(readonly staleLease: ApplicationRoleMutationLease) {
    super("Expired application-role identity mutation requires fenced recovery")
    this.name = "ApplicationRoleMutationRecoveryRequiredError"
  }
}

/** Tenant-wide CAS lease with a fencing token carried through the IdP boundary. */
export class ObjectStoreApplicationRoleMutationLock {
  constructor(
    private readonly objectStore: ObjectStore,
    private readonly now: () => Date = () => new Date(),
    private readonly leaseDurationMs = 2 * 60_000
  ) {
    if (!Number.isSafeInteger(leaseDurationMs) || leaseDurationMs <= 0) {
      throw new Error("Application-role mutation lease duration is invalid")
    }
  }

  async acquire(input: Readonly<{
    tenantId: string
    operationId: string
    auditIntentId: string
    targetUserId: string
    targetUsername: string
    expectedRoles: readonly ApplicationRole[]
    desiredRoles: readonly ApplicationRole[]
  }>): Promise<ApplicationRoleMutationLease> {
    const canonicalInput = canonicalAcquireInput(input)
    const key = lockKey(canonicalInput.tenantId)
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const current = await this.read(key)
      if (current) assertRecord(current.record, canonicalInput.tenantId)
      if (current && current.record.phase !== "released") {
        if (current.record.operationId === canonicalInput.operationId) {
          assertSameMutation(current.record, canonicalInput)
          if (current.record.phase !== "held") {
            throw new ApplicationRoleMutationRecoveryRequiredError(current)
          }
          return this.renew(current)
        }
        if (!isExpired(current.record, this.now())) {
          throw new ApplicationRoleMutationLockConflictError()
        }
        if (current.record.phase !== "held") {
          throw new ApplicationRoleMutationRecoveryRequiredError(current)
        }
      }

      const timestamp = this.now().toISOString()
      const record: ApplicationRoleMutationLockRecord = {
        schemaVersion: APPLICATION_ROLE_MUTATION_LOCK_SCHEMA_VERSION,
        ...canonicalInput,
        fencingToken: randomUUID(),
        phase: "held",
        leaseExpiresAt: new Date(Date.parse(timestamp) + this.leaseDurationMs).toISOString(),
        revision: (current?.record.revision ?? 0) + 1,
        createdAt: timestamp,
        updatedAt: timestamp
      }
      try {
        return await this.write(key, record, current?.version)
      } catch (error) {
        if (!isConditionalWriteError(error) || attempt === 7) throw error
      }
    }
    throw new Error("Application-role mutation lock acquisition did not converge")
  }

  beginIdentityMutation(lease: ApplicationRoleMutationLease): Promise<ApplicationRoleMutationLease> {
    return this.transition(lease, ["held"], "identity_mutation")
  }

  beginManagedCommit(lease: ApplicationRoleMutationLease): Promise<ApplicationRoleMutationLease> {
    return this.transition(lease, ["identity_mutation"], "managed_commit")
  }

  markManagedCommitted(lease: ApplicationRoleMutationLease): Promise<ApplicationRoleMutationLease> {
    return this.transition(lease, ["managed_commit"], "managed_committed")
  }

  async renew(lease: ApplicationRoleMutationLease): Promise<ApplicationRoleMutationLease> {
    const key = lockKey(lease.record.tenantId)
    const current = await this.read(key)
    this.assertSameLease(current, lease)
    if (current.record.phase === "released") throw new ApplicationRoleMutationLockLostError()
    const next = this.nextRecord(current.record, current.record.phase)
    try {
      return await this.write(key, next, current.version)
    } catch (error) {
      if (isConditionalWriteError(error)) throw new ApplicationRoleMutationLockLostError()
      throw error
    }
  }

  async release(lease: ApplicationRoleMutationLease): Promise<ApplicationRoleMutationLease> {
    const key = lockKey(lease.record.tenantId)
    const current = await this.read(key)
    this.assertSameLease(current, lease)
    if (current.record.phase === "released") return current
    const next = this.nextRecord(current.record, "released")
    try {
      return await this.write(key, next, current.version)
    } catch (error) {
      if (isConditionalWriteError(error)) throw new ApplicationRoleMutationLockLostError()
      throw error
    }
  }

  async beginExpiredRecovery(staleLease: ApplicationRoleMutationLease): Promise<ApplicationRoleMutationLease> {
    const key = lockKey(staleLease.record.tenantId)
    const current = await this.read(key)
    this.assertSameLease(current, staleLease)
    if (current.record.phase === "released" || current.record.phase === "held") {
      throw new ApplicationRoleMutationLockLostError("Application-role mutation no longer requires identity recovery")
    }
    if (!isExpired(current.record, this.now())) {
      throw new ApplicationRoleMutationLockConflictError("Application-role mutation recovery lease is still active")
    }
    const timestamp = this.now().toISOString()
    const next: ApplicationRoleMutationLockRecord = {
      ...current.record,
      fencingToken: randomUUID(),
      phase: "recovering",
      recoveryAction: current.record.recoveryAction ?? (
        current.record.phase === "managed_committed"
          ? "complete_managed"
          : current.record.phase === "managed_commit"
            ? "reconcile_managed"
            : "rollback_identity"
      ),
      leaseExpiresAt: new Date(Date.parse(timestamp) + this.leaseDurationMs).toISOString(),
      revision: current.record.revision + 1,
      updatedAt: timestamp
    }
    try {
      return await this.write(key, next, current.version)
    } catch (error) {
      if (isConditionalWriteError(error)) throw new ApplicationRoleMutationLockConflictError("Application-role recovery CAS race was lost")
      throw error
    }
  }

  private async transition(
    lease: ApplicationRoleMutationLease,
    allowedPhases: readonly ApplicationRoleMutationLockPhase[],
    phase: ApplicationRoleMutationLockPhase
  ): Promise<ApplicationRoleMutationLease> {
    const key = lockKey(lease.record.tenantId)
    const current = await this.read(key)
    this.assertSameLease(current, lease)
    if (!allowedPhases.includes(current.record.phase)) {
      throw new ApplicationRoleMutationLockLostError(`Application-role mutation phase changed to ${current.record.phase}`)
    }
    const next = this.nextRecord(current.record, phase)
    try {
      return await this.write(key, next, current.version)
    } catch (error) {
      if (isConditionalWriteError(error)) throw new ApplicationRoleMutationLockLostError()
      throw error
    }
  }

  private nextRecord(
    current: ApplicationRoleMutationLockRecord,
    phase: ApplicationRoleMutationLockPhase
  ): ApplicationRoleMutationLockRecord {
    const timestamp = this.now().toISOString()
    return {
      ...current,
      phase,
      leaseExpiresAt: new Date(Date.parse(timestamp) + this.leaseDurationMs).toISOString(),
      revision: current.revision + 1,
      updatedAt: timestamp
    }
  }

  private assertSameLease(
    current: ApplicationRoleMutationLease | undefined,
    expected: ApplicationRoleMutationLease
  ): asserts current is ApplicationRoleMutationLease {
    if (
      !current ||
      current.record.operationId !== expected.record.operationId ||
      current.record.fencingToken !== expected.record.fencingToken
    ) throw new ApplicationRoleMutationLockLostError()
    assertRecord(current.record, expected.record.tenantId)
  }

  private async read(key: string): Promise<ApplicationRoleMutationLease | undefined> {
    try {
      const stored = await this.objectStore.getTextWithVersion(key)
      return {
        record: JSON.parse(stored.text) as ApplicationRoleMutationLockRecord,
        version: stored.version
      }
    } catch (error) {
      if (isMissingObjectError(error)) return undefined
      throw error
    }
  }

  private async write(
    key: string,
    record: ApplicationRoleMutationLockRecord,
    expectedVersion: string | undefined
  ): Promise<ApplicationRoleMutationLease> {
    await this.objectStore.putTextIfVersion(key, JSON.stringify(record, null, 2), expectedVersion, "application/json")
    const stored = await this.objectStore.getTextWithVersion(key)
    return { record: JSON.parse(stored.text) as ApplicationRoleMutationLockRecord, version: stored.version }
  }
}

function canonicalAcquireInput(input: Readonly<{
  tenantId: string
  operationId: string
  auditIntentId: string
  targetUserId: string
  targetUsername: string
  expectedRoles: readonly ApplicationRole[]
  desiredRoles: readonly ApplicationRole[]
}>) {
  return {
    tenantId: canonical(input.tenantId, "tenantId"),
    operationId: canonical(input.operationId, "operationId"),
    auditIntentId: canonical(input.auditIntentId, "auditIntentId"),
    targetUserId: canonical(input.targetUserId, "targetUserId"),
    targetUsername: canonical(input.targetUsername, "targetUsername"),
    expectedRoles: canonicalRoles(input.expectedRoles, "expectedRoles"),
    desiredRoles: canonicalRoles(input.desiredRoles, "desiredRoles")
  }
}

function canonicalRoles(values: readonly ApplicationRole[], field: string): readonly ApplicationRole[] {
  if (values.length === 0 || values.some((value) => !isApplicationRole(value)) || new Set(values).size !== values.length) {
    throw new Error(`Application-role mutation lock ${field} is invalid`)
  }
  const selected = new Set(values)
  return APPLICATION_ROLES.filter((role) => selected.has(role))
}

function assertSameMutation(
  current: ApplicationRoleMutationLockRecord,
  input: ReturnType<typeof canonicalAcquireInput>
): void {
  if (
    current.auditIntentId !== input.auditIntentId ||
    current.targetUserId !== input.targetUserId ||
    current.targetUsername !== input.targetUsername ||
    !sameValues(current.expectedRoles, input.expectedRoles) ||
    !sameValues(current.desiredRoles, input.desiredRoles)
  ) throw new ApplicationRoleMutationLockConflictError("Application-role operation id was reused with different mutation data")
}

function assertRecord(record: ApplicationRoleMutationLockRecord, tenantId: string): void {
  if (
    record.schemaVersion !== APPLICATION_ROLE_MUTATION_LOCK_SCHEMA_VERSION ||
    record.tenantId !== tenantId ||
    !record.operationId ||
    !record.auditIntentId ||
    !record.fencingToken ||
    !record.targetUserId ||
    !record.targetUsername ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 1 ||
    !Number.isFinite(Date.parse(record.leaseExpiresAt)) ||
    !["held", "identity_mutation", "managed_commit", "managed_committed", "recovering", "released"].includes(record.phase) ||
    record.expectedRoles.length === 0 ||
    record.desiredRoles.length === 0 ||
    new Set(record.expectedRoles).size !== record.expectedRoles.length ||
    new Set(record.desiredRoles).size !== record.desiredRoles.length ||
    (record.recoveryAction !== undefined &&
      record.recoveryAction !== "rollback_identity" &&
      record.recoveryAction !== "complete_managed" &&
      record.recoveryAction !== "reconcile_managed") ||
    record.expectedRoles.some((role) => !isApplicationRole(role)) ||
    record.desiredRoles.some((role) => !isApplicationRole(role)) ||
    !sameValues(record.expectedRoles, canonicalRoles(record.expectedRoles, "expectedRoles")) ||
    !sameValues(record.desiredRoles, canonicalRoles(record.desiredRoles, "desiredRoles"))
  ) throw new Error("Application-role mutation lock record is invalid")
}

function lockKey(tenantId: string): string {
  return `security/application-role-mutation-locks/${tenantPartitionId(tenantId)}/tenant.json`
}

function isExpired(record: ApplicationRoleMutationLockRecord, now: Date): boolean {
  return Date.parse(record.leaseExpiresAt) <= now.getTime()
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function canonical(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized || normalized !== value) throw new Error(`Application-role mutation lock ${field} is missing or non-canonical`)
  return normalized
}

function isMissingObjectError(error: unknown): boolean {
  return error instanceof Error && (
    (error as NodeJS.ErrnoException).code === "ENOENT" ||
    error.name === "NoSuchKey" ||
    error.name === "NotFound"
  )
}

function isConditionalWriteError(error: unknown): boolean {
  return error instanceof Error && (
    (error as Error & { code?: string }).code === "PRECONDITION_FAILED" ||
    error.name === "PreconditionFailed" ||
    error.name === "ConditionalCheckFailedException"
  )
}
