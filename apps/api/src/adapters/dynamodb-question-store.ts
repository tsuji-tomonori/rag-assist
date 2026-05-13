import { randomUUID } from "node:crypto"
import { DynamoDBClient, GetItemCommand, PutItemCommand, ScanCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { config } from "../config.js"
import type { HumanQuestion } from "../types.js"
import type { AnswerQuestionInput, CreateQuestionInput, QuestionStore } from "./question-store.js"

export class DynamoDbQuestionStore implements QuestionStore {
  private readonly client: DynamoDBClient

  constructor(private readonly tableName: string, client = new DynamoDBClient({ region: config.region })) {
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

  async list(): Promise<HumanQuestion[]> {
    const result = await this.client.send(new ScanCommand({ TableName: this.tableName }))
    return (result.Items ?? [])
      .map((item) => unmarshall(item) as HumanQuestion)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
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
}
