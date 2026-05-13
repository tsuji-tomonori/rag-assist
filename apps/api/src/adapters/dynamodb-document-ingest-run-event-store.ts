import { DynamoDBClient, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { config } from "../config.js"
import type { DocumentIngestRunEvent } from "../types.js"
import type { CreateDocumentIngestRunEventInput, DocumentIngestRunEventStore } from "./document-ingest-run-event-store.js"

export class DynamoDbDocumentIngestRunEventStore implements DocumentIngestRunEventStore {
  private readonly client: DynamoDBClient

  constructor(private readonly tableName: string, client = new DynamoDBClient({ region: config.region })) {
    this.client = client
  }

  async append(input: CreateDocumentIngestRunEventInput): Promise<DocumentIngestRunEvent> {
    const seq = input.seq ?? await this.nextSeq(input.runId)
    const event: DocumentIngestRunEvent = {
      ...input,
      seq,
      createdAt: input.createdAt ?? new Date().toISOString()
    }
    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(event, { removeUndefinedValues: true }),
        ConditionExpression: "attribute_not_exists(runId) AND attribute_not_exists(seq)"
      })
    )
    return event
  }

  async listAfter(runId: string, afterSeq: number, limit = 50): Promise<DocumentIngestRunEvent[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "runId = :runId AND seq > :afterSeq",
        ExpressionAttributeValues: marshall({ ":runId": runId, ":afterSeq": afterSeq }),
        Limit: limit,
        ScanIndexForward: true
      })
    )
    return (result.Items ?? []).map((item) => unmarshall(item) as DocumentIngestRunEvent)
  }

  private async nextSeq(runId: string): Promise<number> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "runId = :runId",
        ExpressionAttributeValues: marshall({ ":runId": runId }),
        ProjectionExpression: "seq",
        ScanIndexForward: false,
        Limit: 1
      })
    )
    const latest = result.Items?.[0] ? (unmarshall(result.Items[0]) as Pick<DocumentIngestRunEvent, "seq">) : undefined
    return (latest?.seq ?? 0) + 1
  }
}
