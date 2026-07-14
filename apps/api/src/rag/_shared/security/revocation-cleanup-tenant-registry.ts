import type { ObjectStore } from "../../../adapters/object-store.js"
import { tenantPartitionId } from "../../../security/tenant-partition.js"

const schemaVersion = 1 as const
const registryPrefix = "security/revocation-cleanup-tenants/"
const registryBackfillKey = "security/revocation-cleanup-tenant-registry-state/backfill-v1.json"
const discoveryPrefixes = ["security/revocation-cleanup/", "security/revocation-cleanup-repairs/"] as const

type RevocationCleanupTenantRecord = Readonly<{
  schemaVersion: typeof schemaVersion
  tenantId: string
  tenantPartitionId: string
  createdAt: string
  updatedAt: string
}>

/** Tenant-primary registry plus a one-way backfill seam for pre-registry cleanup state. */
export class ObjectStoreRevocationCleanupTenantRegistry {
  constructor(
    private readonly objectStore: ObjectStore,
    private readonly now: () => Date = () => new Date()
  ) {}

  async register(tenantId: string): Promise<void> {
    const canonical = canonicalTenantId(tenantId)
    const key = tenantRegistryKey(canonical)
    const existing = await this.read(key)
    if (existing) {
      assertRecord(existing, canonical, key)
      return
    }
    const timestamp = this.now().toISOString()
    const record: RevocationCleanupTenantRecord = {
      schemaVersion,
      tenantId: canonical,
      tenantPartitionId: tenantPartitionId(canonical),
      createdAt: timestamp,
      updatedAt: timestamp
    }
    try {
      await this.objectStore.putTextIfVersion(key, JSON.stringify(record, null, 2), undefined, "application/json")
    } catch (error) {
      if (!isConditionalWriteError(error)) throw error
      const winner = await this.read(key)
      if (!winner) throw error
      assertRecord(winner, canonical, key)
    }
  }

  async listAllTenantIds(): Promise<string[]> {
    const tenantIds = new Set<string>()
    const registryKeys = await this.objectStore.listKeys(registryPrefix)
    for (const key of registryKeys.sort()) {
      if (!key.startsWith(registryPrefix) || !key.endsWith(".json")) throw new Error("Revocation cleanup tenant registry escaped its prefix")
      const record = await this.read(key)
      if (!record) throw new Error("Listed revocation cleanup tenant record disappeared")
      assertRecord(record, record.tenantId, key)
      tenantIds.add(record.tenantId)
    }

    if (!await this.isBackfillComplete()) {
      // One-time deployment backfill: old manifests predate the registry.
      // Normal scheduled discovery remains registry-primary after this marker
      // commits; every new manifest/repair registers its tenant first.
      for (const prefix of discoveryPrefixes) {
        for (const key of (await this.objectStore.listKeys(prefix)).sort()) {
          if (!key.startsWith(prefix) || !key.endsWith(".json")) throw new Error("Revocation cleanup tenant discovery escaped its prefix")
          let parsed: { tenantId?: unknown }
          try {
            parsed = JSON.parse(await this.objectStore.getText(key)) as typeof parsed
          } catch (error) {
            throw new Error("Revocation cleanup tenant discovery state is unreadable", { cause: error })
          }
          if (typeof parsed.tenantId !== "string") throw new Error("Revocation cleanup tenant discovery state has no tenant identity")
          const tenantId = canonicalTenantId(parsed.tenantId)
          const expectedPartitionPrefix = `${prefix}${tenantPartitionId(tenantId)}/`
          if (!key.startsWith(expectedPartitionPrefix)) throw new Error("Revocation cleanup tenant discovery crossed a tenant partition")
          tenantIds.add(tenantId)
        }
      }
      for (const tenantId of tenantIds) await this.register(tenantId)
      await this.markBackfillComplete()
    }
    return [...tenantIds].sort()
  }

  private async isBackfillComplete(): Promise<boolean> {
    try {
      const value = JSON.parse(await this.objectStore.getText(registryBackfillKey)) as { schemaVersion?: unknown; completedAt?: unknown }
      if (value.schemaVersion !== schemaVersion || typeof value.completedAt !== "string" || !Number.isFinite(Date.parse(value.completedAt))) {
        throw new Error("Revocation cleanup tenant registry backfill marker is invalid")
      }
      return true
    } catch (error) {
      if (isMissingObjectError(error)) return false
      throw error
    }
  }

  private async markBackfillComplete(): Promise<void> {
    const completedAt = this.now().toISOString()
    try {
      await this.objectStore.putTextIfVersion(
        registryBackfillKey,
        JSON.stringify({ schemaVersion, completedAt }, null, 2),
        undefined,
        "application/json"
      )
    } catch (error) {
      if (!isConditionalWriteError(error) || !await this.isBackfillComplete()) throw error
    }
  }

  private async read(key: string): Promise<RevocationCleanupTenantRecord | undefined> {
    try {
      return JSON.parse(await this.objectStore.getText(key)) as RevocationCleanupTenantRecord
    } catch (error) {
      if (isMissingObjectError(error)) return undefined
      throw error
    }
  }
}

function tenantRegistryKey(tenantId: string): string {
  return `${registryPrefix}${tenantPartitionId(tenantId)}.json`
}

function assertRecord(record: RevocationCleanupTenantRecord, tenantId: string, key: string): void {
  if (
    record.schemaVersion !== schemaVersion
    || record.tenantId !== tenantId
    || record.tenantPartitionId !== tenantPartitionId(tenantId)
    || key !== tenantRegistryKey(tenantId)
    || !Number.isFinite(Date.parse(record.createdAt))
    || !Number.isFinite(Date.parse(record.updatedAt))
  ) throw new Error("Revocation cleanup tenant registry record is invalid")
}

function canonicalTenantId(value: string): string {
  if (!value || value.trim() !== value) throw new Error("Revocation cleanup tenant identity is invalid")
  return value
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
