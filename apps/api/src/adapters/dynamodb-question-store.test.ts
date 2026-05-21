import assert from "node:assert/strict"
import test from "node:test"
import { QueryCommand } from "@aws-sdk/client-dynamodb"
import { marshall } from "@aws-sdk/util-dynamodb"
import { DynamoDbQuestionStore } from "./dynamodb-question-store.js"

test("dynamoQuestionStore_listAssignedToUserQueriesAssigneeUserIndex", async () => {
  const sent: QueryCommand[] = []
  const store = new DynamoDbQuestionStore("HumanQuestionsTable", { send: async (command: QueryCommand) => {
    sent.push(command)
    return { Items: [] }
  } } as never)

  await store.listAssignedToUser("user-a", [])

  assert.equal(sent.length, 1)
  assert.equal(sent[0]?.input.IndexName, "AssigneeUserUpdatedAtIndex")
})

test("dynamoQuestionStore_listAssignedToUserQueriesAssigneeGroupIndexForEachGroup", async () => {
  const sent: QueryCommand[] = []
  const store = new DynamoDbQuestionStore("HumanQuestionsTable", { send: async (command: QueryCommand) => {
    sent.push(command)
    return { Items: [] }
  } } as never)

  await store.listAssignedToUser("user-a", ["group-a", "group-b"])

  assert.deepEqual(sent.map((command) => command.input.IndexName), [
    "AssigneeUserUpdatedAtIndex",
    "AssigneeGroupUpdatedAtIndex",
    "AssigneeGroupUpdatedAtIndex"
  ])
})

test("dynamoQuestionStore_listAssignedToUserDeduplicatesAndSortsByUpdatedAtDesc", async () => {
  const sent: QueryCommand[] = []
  const store = new DynamoDbQuestionStore("HumanQuestionsTable", { send: async (command: QueryCommand) => {
    sent.push(command)
    if (command.input.IndexName === "AssigneeUserUpdatedAtIndex") {
      return { Items: [marshall(question("ticket-1", "2026-05-01T00:00:00.000Z"))] }
    }
    return { Items: [
      marshall(question("ticket-1", "2026-05-01T00:00:00.000Z")),
      marshall(question("ticket-2", "2026-05-03T00:00:00.000Z"))
    ] }
  } } as never)

  const questions = await store.listAssignedToUser("user-a", ["group-a"])

  assert.deepEqual(questions.map((item) => item.questionId), ["ticket-2", "ticket-1"])
})

test("dynamoQuestionStore_queryByIndexPaginatesUntilLastEvaluatedKeyIsEmpty", async () => {
  const sent: QueryCommand[] = []
  const store = new DynamoDbQuestionStore("HumanQuestionsTable", { send: async (command: QueryCommand) => {
    sent.push(command)
    if (sent.length === 1) {
      return {
        Items: [marshall(question("ticket-1", "2026-05-01T00:00:00.000Z"))],
        LastEvaluatedKey: marshall({ questionId: "ticket-1" })
      }
    }
    return { Items: [marshall(question("ticket-2", "2026-05-02T00:00:00.000Z"))] }
  } } as never)

  const questions = await store.listRequestedByUser("user-a")

  assert.deepEqual(questions.map((item) => item.questionId), ["ticket-1", "ticket-2"])
  assert.equal(sent.length, 2)
  assert.deepEqual(sent[1]?.input.ExclusiveStartKey, marshall({ questionId: "ticket-1" }))
})

function question(questionId: string, updatedAt: string) {
  return {
    questionId,
    title: "title",
    question: "question",
    requesterName: "requester",
    requesterDepartment: "dept",
    assigneeDepartment: "support",
    category: "general",
    priority: "normal",
    status: "open",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt
  }
}
