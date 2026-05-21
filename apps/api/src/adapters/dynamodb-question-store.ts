import { randomUUID } from "node:crypto"
import { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import type { HumanQuestion } from "../types.js"
import type { AnswerQuestionInput, CreateQuestionInput, QuestionStore } from "./question-store.js"
import { createDynamoDbClient } from "./dynamodb-client.js"

export class DynamoDbQuestionStore implements QuestionStore {
  private readonly client: DynamoDBClient

  constructor(private readonly tableName: string, client = createDynamoDbClient()) {
    this.client = client
  }

  async create(input: CreateQuestionInput): Promise<HumanQuestion> {
    const now = new Date().toISOString()
    const question: HumanQuestion = {
      questionId: randomUUID(),
      title: input.title,
      question: input.question,
      requesterName: input.requesterName?.trim() || "未設定",
      requesterUserId: input.requesterUserId,
      requesterDepartment: input.requesterDepartment?.trim() || "未設定",
      assigneeDepartment: input.assigneeDepartment?.trim() || "未設定",
      category: input.category?.trim() || "その他の質問",
      priority: input.priority ?? "normal",
      status: "open",
      source: input.source ?? "manual_escalation",
      messageId: input.messageId,
      ragRunId: input.ragRunId,
      answerUnavailableEventId: input.answerUnavailableEventId,
      answerUnavailableReason: input.answerUnavailableReason,
      sanitizedDiagnostics: input.sanitizedDiagnostics,
      assigneeUserId: input.assigneeUserId,
      assigneeGroupId: input.assigneeGroupId,
      slaDueAt: input.slaDueAt,
      qualityCause: input.qualityCause,
      sourceQuestion: input.sourceQuestion,
      chatAnswer: input.chatAnswer,
      chatRunId: input.chatRunId,
      createdAt: now,
      updatedAt: now
    }
    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(question, { removeUndefinedValues: true }),
        ConditionExpression: "attribute_not_exists(questionId)"
      })
    )
    return question
  }

  async listAssignedToUser(userId: string, groupIds: string[]): Promise<HumanQuestion[]> {
    const [userItems, ...groupItems] = await Promise.all([
      this.queryByIndex("AssigneeUserUpdatedAtIndex", "assigneeUserId", userId),
      ...groupIds.map((groupId) => this.queryByIndex("AssigneeGroupUpdatedAtIndex", "assigneeGroupId", groupId))
    ])
    return sortAndDedupeQuestions([...userItems, ...groupItems.flat()])
  }

  async listRequestedByUser(userId: string): Promise<HumanQuestion[]> {
    return this.queryByIndex("RequesterUpdatedAtIndex", "requesterUserId", userId)
  }

  async listAllForAdmin(): Promise<HumanQuestion[]> {
    const statuses: HumanQuestion["status"][] = ["open", "in_progress", "waiting_requester", "answered", "resolved"]
    const results = await Promise.all(statuses.map((status) => this.queryByIndex("StatusUpdatedAtIndex", "status", status)))
    return sortAndDedupeQuestions(results.flat())
  }

  async get(questionId: string): Promise<HumanQuestion | undefined> {
    const result = await this.client.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ questionId })
      })
    )
    return result.Item ? (unmarshall(result.Item) as HumanQuestion) : undefined
  }

  async answer(questionId: string, input: AnswerQuestionInput): Promise<HumanQuestion> {
    const now = new Date().toISOString()
    const result = await this.client.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ questionId }),
        ConditionExpression: "attribute_exists(questionId)",
        UpdateExpression:
          "SET answerTitle = :answerTitle, answerBody = :answerBody, responderName = :responderName, responderDepartment = :responderDepartment, #references = :references, internalMemo = :internalMemo, notifyRequester = :notifyRequester, #status = :status, answeredAt = :answeredAt, updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#references": "references",
          "#status": "status"
        },
        ExpressionAttributeValues: marshall(
          {
            ":answerTitle": input.answerTitle,
            ":answerBody": input.answerBody,
            ":responderName": input.responderName?.trim() || "未設定",
            ":responderDepartment": input.responderDepartment?.trim() || "未設定",
            ":references": input.references ?? "",
            ":internalMemo": input.internalMemo ?? "",
            ":notifyRequester": input.notifyRequester ?? true,
            ":status": "answered",
            ":answeredAt": now,
            ":updatedAt": now
          },
          { removeUndefinedValues: true }
        ),
        ReturnValues: "ALL_NEW"
      })
    )
    if (!result.Attributes) throw new Error("Question not found")
    return unmarshall(result.Attributes) as HumanQuestion
  }

  async resolve(questionId: string): Promise<HumanQuestion> {
    const now = new Date().toISOString()
    const result = await this.client.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ questionId }),
        ConditionExpression: "attribute_exists(questionId)",
        UpdateExpression: "SET #status = :status, resolvedAt = :resolvedAt, updatedAt = :updatedAt",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: marshall({
          ":status": "resolved",
          ":resolvedAt": now,
          ":updatedAt": now
        }),
        ReturnValues: "ALL_NEW"
      })
    )
    if (!result.Attributes) throw new Error("Question not found")
    return unmarshall(result.Attributes) as HumanQuestion
  }

  private async queryByIndex(indexName: string, keyName: string, keyValue: string): Promise<HumanQuestion[]> {
    if (!keyValue) return []
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: indexName,
        KeyConditionExpression: "#pk = :pk",
        ExpressionAttributeNames: { "#pk": keyName },
        ExpressionAttributeValues: marshall({ ":pk": keyValue })
      })
    )
    return (result.Items ?? []).map((item) => unmarshall(item) as HumanQuestion)
  }
}

function sortAndDedupeQuestions(questions: HumanQuestion[]): HumanQuestion[] {
  const byId = new Map<string, HumanQuestion>()
  for (const question of questions) byId.set(question.questionId, question)
  return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
