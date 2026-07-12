import { z } from "@hono/zod-openapi"
import type { Context } from "hono"
import type { AppEnv } from "../app-env.js"
import { requirePermission } from "../authorization.js"
import {
  CreateResourceGroupRequestSchema,
  DeleteResourceGroupRequestSchema,
  ErrorResponseSchema,
  ReplaceResourceGroupMembershipsRequestSchema,
  ResourceGroupListResponseSchema,
  ResourceGroupMembershipStateSchema,
  ResourceGroupPublicSchema,
  ResourceUnavailableResponseSchema,
  UnsupportedResourceGroupMutationRequestSchema,
  UpdateResourceGroupRequestSchema
} from "../schemas.js"
import {
  ResourceGroupLifecycleError,
  ResourceGroupLifecycleService,
  type CreateResourceGroupInput,
  type DeleteResourceGroupInput,
  type UpdateResourceGroupInput
} from "../security/resource-group-lifecycle-service.js"
import { ObjectStoreRevocationCleanupCoordinator } from "../rag/_shared/security/revocation-cleanup-coordinator.js"
import {
  ResourceGroupMembershipMutationError,
  ResourceGroupMembershipUnavailableError,
  type ReplaceResourceGroupMembershipsInput
} from "../security/resource-group-membership-service.js"
import type { GroupMembership } from "../types.js"
import { publicResourceUnavailable, settleNonEnumerationTiming } from "../security/public-resource-response.js"
import type { ApiRouteContext } from "./route-context.js"
import { looseRoute, routeAuthorization, validJson, validParam } from "./route-utils.js"

const ResourceGroupParamsSchema = z.object({
  groupId: z.string().min(1).max(200).refine((value) => value.trim() === value)
})

type VersionedMembershipState = Readonly<{
  version: string
  memberships: readonly GroupMembership[]
}>

