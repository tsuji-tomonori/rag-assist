import { DynamoDBClient, GetItemCommand, PutItemCommand, ScanCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { config } from "../config.js"
import type { BenchmarkRun } from "../types.js"
import type { BenchmarkRunStore, CreateBenchmarkRunInput, UpdateBenchmarkRunInput } from "./benchmark-run-store.js"

export class DynamoDbBenchmarkRunStore implements BenchmarkRunStore {
  private readonly client: DynamoDBClient

  constructor(private readonly tableName: string, client = new DynamoDBClient({ region: config.region })) {
    this.client = client
  }

  async create(input: CreateBenchmarkRunInput): Promise<BenchmarkRun> {
    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(input, { removeUndefinedValues: true }),
        ConditionExpression: "attribute_not_exists(runId)"
      })
    )
    return input
  }

  async list(limit = 50): Promise<BenchmarkRun[]> {
    const result = await this.client.send(new ScanCommand({ TableName: this.tableName }))
    return (result.Items ?? [])
      .map((item) => unmarshall(item) as BenchmarkRun)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
  }

  async get(runId: string): Promise<BenchmarkRun | undefined> {
    const result = await this.client.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ runId })
      })
    )
    return result.Item ? (unmarshall(result.Item) as BenchmarkRun) : undefined
  }

  async update(runId: string, input: UpdateBenchmarkRunInput): Promise<BenchmarkRun> {
    const entries = Object.entries({ ...input, updatedAt: input.updatedAt ?? new Date().toISOString() }).filter(([, value]) => value !== undefined)
    if (entries.length === 0) {
      const current = await this.get(runId)
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
    if (!result.Attributes) throw new Error("Benchmark run not found")
    return unmarshall(result.Attributes) as BenchmarkRun
  }
}
