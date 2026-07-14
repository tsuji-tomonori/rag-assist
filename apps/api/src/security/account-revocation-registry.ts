import type { ObjectStore } from "../adapters/object-store.js"
import type {
  ServerManagedIdentity,
  VerifiedIdentityProvider
} from "../adapters/verified-identity-provider.js"
import { tenantPartitionId } from "./tenant-partition.js"
import {
  administrativePrincipalTransferIsBlocking,
  type AdministrativePrincipalTransferFencePort
} from "./administrative-principal-transfer-fence.js"

export const ACCOUNT_REVOCATION_REGISTRY_SCHEMA_VERSION = 1 as const

export type AccountRevocationRecord = Readonly<{
  schemaVersion: typeof ACCOUNT_REVOCATION_REGISTRY_SCHEMA_VERSION
  tenantId: string
  userId: string
  username: string
  desiredStatus: "suspended" | "deleted"
  state: "denied" | "cleared"
  auditIntentId: string
  reason: string
  revision: number
  updatedAt: string
}>

export interface AccountRevocationRegistryPort {
  get(tenantId: string, userId: string): Promise<AccountRevocationRecord | undefined>
  deny(input: Readonly<{
    tenantId: string
    userId: string
    username: string
    desiredStatus: "suspended" | "deleted"
    auditIntentId: string
    reason: string
    effectiveAt?: string
  }>): Promise<AccountRevocationRecord>
  clear(input: Readonly<{
    tenantId: string
    userId: string
    username: string
    auditIntentId: string
    reason: string
  }>): Promise<AccountRevocationRecord>
}

/**
 * Application-side authoritative deny registry. It is committed before an
 * external identity-provider mutation so an unavailable IdP cannot leave a
 * subject usable while reconciliation is pending.
 */
export class ObjectStoreAccountRevocationRegistry implements AccountRevocationRegistryPort {
  constructor(
    private readonly objectStore: ObjectStore,
    private readonly now: () => Date = () => new Date()
  ) {}

  async get(tenantId: string, userId: string): Promise<AccountRevocationRecord | undefined> {
    const key = registryKey(canonical(tenantId, "tenantId"), canonical(userId, "userId"))
    try {
      const stored = await this.objectStore.getTextWithVersion(key)
      const parsed = JSON.parse(stored.text) as AccountRevocationRecord
      assertRecord(parsed, tenantId, userId)
      return parsed
    } catch (error) {
      if (isMissingObjectError(error)) return undefined
      throw error
    }
  }

  deny(input: Readonly<{
    tenantId: string
    userId: string
    username: string
    desiredStatus: "suspended" | "deleted"
    auditIntentId: string
    reason: string
    effectiveAt?: string
  }>): Promise<AccountRevocationRecord> {
    return this.transition({ ...input, state: "denied" })
  }

  clear(input: Readonly<{
    tenantId: string
    userId: string
    username: string
    auditIntentId: string
    reason: string
    effectiveAt?: string
  }>): Promise<AccountRevocationRecord> {
    return this.transition({ ...input, desiredStatus: "suspended", state: "cleared" })
  }

  private async transition(input: Readonly<{
    tenantId: string
    userId: string
    username: string
    desiredStatus: "suspended" | "deleted"
    state: "denied" | "cleared"
    auditIntentId: string
    reason: string
    effectiveAt?: string
  }>): Promise<AccountRevocationRecord> {
    const tenantId = canonical(input.tenantId, "tenantId")
    const userId = canonical(input.userId, "userId")
    const username = canonical(input.username, "username")
    const auditIntentId = canonical(input.auditIntentId, "auditIntentId")
    const reason = canonical(input.reason, "reason")
    const key = registryKey(tenantId, userId)

    for (let attempt = 0; attempt < 5; attempt += 1) {
      let expectedVersion: string | undefined
      let current: AccountRevocationRecord | undefined
      try {
        const stored = await this.objectStore.getTextWithVersion(key)
        expectedVersion = stored.version
        current = JSON.parse(stored.text) as AccountRevocationRecord
        assertRecord(current, tenantId, userId)
      } catch (error) {
        if (!isMissingObjectError(error)) throw error
      }
      const next: AccountRevocationRecord = {
        schemaVersion: ACCOUNT_REVOCATION_REGISTRY_SCHEMA_VERSION,
        tenantId,
        userId,
        username,
        desiredStatus: input.desiredStatus,
        state: input.state,
        auditIntentId,
        reason,
        revision: (current?.revision ?? 0) + 1,
        updatedAt: canonicalTimestamp(input.effectiveAt ?? this.now().toISOString(), "effectiveAt")
      }
      try {
        await this.objectStore.putTextIfVersion(key, JSON.stringify(next, null, 2), expectedVersion, "application/json")
        return next
      } catch (error) {
        if (!isConditionalWriteError(error) || attempt === 4) throw error
      }
    }
    throw new Error("Account revocation registry transition did not converge")
  }
}