export function registerResourceGroupRoutes({ app, deps, service }: ApiRouteContext) {
  app.openapi(
    looseRoute({
      method: "get",
      path: "/resource-groups",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "resourceGroup.read",
        operationKey: "resourceGroup.read",
        resourceCondition: "resourceGroupFull",
        notes: ["現行 actor が readOnly 以上を持つ同一 tenant の resource group だけを列挙します。"]
      }),
      responses: {
        200: { description: "参照可能な resource group の最小公開一覧", content: { "application/json": { schema: ResourceGroupListResponseSchema } } },
        403: { description: "認可されていません", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "resource group の認可依存を利用できません", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const actor = c.get("user")
      requirePermission(actor, "resourceGroup.read")
      try {
        const resourceGroups = await lifecycleService(deps).list(actor)
        return c.json({ resourceGroups, count: resourceGroups.length }, 200)
      } catch {
        return c.json({ error: "Resource group lifecycle unavailable" }, 503)
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/resource-groups",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "resourceGroup.create",
        operationKey: "resourceGroup.create",
        resourceCondition: "resourceGroupFull",
        notes: ["immutable groupId、role namespace 分離、absent version、reason、監査 intent を mutation 前に強制します。"]
      }),
      request: { body: { required: true, content: { "application/json": { schema: CreateResourceGroupRequestSchema } } } },
      responses: {
        201: { description: "作成した resource group の最小公開状態", content: { "application/json": { schema: ResourceGroupPublicSchema } } },
        403: { description: "認可されていません", content: { "application/json": { schema: ErrorResponseSchema } } },
        409: { description: "resource group の作成競合", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "resource group または監査 store を利用できません", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const actor = c.get("user")
      const body = validJson<CreateResourceGroupInput>(c)
      try {
        return c.json(await lifecycleService(deps).create(actor, body), 201)
      } catch (error) {
        return resourceGroupMutationError(c, error, false)
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/resource-groups/{groupId}",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "resourceGroup.read",
        operationKey: "resourceGroup.read",
        resourceCondition: "resourceGroupFull",
        errorDisclosure: "resource-hidden",
        notes: ["同一 tenant、active、readOnly 以上を current state で再評価し、allowlist response だけを返します。"]
      }),
      request: { params: ResourceGroupParamsSchema },
      responses: {
        200: { description: "resource group の最小公開状態", content: { "application/json": { schema: ResourceGroupPublicSchema } } },
        404: { description: "資源を利用できません", content: { "application/json": { schema: ResourceUnavailableResponseSchema } } },
        503: { description: "resource group の認可依存を利用できません", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const startedAtMs = Date.now()
      const actor = c.get("user")
      requirePermission(actor, "resourceGroup.read")
      const { groupId } = validParam<{ groupId: string }>(c)
      try {
        return c.json(await lifecycleService(deps).get(actor, groupId), 200)
      } catch (error) {
        if (error instanceof ResourceGroupLifecycleError && error.result === "denied") {
          return resourceUnavailable(c, startedAtMs)
        }
        return c.json({ error: "Resource group lifecycle unavailable" }, 503)
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "put",
      path: "/resource-groups/{groupId}",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "resourceGroup.update",
        operationKey: "resourceGroup.update",
        resourceCondition: "resourceGroupFull",
        errorDisclosure: "resource-hidden",
        notes: ["current full authority、expectedVersion CAS、canonical reason、監査 intent を強制します。"]
      }),
      request: {
        params: ResourceGroupParamsSchema,
        body: { required: true, content: { "application/json": { schema: UpdateResourceGroupRequestSchema } } }
      },
      responses: {
        200: { description: "更新した resource group の最小公開状態", content: { "application/json": { schema: ResourceGroupPublicSchema } } },
        404: { description: "資源を利用できません", content: { "application/json": { schema: ResourceUnavailableResponseSchema } } },
        409: { description: "resource group の version 競合", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "resource group または監査 store を利用できません", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const startedAtMs = Date.now()
      const actor = c.get("user")
      const { groupId } = validParam<{ groupId: string }>(c)
      const body = validJson<UpdateResourceGroupInput>(c)
      try {
        return c.json(await lifecycleService(deps).update(actor, groupId, body), 200)
      } catch (error) {
        return resourceGroupMutationError(c, error, true, startedAtMs)
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "delete",
      path: "/resource-groups/{groupId}",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "resourceGroup.delete",
        operationKey: "resourceGroup.delete",
        resourceCondition: "resourceGroupFull",
        errorDisclosure: "resource-hidden",
        notes: ["impact preview、外部参照拒否、membership revoke-first、expectedVersion CAS、監査 intent を強制します。"]
      }),
      request: {
        params: ResourceGroupParamsSchema,
        body: { required: true, content: { "application/json": { schema: DeleteResourceGroupRequestSchema } } }
      },
      responses: {
        200: { description: "archive した resource group の最小公開状態", content: { "application/json": { schema: ResourceGroupPublicSchema } } },
        404: { description: "資源を利用できません", content: { "application/json": { schema: ResourceUnavailableResponseSchema } } },
        409: { description: "version または参照状態の競合", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "resource group または監査 store を利用できません", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const startedAtMs = Date.now()
      const actor = c.get("user")
      const { groupId } = validParam<{ groupId: string }>(c)
      const body = validJson<DeleteResourceGroupInput>(c)
      try {
        return c.json(await lifecycleService(deps).delete(actor, groupId, body), 200)
      } catch (error) {
        return resourceGroupMutationError(c, error, true, startedAtMs)
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/resource-groups/{groupId}/move",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "resourceGroup.update",
        operationKey: "resourceGroup.move",
        resourceCondition: "resourceGroupFull",
        errorDisclosure: "resource-hidden",
        notes: ["FR-076 の explicit deny セルであり、資源を読む前に常に拒否します。"]
      }),
      request: {
        params: ResourceGroupParamsSchema,
        body: { required: true, content: { "application/json": { schema: UnsupportedResourceGroupMutationRequestSchema } } }
      },
      responses: {
        403: { description: "resource group move は明示的に非対応です", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const actor = c.get("user")
      try {
        lifecycleService(deps).assertMoveUnsupported(actor)
        return c.json({ error: "Forbidden" }, 403)
      } catch (error) {
        if (error instanceof ResourceGroupLifecycleError && error.result === "denied") {
          return c.json({ error: "Forbidden" }, 403)
        }
        return c.json({ error: "Resource group lifecycle unavailable" }, 503)
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/resource-groups/{groupId}/share",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "resourceGroup.read",
        operationKey: "resourceGroup.share",
        resourceCondition: "resourceGroupFull",
        errorDisclosure: "resource-hidden",
        notes: ["FR-076 の explicit deny セルであり、資源を読む前に常に拒否します。"]
      }),
      request: {
        params: ResourceGroupParamsSchema,
        body: { required: true, content: { "application/json": { schema: UnsupportedResourceGroupMutationRequestSchema } } }
      },
      responses: {
        403: { description: "resource group share は明示的に非対応です", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const actor = c.get("user")
      try {
        lifecycleService(deps).assertShareUnsupported(actor)
        return c.json({ error: "Forbidden" }, 403)
      } catch (error) {
        if (error instanceof ResourceGroupLifecycleError && error.result === "denied") {
          return c.json({ error: "Forbidden" }, 403)
        }
        return c.json({ error: "Resource group lifecycle unavailable" }, 503)
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/resource-groups/{groupId}/memberships",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "rag:group:assign_manager",
        operationKey: "resource_group.membership.read",
        resourceCondition: "resourceGroupFull",
        notes: ["membership mutate feature と対象 resource group の current full/manager authority を両方再確認します。"]
      }),
      request: { params: ResourceGroupParamsSchema },
      responses: {
        200: { description: "Versioned complete resource-group membership state", content: { "application/json": { schema: ResourceGroupMembershipStateSchema } } },
        403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "membership の identity または state 依存サービスを利用できません", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const actor = c.get("user")
      requirePermission(actor, "rag:group:assign_manager")
      const { groupId } = validParam<{ groupId: string }>(c)
      try {
        const state = await service.getResourceGroupMembershipState(actor, groupId)
        return c.json(publicMembershipState(groupId, state), 200)
      } catch (error) {
        if (error instanceof ResourceGroupMembershipMutationError && error.result === "denied") {
          return c.json({ error: "Forbidden" }, 403)
        }
        if (error instanceof ResourceGroupMembershipUnavailableError) {
          return c.json({ error: "Resource group membership unavailable" }, 503)
        }
        return c.json({ error: "Resource group membership unavailable" }, 503)
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "put",
      path: "/resource-groups/{groupId}/memberships",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "rag:group:assign_manager",
        operationKey: "resource_group.membership.replace",
        resourceCondition: "resourceGroupFull",
        notes: ["expectedVersion、reason、proposed complete state integrity、audit intent、CAS を一つの mutation boundary で強制します。"]
      }),
      request: {
        params: ResourceGroupParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: ReplaceResourceGroupMembershipsRequestSchema } }
        }
      },
      responses: {
        200: { description: "Replaced versioned complete resource-group membership state", content: { "application/json": { schema: ResourceGroupMembershipStateSchema } } },
        400: { description: "Invalid complete membership state request", content: { "application/json": { schema: ErrorResponseSchema } } },
        403: { description: "Forbidden or proposed-state integrity denied", content: { "application/json": { schema: ErrorResponseSchema } } },
        409: { description: "Membership state version conflict", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "membership state または監査永続化を利用できません", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const actor = c.get("user")
      const { groupId } = validParam<{ groupId: string }>(c)
      const body = validJson<ReplaceResourceGroupMembershipsInput>(c)
      try {
        const state = await service.replaceResourceGroupMemberships(actor, groupId, body)
        return c.json(publicMembershipState(groupId, state), 200)
      } catch (error) {
        if (error instanceof ResourceGroupMembershipMutationError) {
          if (error.result === "denied") return c.json({ error: "Forbidden" }, 403)
          if (error.result === "conflict") return c.json({ error: "Resource group membership conflict" }, 409)
        }
        if (error instanceof ResourceGroupMembershipUnavailableError) {
          return c.json({ error: "Resource group membership unavailable" }, 503)
        }
        return c.json({ error: "Resource group membership unavailable" }, 503)
      }
    }
  )
}

function lifecycleService(deps: ApiRouteContext["deps"]): ResourceGroupLifecycleService {
  if (!deps.securityAuditOutbox) throw new Error("Resource group lifecycle audit outbox is unavailable")
  return new ResourceGroupLifecycleService({
    userGroupStore: deps.userGroupStore,
    groupMembershipStore: deps.groupMembershipStore,
    folderPolicyStore: deps.folderPolicyStore,
    objectStore: deps.objectStore,
    auditOutbox: deps.securityAuditOutbox,
    cleanupCoordinator: new ObjectStoreRevocationCleanupCoordinator(deps.objectStore)
  })
}

function resourceGroupMutationError(
  c: Context<AppEnv>,
  error: unknown,
  hideDenied: boolean,
  startedAtMs = Date.now()
) {
  if (error instanceof ResourceGroupLifecycleError) {
    if (error.result === "denied") {
      return hideDenied
        ? resourceUnavailable(c, startedAtMs)
        : c.json({ error: "Forbidden" }, 403)
    }
    if (error.result === "conflict") return c.json({ error: "Resource group conflict" }, 409)
  }
  return c.json({ error: "Resource group lifecycle unavailable" }, 503)
}

async function resourceUnavailable(c: Context<AppEnv>, startedAtMs: number) {
  await settleNonEnumerationTiming(startedAtMs)
  const response = publicResourceUnavailable()
  for (const [name, value] of Object.entries(response.headers)) c.header(name, value)
  return c.json(response.body, response.status)
}

function publicMembershipState(groupId: string, state: VersionedMembershipState) {
  return {
    groupId,
    version: state.version,
    memberships: state.memberships.map((membership) => ({
      memberType: membership.memberType,
      memberId: membership.memberId,
      permissionLevel: membership.permissionLevel
    }))
  }
}
