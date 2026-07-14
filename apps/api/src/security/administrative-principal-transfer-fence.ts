import { randomUUID } from "node:crypto"
import type { ObjectStore } from "../adapters/object-store.js"
import { tenantPartitionId } from "./tenant-partition.js"

export const ADMINISTRATIVE_PRINCIPAL_TRANSFER_FENCE_SCHEMA_VERSION = 1 as const

export type AdministrativePrincipalTransferMode = "administrative_change" | "permanent_delete"

export type AdministrativePrincipalTransferFenceRecord = Readonly<{
  schemaVersion: typeof ADMINISTRATIVE_PRINCIPAL_TRANSFER_FENCE_SCHEMA_VERSION
  tenantId: string
  sourceUserId: string
  successorUserId?: string
  operationId: string
  fencingToken: string
  mode: AdministrativePrincipalTransferMode
  status: "blocking" | "account_deny_confirmed" | "released"
  leaseExpiresAt: string
  revision: number
  createdAt: string
  updatedAt: string
}>

export interface AdministrativePrincipalTransferFencePort {
  get(tenantId: string, sourceUserId: string): Promise<AdministrativePrincipalTransferFenceRecord | undefined>
  acquire(input: Readonly<{
    tenantId: string
    sourceUserId: string
    successorUserId?: string
    operationId?: string
    mode: AdministrativePrincipalTransferMode
  }>): Promise<AdministrativePrincipalTransferFenceRecord>
  renew(input: Readonly<{
    tenantId: string
    sourceUserId: string
    operationId: string
    fencingToken: string
  }>): Promise<AdministrativePrincipalTransferFenceRecord>
  assertHeld(input: Readonly<{
    tenantId: string
    sourceUserId: string
    operationId: string
    fencingToken: string
  }>): Promise<AdministrativePrincipalTransferFenceRecord>
  confirmAccountDeny(input: Readonly<{
    tenantId: string
    sourceUserId: string
    operationId: string
  }>): Promise<AdministrativePrincipalTransferFenceRecord>
  release(input: Readonly<{
    tenantId: string
    sourceUserId: string
    operationId: string
    fencingToken: string
  }>): Promise<AdministrativePrincipalTransferFenceRecord>
  releaseAfterAccountRestore(input: Readonly<{
    tenantId: string
    sourceUserId: string
  }>): Promise<AdministrativePrincipalTransferFenceRecord | undefined>
}

export class AdministrativePrincipalTransferFenceError extends Error {
  constructor(message: string, readonly conflict = false) {
    super(message)
    this.name = "AdministrativePrincipalTransferFenceError"
  }
}

/**
 * Durable, fail-closed principal fence. Lease expiry permits the same transfer
 * to recover, but never makes a fenced principal usable again by itself.
 */
export class ObjectStoreAdministrativePrincipalTransferFence implements AdministrativePrincipalTransferFencePort {
  constructor(
    private readonly objectStore: ObjectStore,
    private readonly now: () => Date = () => new Date(),
    private readonly leaseDurationMs = 5 * 60_000
  ) {
    if (!Number.isSafeInteger(leaseDurationMs) || leaseDurationMs <= 0) {
      throw new Error("Administrative-principal transfer fence lease duration is invalid")
    }
  }

  async get(tenantId: string, sourceUserId: string): Promise<AdministrativePrincipalTransferFenceRecord | undefined> {
    const canonicalTenantId = canonical(tenantId, "tenantId")
    const canonicalSourceUserId = canonical(sourceUserId, "sourceUserId")
    const stored = await this.read(fenceKey(canonicalTenantId, canonicalSourceUserId))
    if (!stored) return undefined
    assertRecord(stored.value, canonicalTenantId, canonicalSourceUserId)
    return stored.value
  }

