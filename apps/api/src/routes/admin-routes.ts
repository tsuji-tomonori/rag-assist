import { z } from "@hono/zod-openapi"
import { HTTPException } from "hono/http-exception"
import { ROLE_CATALOG_VERSION } from "@memorag-mvp/contract/access-control"
import { requirePermission } from "../authorization.js"
import {
  AccessRoleListResponseSchema,
  AdministrativePrincipalTransferRequestSchema,
  AdministrativePrincipalTransferResponseSchema,
  AdminExportResponseSchema,
  AdminAuditLogQuerySchema,
  AdminAuditLogResponseSchema,
  AliasAuditLogQuerySchema,
  AliasAuditLogResponseSchema,
  AliasDefinitionSchema,
  AliasListQuerySchema,
  AliasListResponseSchema,
  AssignUserRolesRequestSchema,
  CostAuditSummarySchema,
  CreateAliasRequestSchema,
  CreateManagedUserRequestSchema,
  DisableAliasRequestSchema,
  ErrorResponseSchema,
  ManagedUserDeletionPreflightSchema,
  ManagedUserListResponseSchema,
  ManagedUserSchema,
  PublishAliasesRequestSchema,
  PublishAliasesResponseSchema,
  QualityActionCardListResponseSchema,
  ReviewAliasRequestSchema,
  TransitionAliasRequestSchema,
  UpdateAliasCommandSchema,
  UsageSummaryListResponseSchema
} from "../schemas.js"
import type { ApiRouteContext } from "./route-context.js"
import { looseRoute, routeAuthorization, validJson, validParam, validQuery } from "./route-utils.js"
import { ApplicationRoleMutationError } from "../security/application-role-mutation-service.js"
import { AdministrativePrincipalTransferError } from "../security/administrative-principal-transfer-service.js"
import { AliasGovernanceError } from "../rag/memorag-service.js"
import { InvalidPageCursorError } from "../admin/keyset-pagination.js"

