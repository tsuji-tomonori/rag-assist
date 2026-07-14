import { createDependencies } from "./dependencies.js"
import {
  ProductionRevocationCleanupService,
  type ProductionRevocationCleanupBatchResult
} from "./rag/_shared/security/production-revocation-cleanup.js"
import { ObjectStoreRevocationCleanupTenantRegistry } from "./rag/_shared/security/revocation-cleanup-tenant-registry.js"

export type RevocationCleanupWorkerEvent = Readonly<{
  tenantIds?: unknown
  limitPerTenant?: unknown
}>

export type RevocationCleanupWorkerResult = Readonly<{
  tenantCount: number
  examined: number
  completed: number
  superseded: number
  reconciliationRequired: number
  tenants: readonly ProductionRevocationCleanupBatchResult[]
}>

type CleanupService = Pick<ProductionRevocationCleanupService, "reconcilePending">

export function createRevocationCleanupHandler(
  service: CleanupService,
  discoverTenantIds: () => readonly string[] | Promise<readonly string[]> = () => {
    throw new Error("Revocation cleanup tenant registry is unavailable")
  }
) {
  return async (event: RevocationCleanupWorkerEvent = {}): Promise<RevocationCleanupWorkerResult> => {
    const discovered = event.tenantIds === undefined ? await discoverTenantIds() : event.tenantIds
    const tenantIds = canonicalTenantIds(
      discovered,
      event.tenantIds === undefined ? undefined : 100,
      event.tenantIds === undefined
    )
    const limit = canonicalLimit(event.limitPerTenant)
    const tenants: ProductionRevocationCleanupBatchResult[] = []
    for (const tenantId of tenantIds) tenants.push(await service.reconcilePending(tenantId, limit))
    const result: RevocationCleanupWorkerResult = {
      tenantCount: tenants.length,
      examined: tenants.reduce((sum, tenant) => sum + tenant.examined, 0),
      completed: tenants.reduce((sum, tenant) => sum + tenant.completed, 0),
      superseded: tenants.reduce((sum, tenant) => sum + tenant.superseded, 0),
      reconciliationRequired: tenants.reduce((sum, tenant) => sum + tenant.reconciliationRequired, 0),
      tenants
    }
    emitCleanupMetrics(result)
    return result
  }
}

export async function handler(event: RevocationCleanupWorkerEvent = {}): Promise<RevocationCleanupWorkerResult> {
  const deps = createDependencies()
  return createRevocationCleanupHandler(
    new ProductionRevocationCleanupService(deps),
    () => new ObjectStoreRevocationCleanupTenantRegistry(deps.objectStore).listAllTenantIds()
  )(event)
}

function canonicalTenantIds(value: unknown, maximum: number | undefined, allowEmpty: boolean): string[] {
  if (!Array.isArray(value)) throw new Error("tenantIds must be a non-empty array")
  const tenantIds = [...new Set(value.map((entry) => {
    if (typeof entry !== "string" || !entry.trim() || entry !== entry.trim()) throw new Error("tenantIds contains an invalid tenant")
    return entry
  }))]
  if ((!allowEmpty && tenantIds.length === 0) || (maximum !== undefined && tenantIds.length > maximum)) {
    throw new Error("tenantIds must be a bounded array and explicit tenantIds must be non-empty")
  }
  return tenantIds.sort()
}

function canonicalLimit(value: unknown): number {
  if (value === undefined) return 100
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > 1_000) {
    throw new Error("limitPerTenant must be an integer between 1 and 1000")
  }
  return value as number
}

function emitCleanupMetrics(result: RevocationCleanupWorkerResult): void {
  console.log(JSON.stringify({
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [{
        Namespace: "MemoRAG/RevocationCleanup",
        Dimensions: [[]],
        Metrics: [
          { Name: "WorkerHeartbeat", Unit: "Count" },
          { Name: "Examined", Unit: "Count" },
          { Name: "Completed", Unit: "Count" },
          { Name: "Superseded", Unit: "Count" },
          { Name: "ReconciliationRequired", Unit: "Count" }
        ]
      }]
    },
    WorkerHeartbeat: 1,
    Examined: result.examined,
    Completed: result.completed,
    Superseded: result.superseded,
    ReconciliationRequired: result.reconciliationRequired,
    TenantCount: result.tenantCount
  }))
}
