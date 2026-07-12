import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  TransactWriteItemsCommand,
  type AttributeValue,
  type TransactWriteItem
} from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { config } from "../config.js"
import type { FolderPolicy } from "../types.js"
import { TENANT_ITEM_INDEX_NAME, tenantItemIndexAttributes, tenantPartitionId, tenantStorageKey } from "../security/tenant-partition.js"
import {
  folderPolicyConflictError,
  folderPolicyStateVersion,
  type FolderPolicyStore,
  type VersionedFolderPolicyState
} from "./folder-policy-store.js"

type StoredFolderPolicy = FolderPolicy & {
  groupId: string
  itemType: "folderPolicy"
  tenantPartitionId: string
  tenantItemId: string
}
type StoredFolderPolicyState = {
  groupId: string
  itemType: "folderPolicyState"
  tenantId: string
  tenantPartitionId: string
  tenantItemId: string
  folderId: string
  policyId?: string
  stateVersion: string
}

type InternalVersionedFolderPolicyState = VersionedFolderPolicyState & {
  markerExists: boolean
}

export class DynamoDbFolderPolicyStore implements FolderPolicyStore {
  private readonly client: DynamoDBClient

  constructor(private readonly tableName: string, client = new DynamoDBClient({ region: config.region })) {
    this.client = client
  }

