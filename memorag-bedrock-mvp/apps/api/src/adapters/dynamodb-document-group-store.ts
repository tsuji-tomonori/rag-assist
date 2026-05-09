import { DynamoDBClient, GetItemCommand, PutItemCommand, ScanCommand, UpdateItemCommand, type AttributeValue } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { config } from "../config.js"
import type { DocumentGroup } from "../types.js"
import type { CreateDocumentGroupInput, DocumentGroupStore, UpdateDocumentGroupInput } from "./document-group-store.js"

export class DynamoDbDocumentGroupStore implements DocumentGroupStore {
  private readonly client: DynamoDBClient

  constructor(private readonly tableName: string, client = new DynamoDBClient({ region: config.region })) {
    this.client = client
  }

  async list(): Promise<DocumentGroup[]> {
    const groups: DocumentGroup[] = []
    let ExclusiveStartKey: Record<string, AttributeValue> | undefined
    do {
      const result = await this.client.send(new ScanCommand({ TableName: this.tableName, ExclusiveStartKey }))
      groups.push(...(result.Items ?? []).map((item) => unmarshall(item) as DocumentGroup))
      ExclusiveStartKey = result.LastEvaluatedKey
    } while (ExclusiveStartKey)
    return groups
  }

  async get(groupId: string): Promise<DocumentGroup | undefined> {
    const result = await this.client.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ groupId })
      })
    )
    return result.Item ? (unmarshall(result.Item) as DocumentGroup) : undefined
  }

  async create(input: CreateDocumentGroupInput): Promise<DocumentGroup> {
    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(input, { removeUndefinedValues: true }),
        ConditionExpression: "attribute_not_exists(groupId)"
      })
    )
    return input
  }

  async update(groupId: string, input: UpdateDocumentGroupInput): Promise<DocumentGroup> {
    const entries = Object.entries({ ...input, updatedAt: input.updatedAt ?? new Date().toISOString() }).filter(([, value]) => value !== undefined)
    if (entries.length === 0) {
      const current = await this.get(groupId)
      if (!current) throw new Error("Document group not found")
      return current
    }

    const names: Record<string, string> = {}
    const values: Record<string, unknown> = {}
    const assignments = entries.map(([key, value]) => {
      names[`#${key}`] = key
      values[`:${key}`] = value
      return `#${key} = :${key}`
    })

    const result = await this.client.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ groupId }),
        ConditionExpression: "attribute_exists(groupId)",
        UpdateExpression: `SET ${assignments.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: marshall(values, { removeUndefinedValues: true }),
        ReturnValues: "ALL_NEW"
      })
    )
    if (!result.Attributes) throw new Error("Document group not found")
    return unmarshall(result.Attributes) as DocumentGroup
  }
}
