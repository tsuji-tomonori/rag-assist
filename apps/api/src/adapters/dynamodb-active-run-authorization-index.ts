import { DeleteItemCommand, DynamoDBClient, PutItemCommand, QueryCommand, type AttributeValue } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { config } from "../config.js"
import { tenantPartitionId } from "../security/tenant-partition.js"
import {
  ACTIVE_RUN_AUTHORIZATION_INDEX_SCHEMA_VERSION,
  type ActiveRunAuthorizationIndex,
  type ActiveRunAuthorizationIndexRecord,
  type ActiveRunKind
} from "./active-run-authorization-index.js"

export class DynamoDbActiveRunAuthorizationIndex implements ActiveRunAuthorizationIndex {
  private readonly client: DynamoDBClient

  constructor(private readonly tableName: string, client = new DynamoDBClient({ region: config.region })) {
    if (!tableName) throw new Error("ACTIVE_RUN_AUTHORIZATION_INDEX_TABLE_NAME is required")
    this.client = client
  }

  async markActive(record: Omit<ActiveRunAuthorizationIndexRecord, "schemaVersion">): Promise<void> {
    validateIdentity(record.tenantId, record.runKind, record.runId)
    validateTimestamp(record.updatedAt)
    await this.client.send(new PutItemCommand({
      TableName: this.tableName,
      Item: marshall({
        schemaVersion: ACTIVE_RUN_AUTHORIZATION_INDEX_SCHEMA_VERSION,
        tenantPartitionId: tenantPartitionId(record.tenantId),
        runKey: runKey(record.runKind, record.runId),
        ...record
      })
    }))
  }

  async markInactive(tenantId: string, runKind: ActiveRunKind, runId: string): Promise<void> {
    validateIdentity(tenantId, runKind, runId)
    await this.client.send(new DeleteItemCommand({
      TableName: this.tableName,
      Key: marshall({ tenantPartitionId: tenantPartitionId(tenantId), runKey: runKey(runKind, runId) })
    }))
  }

  async listActiveRunIds(tenantId: string, runKind: ActiveRunKind): Promise<string[]> {
    validateIdentity(tenantId, runKind, "probe")
    const records: ActiveRunAuthorizationIndexRecord[] = []
    let ExclusiveStartKey: Record<string, AttributeValue> | undefined
    do {
      const response = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        ConsistentRead: true,
        KeyConditionExpression: "tenantPartitionId = :tenantPartitionId AND begins_with(runKey, :runPrefix)",
        ExpressionAttributeValues: marshall({
          ":tenantPartitionId": tenantPartitionId(tenantId),
          ":runPrefix": `${runKind}#`
        }),
        ExclusiveStartKey
      }))
      for (const item of response.Items ?? []) {
        const stored = unmarshall(item) as ActiveRunAuthorizationIndexRecord & { tenantPartitionId?: unknown; runKey?: unknown }
        validateStored(stored, tenantId, runKind)
        records.push(stored)
      }
      ExclusiveStartKey = response.LastEvaluatedKey
    } while (ExclusiveStartKey)
    return [...new Set(records.map((record) => record.runId))].sort()
  }
}

function runKey(runKind: ActiveRunKind, runId: string): string {
  return `${runKind}#${runId}`
}

function validateStored(
  record: ActiveRunAuthorizationIndexRecord & { tenantPartitionId?: unknown; runKey?: unknown },
  tenantId: string,
  runKind: ActiveRunKind
): void {
  if (
    record.schemaVersion !== ACTIVE_RUN_AUTHORIZATION_INDEX_SCHEMA_VERSION
    || record.tenantId !== tenantId
    || record.runKind !== runKind
    || record.tenantPartitionId !== tenantPartitionId(tenantId)
    || record.runKey !== runKey(record.runKind, record.runId)
  ) throw new Error("Active-run authorization index integrity mismatch")
  validateIdentity(record.tenantId, record.runKind, record.runId)
  validateTimestamp(record.updatedAt)
}

function validateIdentity(tenantId: string, runKind: ActiveRunKind, runId: string): void {
  for (const [name, value] of [["tenantId", tenantId], ["runId", runId]] as const) {
    if (!value || value.trim() !== value) throw new Error(`Active-run authorization ${name} is invalid`)
  }
  if (!["chat", "document_ingest", "benchmark"].includes(runKind)) throw new Error("Active-run authorization kind is invalid")
}

function validateTimestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new Error("Active-run authorization timestamp is invalid")
  }
}
