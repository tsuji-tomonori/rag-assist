import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"
import { createDependencies } from "./dependencies.js"
import { authMiddleware } from "./auth.js"
import { getPermissionsForGroups, requirePermission } from "./authorization.js"
import { MemoRagService } from "./rag/memorag-service.js"
import {
  ChatRequestSchema,
  ChatResponseSchema,
  AnswerQuestionRequestSchema,
  AdminAuditLogResponseSchema,
  AccessRoleListResponseSchema,
  AssignUserRolesRequestSchema,
  AliasAuditLogResponseSchema,
  AliasDefinitionSchema,
  AliasListResponseSchema,
  BenchmarkRunListResponseSchema,
  BenchmarkRunSchema,
  BenchmarkSuiteListResponseSchema,
  BenchmarkQueryRequestSchema,
  BenchmarkQueryResponseSchema,
  ConversationHistoryItemSchema,
  ConversationHistoryListResponseSchema,
  CostAuditSummarySchema,
  CreateAliasRequestSchema,
  CreateManagedUserRequestSchema,
  CreateBenchmarkRunRequestSchema,
  CreateQuestionRequestSchema,
  CurrentUserResponseSchema,
  DeleteDocumentResponseSchema,
  DebugTraceListResponseSchema,
  DebugTraceSchema,
  DebugDownloadResponseSchema,
  DocumentListResponseSchema,
  DocumentManifestSchema,
  DocumentUploadRequestSchema,
  ErrorResponseSchema,
  HealthResponseSchema,
  ManagedUserListResponseSchema,
  ManagedUserSchema,
  PublishAliasesResponseSchema,
  QuestionListResponseSchema,
  QuestionSchema,
  ReindexMigrationListResponseSchema,
  ReindexMigrationSchema,
  ReviewAliasRequestSchema,
  SearchRequestSchema,
  SearchResponseSchema,
  UpdateAliasRequestSchema,
  UsageSummaryListResponseSchema
} from "./schemas.js"

const deps = createDependencies()
const service = new MemoRagService(deps)

const app = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ error: "Validation failed", details: result.error.flatten() }, 400)
    }
  }
})

app.use("*", cors({ origin: "*", allowHeaders: ["Content-Type", "Authorization"], allowMethods: ["GET", "POST", "DELETE", "OPTIONS"] }))
for (const path of ["/me", "/admin/*", "/documents", "/documents/*", "/chat", "/search", "/questions", "/questions/*", "/conversation-history", "/conversation-history/*", "/debug-runs", "/debug-runs/*", "/benchmark/query", "/benchmark-runs", "/benchmark-runs/*", "/benchmark-suites"]) {
  app.use(path, authMiddleware)
}

function looseRoute(config: any) {
  return createRoute(config) as any
}

app.openapi(
  looseRoute({
    method: "get",
    path: "/health",
    responses: {
      200: { description: "Health check", content: { "application/json": { schema: HealthResponseSchema } } }
    }
  }),
  (c) => c.json({ ok: true, service: "memorag-bedrock-mvp", timestamp: new Date().toISOString() }, 200)
)

