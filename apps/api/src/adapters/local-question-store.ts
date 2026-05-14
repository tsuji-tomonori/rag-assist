import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type { HumanQuestion } from "../types.js"
import type { AnswerQuestionInput, CreateQuestionInput, QuestionStore } from "./question-store.js"

type DbFile = {
  questions: HumanQuestion[]
}

export class LocalQuestionStore implements QuestionStore {
  private readonly filePath: string

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, "human-questions.json")
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
    const db = await this.load()
    db.questions = [question, ...db.questions]
    await this.save(db)
    return question
  }

  async list(): Promise<HumanQuestion[]> {
    const db = await this.load()
    return [...db.questions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async get(questionId: string): Promise<HumanQuestion | undefined> {
    const db = await this.load()
    return db.questions.find((question) => question.questionId === questionId)
  }

  async answer(questionId: string, input: AnswerQuestionInput): Promise<HumanQuestion> {
    return this.update(questionId, (question, now) => ({
      ...question,
      answerTitle: input.answerTitle,
      answerBody: input.answerBody,
      responderName: input.responderName?.trim() || "未設定",
      responderDepartment: input.responderDepartment?.trim() || question.assigneeDepartment,
      references: input.references,
      internalMemo: input.internalMemo,
      notifyRequester: input.notifyRequester ?? true,
      status: "answered",
      answeredAt: now,
      updatedAt: now
    }))
  }

  async resolve(questionId: string): Promise<HumanQuestion> {
    return this.update(questionId, (question, now) => ({
      ...question,
      status: "resolved",
      resolvedAt: now,
      updatedAt: now
    }))
  }

  private async update(questionId: string, updater: (question: HumanQuestion, now: string) => HumanQuestion): Promise<HumanQuestion> {
    const db = await this.load()
    const index = db.questions.findIndex((question) => question.questionId === questionId)
    if (index === -1) throw new Error("Question not found")
    const current = db.questions[index]
    if (!current) throw new Error("Question not found")
    const updated = updater(current, new Date().toISOString())
    db.questions[index] = updated
    await this.save(db)
    return updated
  }

  private async load(): Promise<DbFile> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf-8")) as DbFile
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
      return { questions: [] }
    }
  }

  private async save(db: DbFile): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(db, null, 2))
  }
}
