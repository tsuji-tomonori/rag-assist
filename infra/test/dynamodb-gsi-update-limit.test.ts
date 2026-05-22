import assert from "node:assert/strict"
import test from "node:test"
import { findDynamoDbGsiUpdateLimitViolations } from "../lib/dynamodb-gsi-update-limit"

function templateWithTables(resources: Record<string, any>) {
  return { Resources: resources }
}

function dynamoTable(indexNames: string[], extraIndexProperties: Record<string, any> = {}) {
  return {
    Type: "AWS::DynamoDB::Table",
    Properties: {
      KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
      GlobalSecondaryIndexes: indexNames.map((indexName) => ({
        IndexName: indexName,
        KeySchema: [{ AttributeName: `${indexName}Pk`, KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
        ...extraIndexProperties
      }))
    }
  }
}

function violations(previousIndexNames: string[], nextIndexNames: string[]) {
  return findDynamoDbGsiUpdateLimitViolations(
    templateWithTables({ ExistingTable: dynamoTable(previousIndexNames) }),
    templateWithTables({ ExistingTable: dynamoTable(nextIndexNames) })
  )
}

test("passes when an existing table adds one GSI", () => {
  assert.deepEqual(violations(["ByRequester"], ["ByRequester", "ByStatus"]), [])
})

test("fails when an existing table adds two GSIs", () => {
  const actual = violations(["ByRequester"], ["ByRequester", "ByStatus", "ByAssignee"])

  assert.deepEqual(actual, [{
    logicalId: "ExistingTable",
    added: ["ByAssignee", "ByStatus"],
    removed: [],
    createDeleteChangeCount: 2
  }])
})

test("passes when an existing table removes one GSI", () => {
  assert.deepEqual(violations(["ByRequester", "ByStatus"], ["ByRequester"]), [])
})

test("fails when an existing table adds one GSI and removes one GSI", () => {
  const actual = violations(["ByRequester", "ByStatus"], ["ByRequester", "ByAssignee"])

  assert.deepEqual(actual, [{
    logicalId: "ExistingTable",
    added: ["ByAssignee"],
    removed: ["ByStatus"],
    createDeleteChangeCount: 2
  }])
})

test("passes when a new DynamoDB table has multiple GSIs", () => {
  const actual = findDynamoDbGsiUpdateLimitViolations(
    templateWithTables({}),
    templateWithTables({ NewTable: dynamoTable(["ByStatus", "ByAssignee"]) })
  )

  assert.deepEqual(actual, [])
})

test("passes when existing GSI properties change without GSI creation or deletion", () => {
  const previousTemplate = templateWithTables({
    ExistingTable: dynamoTable(["ByRequester"], { ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 } })
  })
  const nextTemplate = templateWithTables({
    ExistingTable: dynamoTable(["ByRequester"], { ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 } })
  })

  assert.deepEqual(findDynamoDbGsiUpdateLimitViolations(previousTemplate, nextTemplate), [])
})
