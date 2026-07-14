import { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand, UpdateItemCommand, type AttributeValue } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { config } from "../config.js"
import type { DocumentIngestRun } from "../types.js"
import { TENANT_ITEM_INDEX_NAME, tenantItemIndexAttributes, tenantPartitionId, tenantStorageKey } from "../security/tenant-partition.js"
import type { CreateDocumentIngestRunInput, DocumentIngestRunStore, UpdateDocumentIngestRunInput } from "./document-ingest-run-store.js"
import { runIsActive, type ActiveRunAuthorizationIndex } from "./active-run-authorization-index.js"

export class DynamoDbDocumentIngestRunStore implements DocumentIngestRunStore {
  private readonly client: DynamoDBClient

  constructor(
    private readonly tableName: string,
    client = new DynamoDBClient({ region: config.region }),
    private readonly activeRunIndex?: ActiveRunAuthorizationIndex
  ) {
    this.client = client
  }

  async create(input: CreateDocumentIngestRunInput): Promise<DocumentIngestRun> {
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

  async list(tenantId: string, limit = 500): Promise<DocumentIngestRun[]> {
    return this.listRuns(tenantId, limit)
  }

  async listAll(tenantId: string): Promise<DocumentIngestRun[]> {
    return this.listRuns(tenantId)
  }

  async listAllAuthoritative(tenantId: string): Promise<DocumentIngestRun[]> {
    if (!this.activeRunIndex) throw new Error("Active-run authorization index is unavailable")
    for (const run of await this.listRuns(tenantId)) await this.syncActiveIndex(run)
    const runs: DocumentIngestRun[] = []
    for (const runId of await this.activeRunIndex.listActiveRunIds(tenantId, "document_ingest")) {
      const run = (await this.resolveStoredRun(tenantId, runId))?.run
      if (!run || !runIsActive(run.status)) {
        await this.activeRunIndex.markInactive(tenantId, "document_ingest", runId)
        continue
      }
      runs.push(run)
    }
    return runs.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  private async listRuns(tenantId: string, limit?: number): Promise<DocumentIngestRun[]> {
    const runs: DocumentIngestRun[] = []
    let ExclusiveStartKey: Record<string, AttributeValue> | undefined
    do {
      const result = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: TENANT_ITEM_INDEX_NAME,
        KeyConditionExpression: "tenantPartitionId = :tenantPartitionId AND begins_with(tenantItemId, :itemPrefix)",
        ExpressionAttributeValues: marshall({
          ":tenantPartitionId": tenantPartitionId(tenantId),
          ":itemPrefix": "documentIngestRun#"
        }),
        Limit: limit === undefined ? undefined : Math.max(1, limit - runs.length),
        ExclusiveStartKey
      }))
      runs.push(...(result.Items ?? []).map((item) => {
        const stored = unmarshall(item) as StoredDocumentIngestRun
        return fromStored(stored, tenantId, stored.rawRunId)
      }))
      ExclusiveStartKey = result.LastEvaluatedKey
    } while (ExclusiveStartKey && (limit === undefined || runs.length < limit))
    const sorted = runs.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    return limit === undefined ? sorted : sorted.slice(0, limit)
  }

  async get(tenantId: string, runId: string): Promise<DocumentIngestRun | undefined> {
    return (await this.resolveStoredRun(tenantId, runId))?.run
  }

  async update(tenantId: string, runId: string, input: UpdateDocumentIngestRunInput): Promise<DocumentIngestRun> {
    const entries = Object.entries({ ...input, updatedAt: input.updatedAt ?? new Date().toISOString() }).filter(([, value]) => value !== undefined)
    if (entries.length === 0) {
      const current = await this.get(tenantId, runId)
      if (!current) throw new Error("Document ingest run not found")
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
    if (!stored) throw new Error("Document ingest run not found")
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
    if (!result.Attributes) throw new Error("Document ingest run not found")
    const updated = fromAuthoritativeStored(unmarshall(result.Attributes), tenantId, runId)
    await this.syncActiveIndex(updated)
    return updated
  }

  private async resolveStoredRun(tenantId: string, runId: string): Promise<{ run: DocumentIngestRun; physicalRunId: string } | undefined> {
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

  private async syncActiveIndex(run: DocumentIngestRun): Promise<void> {
    if (!this.activeRunIndex) return
    if (runIsActive(run.status)) {
      await this.activeRunIndex.markActive({
        tenantId: run.tenantId,
        runKind: "document_ingest",
        runId: run.runId,
        updatedAt: run.updatedAt
      })
      return
    }
    await this.activeRunIndex.markInactive(run.tenantId, "document_ingest", run.runId)
  }
}

type StoredDocumentIngestRun = Omit<DocumentIngestRun, "runId"> & {
  runId: string
  rawRunId: string
  tenantPartitionId: string
  tenantItemId: string
}

function toStored(run: DocumentIngestRun): StoredDocumentIngestRun {
  return {
    ...run,
    runId: tenantStorageKey(run.tenantId, run.runId),
    rawRunId: run.runId,
    ...tenantItemIndexAttributes(run.tenantId, `documentIngestRun#${run.runId}`)
  }
}

function fromStored(stored: StoredDocumentIngestRun, tenantId: string, runId: string): DocumentIngestRun {
  if (stored.tenantId !== tenantId || stored.rawRunId !== runId) throw new Error("Document ingest run tenant storage integrity mismatch")
  const { rawRunId, tenantPartitionId: _tenantPartitionId, tenantItemId: _tenantItemId, ...run } = stored
  return { ...run, runId: rawRunId }
}

function fromAuthoritativeStored(stored: Record<string, unknown>, tenantId: string, requestedRunId?: string): DocumentIngestRun {
  if (stored.tenantId !== tenantId) throw new Error("Document ingest run tenant storage integrity mismatch")
  if (typeof stored.rawRunId === "string") {
    return fromStored(stored as StoredDocumentIngestRun, tenantId, requestedRunId ?? stored.rawRunId)
  }
  if (typeof stored.runId !== "string" || (requestedRunId !== undefined && stored.runId !== requestedRunId)) {
    throw new Error("Legacy document ingest run backfill identity is invalid")
  }
  return stored as DocumentIngestRun
}