export function registerAdminRoutes({ app, service }: ApiRouteContext) {
  app.openapi(
    looseRoute({
      method: "post",
      path: "/admin/users",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "user:create", operationKey: "user.create", resourceCondition: "adminManagedUser" }),
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
      const body = validJson<z.infer<typeof CreateManagedUserRequestSchema>>(c)
      try {
        return c.json(await service.createManagedUser(actor, body), 200)
      } catch (err) {
        if (err instanceof Error && err.message === "Managed user already exists") {
          return c.json({ error: "Managed user already exists" }, 409)
        }
        throw err
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/admin/users/{userId}/administrative-principal-transfer",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "user:delete",
        operationKey: "administrative_principal.transfer",
        resourceCondition: "adminManagedUser",
        notes: ["owner/adminPrincipal 変更、tenant 離脱、恒久削除を確定する前に全所有資源を同一 tenant の active 後継へ移管します。"]
      }),
      request: {
        params: z.object({ userId: z.string().min(1) }),
        body: { required: true, content: { "application/json": { schema: AdministrativePrincipalTransferRequestSchema } } }
      },
      responses: {
        200: { description: "移管結果", content: { "application/json": { schema: AdministrativePrincipalTransferResponseSchema } } },
        400: { description: "移管条件が不正", content: { "application/json": { schema: ErrorResponseSchema } } },
        403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
        404: { description: "対象ユーザーが見つかりません", content: { "application/json": { schema: ErrorResponseSchema } } },
        409: { description: "別の移管と競合", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "移管 reconciliation が必要", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const actor = c.get("user")
      requirePermission(actor, "user:delete")
      const { userId } = validParam<{ userId: string }>(c)
      const body = validJson<z.infer<typeof AdministrativePrincipalTransferRequestSchema>>(c)
      try {
        const result = await service.transferManagedUserAdministrativePrincipal(actor, userId, body)
        if (!result) return c.json({ error: "User not found" }, 404)
        return c.json(result, 200)
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Forbidden")) {
          throw new HTTPException(403, { message: "Forbidden" })
        }
        if (error instanceof AdministrativePrincipalTransferError) {
          if (error.reconciliationRequired) return c.json({ error: "Administrative principal transfer unavailable" }, 503)
          if (/conflict|already transferred|in progress|CAS race/i.test(error.message)) {
            return c.json({ error: "Administrative principal transfer conflict" }, 409)
          }
          return c.json({ error: error.message }, 400)
        }
        if (error instanceof Error && error.message.includes("Transfer reason")) return c.json({ error: error.message }, 400)
        throw error
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/admin/users",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "user:read", operationKey: "user.read", resourceCondition: "adminManagedUser" }),
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
      path: "/admin/users/{userId}/deletion-preflight",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "user:delete",
        operationKey: "user.delete.preflight",
        resourceCondition: "adminManagedUser",
        notes: ["所有資源の件数と、正本 identity で active・同一 tenant と確認できた後継候補だけを返します。"]
      }),
      request: { params: z.object({ userId: z.string().min(1) }) },
      responses: {
        200: { description: "削除前の所有資源と後継候補", content: { "application/json": { schema: ManagedUserDeletionPreflightSchema } } },
        404: { description: "対象ユーザーが見つかりません", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const actor = c.get("user")
      requirePermission(actor, "user:delete")
      const { userId } = validParam<{ userId: string }>(c)
      const preflight = await service.getManagedUserDeletionPreflight(actor, userId)
      if (!preflight) return c.json({ error: "User not found" }, 404)
      return c.json(preflight, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/admin/audit-log",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "access:policy:read", operationKey: "audit.read", resourceCondition: "none" }),
      request: { query: AdminAuditLogQuerySchema },
      responses: {
        200: { description: "List admin audit log entries with stable cursor metadata", content: { "application/json": { schema: AdminAuditLogResponseSchema } } },
        400: { description: "Invalid cursor or filter", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "access:policy:read")
      const query = validQuery<z.infer<typeof AdminAuditLogQuerySchema>>(c)
      try {
        return c.json(await service.listAdminAuditLog(user, query), 200)
      } catch (error) {
        if (error instanceof InvalidPageCursorError) return c.json({ error: error.message }, 400)
        throw error
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/admin/audit-log/export",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "access:policy:read",
        operationKey: "audit.export",
        resourceCondition: "none",
        notes: ["audit export は sanitize 済み JSON を署名付き URL として返し、credential や raw prompt は含めません。"]
      }),
      responses: {
        200: { description: "Create signed admin audit export URL", content: { "application/json": { schema: AdminExportResponseSchema } } },
        403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "export 保存先が設定されていません", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "access:policy:read")
      try {
        return c.json(await service.createAdminExportDownloadUrl(user, "audit_log"), 200)
      } catch (err) {
        if (err instanceof Error && err.message.includes("DEBUG_DOWNLOAD_BUCKET_NAME")) return c.json({ error: "Export storage is not configured" }, 503)
        throw err
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/admin/users/{userId}/roles",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "access:role:assign", operationKey: "role.assign", resourceCondition: "roleAssignment", notes: ["自分自身の role 更新は 403 を返します。", "SYSTEM_ADMIN を付与する場合、実行者も SYSTEM_ADMIN role である必要があります。"] }),
      request: {
        params: z.object({ userId: z.string().min(1) }),
        body: {
          required: true,
          content: { "application/json": { schema: AssignUserRolesRequestSchema } }
        }
      },
      responses: {
        200: { description: "Assigned user roles", content: { "application/json": { schema: ManagedUserSchema } } },
        403: { description: "Forbidden role assignment", content: { "application/json": { schema: ErrorResponseSchema } } },
        404: { description: "User not found", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "正本 role の更新または session 失効に失敗しました", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const actor = c.get("user")
      requirePermission(actor, "access:role:assign")
      const { userId } = validParam<{ userId: string }>(c)
      const body = validJson<z.infer<typeof AssignUserRolesRequestSchema>>(c)
      let user
      try {
        user = await service.assignUserRoles(actor, userId, body.groups, body.reason)
      } catch (error) {
        if (error instanceof ApplicationRoleMutationError) {
          return c.json({ error: error.result === "denied" ? "Forbidden role assignment" : "Role mutation unavailable" }, error.result === "denied" ? 403 : 503)
        }
        throw error
      }
      if (!user) return c.json({ error: "User not found" }, 404)
      return c.json(user, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/admin/users/{userId}/suspend",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "user:suspend", operationKey: "user.suspend", resourceCondition: "adminManagedUser" }),
      request: { params: z.object({ userId: z.string().min(1) }) },
      responses: {
        200: { description: "Suspended user", content: { "application/json": { schema: ManagedUserSchema } } },
        404: { description: "User not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const actor = c.get("user")
      requirePermission(actor, "user:suspend")
      const { userId } = validParam<{ userId: string }>(c)
      const user = await service.suspendManagedUser(actor, userId)
      if (!user) return c.json({ error: "User not found" }, 404)
      return c.json(user, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/admin/users/{userId}/unsuspend",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "user:unsuspend", operationKey: "user.restore", resourceCondition: "adminManagedUser" }),
      request: { params: z.object({ userId: z.string().min(1) }) },
      responses: {
        200: { description: "Unsuspended user", content: { "application/json": { schema: ManagedUserSchema } } },
        404: { description: "User not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const actor = c.get("user")
      requirePermission(actor, "user:unsuspend")
      const { userId } = validParam<{ userId: string }>(c)
      const user = await service.unsuspendManagedUser(actor, userId)
      if (!user) return c.json({ error: "User not found" }, 404)
      return c.json(user, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "delete",
      path: "/admin/users/{userId}",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "user:delete", operationKey: "user.delete", resourceCondition: "adminManagedUser" }),
      request: {
        params: z.object({ userId: z.string().min(1) }),
        query: z.object({ successorUserId: z.string().min(1).optional() })
      },
      responses: {
        200: { description: "Deleted user from management ledger", content: { "application/json": { schema: ManagedUserSchema } } },
        404: { description: "User not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const actor = c.get("user")
      requirePermission(actor, "user:delete")
      const { userId } = validParam<{ userId: string }>(c)
      const { successorUserId } = validQuery<{ successorUserId?: string }>(c)
      const user = await service.deleteManagedUser(actor, userId, { successorUserId })
      if (!user) return c.json({ error: "User not found" }, 404)
      return c.json(user, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/admin/roles",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "access:policy:read", operationKey: "role.read", resourceCondition: "none" }),
      responses: {
        200: { description: "List access roles and permissions", content: { "application/json": { schema: AccessRoleListResponseSchema } } }
      }
    }),
    (c) => {
      requirePermission(c.get("user"), "access:policy:read")
      return c.json({
        roles: service.listAccessRoles(),
        catalogVersion: ROLE_CATALOG_VERSION,
        source: "canonical-application-role-catalog",
        asOf: new Date().toISOString()
      }, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/admin/aliases",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:alias:read", operationKey: "alias.read", resourceCondition: "tenantCollection" }),
      request: { query: AliasListQuerySchema },
      responses: {
        200: { description: "List tenant alias definitions with stable cursor metadata", content: { "application/json": { schema: AliasListResponseSchema } } },
        400: { description: "Invalid cursor or filter", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const actor = c.get("user")
      requirePermission(actor, "rag:alias:read")
      const query = validQuery<z.infer<typeof AliasListQuerySchema>>(c)
      try {
        return c.json(await service.listAliases(actor, query), 200)
      } catch (error) {
        if (error instanceof InvalidPageCursorError) return c.json({ error: error.message }, 400)
        throw error
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/admin/aliases",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:alias:write:group", operationKey: "alias.create", resourceCondition: "tenantCollection" }),
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
      const body = validJson<z.infer<typeof CreateAliasRequestSchema>>(c)
      return c.json(await service.createAlias(user, body), 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/admin/aliases/{aliasId}/update",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:alias:write:group", operationKey: "alias.update", resourceCondition: "tenantCollection" }),
      request: {
        params: z.object({ aliasId: z.string().min(1) }),
        body: {
          required: true,
          content: { "application/json": { schema: UpdateAliasCommandSchema } }
        }
      },
      responses: {
        200: { description: "Updated alias draft", content: { "application/json": { schema: AliasDefinitionSchema } } },
        400: { description: "Invalid alias transition", content: { "application/json": { schema: ErrorResponseSchema } } },
        404: { description: "Alias not found", content: { "application/json": { schema: ErrorResponseSchema } } },
        409: { description: "Alias version conflict", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "alias 更新の永続化を完了できません", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "rag:alias:write:group")
      const { aliasId } = validParam<{ aliasId: string }>(c)
      const body = validJson<z.infer<typeof UpdateAliasCommandSchema>>(c)
      try {
        const alias = await service.updateAlias(user, aliasId, body)
        if (!alias) return c.json({ error: "Alias not found" }, 404)
        return c.json(alias, 200)
      } catch (error) {
        if (error instanceof AliasGovernanceError) return c.json({ error: error.message }, aliasGovernanceStatus(error))
        throw error
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/admin/aliases/{aliasId}/review",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:alias:review:group", operationKey: "alias.review", resourceCondition: "tenantCollection" }),
      request: {
        params: z.object({ aliasId: z.string().min(1) }),
        body: {
          required: true,
          content: { "application/json": { schema: ReviewAliasRequestSchema } }
        }
      },
      responses: {
        200: { description: "Reviewed alias", content: { "application/json": { schema: AliasDefinitionSchema } } },
        400: { description: "Invalid alias transition", content: { "application/json": { schema: ErrorResponseSchema } } },
        404: { description: "Alias not found", content: { "application/json": { schema: ErrorResponseSchema } } },
        409: { description: "Alias version conflict", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "alias レビューの永続化を完了できません", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "rag:alias:review:group")
      const { aliasId } = validParam<{ aliasId: string }>(c)
      const body = validJson<z.infer<typeof ReviewAliasRequestSchema>>(c)
      try {
        const alias = await service.reviewAlias(user, aliasId, body)
        if (!alias) return c.json({ error: "Alias not found" }, 404)
        return c.json(alias, 200)
      } catch (error) {
        if (error instanceof AliasGovernanceError) return c.json({ error: error.message }, aliasGovernanceStatus(error))
        throw error
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/admin/aliases/{aliasId}/transition",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:alias:write:group", operationKey: "alias.transition", resourceCondition: "tenantCollection" }),
      request: {
        params: z.object({ aliasId: z.string().min(1) }),
        body: { required: true, content: { "application/json": { schema: TransitionAliasRequestSchema } } }
      },
      responses: {
        200: { description: "Transitioned alias to draft", content: { "application/json": { schema: AliasDefinitionSchema } } },
        400: { description: "Invalid alias transition", content: { "application/json": { schema: ErrorResponseSchema } } },
        404: { description: "Alias not found", content: { "application/json": { schema: ErrorResponseSchema } } },
        409: { description: "Alias version conflict", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "alias 状態遷移の永続化を完了できません", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const actor = c.get("user")
      requirePermission(actor, "rag:alias:write:group")
      const { aliasId } = validParam<{ aliasId: string }>(c)
      const body = validJson<z.infer<typeof TransitionAliasRequestSchema>>(c)
      try {
        const alias = await service.transitionAliasToDraft(actor, aliasId, body)
        if (!alias) return c.json({ error: "Alias not found" }, 404)
        return c.json(alias, 200)
      } catch (error) {
        if (error instanceof AliasGovernanceError) return c.json({ error: error.message }, aliasGovernanceStatus(error))
        throw error
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/admin/aliases/{aliasId}/disable",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:alias:disable:group", operationKey: "alias.disable", resourceCondition: "tenantCollection" }),
      request: {
        params: z.object({ aliasId: z.string().min(1) }),
        body: { required: true, content: { "application/json": { schema: DisableAliasRequestSchema } } }
      },
      responses: {
        200: { description: "Disabled alias", content: { "application/json": { schema: AliasDefinitionSchema } } },
        400: { description: "Invalid alias transition", content: { "application/json": { schema: ErrorResponseSchema } } },
        404: { description: "Alias not found", content: { "application/json": { schema: ErrorResponseSchema } } },
        409: { description: "Alias version conflict", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "alias 無効化の永続化を完了できません", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "rag:alias:disable:group")
      const { aliasId } = validParam<{ aliasId: string }>(c)
      const body = validJson<z.infer<typeof DisableAliasRequestSchema>>(c)
      try {
        const alias = await service.disableAlias(user, aliasId, body)
        if (!alias) return c.json({ error: "Alias not found" }, 404)
        return c.json(alias, 200)
      } catch (error) {
        if (error instanceof AliasGovernanceError) return c.json({ error: error.message }, aliasGovernanceStatus(error))
        throw error
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/admin/aliases/publish",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:alias:publish:group", operationKey: "alias.publish", resourceCondition: "tenantCollection" }),
      request: { body: { required: true, content: { "application/json": { schema: PublishAliasesRequestSchema } } } },
      responses: {
        200: { description: "Published approved aliases", content: { "application/json": { schema: PublishAliasesResponseSchema } } },
        400: { description: "No publishable aliases or invalid command", content: { "application/json": { schema: ErrorResponseSchema } } },
        409: { description: "Alias ledger version conflict", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "alias 公開の永続化を完了できません", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "rag:alias:publish:group")
      const body = validJson<z.infer<typeof PublishAliasesRequestSchema>>(c)
      try {
        return c.json(await service.publishAliases(user, body), 200)
      } catch (error) {
        if (error instanceof AliasGovernanceError) return c.json({ error: error.message }, aliasGovernanceStatus(error))
        throw error
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/admin/aliases/audit-log",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:alias:read", operationKey: "alias.audit.read", resourceCondition: "tenantCollection" }),
      request: { query: AliasAuditLogQuerySchema },
      responses: {
        200: { description: "List tenant alias audit events with stable cursor metadata", content: { "application/json": { schema: AliasAuditLogResponseSchema } } },
        400: { description: "Invalid cursor or filter", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const actor = c.get("user")
      requirePermission(actor, "rag:alias:read")
      const query = validQuery<z.infer<typeof AliasAuditLogQuerySchema>>(c)
      try {
        return c.json(await service.listAliasAuditLog(actor, query), 200)
      } catch (error) {
        if (error instanceof InvalidPageCursorError) return c.json({ error: error.message }, 400)
        throw error
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/admin/quality-actions",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "rag:doc:read",
        operationKey: "quality.action.read",
        resourceCondition: "documentGroupRead",
        notes: ["品質 action card は caller が読める文書から算出し、架空件数や固定 fallback は返しません。"]
      }),
      responses: {
        200: { description: "List document quality action cards", content: { "application/json": { schema: QualityActionCardListResponseSchema } } },
        403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "rag:doc:read")
      return c.json({ actions: await service.listQualityActionCards(user) }, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/admin/usage",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "usage:read:all_users", operationKey: "usage.read.aggregate", resourceCondition: "none" }),
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
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "cost:read:all", operationKey: "cost.read.aggregate", resourceCondition: "none" }),
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
      method: "post",
      path: "/admin/costs/export",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "cost:read:all",
        operationKey: "cost.export",
        resourceCondition: "none",
        notes: ["cost export は集計値と redaction metadata のみを含む sanitize 済み JSON として返します。"]
      }),
      responses: {
        200: { description: "Create signed admin cost export URL", content: { "application/json": { schema: AdminExportResponseSchema } } },
        403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "export 保存先が設定されていません", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "cost:read:all")
      try {
        return c.json(await service.createAdminExportDownloadUrl(user, "cost_summary"), 200)
      } catch (err) {
        if (err instanceof Error && err.message.includes("DEBUG_DOWNLOAD_BUCKET_NAME")) return c.json({ error: "Export storage is not configured" }, 503)
        throw err
      }
    }
  )
}

function aliasGovernanceStatus(error: AliasGovernanceError): 400 | 409 | 503 {
  if (error.result === "conflict") return 409
  if (error.result === "denied") return 400
  return 503
}
