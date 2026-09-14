import assert from "node:assert/strict"
import test from "node:test"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { S3Client } from "@aws-sdk/client-s3"
import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider"
import { config } from "./config.js"
import { handler as authorize } from "./websocket-authorizer.js"
import { handler as connect } from "./websocket-connection-handler.js"

test("production WebSocket entry points reject invalid connections before AWS reads or writes", async (t) => {
  let calls = 0
  const unexpected = async () => { calls += 1; throw new Error("Unexpected AWS request") }
  t.mock.method(DynamoDBClient.prototype, "send", unexpected)
  t.mock.method(S3Client.prototype, "send", unexpected)
  t.mock.method(CognitoIdentityProviderClient.prototype, "send", unexpected)
  const previousBucket = config.docsBucketName
  config.docsBucketName = "test-docs"
  const previousTickets = config.webSocketTicketsTableName
  const previousConnections = config.webSocketConnectionsTableName
  config.webSocketTicketsTableName = "test-tickets"
  config.webSocketConnectionsTableName = "test-connections"
  try {
    for (const event of [{}, { queryStringParameters: { ticket: "must-not-be-logged" } }, { headers: { "Sec-WebSocket-Protocol": "invalid" } }]) {
      const result = await authorize(event)
      assert.equal(result.policyDocument.Statement[0]?.Effect, "Deny")
    }
    assert.equal((await connect({ requestContext: { eventType: "CONNECT" } })).statusCode, 400)
    assert.equal((await connect({ requestContext: { eventType: "DISCONNECT" } })).statusCode, 400)
    assert.equal((await connect({ requestContext: { eventType: "MESSAGE" } })).statusCode, 400)
    assert.equal(calls, 0)
  } finally {
    config.docsBucketName = previousBucket
    config.webSocketTicketsTableName = previousTickets
    config.webSocketConnectionsTableName = previousConnections
  }
})
