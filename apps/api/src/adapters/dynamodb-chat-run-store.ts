import { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand, UpdateItemCommand, type AttributeValue } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { config } from "../config.js"
import type { ChatRun } from "../types.js"
import { TENANT_ITEM_INDEX_NAME, tenantItemIndexAttributes, tenantPartitionId, tenantStorageKey } from "../security/tenant-partition.js"
import { chatRunResultFieldNames, type ChatRunExecutionEnvelope, type ChatRunStore, type CreateChatRunInput, type UpdateChatRunInput } from "./chat-run-store.js"
import { runIsActive, type ActiveRunAuthorizationIndex } from "./active-run-authorization-index.js"

const executionEnvelopeFields = [
  "rawRunId", "tenantId", "status", "createdBy", "userEmail", "userGroups", "securityResourceRefs", "searchScope",
  "createdAt", "updatedAt", "startedAt", "completedAt", "error", "errorCode", "ttl"
] as const

export class DynamoDbChatRunStore implements ChatRunStore {
  private readonly client: DynamoDBClient

  constructor(
    private readonly tableName: string,
    client = new DynamoDBClient({ region: config.region }),
    private readonly activeRunIndex?: ActiveRunAuthorizationIndex
  ) {
    this.client = client
  }

  async create(input: CreateChatRunInput): Promise<ChatRun> {
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

  async list(tenantId: string, limit = 500): Promise<ChatRun[]> {
    return this.listRuns(tenantId, limit)
  }

  async listAll(tenantId: string): Promise<ChatRun[]> {
    return this.listRuns(tenantId)
  }

  async listAllAuthoritative(tenantId: string): Promise<ChatRun[]> {
    if (!this.activeRunIndex) throw new Error("Active-run authorization index is unavailable")
    // Backfill seam for rows created before the registry existed. The GSI is
    // used only to repair registry membership; cleanup enumerates the base
    // registry with a strongly consistent tenant-partition Query below.
    for (const run of await this.listRuns(tenantId)) await this.syncActiveIndex(run)
    const runs: ChatRun[] = []
    for (const runId of await this.activeRunIndex.listActiveRunIds(tenantId, "chat")) {
      const run = (await this.resolveStoredRun(tenantId, runId))?.run
      if (!run || !runIsActive(run.status)) {
        await this.activeRunIndex.markInactive(tenantId, "chat", runId)
        continue
      }
      runs.push(run)
    }
    return runs.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  private async listRuns(tenantId: string, limit?: number): Promise<ChatRun[]> {
    const runs: ChatRun[] = []
    let ExclusiveStartKey: Record<string, AttributeValue> | undefined
    do {
      const result = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: TENANT_ITEM_INDEX_NAME,
        KeyConditionExpression: "tenantPartitionId = :tenantPartitionId AND begins_with(tenantItemId, :itemPrefix)",
        ExpressionAttributeValues: marshall({
          ":tenantPartitionId": tenantPartitionId(tenantId),
          ":itemPrefix": "chatRun#"
        }),
        Limit: limit === undefined ? undefined : Math.max(1, limit - runs.length),
        ExclusiveStartKey
      }))
      runs.push(...(result.Items ?? []).map((item) => {
        const stored = unmarshall(item) as StoredChatRun
        return fromStored(stored, tenantId, stored.rawRunId)
      }))
      ExclusiveStartKey = result.LastEvaluatedKey
    } while (ExclusiveStartKey && (limit === undefined || runs.length < limit))
    const sorted = runs.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    return limit === undefined ? sorted : sorted.slice(0, limit)
  }

  async get(tenantId: string, runId: string): Promise<ChatRun | undefined> {
    return (await this.resolveStoredRun(tenantId, runId))?.run
  }

  async getExecutionEnvelope(tenantId: string, runId: string): Promise<ChatRunExecutionEnvelope | undefined> {
    const names = Object.fromEntries(executionEnvelopeFields.map((field, index) => [`#f${index}`, field]))
    const result = await this.client.send(new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({ runId: tenantStorageKey(tenantId, runId) }),
      ConsistentRead: true,
      ProjectionExpression: executionEnvelopeFields.map((_field, index) => `#f${index}`).join(", "),
      ExpressionAttributeNames: names
    }))
    if (!result.Item) return undefined
    const stored = unmarshall(result.Item) as Partial<StoredChatRun>
    if (stored.tenantId !== tenantId || stored.rawRunId !== runId) throw new Error("Chat run tenant storage integrity mismatch")
    return {
      runId,
      tenantId,
      status: stored.status!,
      createdBy: stored.createdBy!,
      userEmail: stored.userEmail,
      userGroups: stored.userGroups,
      securityResourceRefs: stored.securityResourceRefs,
      searchScope: stored.searchScope,
      createdAt: stored.createdAt!,
      updatedAt: stored.updatedAt!,
      startedAt: stored.startedAt,
      completedAt: stored.completedAt,
      error: stored.error,
      errorCode: stored.errorCode,
      ttl: stored.ttl
    }
  }

  async update(tenantId: string, runId: string, input: UpdateChatRunInput): Promise<ChatRun> {
    const { clearResult, ...patch } = input
    const entries = Object.entries({ ...patch, updatedAt: input.updatedAt ?? new Date().toISOString() }).filter(([, value]) => value !== undefined)
    if (entries.length === 0 && !clearResult) {
      const current = await this.get(tenantId, runId)
      if (!current) throw new Error("Chat run not found")
      return current
    }

    const names: Record<string, string> = {}
    const values: Record<string, unknown> = {}
    const assignments = entries.map(([key, value]) => {
      names[`#${key}`] = key
      values[`:${key}`] = value
      return `#${key} = :${key}`
    })
    const removals = clearResult ? chatRunResultFieldNames.map((key) => {
      names[`#${key}`] = key
      return `#${key}`
    }) : []
    const updateExpressions = [
      ...(assignments.length > 0 ? [`SET ${assignments.join(", ")}`] : []),
      ...(removals.length > 0 ? [`REMOVE ${removals.join(", ")}`] : [])
    ]

    const stored = await this.resolveStoredRun(tenantId, runId)
    if (!stored) throw new Error("Chat run not found")
    const result = await this.client.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ runId: stored.physicalRunId }),
        ConditionExpression: "attribute_exists(runId)",
        UpdateExpression: updateExpressions.join(" "),
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: marshall(values, { removeUndefinedValues: true }),
        ReturnValues: "ALL_NEW"
      })
    )
    if (!result.Attributes) throw new Error("Chat run not found")
    const updated = fromAuthoritativeStored(unmarshall(result.Attributes), tenantId, runId)
    await this.syncActiveIndex(updated)
    return updated
  }

  async updateIfStatus(
    tenantId: string,
    runId: string,
    expectedStatus: ChatRun["status"],
    input: UpdateChatRunInput
  ): Promise<boolean> {
    const { clearResult, ...patch } = input
    const entries = Object.entries({ ...patch, updatedAt: input.updatedAt ?? new Date().toISOString() }).filter(([, value]) => value !== undefined)
    const names: Record<string, string> = { "#status": "status" }
    const values: Record<string, unknown> = { ":expectedStatus": expectedStatus }
    const assignments = entries.map(([key, value]) => {
      names[`#${key}`] = key
      values[`:${key}`] = value
      return `#${key} = :${key}`
    })
    const removals = clearResult ? chatRunResultFieldNames.map((key) => {
      names[`#${key}`] = key
      return `#${key}`
    }) : []
    const updateExpression = [
      ...(assignments.length > 0 ? [`SET ${assignments.join(", ")}`] : []),
      ...(removals.length > 0 ? [`REMOVE ${removals.join(", ")}`] : [])
    ].join(" ")
    const stored = await this.resolveStoredRun(tenantId, runId)
    if (!stored) return false
    try {
      await this.client.send(new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ runId: stored.physicalRunId }),
        ConditionExpression: "#status = :expectedStatus",
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: marshall(values, { removeUndefinedValues: true }),
        ReturnValues: "NONE"
      }))
      await this.syncActiveIndex({ ...stored.run, ...patch, status: input.status ?? stored.run.status, updatedAt: input.updatedAt ?? new Date().toISOString() })
      return true
    } catch (error) {
      if (isConditionalCheckFailure(error)) return false
      throw error
    }
  }

  private async resolveStoredRun(tenantId: string, runId: string): Promise<{ run: ChatRun; physicalRunId: string } | undefined> {
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
    const run = fromAuthoritativeStored(unmarshall(legacy.Item), tenantId, runId)
    return { run, physicalRunId: runId }
  }

  private async syncActiveIndex(run: ChatRun): Promise<void> {
    if (!this.activeRunIndex) return
    if (runIsActive(run.status)) {
      await this.activeRunIndex.markActive({
        tenantId: run.tenantId,
        runKind: "chat",
        runId: run.runId,
        updatedAt: run.updatedAt
      })
      return
    }
    await this.activeRunIndex.markInactive(run.tenantId, "chat", run.runId)
  }
}