  async acquire(input: Readonly<{
    tenantId: string
    sourceUserId: string
    successorUserId?: string
    operationId?: string
    mode: AdministrativePrincipalTransferMode
  }>): Promise<AdministrativePrincipalTransferFenceRecord> {
    const tenantId = canonical(input.tenantId, "tenantId")
    const sourceUserId = canonical(input.sourceUserId, "sourceUserId")
    const successorUserId = input.successorUserId === undefined
      ? undefined
      : canonical(input.successorUserId, "successorUserId")
    if (successorUserId === sourceUserId) {
      throw new AdministrativePrincipalTransferFenceError("Source and successor administrative principals must differ")
    }
    const requestedOperationId = input.operationId === undefined
      ? undefined
      : canonical(input.operationId, "operationId")
    const key = fenceKey(tenantId, sourceUserId)

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const current = await this.read(key)
      if (current) assertRecord(current.value, tenantId, sourceUserId)
      if (current && current.value.status !== "released") {
        if (
          current.value.mode !== input.mode ||
          current.value.successorUserId !== successorUserId ||
          (requestedOperationId !== undefined && current.value.operationId !== requestedOperationId)
        ) {
          throw new AdministrativePrincipalTransferFenceError(
            "Another administrative-principal transfer fence is active",
            true
          )
        }
        if (current.value.status === "account_deny_confirmed") return current.value
        if (Date.parse(current.value.leaseExpiresAt) > this.now().getTime()) {
          throw new AdministrativePrincipalTransferFenceError(
            "Administrative-principal transfer fence is already held by an active worker",
            true
          )
        }
        const renewed = this.nextRecord(current.value, {
          status: "blocking",
          fencingToken: randomUUID()
        })
        try {
          return await this.write(key, renewed, current.version)
        } catch (error) {
          if (!isConditionalWriteError(error) || attempt === 7) throw error
          continue
        }
      }

      const timestamp = this.now().toISOString()
      const next: AdministrativePrincipalTransferFenceRecord = {
        schemaVersion: ADMINISTRATIVE_PRINCIPAL_TRANSFER_FENCE_SCHEMA_VERSION,
        tenantId,
        sourceUserId,
        ...(successorUserId ? { successorUserId } : {}),
        operationId: requestedOperationId ?? `ownership_transfer_${randomUUID()}`,
        fencingToken: randomUUID(),
        mode: input.mode,
        status: "blocking",
        leaseExpiresAt: new Date(Date.parse(timestamp) + this.leaseDurationMs).toISOString(),
        revision: (current?.value.revision ?? 0) + 1,
        createdAt: timestamp,
        updatedAt: timestamp
      }
      try {
        return await this.write(key, next, current?.version)
      } catch (error) {
        if (!isConditionalWriteError(error) || attempt === 7) throw error
      }
    }
    throw new Error("Administrative-principal transfer fence acquisition did not converge")
  }

  renew(input: Readonly<{ tenantId: string; sourceUserId: string; operationId: string; fencingToken: string }>) {
    return this.transition(input, (current) => {
      if (current.status === "released") {
        throw new AdministrativePrincipalTransferFenceError("Administrative-principal transfer fence is no longer held", true)
      }
      return this.nextRecord(current, {})
    })
  }

  async assertHeld(input: Readonly<{ tenantId: string; sourceUserId: string; operationId: string; fencingToken: string }>) {
    const tenantId = canonical(input.tenantId, "tenantId")
    const sourceUserId = canonical(input.sourceUserId, "sourceUserId")
    const operationId = canonical(input.operationId, "operationId")
    const fencingToken = canonical(input.fencingToken, "fencingToken")
    const current = await this.read(fenceKey(tenantId, sourceUserId))
    if (
      !current ||
      current.value.operationId !== operationId ||
      current.value.fencingToken !== fencingToken ||
      current.value.status === "released"
    ) throw new AdministrativePrincipalTransferFenceError("Administrative-principal transfer fence was lost", true)
    assertRecord(current.value, tenantId, sourceUserId)
    return current.value
  }

  confirmAccountDeny(input: Readonly<{ tenantId: string; sourceUserId: string; operationId: string }>) {
    return this.transition(input, (current) => {
      if (current.mode !== "permanent_delete") {
        throw new AdministrativePrincipalTransferFenceError("Only a permanent-delete fence can confirm account deny")
      }
      if (current.status === "released") {
        throw new AdministrativePrincipalTransferFenceError("Permanent-delete fence was released before account deny", true)
      }
      if (current.status === "account_deny_confirmed") return current
      return this.nextRecord(current, { status: "account_deny_confirmed" })
    })
  }

  release(input: Readonly<{ tenantId: string; sourceUserId: string; operationId: string; fencingToken: string }>) {
    return this.transition(input, (current) => {
      if (current.status === "released") return current
      if (current.status === "account_deny_confirmed") {
        throw new AdministrativePrincipalTransferFenceError("Confirmed permanent-delete fence cannot be released by transfer completion")
      }
      return this.nextRecord(current, { status: "released" })
    })
  }

  async releaseAfterAccountRestore(input: Readonly<{ tenantId: string; sourceUserId: string }>) {
    const tenantId = canonical(input.tenantId, "tenantId")
    const sourceUserId = canonical(input.sourceUserId, "sourceUserId")
    const key = fenceKey(tenantId, sourceUserId)
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const current = await this.read(key)
      if (!current) return undefined
      assertRecord(current.value, tenantId, sourceUserId)
      if (current.value.status === "released") return current.value
      if (current.value.mode !== "permanent_delete") {
        throw new AdministrativePrincipalTransferFenceError("Active administrative-change fence cannot be cleared by account restore", true)
      }
      if (current.value.status !== "account_deny_confirmed") {
        throw new AdministrativePrincipalTransferFenceError("Permanent-delete transfer is still active and cannot be cleared by account restore", true)
      }
      const released = this.nextRecord(current.value, { status: "released" })
      try {
        return await this.write(key, released, current.version)
      } catch (error) {
        if (!isConditionalWriteError(error) || attempt === 7) throw error
      }
    }
    throw new Error("Administrative-principal transfer fence restore release did not converge")
  }

  private async transition(
    rawInput: Readonly<{ tenantId: string; sourceUserId: string; operationId: string; fencingToken?: string }>,
    transition: (current: AdministrativePrincipalTransferFenceRecord) => AdministrativePrincipalTransferFenceRecord
  ): Promise<AdministrativePrincipalTransferFenceRecord> {
    const tenantId = canonical(rawInput.tenantId, "tenantId")
    const sourceUserId = canonical(rawInput.sourceUserId, "sourceUserId")
    const operationId = canonical(rawInput.operationId, "operationId")
    const fencingToken = rawInput.fencingToken === undefined
      ? undefined
      : canonical(rawInput.fencingToken, "fencingToken")
    const key = fenceKey(tenantId, sourceUserId)
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const current = await this.read(key)
      if (!current) throw new AdministrativePrincipalTransferFenceError("Administrative-principal transfer fence is missing", true)
      assertRecord(current.value, tenantId, sourceUserId)
      if (current.value.operationId !== operationId) {
        throw new AdministrativePrincipalTransferFenceError("Administrative-principal transfer fence operation changed", true)
      }
      if (fencingToken !== undefined && current.value.fencingToken !== fencingToken) {
        throw new AdministrativePrincipalTransferFenceError("Administrative-principal transfer fencing token changed", true)
      }
      const next = transition(current.value)
      if (next === current.value) return current.value
      try {
        return await this.write(key, next, current.version)
      } catch (error) {
        if (!isConditionalWriteError(error) || attempt === 7) throw error
      }
    }
    throw new Error("Administrative-principal transfer fence transition did not converge")
  }

  private nextRecord(
    current: AdministrativePrincipalTransferFenceRecord,
    patch: Partial<Pick<AdministrativePrincipalTransferFenceRecord, "status" | "fencingToken">>
  ): AdministrativePrincipalTransferFenceRecord {
    const timestamp = this.now().toISOString()
    return {
      ...current,
      ...patch,
      leaseExpiresAt: new Date(Date.parse(timestamp) + this.leaseDurationMs).toISOString(),
      revision: current.revision + 1,
      updatedAt: timestamp
    }
  }

  private async read(key: string): Promise<{ value: AdministrativePrincipalTransferFenceRecord; version: string } | undefined> {
    try {
      const stored = await this.objectStore.getTextWithVersion(key)
      return { value: JSON.parse(stored.text) as AdministrativePrincipalTransferFenceRecord, version: stored.version }
    } catch (error) {
      if (isMissingObjectError(error)) return undefined
      throw error
    }
  }

  private async write(
    key: string,
    value: AdministrativePrincipalTransferFenceRecord,
    expectedVersion: string | undefined
  ): Promise<AdministrativePrincipalTransferFenceRecord> {
    await this.objectStore.putTextIfVersion(key, JSON.stringify(value, null, 2), expectedVersion, "application/json")
    return value
  }
}

