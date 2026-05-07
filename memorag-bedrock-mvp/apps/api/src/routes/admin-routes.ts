import { z } from "@hono/zod-openapi"
import { requirePermission } from "../authorization.js"
import {
  AccessRoleListResponseSchema,
  AdminAuditLogResponseSchema,
  AliasAuditLogResponseSchema,
  AliasDefinitionSchema,
  AliasListResponseSchema,
  AssignUserRolesRequestSchema,
  CostAuditSummarySchema,
  CreateAliasRequestSchema,
  CreateManagedUserRequestSchema,
  ErrorResponseSchema,
  ManagedUserListResponseSchema,
  ManagedUserSchema,
  PublishAliasesResponseSchema,
  ReviewAliasRequestSchema,
  UpdateAliasRequestSchema,
  UsageSummaryListResponseSchema
} from "../schemas.js"
import type { ApiRouteContext } from "./route-context.js"
import { looseRoute } from "./route-utils.js"

export function registerAdminRoutes({ app, service }: ApiRouteContext) {
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
      if (actor.userId === userId) return c.json({ error: "Self role assignment is forbidden" }, 403)
      const wantsSystemAdmin = body.groups.some((group) => group.trim() === "SYSTEM_ADMIN")
      const isSystemAdmin = actor.cognitoGroups.includes("SYSTEM_ADMIN")
      if (wantsSystemAdmin && !isSystemAdmin) return c.json({ error: "Forbidden role assignment" }, 403)
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
}
