import type { ObjectStore } from "../adapters/object-store.js"
import { tenantPartitionId } from "../security/tenant-partition.js"
import type { AsyncAgentRun } from "../types.js"

export type AsyncAgentRunRepositoryPort = Pick<ObjectStore, "listKeys" | "getText" | "putText">

export class AsyncAgentRunRepository {
  constructor(private readonly objectStore: AsyncAgentRunRepositoryPort) {}

  async list(tenantId: string): Promise<AsyncAgentRun[]> {
    const prefix = asyncAgentRunPrefix(tenantId)
    const keys = await this.objectStore.listKeys(prefix)
    const runs = await Promise.all(
      keys
        .filter((key) => key.startsWith(prefix) && /^agent-runs\/tenant:[a-f0-9]{24}\/runs\/[^/]+\.json$/u.test(key))
        .map(async (key) => JSON.parse(await this.objectStore.getText(key)) as AsyncAgentRun)
    )
    return runs.map((run) => assertAsyncAgentTenant(normalizeAsyncAgentRun(run), tenantId))
  }

  async get(tenantId: string, agentRunId: string): Promise<AsyncAgentRun | undefined> {
    try {
      const stored = await this.objectStore.getText(asyncAgentRunObjectKey(tenantId, agentRunId))
      return assertAsyncAgentTenant(normalizeAsyncAgentRun(JSON.parse(stored) as AsyncAgentRun), tenantId)
    } catch (error: unknown) {
      if (!isMissingObjectError(error)) throw error
      try {
        await this.objectStore.getText(legacyAsyncAgentRunObjectKey(agentRunId))
      } catch (legacyError) {
        if (isMissingObjectError(legacyError)) return undefined
        throw legacyError
      }
      throw new Error("Legacy unscoped async agent run requires tenant migration", { cause: error })
    }
  }

  async save(run: AsyncAgentRun): Promise<void> {
    await this.objectStore.putText(
      asyncAgentRunObjectKey(run.tenantId, run.agentRunId),
      JSON.stringify(run, null, 2),
      "application/json; charset=utf-8"
    )
  }
}

function asyncAgentRunPrefix(tenantId: string): string {
  return `agent-runs/${tenantPartitionId(tenantId)}/runs/`
}

function asyncAgentRunObjectKey(tenantId: string, agentRunId: string): string {
  return `${asyncAgentRunPrefix(tenantId)}${encodeURIComponent(agentRunId)}.json`
}

function legacyAsyncAgentRunObjectKey(agentRunId: string): string {
  return `agent-runs/${encodeURIComponent(agentRunId)}.json`
}

function normalizeAsyncAgentRun(run: AsyncAgentRun): AsyncAgentRun {
  return {
    ...run,
    runId: run.runId ?? run.agentRunId,
    workspaceMounts: run.workspaceMounts ?? [],
    artifactIds: run.artifactIds ?? [],
    artifacts: run.artifacts ?? []
  }
}

function assertAsyncAgentTenant(run: AsyncAgentRun, tenantId: string): AsyncAgentRun {
  if (run.tenantId !== tenantId) throw new Error("Async agent run tenant storage integrity mismatch")
  return run
}

function isMissingObjectError(error: unknown): boolean {
  const candidate = error as { Code?: string; code?: string; name?: string; message?: string; $metadata?: { httpStatusCode?: number } }
  return candidate.Code === "NoSuchKey"
    || candidate.code === "ENOENT"
    || candidate.name === "NoSuchKey"
    || candidate.name === "NotFound"
    || candidate.$metadata?.httpStatusCode === 404
    || candidate.message?.includes("NoSuchKey") === true
    || candidate.message?.includes("ENOENT") === true
}