type StoredChatRun = Omit<ChatRun, "runId"> & {
  runId: string
  rawRunId: string
  tenantPartitionId: string
  tenantItemId: string
}

function toStored(run: ChatRun): StoredChatRun {
  return {
    ...run,
    runId: tenantStorageKey(run.tenantId, run.runId),
    rawRunId: run.runId,
    ...tenantItemIndexAttributes(run.tenantId, `chatRun#${run.runId}`)
  }
}

function fromStored(stored: StoredChatRun, tenantId: string, runId: string): ChatRun {
  if (stored.tenantId !== tenantId || stored.rawRunId !== runId) throw new Error("Chat run tenant storage integrity mismatch")
  const { rawRunId, tenantPartitionId: _tenantPartitionId, tenantItemId: _tenantItemId, ...run } = stored
  return { ...run, runId: rawRunId }
}

function fromAuthoritativeStored(stored: Record<string, unknown>, tenantId: string, requestedRunId?: string): ChatRun {
  if (stored.tenantId !== tenantId) throw new Error("Chat run tenant storage integrity mismatch")
  if (typeof stored.rawRunId === "string") {
    const runId = requestedRunId ?? stored.rawRunId
    return fromStored(stored as StoredChatRun, tenantId, runId)
  }
  if (typeof stored.runId !== "string" || (requestedRunId !== undefined && stored.runId !== requestedRunId)) {
    throw new Error("Legacy chat run backfill identity is invalid")
  }
  return stored as ChatRun
}

function isConditionalCheckFailure(error: unknown): boolean {
  const value = error as { name?: string; code?: string }
  return value.name === "ConditionalCheckFailedException" || value.code === "ConditionalCheckFailedException"
}