/** Current identity projection that enforces the application deny registry. */
export class RevocationAwareVerifiedIdentityProvider implements VerifiedIdentityProvider {
  constructor(
    private readonly inner: VerifiedIdentityProvider,
    private readonly registry: AccountRevocationRegistryPort,
    private readonly administrativePrincipalTransferFence?: Pick<AdministrativePrincipalTransferFencePort, "get">
  ) {}

  async getCurrentIdentity(username: string): Promise<ServerManagedIdentity | undefined> {
    return this.apply(await this.inner.getCurrentIdentity(username))
  }

  async getCurrentIdentityBySubject(subject: string): Promise<ServerManagedIdentity | undefined> {
    return this.apply(await this.inner.getCurrentIdentityBySubject(subject))
  }

  private async apply(identity: ServerManagedIdentity | undefined): Promise<ServerManagedIdentity | undefined> {
    if (!identity) return undefined
    const [record, transferFence] = await Promise.all([
      this.registry.get(identity.tenantId, identity.userId),
      this.administrativePrincipalTransferFence?.get(identity.tenantId, identity.userId)
    ])
    if (record?.state !== "denied" && !administrativePrincipalTransferIsBlocking(transferFence)) return identity
    const invalidAfter = Math.max(
      record?.state === "denied" ? Date.parse(record.updatedAt) : 0,
      administrativePrincipalTransferIsBlocking(transferFence) ? Date.parse(transferFence.updatedAt) : 0
    )
    return {
      ...identity,
      accountStatus: "suspended",
      sessionInvalidAfterEpochMs: Number.isFinite(invalidAfter)
        ? Math.max(identity.sessionInvalidAfterEpochMs ?? 0, invalidAfter)
        : identity.sessionInvalidAfterEpochMs
    }
  }
}

function registryKey(tenantId: string, userId: string): string {
  return `security/account-revocations/${tenantPartitionId(tenantId)}/${encodeURIComponent(userId)}.json`
}

function canonical(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized || normalized !== value) throw new Error(`Account revocation ${field} is missing or non-canonical`)
  return normalized
}

function canonicalTimestamp(value: string, field: string): string {
  const normalized = canonical(value, field)
  if (!Number.isFinite(Date.parse(normalized)) || new Date(normalized).toISOString() !== normalized) {
    throw new Error(`Account revocation ${field} is invalid`)
  }
  return normalized
}

export function accountRevocationStateVersion(record: AccountRevocationRecord | undefined): string {
  return record
    ? `account-revocation:${record.state}:${record.desiredStatus}:${record.auditIntentId}:${record.revision}`
    : "account-revocation:none"
}

export function accountRevocationCleanupDenyVersion(record: AccountRevocationRecord): string {
  if (record.state !== "denied") throw new Error("Account revocation cleanup deny is not effective")
  return `account-revocation-deny:${record.desiredStatus}:${record.auditIntentId}`
}

function assertRecord(record: AccountRevocationRecord, tenantId: string, userId: string): void {
  if (
    record.schemaVersion !== ACCOUNT_REVOCATION_REGISTRY_SCHEMA_VERSION ||
    record.tenantId !== tenantId ||
    record.userId !== userId ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 1 ||
    (record.state !== "denied" && record.state !== "cleared")
  ) throw new Error("Account revocation registry record is invalid")
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
    error.name === "PreconditionFailed" ||
    error.name === "ConditionalCheckFailedException" ||
    (error as Error & { code?: string }).code === "PRECONDITION_FAILED"
  )
}
