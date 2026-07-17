import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"
import type {
  AnswerQuestionInput,
  CreateQuestionInput
} from "../adapters/question-store.js"
import type { AppUser } from "../auth.js"
import type { HumanQuestion } from "../types.js"
import {
  QuestionService,
  questionUserDisplayName,
  type QuestionServicePorts
} from "./question-service.js"

const requester: AppUser = {
  userId: "requester-1",
  email: " requester@example.com ",
  tenantId: "tenant-a",
  accountStatus: "active",
  cognitoGroups: ["CHAT_USER"]
}

test("QuestionService source depends on narrow ports rather than whole Dependencies or AWS clients", () => {
  const source = readFileSync(fileURLToPath(new URL("./question-service.ts", import.meta.url)), "utf8")

  assert.doesNotMatch(source, /\bDependencies\b/)
  assert.doesNotMatch(source, /@aws-sdk\//)
  assert.doesNotMatch(source, /from "\.\.\/config\.js"/)
})

test("QuestionService canonicalizes requester, default assignment, and support diagnostics", async () => {
  const fixture = createFixture({ defaultAssigneeGroupId: "support-default" })
  const visibleCitationIds = Array.from({ length: 23 }, (_, index) => ` cite-${index} `)

  await fixture.service.create({
    title: "資料外の質問",
    question: "担当者へ確認してください。",
    requesterName: " ",
    requesterDepartment: " ",
    answerUnavailableReason: " fallback reason ",
    sanitizedDiagnostics: {
      tier: "support_sanitized",
      answerUnavailableReason: " diagnostic reason ",
      retrievalQuality: "insufficient_evidence",
      qualityCauses: ["retrieval_gap", "invalid"],
      visibleCitationIds: [...visibleCitationIds, "cite-0"],
      visibleDocumentIds: [" doc-1 ", "", "doc-1"],
      visibleChunkIds: [" chunk-1 "],
      qualityWarnings: [" warning ", "warning"],
      suggestedNextActions: ["search_improvement_review", "invalid"]
    } as NonNullable<HumanQuestion["sanitizedDiagnostics"]>
  }, requester)

  assert.deepEqual(fixture.created[0], {
    title: "資料外の質問",
    question: "担当者へ確認してください。",
    requesterName: "requester@example.com",
    requesterDepartment: "未設定",
    requesterUserId: "requester-1",
    assigneeGroupId: "support-default",
    answerUnavailableReason: " fallback reason ",
    sanitizedDiagnostics: {
      tier: "support_sanitized",
      answerUnavailableReason: "diagnostic reason",
      retrievalQuality: "insufficient_evidence",
      qualityCauses: ["retrieval_gap"],
      visibleCitationIds: Array.from({ length: 20 }, (_, index) => `cite-${index}`),
      visibleDocumentIds: ["doc-1"],
      visibleChunkIds: ["chunk-1"],
      qualityWarnings: ["warning"],
      suggestedNextActions: ["search_improvement_review"]
    }
  })
})

test("QuestionService preserves explicit assignment and forwards idempotency fields", async () => {
  const fixture = createFixture({ defaultAssigneeGroupId: "support-default" })
  const input: CreateQuestionInput = {
    title: "再送",
    question: "再送本文",
    requesterName: " 依頼者 ",
    requesterDepartment: " 開発 ",
    assigneeUserId: "answerer-1",
    messageId: "message-1",
    ragRunId: "rag-run-1"
  }

  await fixture.service.create(input, requester)
  await fixture.service.create(input, requester)

  assert.equal(fixture.created.length, 2)
  assert.ok(fixture.created.every((created) => created.messageId === "message-1"))
  assert.ok(fixture.created.every((created) => created.ragRunId === "rag-run-1"))
  assert.ok(fixture.created.every((created) => created.assigneeUserId === "answerer-1"))
  assert.ok(fixture.created.every((created) => created.assigneeGroupId === undefined))
  assert.ok(fixture.created.every((created) => created.requesterName === "依頼者"))
  assert.ok(fixture.created.every((created) => created.requesterDepartment === "開発"))
})

test("QuestionService delegates each read boundary with the original arguments", async () => {
  const fixture = createFixture()

  assert.deepEqual(await fixture.service.listAssigned("answerer-1", ["SUPPORT_A"]), [fixture.question])
  assert.deepEqual(await fixture.service.listRequested("requester-1"), [fixture.question])
  assert.deepEqual(await fixture.service.listAllForAdmin(), [fixture.question])
  assert.equal(await fixture.service.get("question-1"), fixture.question)
  assert.equal(await fixture.service.get("missing"), undefined)
  assert.deepEqual(fixture.readCalls, [
    { operation: "assigned", args: ["answerer-1", ["SUPPORT_A"]] },
    { operation: "requested", args: ["requester-1"] },
    { operation: "all", args: [] },
    { operation: "get", args: ["question-1"] },
    { operation: "get", args: ["missing"] }
  ])
})

test("QuestionService canonicalizes responder display name and delegates answer and resolve", async () => {
  const fixture = createFixture()
  const answerer: AppUser = {
    userId: "answerer-1",
    email: " answerer@example.com ",
    tenantId: "tenant-a",
    accountStatus: "active",
    cognitoGroups: ["ANSWER_EDITOR"]
  }

  await fixture.service.answer("question-1", {
    answerTitle: "回答",
    answerBody: "回答本文",
    responderName: " "
  }, answerer)
  await fixture.service.answer("question-1", {
    answerTitle: "回答2",
    answerBody: "回答本文2",
    responderName: " 担当者名 "
  }, answerer)
  await fixture.service.resolve("question-1")

  assert.deepEqual(fixture.answered, [
    {
      questionId: "question-1",
      input: { answerTitle: "回答", answerBody: "回答本文", responderName: "answerer@example.com" }
    },
    {
      questionId: "question-1",
      input: { answerTitle: "回答2", answerBody: "回答本文2", responderName: "担当者名" }
    }
  ])
  assert.deepEqual(fixture.resolved, ["question-1"])
})

test("questionUserDisplayName falls back from email to user id and an honest unset value", () => {
  assert.equal(questionUserDisplayName(requester), "requester@example.com")
  assert.equal(questionUserDisplayName({ ...requester, email: " ", userId: " user-2 " }), "user-2")
  assert.equal(questionUserDisplayName(undefined), "未設定")
})

function createFixture(options: { defaultAssigneeGroupId?: string } = {}) {
  const question = storedQuestion()
  const created: CreateQuestionInput[] = []
  const answered: Array<{ questionId: string; input: AnswerQuestionInput }> = []
  const resolved: string[] = []
  const readCalls: Array<{ operation: string; args: unknown[] }> = []
  const ports: QuestionServicePorts = {
    defaultAssigneeGroupId: options.defaultAssigneeGroupId,
    resolveUserDisplayName: questionUserDisplayName,
    questionStore: {
      create: async (input) => {
        created.push(input)
        return { ...question, ...input }
      },
      listAssignedToUser: async (userId, groupIds) => {
        readCalls.push({ operation: "assigned", args: [userId, groupIds] })
        return [question]
      },
      listRequestedByUser: async (userId) => {
        readCalls.push({ operation: "requested", args: [userId] })
        return [question]
      },
      listAllForAdmin: async () => {
        readCalls.push({ operation: "all", args: [] })
        return [question]
      },
      get: async (questionId) => {
        readCalls.push({ operation: "get", args: [questionId] })
        return questionId === question.questionId ? question : undefined
      },
      answer: async (questionId, input) => {
        answered.push({ questionId, input })
        return { ...question, ...input, status: "answered" }
      },
      resolve: async (questionId) => {
        resolved.push(questionId)
        return { ...question, status: "resolved" }
      }
    }
  }
  return {
    service: new QuestionService(ports),
    question,
    created,
    answered,
    resolved,
    readCalls
  }
}

function storedQuestion(): HumanQuestion {
  return {
    questionId: "question-1",
    title: "質問",
    question: "質問本文",
    requesterName: "依頼者",
    requesterDepartment: "開発",
    assigneeDepartment: "サポート",
    category: "その他",
    priority: "normal",
    status: "open",
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z"
  }
}
