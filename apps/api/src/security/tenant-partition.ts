import { createHash } from "node:crypto"

export function tenantPartitionId(tenantId: string): string {
  const normalized = tenantId.trim()
  if (!normalized) throw new Error("Authoritative tenant is required")
  return `tenant:${createHash("sha256").update(normalized).digest("hex").slice(0, 24)}`
}

/** Name shared by every tenant-owned DynamoDB collection index. */
export const TENANT_ITEM_INDEX_NAME = "TenantItemIndex"

/**
 * Produces a collision-free physical key while keeping the public identifier
 * unchanged in API/domain objects. Callers must pass a server-authoritative
 * tenant identifier; blank or non-canonical values fail closed.
 */
export function tenantStorageKey(tenantId: string, itemId: string): string {
  const canonicalItemId = itemId.trim()
  if (!canonicalItemId || canonicalItemId !== itemId) throw new Error("Tenant item identifier is missing or non-canonical")
  return `${tenantPartitionId(tenantId)}#${encodeURIComponent(canonicalItemId)}`
}

export function tenantItemIndexAttributes(tenantId: string, itemId: string): Readonly<{
  tenantPartitionId: string
  tenantItemId: string
}> {
  const canonicalItemId = itemId.trim()
  if (!canonicalItemId || canonicalItemId !== itemId) throw new Error("Tenant item identifier is missing or non-canonical")
  return { tenantPartitionId: tenantPartitionId(tenantId), tenantItemId: canonicalItemId }
}
