import assert from "node:assert/strict"
import test from "node:test"
import { OpenAPIHono } from "@hono/zod-openapi"
import type { AppEnv } from "../app-env.js"
import type { AppUser } from "../auth.js"
import type { HumanQuestion } from "../types.js"
import { canReadAllTickets, registerQuestionRoutes } from "./question-routes.js"

test("canReadAllTickets_usesPermissionOnly", () => {
  assert.equal(canReadAllTickets({ userId: "active-admin", cognitoGroups: ["SYSTEM_ADMIN"], accountStatus: "active" }), true)
  assert.equal(canReadAllTickets({ userId: "suspended-admin", cognitoGroups: ["SYSTEM_ADMIN"], accountStatus: "suspended" }), false)
  assert.equal(canReadAllTickets({ userId: "group-only", cognitoGroups: ["SYSTEM_ADMIN_BACKUP"], accountStatus: "active" }), false)
})

test("questionRoute_listAllRejectsSuspendedSystemAdmin", async () => {
  const app = createQuestionRouteApp({ userId: "admin-1", cognitoGroups: ["SYSTEM_ADMIN"], accountStatus: "suspended" }, {
    listAllQuestionsForAdmin: async () => {
      throw new Error("listAllQuestionsForAdmin must not be called")
    },
    listAssignedQuestions: async () => {
      throw new Error("listAssignedQuestions must not be called")
    }
  })

  const response = await app.request("/questions")

  assert.equal(response.status, 403)
})

test("questionRoute_getRejectsSuspendedSystemAdmin", async () => {
  const app = createQuestionRouteApp({ userId: "admin-1", cognitoGroups: ["SYSTEM_ADMIN"], accountStatus: "suspended" }, {
    getQuestion: async () => question({ questionId: "ticket-1", requesterUserId: "requester-1" })
  })

  const response = await app.request("/questions/ticket-1")
  const body = await response.json() as { title?: string; internalMemo?: string; error?: string }

  assert.equal(response.status, 404)
  assert.equal(body.title, undefined)
  assert.equal(body.internalMemo, undefined)
})

function createQuestionRouteApp(user: AppUser, service: Record<string, unknown>) {
  const app = new OpenAPIHono<AppEnv>()
  app.use("*", async (c, next) => {
    c.set("user", user)
    await next()
  })
  registerQuestionRoutes({ app, deps: {} as never, service: service as never })
  return app
}

function question(overrides: Partial<HumanQuestion> = {}): HumanQuestion {
  return {
    questionId: "ticket-1",
    title: "問い合わせ",
    question: "質問本文",
    requesterName: "requester",
    requesterDepartment: "dept",
    requesterUserId: "requester-1",
    assigneeDepartment: "support",
    category: "general",
    priority: "normal",
    status: "open",
    internalMemo: "internal",
    createdAt: "2026-05-21T00:00:00.000Z",
    updatedAt: "2026-05-21T00:00:00.000Z",
    ...overrides
  }
}