app.openapi(
  looseRoute({
    method: "get",
    path: "/me",
    responses: {
      200: {
        description: "Current authenticated user and effective permissions",
        content: { "application/json": { schema: CurrentUserResponseSchema } }
      },
      401: { description: "Authentication required", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  (c) => {
    const user = c.get("user")
    return c.json({
      user: {
        userId: user.userId,
        email: user.email,
        groups: user.cognitoGroups,
        permissions: getPermissionsForGroups(user.cognitoGroups)
      }
    }, 200)
  }
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/admin/users",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: CreateManagedUserRequestSchema } }
      }
    },
    responses: {
      200: { description: "Created managed user", content: { "application/json": { schema: ManagedUserSchema } } },
      409: { description: "User already exists", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    const actor = c.get("user")
    requirePermission(actor, "user:create")
    const body = (c.req as any).valid("json") as z.infer<typeof CreateManagedUserRequestSchema>
    try {
      return c.json(await service.createManagedUser(actor, body), 200)
    } catch (err) {
      if (err instanceof Error && err.message === "Managed user already exists") {
        return c.json({ error: err.message }, 409)
      }
      throw err
    }
  }
)

app.openapi(
  looseRoute({
    method: "get",
    path: "/admin/users",
    responses: {
      200: { description: "List managed users", content: { "application/json": { schema: ManagedUserListResponseSchema } } },
      403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    const user = c.get("user")
    requirePermission(user, "user:read")
    return c.json({ users: await service.listManagedUsers(user) }, 200)
  }
)

app.openapi(
  looseRoute({
    method: "get",
    path: "/admin/audit-log",
    responses: {
      200: { description: "List recent admin audit log entries", content: { "application/json": { schema: AdminAuditLogResponseSchema } } }
    }
  }),
  async (c) => {
    const user = c.get("user")
    requirePermission(user, "access:policy:read")
    return c.json({ auditLog: await service.listAdminAuditLog(user) }, 200)
  }
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/admin/users/{userId}/roles",
    request: {
      params: z.object({ userId: z.string().min(1) }),
      body: {
        required: true,
        content: { "application/json": { schema: AssignUserRolesRequestSchema } }
      }
    },
    responses: {
      200: { description: "Assigned user roles", content: { "application/json": { schema: ManagedUserSchema } } },
      404: { description: "User not found", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    const actor = c.get("user")
    requirePermission(actor, "access:role:assign")
    const { userId } = (c.req as any).valid("param") as { userId: string }
    const body = (c.req as any).valid("json") as z.infer<typeof AssignUserRolesRequestSchema>
    const user = await service.assignUserRoles(actor, userId, body.groups)
    if (!user) return c.json({ error: "User not found" }, 404)
    return c.json(user, 200)
  }
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/admin/users/{userId}/suspend",
    request: { params: z.object({ userId: z.string().min(1) }) },
    responses: {
      200: { description: "Suspended user", content: { "application/json": { schema: ManagedUserSchema } } },
      404: { description: "User not found", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    const actor = c.get("user")
    requirePermission(actor, "user:suspend")
    const { userId } = (c.req as any).valid("param") as { userId: string }
    const user = await service.suspendManagedUser(actor, userId)
    if (!user) return c.json({ error: "User not found" }, 404)
    return c.json(user, 200)
  }
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/admin/users/{userId}/unsuspend",
    request: { params: z.object({ userId: z.string().min(1) }) },
    responses: {
      200: { description: "Unsuspended user", content: { "application/json": { schema: ManagedUserSchema } } },
      404: { description: "User not found", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    const actor = c.get("user")
    requirePermission(actor, "user:unsuspend")
    const { userId } = (c.req as any).valid("param") as { userId: string }
    const user = await service.unsuspendManagedUser(actor, userId)
    if (!user) return c.json({ error: "User not found" }, 404)
    return c.json(user, 200)
  }
)

app.openapi(
  looseRoute({
    method: "delete",
    path: "/admin/users/{userId}",
    request: { params: z.object({ userId: z.string().min(1) }) },
    responses: {
      200: { description: "Deleted user from management ledger", content: { "application/json": { schema: ManagedUserSchema } } },
      404: { description: "User not found", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    const actor = c.get("user")
    requirePermission(actor, "user:delete")
    const { userId } = (c.req as any).valid("param") as { userId: string }
    const user = await service.deleteManagedUser(actor, userId)
    if (!user) return c.json({ error: "User not found" }, 404)
    return c.json(user, 200)
  }
)

app.openapi(
  looseRoute({
    method: "get",
    path: "/admin/roles",
    responses: {
      200: { description: "List access roles and permissions", content: { "application/json": { schema: AccessRoleListResponseSchema } } }
    }
  }),
  (c) => {
    requirePermission(c.get("user"), "access:policy:read")
    return c.json({ roles: service.listAccessRoles() }, 200)
  }
)

app.openapi(
  looseRoute({
    method: "get",
    path: "/admin/aliases",
    responses: {
      200: { description: "List alias definitions", content: { "application/json": { schema: AliasListResponseSchema } } }
    }
  }),
  async (c) => {
    requirePermission(c.get("user"), "rag:alias:read")
    return c.json({ aliases: await service.listAliases() }, 200)
  }
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/admin/aliases",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: CreateAliasRequestSchema } }
      }
    },
    responses: {
      200: { description: "Created alias draft", content: { "application/json": { schema: AliasDefinitionSchema } } }
    }
  }),
  async (c) => {
    const user = c.get("user")
    requirePermission(user, "rag:alias:write:group")
    const body = (c.req as any).valid("json") as z.infer<typeof CreateAliasRequestSchema>
    return c.json(await service.createAlias(user, body), 200)
  }
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/admin/aliases/{aliasId}/update",
    request: {
      params: z.object({ aliasId: z.string().min(1) }),
      body: {
        required: true,
        content: { "application/json": { schema: UpdateAliasRequestSchema } }
      }
    },
    responses: {
      200: { description: "Updated alias draft", content: { "application/json": { schema: AliasDefinitionSchema } } },
      404: { description: "Alias not found", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    const user = c.get("user")
    requirePermission(user, "rag:alias:write:group")
    const { aliasId } = (c.req as any).valid("param") as { aliasId: string }
    const body = (c.req as any).valid("json") as z.infer<typeof UpdateAliasRequestSchema>
    const alias = await service.updateAlias(user, aliasId, body)
    if (!alias) return c.json({ error: "Alias not found" }, 404)
    return c.json(alias, 200)
  }
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/admin/aliases/{aliasId}/review",
    request: {
      params: z.object({ aliasId: z.string().min(1) }),
      body: {
        required: true,
        content: { "application/json": { schema: ReviewAliasRequestSchema } }
      }
    },
    responses: {
      200: { description: "Reviewed alias", content: { "application/json": { schema: AliasDefinitionSchema } } },
      404: { description: "Alias not found", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    const user = c.get("user")
    requirePermission(user, "rag:alias:review:group")
    const { aliasId } = (c.req as any).valid("param") as { aliasId: string }
    const body = (c.req as any).valid("json") as z.infer<typeof ReviewAliasRequestSchema>
    const alias = await service.reviewAlias(user, aliasId, body)
    if (!alias) return c.json({ error: "Alias not found" }, 404)
    return c.json(alias, 200)
  }
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/admin/aliases/{aliasId}/disable",
    request: { params: z.object({ aliasId: z.string().min(1) }) },
    responses: {
      200: { description: "Disabled alias", content: { "application/json": { schema: AliasDefinitionSchema } } },
      404: { description: "Alias not found", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    const user = c.get("user")
    requirePermission(user, "rag:alias:disable:group")
    const { aliasId } = (c.req as any).valid("param") as { aliasId: string }
    const alias = await service.disableAlias(user, aliasId)
    if (!alias) return c.json({ error: "Alias not found" }, 404)
    return c.json(alias, 200)
  }
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/admin/aliases/publish",
    responses: {
      200: { description: "Published approved aliases", content: { "application/json": { schema: PublishAliasesResponseSchema } } }
    }
  }),
  async (c) => {
    const user = c.get("user")
    requirePermission(user, "rag:alias:publish:group")
    return c.json(await service.publishAliases(user), 200)
  }
)

app.openapi(
  looseRoute({
    method: "get",
    path: "/admin/aliases/audit-log",
    responses: {
      200: { description: "List alias audit events", content: { "application/json": { schema: AliasAuditLogResponseSchema } } }
    }
  }),
  async (c) => {
    requirePermission(c.get("user"), "rag:alias:read")
    return c.json({ auditLog: await service.listAliasAuditLog() }, 200)
  }
)

app.openapi(
  looseRoute({
    method: "get",
    path: "/admin/usage",
    responses: {
      200: { description: "List all-user usage summaries", content: { "application/json": { schema: UsageSummaryListResponseSchema } } }
    }
  }),
  async (c) => {
    const user = c.get("user")
    requirePermission(user, "usage:read:all_users")
    return c.json({ users: await service.listUsageSummaries(user) }, 200)
  }
)

app.openapi(
  looseRoute({
    method: "get",
    path: "/admin/costs",
    responses: {
      200: { description: "Get estimated cost audit summary", content: { "application/json": { schema: CostAuditSummarySchema } } }
    }
  }),
  async (c) => {
    const user = c.get("user")
    requirePermission(user, "cost:read:all")
    return c.json(await service.getCostAuditSummary(user), 200)
  }
)

app.openapi(
  looseRoute({
    method: "get",
    path: "/documents",
    responses: {
      200: {
        description: "List ingested documents",
        content: { "application/json": { schema: DocumentListResponseSchema } }
      },
      500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    requirePermission(c.get("user"), "rag:doc:read")
    return c.json({ documents: await service.listDocuments() }, 200)
  }
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/documents",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: DocumentUploadRequestSchema } }
      }
    },
    responses: {
      200: { description: "Ingested document", content: { "application/json": { schema: DocumentManifestSchema } } },
      400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
      500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    requirePermission(c.get("user"), "rag:doc:write:group")
    const body = (c.req as any).valid("json") as z.infer<typeof DocumentUploadRequestSchema>
    if (!body.text && !body.contentBase64 && !body.textractJson) return c.json({ error: "Either text, contentBase64, or textractJson is required" }, 400)
    return c.json(await service.ingest(body), 200)
  }
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/documents/{documentId}/reindex",
    request: {
      params: z.object({ documentId: z.string().min(1) }),
      body: {
        required: false,
        content: { "application/json": { schema: z.object({ embeddingModelId: z.string().optional(), memoryModelId: z.string().optional() }) } }
      }
    },
    responses: {
      200: { description: "Reindexed document", content: { "application/json": { schema: DocumentManifestSchema } } },
      404: { description: "Document not found", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    const user = c.get("user")
    requirePermission(user, "rag:index:rebuild:group")
    const { documentId } = (c.req as any).valid("param") as { documentId: string }
    const body = ((c.req as any).valid("json") ?? {}) as { embeddingModelId?: string; memoryModelId?: string }
    try {
      return c.json(await service.reindexDocument(user, documentId, body), 200)
    } catch (err) {
      if (err instanceof Error && (err.message.includes("ENOENT") || err.message.includes("NoSuchKey"))) return c.json({ error: "Document not found" }, 404)
      throw err
    }
  }
)

app.openapi(
  looseRoute({
    method: "get",
    path: "/documents/reindex-migrations",
    responses: {
      200: { description: "List blue-green reindex migrations", content: { "application/json": { schema: ReindexMigrationListResponseSchema } } }
    }
  }),
  async (c) => {
    requirePermission(c.get("user"), "rag:index:rebuild:group")
    return c.json({ migrations: await service.listReindexMigrations() }, 200)
  }
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/documents/{documentId}/reindex/stage",
    request: {
      params: z.object({ documentId: z.string().min(1) }),
      body: {
        required: false,
        content: { "application/json": { schema: z.object({ embeddingModelId: z.string().optional(), memoryModelId: z.string().optional() }) } }
      }
    },
    responses: {
      200: { description: "Staged reindex migration", content: { "application/json": { schema: ReindexMigrationSchema } } },
      404: { description: "Document not found", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    const user = c.get("user")
    requirePermission(user, "rag:index:rebuild:group")
    const { documentId } = (c.req as any).valid("param") as { documentId: string }
    const body = ((c.req as any).valid("json") ?? {}) as { embeddingModelId?: string; memoryModelId?: string }
    try {
      return c.json(await service.stageReindexMigration(user, documentId, body), 200)
    } catch (err) {
      if (err instanceof Error && (err.message.includes("ENOENT") || err.message.includes("NoSuchKey"))) return c.json({ error: "Document not found" }, 404)
      throw err
    }
  }
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/documents/reindex-migrations/{migrationId}/cutover",
    request: { params: z.object({ migrationId: z.string().min(1) }) },
    responses: {
      200: { description: "Cut over staged reindex migration", content: { "application/json": { schema: ReindexMigrationSchema } } },
      404: { description: "Migration not found", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    requirePermission(c.get("user"), "rag:index:rebuild:group")
    const { migrationId } = (c.req as any).valid("param") as { migrationId: string }
    try {
      return c.json(await service.cutoverReindexMigration(migrationId), 200)
    } catch (err) {
      if (err instanceof Error && err.message.includes("not found")) return c.json({ error: "Migration not found" }, 404)
      throw err
    }
  }
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/documents/reindex-migrations/{migrationId}/rollback",
    request: { params: z.object({ migrationId: z.string().min(1) }) },
    responses: {
      200: { description: "Rolled back reindex migration", content: { "application/json": { schema: ReindexMigrationSchema } } },
      404: { description: "Migration not found", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    requirePermission(c.get("user"), "rag:index:rebuild:group")
    const { migrationId } = (c.req as any).valid("param") as { migrationId: string }
    try {
      return c.json(await service.rollbackReindexMigration(migrationId), 200)
    } catch (err) {
      if (err instanceof Error && err.message.includes("not found")) return c.json({ error: "Migration not found" }, 404)
      throw err
    }
  }
)

app.openapi(
  looseRoute({
    method: "delete",
    path: "/documents/{documentId}",
    request: {
      params: z.object({ documentId: z.string().min(1) })
    },
    responses: {
      200: {
        description: "Deleted document",
        content: { "application/json": { schema: DeleteDocumentResponseSchema } }
      },
      404: { description: "Document not found", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    requirePermission(c.get("user"), "rag:doc:delete:group")
    try {
      const { documentId } = (c.req as any).valid("param") as { documentId: string }
      return c.json(await service.deleteDocument(documentId), 200)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes("ENOENT") || message.includes("NoSuchKey") || message.includes("NotFound")) {
        return c.json({ error: "Document not found" }, 404)
      }
      throw err
    }
  }
)

const chatRoute = looseRoute({
  method: "post",
  path: "/chat",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: ChatRequestSchema } }
    }
  },
  responses: {
    200: { description: "Grounded answer", content: { "application/json": { schema: ChatResponseSchema } } },
    400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
    500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
  }
})

app.openapi(chatRoute, async (c) => {
  const user = c.get("user")
  requirePermission(user, "chat:create")
  const body = (c.req as any).valid("json") as z.infer<typeof ChatRequestSchema>
  if ((body.includeDebug ?? body.debug ?? false) === true) {
    requirePermission(user, "chat:admin:read_all")
  }
  return c.json(await service.chat(body, user), 200)
})

app.openapi(
  looseRoute({
    method: "post",
    path: "/search",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: SearchRequestSchema } }
      }
    },
    responses: {
      200: { description: "Hybrid lexical and vector search results", content: { "application/json": { schema: SearchResponseSchema } } },
      400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
      500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    const user = c.get("user")
    requirePermission(user, "rag:doc:read")
    const body = (c.req as any).valid("json") as z.infer<typeof SearchRequestSchema>
    return c.json(await service.search(body, user), 200)
  }
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/questions",
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
    requirePermission(c.get("user"), "chat:create")
    const body = (c.req as any).valid("json") as z.infer<typeof CreateQuestionRequestSchema>
    return c.json(await service.createQuestion(body), 200)
  }
)

app.openapi(
  looseRoute({
    method: "get",
    path: "/questions",
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
    request: {
      params: z.object({ questionId: z.string().min(1) })
    },
    responses: {
      200: { description: "Get a human follow-up question", content: { "application/json": { schema: QuestionSchema } } },
      404: { description: "Question not found", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    requirePermission(c.get("user"), "answer:edit")
    const { questionId } = (c.req as any).valid("param") as { questionId: string }
    const question = await service.getQuestion(questionId)
    if (!question) return c.json({ error: "Question not found" }, 404)
    return c.json(question, 200)
  }
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/questions/{questionId}/answer",
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
    requirePermission(c.get("user"), "answer:publish")
    try {
      const { questionId } = (c.req as any).valid("param") as { questionId: string }
      const body = (c.req as any).valid("json") as z.infer<typeof AnswerQuestionRequestSchema>
      return c.json(await service.answerQuestion(questionId, body), 200)
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
    request: {
      params: z.object({ questionId: z.string().min(1) })
    },
    responses: {
      200: { description: "Resolved human follow-up question", content: { "application/json": { schema: QuestionSchema } } },
      404: { description: "Question not found", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    requirePermission(c.get("user"), "answer:publish")
    try {
      const { questionId } = (c.req as any).valid("param") as { questionId: string }
      return c.json(await service.resolveQuestion(questionId), 200)
    } catch (err) {
      if (err instanceof Error && err.message.includes("Question not found")) return c.json({ error: "Question not found" }, 404)
      throw err
    }
  }
)

app.openapi(
  looseRoute({
    method: "get",
    path: "/conversation-history",
    responses: {
      200: {
        description: "List persisted conversation history for the current user",
        content: { "application/json": { schema: ConversationHistoryListResponseSchema } }
      },
      500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    const user = c.get("user")
    requirePermission(user, "chat:read:own")
    return c.json({ history: await service.listConversationHistory(user.userId) }, 200)
  }
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/conversation-history",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: ConversationHistoryItemSchema } }
      }
    },
    responses: {
      200: { description: "Saved conversation history", content: { "application/json": { schema: ConversationHistoryItemSchema } } },
      400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
      500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    const user = c.get("user")
    requirePermission(user, "chat:create")
    const body = (c.req as any).valid("json") as z.infer<typeof ConversationHistoryItemSchema>
    return c.json(await service.saveConversationHistory(user.userId, body), 200)
  }
)

app.openapi(
  looseRoute({
    method: "delete",
    path: "/conversation-history/{id}",
    request: {
      params: z.object({ id: z.string().min(1) })
    },
    responses: {
      200: { description: "Deleted conversation history", content: { "application/json": { schema: z.object({ id: z.string() }) } } },
      404: { description: "Conversation history not found", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    const user = c.get("user")
    requirePermission(user, "chat:delete:own")
    const { id } = (c.req as any).valid("param") as { id: string }
    await service.deleteConversationHistory(user.userId, id)
    return c.json({ id }, 200)
  }
)

app.openapi(
  looseRoute({
    method: "get",
    path: "/debug-runs",
    responses: {
      200: {
        description: "List persisted chat debug traces",
        content: { "application/json": { schema: DebugTraceListResponseSchema } }
      }
    }
  }),
  async (c) => {
    requirePermission(c.get("user"), "chat:admin:read_all")
    return c.json({ debugRuns: await service.listDebugRuns() }, 200)
  }
)

app.openapi(
  looseRoute({
    method: "get",
    path: "/debug-runs/{runId}",
    request: {
      params: z.object({ runId: z.string().min(1) })
    },
    responses: {
      200: { description: "Get a persisted chat debug trace", content: { "application/json": { schema: DebugTraceSchema } } },
      404: { description: "Debug run not found", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    requirePermission(c.get("user"), "chat:admin:read_all")
    const { runId } = (c.req as any).valid("param") as { runId: string }
    const trace = await service.getDebugRun(runId)
    if (!trace) return c.json({ error: "Debug run not found" }, 404)
    return c.json(trace, 200)
  }
)


app.openapi(
  looseRoute({
    method: "post",
    path: "/debug-runs/{runId}/download",
    request: { params: z.object({ runId: z.string().min(1) }) },
    responses: {
      200: { description: "Create signed download URL for debug JSON", content: { "application/json": { schema: DebugDownloadResponseSchema } } },
      404: { description: "Debug run not found", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    requirePermission(c.get("user"), "chat:admin:read_all")
    const { runId } = (c.req as any).valid("param") as { runId: string }
    const download = await service.createDebugTraceDownloadUrl(runId)
    if (!download) return c.json({ error: "Debug run not found" }, 404)
    return c.json(download, 200)
  }
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/benchmark/query",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: BenchmarkQueryRequestSchema } }
      }
    },
    responses: {
      200: { description: "Benchmark query result", content: { "application/json": { schema: BenchmarkQueryResponseSchema } } }
    }
  }),
  async (c) => {
    requirePermission(c.get("user"), "benchmark:run")
    const body = (c.req as any).valid("json") as z.infer<typeof BenchmarkQueryRequestSchema>
    const result = await service.chat({ ...body, includeDebug: body.includeDebug ?? true }, c.get("user"))
    return c.json({ id: body.id, ...result }, 200)
  }
)

app.openapi(
  looseRoute({
    method: "get",
    path: "/benchmark-suites",
    responses: {
      200: { description: "List benchmark suites available for asynchronous runs", content: { "application/json": { schema: BenchmarkSuiteListResponseSchema } } }
    }
  }),
  (c) => {
    requirePermission(c.get("user"), "benchmark:read")
    return c.json({ suites: service.listBenchmarkSuites() }, 200)
  }
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/benchmark-runs",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: CreateBenchmarkRunRequestSchema } }
      }
    },
    responses: {
      200: { description: "Queued benchmark run", content: { "application/json": { schema: BenchmarkRunSchema } } },
      400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    const user = c.get("user")
    requirePermission(user, "benchmark:run")
    const body = (c.req as any).valid("json") as z.infer<typeof CreateBenchmarkRunRequestSchema>
    return c.json(await service.createBenchmarkRun(user, body), 200)
  }
)

app.openapi(
  looseRoute({
    method: "get",
    path: "/benchmark-runs",
    responses: {
      200: { description: "List benchmark runs", content: { "application/json": { schema: BenchmarkRunListResponseSchema } } }
    }
  }),
  async (c) => {
    requirePermission(c.get("user"), "benchmark:read")
    return c.json({ benchmarkRuns: await service.listBenchmarkRuns() }, 200)
  }
)

app.openapi(
  looseRoute({
    method: "get",
    path: "/benchmark-runs/{runId}",
    request: {
      params: z.object({ runId: z.string().min(1) })
    },
    responses: {
      200: { description: "Get benchmark run", content: { "application/json": { schema: BenchmarkRunSchema } } },
      404: { description: "Benchmark run not found", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    requirePermission(c.get("user"), "benchmark:read")
    const { runId } = (c.req as any).valid("param") as { runId: string }
    const run = await service.getBenchmarkRun(runId)
    if (!run) return c.json({ error: "Benchmark run not found" }, 404)
    return c.json(run, 200)
  }
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/benchmark-runs/{runId}/cancel",
    request: {
      params: z.object({ runId: z.string().min(1) })
    },
    responses: {
      200: { description: "Cancelled benchmark run", content: { "application/json": { schema: BenchmarkRunSchema } } },
      404: { description: "Benchmark run not found", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    requirePermission(c.get("user"), "benchmark:cancel")
    const { runId } = (c.req as any).valid("param") as { runId: string }
    const run = await service.cancelBenchmarkRun(runId)
    if (!run) return c.json({ error: "Benchmark run not found" }, 404)
    return c.json(run, 200)
  }
)

app.openapi(
  looseRoute({
    method: "post",
    path: "/benchmark-runs/{runId}/download",
    request: {
      params: z.object({ runId: z.string().min(1) }),
      body: {
        required: false,
        content: { "application/json": { schema: z.object({ artifact: z.enum(["report", "summary", "results"]).optional() }) } }
      }
    },
    responses: {
      200: { description: "Create signed download URL for benchmark artifact", content: { "application/json": { schema: DebugDownloadResponseSchema } } },
      404: { description: "Benchmark run not found", content: { "application/json": { schema: ErrorResponseSchema } } }
    }
  }),
  async (c) => {
    requirePermission(c.get("user"), "benchmark:download")
    const { runId } = (c.req as any).valid("param") as { runId: string }
    const body = ((c.req as any).valid("json") ?? {}) as { artifact?: "report" | "summary" | "results" }
    const download = await service.createBenchmarkArtifactDownloadUrl(runId, body.artifact ?? "report")
    if (!download) return c.json({ error: "Benchmark run not found" }, 404)
    return c.json(download, 200)
  }
)

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    version: "0.1.0",
    title: "MemoRAG Bedrock QA MVP API",
    description: "Grounded internal-document QA API. Answers only from uploaded documents; otherwise returns a no-answer response."
  }
})

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse()
  if (typeof err === "object" && err !== null && "getResponse" in err && typeof (err as { getResponse?: unknown }).getResponse === "function") {
    return (err as { getResponse: () => Response }).getResponse()
  }
  if (typeof err === "object" && err !== null && "status" in err) {
    const status = Number((err as { status?: number }).status ?? 500)
    const message = err instanceof Error ? err.message : "Unknown error"
    return c.json({ error: message }, status as any)
  }
  console.error(err)
  return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500)
})

export default app
