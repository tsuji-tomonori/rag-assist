import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { config } from "../config.js"
import type { DocumentIngestRun } from "../types.js"
import type { CreateDocumentIngestRunInput, DocumentIngestRunStore, UpdateDocumentIngestRunInput } from "./document-ingest-run-store.js"

export class DynamoDbDocumentIngestRunStore implements DocumentIngestRunStore {
  private readonly client: DynamoDBClient

  constructor(private readonly tableName: string, client = new DynamoDBClient({ region: config.region })) {
    this.client = client
  }

  async create(input: CreateDocumentIngestRunInput): Promise<DocumentIngestRun> {
    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(input, { removeUndefinedValues: true }),
        ConditionExpression: "attribute_not_exists(runId)"
      })
    )
    return input
  }

  async get(runId: string): Promise<DocumentIngestRun | undefined> {
    const result = await this.client.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ runId })
      })
    )
    return result.Item ? (unmarshall(result.Item) as DocumentIngestRun) : undefined
  }

  async update(runId: string, input: UpdateDocumentIngestRunInput): Promise<DocumentIngestRun> {
    const entries = Object.entries({ ...input, updatedAt: input.updatedAt ?? new Date().toISOString() }).filter(([, value]) => value !== undefined)
    if (entries.length === 0) {
      const current = await this.get(runId)
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

    const result = await this.client.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ runId }),
        ConditionExpression: "attribute_exists(runId)",
        UpdateExpression: `SET ${assignments.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: marshall(values, { removeUndefinedValues: true }),
        ReturnValues: "ALL_NEW"
      })
    )
    if (!result.Attributes) throw new Error("Document ingest run not found")
    return unmarshall(result.Attributes) as DocumentIngestRun
  }
}
