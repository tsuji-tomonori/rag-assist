import { DynamoDBClient, type DynamoDBClientConfig } from "@aws-sdk/client-dynamodb"
import { config } from "../config.js"

export function createDynamoDbClient(overrides: DynamoDBClientConfig = {}): DynamoDBClient {
  return new DynamoDBClient({
    region: config.region,
    endpoint: config.dynamoDbEndpoint || undefined,
    ...overrides
  })
}