export function administrativePrincipalTransferIsBlocking(
  record: AdministrativePrincipalTransferFenceRecord | undefined
): record is AdministrativePrincipalTransferFenceRecord {
  return record?.status === "blocking" || record?.status === "account_deny_confirmed"
}

function fenceKey(tenantId: string, sourceUserId: string): string {
  return `security/administrative-principal-transfer-fences/${tenantPartitionId(tenantId)}/${encodeURIComponent(sourceUserId)}.json`
}

function assertRecord(
  record: AdministrativePrincipalTransferFenceRecord,
  tenantId: string,
  sourceUserId: string
): void {
  if (
    record.schemaVersion !== ADMINISTRATIVE_PRINCIPAL_TRANSFER_FENCE_SCHEMA_VERSION ||
    record.tenantId !== tenantId ||
    record.sourceUserId !== sourceUserId ||
    !record.operationId || record.operationId.trim() !== record.operationId ||
    !record.fencingToken || record.fencingToken.trim() !== record.fencingToken ||
    (record.successorUserId !== undefined && (
      !record.successorUserId ||
      record.successorUserId.trim() !== record.successorUserId ||
      record.successorUserId === sourceUserId
    )) ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 1 ||
    !Number.isFinite(Date.parse(record.leaseExpiresAt)) ||
    (record.mode !== "administrative_change" && record.mode !== "permanent_delete") ||
    (record.status !== "blocking" && record.status !== "account_deny_confirmed" && record.status !== "released")
  ) throw new Error("Administrative-principal transfer fence record is invalid")
}

function canonical(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized || normalized !== value) {
    throw new AdministrativePrincipalTransferFenceError(`Administrative-principal transfer fence ${field} is missing or non-canonical`)
  }
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
