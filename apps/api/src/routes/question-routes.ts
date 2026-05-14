import { z } from "@hono/zod-openapi"
import { hasPermission, requirePermission } from "../authorization.js"
import {
  AnswerQuestionRequestSchema,
  CreateQuestionRequestSchema,
  ErrorResponseSchema,
  QuestionListResponseSchema,
  QuestionSchema
} from "../schemas.js"
import type { ApiRouteContext } from "./route-context.js"
import { looseRoute, routeAuthorization, validJson, validParam } from "./route-utils.js"

function requesterVisibleQuestion(question: z.infer<typeof QuestionSchema>): z.infer<typeof QuestionSchema> {
  const visibleQuestion = { ...question }
  delete visibleQuestion.internalMemo
  return visibleQuestion
}

export function registerQuestionRoutes({ app, service }: ApiRouteContext) {
  app.openapi(
    looseRoute({
      method: "post",
      path: "/questions",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "chat:create", operationKey: "support.ticket.create.self", resourceCondition: "self" }),
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateQuestionRequestSchema } }
        }
      },
      responses: {
        200: { description: "Created human follow-up question", content: { "application/json": { schema: QuestionSchema } } },
        400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
        500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "chat:create")
      const body = validJson<z.infer<typeof CreateQuestionRequestSchema>>(c)
      return c.json(await service.createQuestion(body, user), 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/questions",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "answer:edit", operationKey: "support.ticket.read", resourceCondition: "none" }),
      responses: {
        200: { description: "List human follow-up questions", content: { "application/json": { schema: QuestionListResponseSchema } } },
        500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      requirePermission(c.get("user"), "answer:edit")
      return c.json({ questions: await service.listQuestions() }, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/questions/{questionId}",
      "x-memorag-authorization": routeAuthorization({ mode: "requesterOrPermission", permission: "answer:edit", operationKey: "support.ticket.read", resourceCondition: "requester", notes: ["問い合わせ作成者本人は answer:edit がなくても実行できます。その場合 internalMemo は返しません。"] }),
      request: {
        params: z.object({ questionId: z.string().min(1) })
      },
      responses: {
        200: { description: "Get a human follow-up question", content: { "application/json": { schema: QuestionSchema } } },
        404: { description: "Question not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      const { questionId } = validParam<{ questionId: string }>(c)
      const question = await service.getQuestion(questionId)
      if (!question) return c.json({ error: "Question not found" }, 404)
      if (hasPermission(user, "answer:edit")) return c.json(question, 200)
      if (question.requesterUserId && question.requesterUserId === user.userId) return c.json(requesterVisibleQuestion(question), 200)
      return c.json({ error: "Question not found" }, 404)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/questions/{questionId}/answer",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "answer:publish", operationKey: "support.draft_answer.send", resourceCondition: "none" }),
      request: {
        params: z.object({ questionId: z.string().min(1) }),
        body: {
          required: true,
          content: { "application/json": { schema: AnswerQuestionRequestSchema } }
        }
      },
      responses: {
        200: { description: "Answered human follow-up question", content: { "application/json": { schema: QuestionSchema } } },
        400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
        404: { description: "Question not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "answer:publish")
      try {
        const { questionId } = validParam<{ questionId: string }>(c)
        const body = validJson<z.infer<typeof AnswerQuestionRequestSchema>>(c)
        return c.json(await service.answerQuestion(questionId, body, user), 200)
      } catch (err) {
        if (err instanceof Error && err.message.includes("Question not found")) return c.json({ error: "Question not found" }, 404)
        throw err
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/questions/{questionId}/resolve",
      "x-memorag-authorization": routeAuthorization({ mode: "requesterOrPermission", permission: "answer:publish", operationKey: "support.ticket.close", resourceCondition: "requester", notes: ["問い合わせ作成者本人は answer:publish がなくても、回答済み問い合わせだけ解決できます。"] }),
      request: {
        params: z.object({ questionId: z.string().min(1) })
      },
      responses: {
        200: { description: "Resolved human follow-up question", content: { "application/json": { schema: QuestionSchema } } },
        409: { description: "Question is not answered yet", content: { "application/json": { schema: ErrorResponseSchema } } },
        404: { description: "Question not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      try {
        const user = c.get("user")
        const { questionId } = validParam<{ questionId: string }>(c)
        const question = await service.getQuestion(questionId)
        if (!question) return c.json({ error: "Question not found" }, 404)
        if (hasPermission(user, "answer:publish")) return c.json(await service.resolveQuestion(questionId), 200)
        if (question.requesterUserId && question.requesterUserId === user.userId) {
          if (question.status !== "answered") return c.json({ error: "Question is not answered yet" }, 409)
          return c.json(requesterVisibleQuestion(await service.resolveQuestion(questionId)), 200)
        }
        return c.json({ error: "Question not found" }, 404)
      } catch (err) {
        if (err instanceof Error && err.message.includes("Question not found")) return c.json({ error: "Question not found" }, 404)
        throw err
      }
    }
  )
}