  async list(tenantId: string): Promise<FolderPolicy[]> {
    const policies: FolderPolicy[] = []
    let ExclusiveStartKey: Record<string, AttributeValue> | undefined
    do {
      const result = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: TENANT_ITEM_INDEX_NAME,
        KeyConditionExpression: "tenantPartitionId = :tenantPartitionId AND begins_with(tenantItemId, :itemPrefix)",
        ExpressionAttributeValues: marshall({
          ":tenantPartitionId": tenantPartitionId(tenantId),
          ":itemPrefix": "folderPolicy#"
        }),
        ExclusiveStartKey
      }))
      policies.push(...(result.Items ?? []).map((item) => fromStored(unmarshall(item) as StoredFolderPolicy, tenantId)))
      ExclusiveStartKey = result.LastEvaluatedKey
    } while (ExclusiveStartKey)
    return policies
  }

  async get(tenantId: string, policyId: string): Promise<FolderPolicy | undefined> {
    const result = await this.client.send(new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({ groupId: tenantStorageKey(tenantId, storageKey(policyId)) }),
      ConsistentRead: true
    }))
    const item = result.Item ? (unmarshall(result.Item) as StoredFolderPolicy) : undefined
    if (item?.itemType === "folderPolicy") return fromStored(item, tenantId)
    if (!item) await this.assertNoLegacyItem(storageKey(policyId))
    return undefined
  }

  async findByFolderId(tenantId: string, folderId: string): Promise<FolderPolicy | undefined> {
    const matches = (await this.list(tenantId)).filter((policy) => policy.folderId === folderId)
    if (matches.length > 1) throw new Error(`Multiple folder policies exist for ${folderId}`)
    return matches[0]
  }

  async save(policy: FolderPolicy): Promise<FolderPolicy> {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const current = await this.getVersionedByFolderId(policy.tenantId, policy.folderId)
      try {
        const replaced = await this.replaceForFolder(policy, current.version)
        if (!replaced.policy) throw new Error("Folder policy replacement did not persist a policy")
        return replaced.policy
      } catch (error) {
        if (!isFolderPolicyConflict(error) || attempt === 5) throw error
      }
    }
    throw folderPolicyConflictError(policy.folderId)
  }

  async delete(tenantId: string, policyId: string): Promise<void> {
    const policy = await this.get(tenantId, policyId)
    if (!policy) {
      await this.client.send(new DeleteItemCommand({
        TableName: this.tableName,
        Key: marshall({ groupId: tenantStorageKey(tenantId, storageKey(policyId)) })
      }))
      return
    }
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const current = await this.readVersionedByFolderId(tenantId, policy.folderId)
      if (current.policy?.policyId !== policyId) {
        await this.client.send(new DeleteItemCommand({
          TableName: this.tableName,
          Key: marshall({ groupId: tenantStorageKey(tenantId, storageKey(policyId)) })
        }))
        return
      }
      const emptyVersion = folderPolicyStateVersion(undefined)
      try {
        await this.client.send(new TransactWriteItemsCommand({
          TransactItems: [
            {
              Delete: {
                TableName: this.tableName,
                Key: marshall({ groupId: tenantStorageKey(tenantId, storageKey(policyId)) })
              }
            },
            this.stateMarkerPut(
              tenantId,
              policy.folderId,
              undefined,
              emptyVersion,
              current.version,
              current.markerExists
            )
          ]
        }))
        return
      } catch (error) {
        if (!isConditionalCheckFailed(error) || attempt === 5) throw error
      }
    }
  }

  async getVersionedByFolderId(tenantId: string, folderId: string): Promise<VersionedFolderPolicyState> {
    const { markerExists: _markerExists, ...state } = await this.readVersionedByFolderId(tenantId, folderId)
    return state
  }

  async replaceForFolder(policy: FolderPolicy, expectedVersion: string): Promise<VersionedFolderPolicyState> {
    const current = await this.readVersionedByFolderId(policy.tenantId, policy.folderId)
    if (current.version !== expectedVersion) throw folderPolicyConflictError(policy.folderId)

    const stored: StoredFolderPolicy = {
      ...policy,
      groupId: tenantStorageKey(policy.tenantId, storageKey(policy.policyId)),
      itemType: "folderPolicy",
      ...tenantItemIndexAttributes(policy.tenantId, `folderPolicy#${policy.policyId}`)
    }
    const nextVersion = folderPolicyStateVersion(fromStored(stored, policy.tenantId))
    const operations: TransactWriteItem[] = []
    if (current.policy && current.policy.policyId !== policy.policyId) {
      operations.push({
        Delete: {
          TableName: this.tableName,
          Key: marshall({ groupId: tenantStorageKey(policy.tenantId, storageKey(current.policy.policyId)) })
        }
      })
    }
    operations.push({
      Put: {
        TableName: this.tableName,
        Item: marshall(stored, { removeUndefinedValues: true })
      }
    })
    operations.push(this.stateMarkerPut(
      policy.tenantId,
      policy.folderId,
      policy.policyId,
      nextVersion,
      expectedVersion,
      current.markerExists
    ))

    try {
      await this.client.send(new TransactWriteItemsCommand({ TransactItems: operations }))
    } catch (error) {
      if (isConditionalCheckFailed(error)) throw folderPolicyConflictError(policy.folderId)
      throw error
    }
    return { policy: fromStored(stored, policy.tenantId), version: nextVersion }
  }

  private async readVersionedByFolderId(tenantId: string, folderId: string): Promise<InternalVersionedFolderPolicyState> {
    const markerResult = await this.client.send(new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({ groupId: tenantStorageKey(tenantId, stateStorageKey(folderId)) }),
      ConsistentRead: true
    }))
    const marker = markerResult.Item
      ? (unmarshall(markerResult.Item) as StoredFolderPolicyState)
      : undefined
    if (marker) {
      if (marker.itemType !== "folderPolicyState" || marker.tenantId !== tenantId || marker.folderId !== folderId || !marker.stateVersion) {
        throw new Error(`Folder policy state marker is invalid for ${folderId}`)
      }
      const policy = marker.policyId ? await this.get(tenantId, marker.policyId) : undefined
      if ((marker.policyId && (!policy || policy.folderId !== folderId)) || folderPolicyStateVersion(policy) !== marker.stateVersion) {
        throw new Error(`Folder policy state integrity mismatch for ${folderId}`)
      }
      return { policy, version: marker.stateVersion, markerExists: true }
    }

    await this.assertNoLegacyItem(stateStorageKey(folderId))
    const policy = await this.findByFolderId(tenantId, folderId)
    return { policy, version: folderPolicyStateVersion(policy), markerExists: false }
  }

  private stateMarkerPut(
    tenantId: string,
    folderId: string,
    policyId: string | undefined,
    stateVersion: string,
    expectedVersion: string,
    markerExists: boolean
  ): TransactWriteItem {
    const marker: StoredFolderPolicyState = {
      groupId: tenantStorageKey(tenantId, stateStorageKey(folderId)),
      itemType: "folderPolicyState",
      tenantId,
      ...tenantItemIndexAttributes(tenantId, `folderPolicyState#${folderId}`),
      folderId,
      policyId,
      stateVersion
    }
    return {
      Put: {
        TableName: this.tableName,
        Item: marshall(marker, { removeUndefinedValues: true }),
        ConditionExpression: markerExists
          ? "itemType = :stateItemType AND folderId = :folderId AND stateVersion = :expectedVersion"
          : "attribute_not_exists(groupId)",
        ExpressionAttributeValues: markerExists
          ? marshall({
            ":stateItemType": "folderPolicyState",
            ":folderId": folderId,
            ":expectedVersion": expectedVersion
          })
          : undefined
      }
    }
  }

  private async assertNoLegacyItem(groupId: string): Promise<void> {
    const legacy = await this.client.send(new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({ groupId }),
      ProjectionExpression: "groupId"
    }))
    if (legacy.Item) throw new Error("Legacy unscoped folder policy requires tenant migration")
  }
}

function storageKey(policyId: string): string {
  return `folderPolicy#${policyId}`
}

function stateStorageKey(folderId: string): string {
  return `folderPolicyState#${folderId}`
}

function fromStored(item: StoredFolderPolicy, tenantId: string): FolderPolicy {
  if (item.tenantId !== tenantId || item.tenantPartitionId !== tenantPartitionId(tenantId)) {
    throw new Error("Folder policy tenant storage integrity mismatch")
  }
  const { groupId: _groupId, tenantPartitionId: _tenantPartitionId, tenantItemId: _tenantItemId, ...policy } = item
  return policy
}

function isConditionalCheckFailed(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const named = error as Error & { name?: string; code?: string; CancellationReasons?: Array<{ Code?: string }> }
  return named.name === "ConditionalCheckFailedException" ||
    named.code === "ConditionalCheckFailedException" ||
    named.name === "TransactionCanceledException" && (
      named.CancellationReasons === undefined ||
      named.CancellationReasons.some((reason) => reason.Code === "ConditionalCheckFailed")
    )
}

function isFolderPolicyConflict(error: unknown): boolean {
  return isConditionalCheckFailed(error) || (
    error instanceof Error && (error as Error & { code?: string }).code === "PRECONDITION_FAILED"
  )
}
