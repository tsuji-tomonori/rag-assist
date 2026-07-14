export const ACTIVE_RUN_AUTHORIZATION_INDEX_SCHEMA_VERSION = 1 as const

export type ActiveRunKind = "chat" | "document_ingest" | "benchmark"

export type ActiveRunAuthorizationIndexRecord = Readonly<{
  schemaVersion: typeof ACTIVE_RUN_AUTHORIZATION_INDEX_SCHEMA_VERSION
  tenantId: string
  runKind: ActiveRunKind
  runId: string
  updatedAt: string
}>

export interface ActiveRunAuthorizationIndex {
  markActive(record: Omit<ActiveRunAuthorizationIndexRecord, "schemaVersion">): Promise<void>
  markInactive(tenantId: string, runKind: ActiveRunKind, runId: string): Promise<void>
  listActiveRunIds(tenantId: string, runKind: ActiveRunKind): Promise<string[]>
}

export function runIsActive(status: string): boolean {
  return status === "queued" || status === "running"
}
