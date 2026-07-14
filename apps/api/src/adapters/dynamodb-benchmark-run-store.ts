import { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand, UpdateItemCommand, type AttributeValue } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { config } from "../config.js"
import type { BenchmarkRun } from "../types.js"
import { TENANT_ITEM_INDEX_NAME, tenantItemIndexAttributes, tenantPartitionId, tenantStorageKey } from "../security/tenant-partition.js"
import type { BenchmarkRunStore, CreateBenchmarkRunInput, UpdateBenchmarkRunInput } from "./benchmark-run-store.js"
import { runIsActive, type ActiveRunAuthorizationIndex } from "./active-run-authorization-index.js"

export class DynamoDbBenchmarkRunStore implements BenchmarkRunStore {
  private readonly client: DynamoDBClient

  constructor(
    private readonly tableName: string,
    client = new DynamoDBClient({ region: config.region }),
    private readonly activeRunIndex?: ActiveRunAuthorizationIndex
  ) {
    this.client = client
  }

  async create(input: CreateBenchmarkRunInput): Promise<BenchmarkRun> {
    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(toStored(input), { removeUndefinedValues: true }),
        ConditionExpression: "attribute_not_exists(runId)"
      })
    )
    await this.syncActiveIndex(input)
    return input
  }

  async list(tenantId: string, limit = 50): Promise<BenchmarkRun[]> {
    return this.listRuns(tenantId, limit)
  }

  async listAll(tenantId: string): Promise<BenchmarkRun[]> {
    return this.listRuns(tenantId)
  }

  async listAllAuthoritative(tenantId: string): Promise<BenchmarkRun[]> {
    if (!this.activeRunIndex) throw new Error("Active-run authorization index is unavailable")
    for (const run of await this.listRuns(tenantId)) await this.syncActiveIndex(run)
    const runs: BenchmarkRun[] = []
    for (const runId of await this.activeRunIndex.listActiveRunIds(tenantId, "benchmark")) {
      const run = (await this.resolveStoredRun(tenantId, runId))?.run
      if (!run || !runIsActive(run.status)) {
        await this.activeRunIndex.markInactive(tenantId, "benchmark", runId)
        continue
      }
      runs.push(run)
    }
    return runs.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  private async listRuns(tenantId: string, limit?: number): Promise<BenchmarkRun[]> {
    const runs: BenchmarkRun[] = []
    let ExclusiveStartKey: Record<string, AttributeValue> | undefined
    do {
      const result = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: TENANT_ITEM_INDEX_NAME,
        KeyConditionExpression: "tenantPartitionId = :tenantPartitionId AND begins_with(tenantItemId, :itemPrefix)",
        ExpressionAttributeValues: marshall({
          ":tenantPartitionId": tenantPartitionId(tenantId),
          ":itemPrefix": "benchmarkRun#"
        }),
        ScanIndexForward: false,
        Limit: limit === undefined ? undefined : Math.max(1, limit - runs.length),
        ExclusiveStartKey
      }))
      runs.push(...(result.Items ?? []).map((item) => {
        const stored = unmarshall(item) as StoredBenchmarkRun
        return fromStored(stored, tenantId, stored.rawRunId)
      }))
      ExclusiveStartKey = result.LastEvaluatedKey
    } while (ExclusiveStartKey && (limit === undefined || runs.length < limit))
    return limit === undefined ? runs : runs.slice(0, limit)
  }

  async get(tenantId: string, runId: string): Promise<BenchmarkRun | undefined> {
    return (await this.resolveStoredRun(tenantId, runId))?.run
  }

  async update(tenantId: string, runId: string, input: UpdateBenchmarkRunInput): Promise<BenchmarkRun> {
    const entries = Object.entries({ ...input, updatedAt: input.updatedAt ?? new Date().toISOString() }).filter(([, value]) => value !== undefined)
    if (entries.length === 0) {
      const current = await this.get(tenantId, runId)
      if (!current) throw new Error("Benchmark run not found")
      return current
    }

    const names: Record<string, string> = {}
    const values: Record<string, unknown> = {}
    const assignments = entries.map(([key, value]) => {
      names[`#${key}`] = key
      values[`:${key}`] = value
      return `#${key} = :${key}`
    })

    const stored = await this.resolveStoredRun(tenantId, runId)
    if (!stored) throw new Error("Benchmark run not found")
    const result = await this.client.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ runId: stored.physicalRunId }),
        ConditionExpression: "attribute_exists(runId)",
        UpdateExpression: `SET ${assignments.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: marshall(values, { removeUndefinedValues: true }),
        ReturnValues: "ALL_NEW"
      })
    )
    if (!result.Attributes) throw new Error("Benchmark run not found")
    const updated = fromAuthoritativeStored(unmarshall(result.Attributes), tenantId, runId)
    await this.syncActiveIndex(updated)
    return updated
  }

  private async resolveStoredRun(tenantId: string, runId: string): Promise<{ run: BenchmarkRun; physicalRunId: string } | undefined> {
    const composite = tenantStorageKey(tenantId, runId)
    const current = await this.client.send(new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({ runId: composite }),
      ConsistentRead: true
    }))
    if (current.Item) return { run: fromAuthoritativeStored(unmarshall(current.Item), tenantId, runId), physicalRunId: composite }
    const legacy = await this.client.send(new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({ runId }),
      ConsistentRead: true
    }))
    if (!legacy.Item) return undefined
    return { run: fromAuthoritativeStored(unmarshall(legacy.Item), tenantId, runId), physicalRunId: runId }
  }

  private async syncActiveIndex(run: BenchmarkRun): Promise<void> {
    if (!this.activeRunIndex) return
    if (runIsActive(run.status)) {
      await this.activeRunIndex.markActive({
        tenantId: run.tenantId,
        runKind: "benchmark",
        runId: run.runId,
        updatedAt: run.updatedAt
      })
      return
    }
    await this.activeRunIndex.markInactive(run.tenantId, "benchmark", run.runId)
  }
}

type StoredBenchmarkRun = Omit<BenchmarkRun, "runId"> & {
  runId: string
  rawRunId: string
  tenantPartitionId: string
  tenantItemId: string
}

function toStored(run: BenchmarkRun): StoredBenchmarkRun {
  return {
    ...run,
    runId: tenantStorageKey(run.tenantId, run.runId),
    rawRunId: run.runId,
    ...tenantItemIndexAttributes(run.tenantId, `benchmarkRun#${run.createdAt}#${run.runId}`)
  }
}

function fromStored(stored: StoredBenchmarkRun, tenantId: string, runId: string): BenchmarkRun {
  if (stored.tenantId !== tenantId || stored.rawRunId !== runId) throw new Error("Benchmark run tenant storage integrity mismatch")
  const { rawRunId, tenantPartitionId: _tenantPartitionId, tenantItemId: _tenantItemId, ...run } = stored
  return { ...run, runId: rawRunId }
}

function fromAuthoritativeStored(stored: Record<string, unknown>, tenantId: string, requestedRunId?: string): BenchmarkRun {
  if (stored.tenantId !== tenantId) throw new Error("Benchmark run tenant storage integrity mismatch")
  if (typeof stored.rawRunId === "string") {
    return fromStored(stored as StoredBenchmarkRun, tenantId, requestedRunId ?? stored.rawRunId)
  }
  if (typeof stored.runId !== "string" || (requestedRunId !== undefined && stored.runId !== requestedRunId)) {
    throw new Error("Legacy benchmark run backfill identity is invalid")
  }
  return stored as BenchmarkRun
}
