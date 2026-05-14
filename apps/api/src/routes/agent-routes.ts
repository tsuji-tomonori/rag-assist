import { z } from "@hono/zod-openapi"
import { hasPermission, requirePermission } from "../authorization.js"
import {
  AgentArtifactListResponseSchema,
  AgentArtifactSchema,
  AgentProviderListResponseSchema,
  AsyncAgentRunListResponseSchema,
  AsyncAgentRunSchema,
  CreateAsyncAgentRunRequestSchema,
  ErrorResponseSchema
} from "../schemas.js"
import type { ApiRouteContext } from "./route-context.js"
import { looseRoute, routeAuthorization, validJson, validParam } from "./route-utils.js"

const agentReadAuthorization = routeAuthorization({
  mode: "required",
  permission: "agent:read:self",
  conditionalPermissions: ["agent:read:managed"],
  operationKey: "agent.run.read",
  resourceCondition: "agentRunSelfOrManaged",
  notes: [
    "自分の AsyncAgentRun は agent:read:self で参照できます。管理対象 run の横断参照には agent:read:managed が必要です。",
    "run metadata と read-only artifact metadata のみ返し、provider raw workspace / credential は返しません。provider log は sanitized artifact metadata としてのみ扱います。"
  ]
})

const agentArtifactReadAuthorization = routeAuthorization({
  mode: "required",
  permission: "agent:artifact:download",
  conditionalPermissions: ["agent:read:managed"],
  operationKey: "agent.artifact.read",
  resourceCondition: "agentRunSelfOrManaged",
  notes: [
    "artifact API は read-only metadata だけを返します。download URL、writeback 適用、架空 artifact fallback は実装しません。",
    "対象 run は自分の run または agent:read:managed で管理対象として読める run に限定します。"
  ]
})

export function registerAgentRoutes({ app, service }: ApiRouteContext) {
  app.openapi(
    looseRoute({
      method: "get",
      path: "/agents/providers",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "agent:read:self",
        conditionalPermissions: ["agent:provider:manage"],
        operationKey: "agent.provider.read",
        resourceCondition: "none",
        notes: ["provider 一覧は設定状態だけを返します。credential、secret、実行可能 fallback は返しません。"]
      }),
      responses: {
        200: { description: "List async agent runtime providers and configuration status", content: { "application/json": { schema: AgentProviderListResponseSchema } } }
      }
    }),
    (c) => {
      requirePermission(c.get("user"), "agent:read:self")
      return c.json({ providers: service.listAgentRuntimeProviders() }, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/agents/runs",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "agent:run",
        operationKey: "agent.run.create",
        resourceCondition: "agentWorkspaceReadOnly",
        notes: [
          "選択 folder/document は readOnly 以上を service 層で確認します。writableCopy と writeback は scope-out です。",
          "provider が disabled / not configured / unavailable の場合、mock execution は作らず blocked run として返します。"
        ]
      }),
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateAsyncAgentRunRequestSchema } }
        }
      },
      responses: {
        200: { description: "Create an async agent run metadata record", content: { "application/json": { schema: AsyncAgentRunSchema } } },
        400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
        403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "agent:run")
      const body = validJson<z.infer<typeof CreateAsyncAgentRunRequestSchema>>(c)
      return c.json(await service.createAsyncAgentRun(user, body), 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/agents/runs",
      "x-memorag-authorization": agentReadAuthorization,
      responses: {
        200: { description: "List async agent runs readable by the caller", content: { "application/json": { schema: AsyncAgentRunListResponseSchema } } }
      }
    }),
    async (c) => {
      requirePermission(c.get("user"), "agent:read:self")
      return c.json({ agentRuns: await service.listAsyncAgentRuns(c.get("user")) }, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/agents/runs/{agentRunId}",
      "x-memorag-authorization": agentReadAuthorization,
      request: { params: z.object({ agentRunId: z.string().min(1) }) },
      responses: {
        200: { description: "Get async agent run metadata", content: { "application/json": { schema: AsyncAgentRunSchema } } },
        404: { description: "Async agent run not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      requirePermission(c.get("user"), "agent:read:self")
      const { agentRunId } = validParam<{ agentRunId: string }>(c)
      const run = await service.getAsyncAgentRun(c.get("user"), agentRunId)
      if (!run) return c.json({ error: "Async agent run not found" }, 404)
      return c.json(run, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/agents/runs/{agentRunId}/cancel",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "agent:cancel",
        conditionalPermissions: ["agent:read:managed"],
        operationKey: "agent.run.cancel",
        resourceCondition: "agentRunSelfOrManaged",
        notes: ["自分の run または agent:read:managed で読める管理対象 run だけを cancel できます。"]
      }),
      request: { params: z.object({ agentRunId: z.string().min(1) }) },
      responses: {
        200: { description: "Cancel async agent run", content: { "application/json": { schema: AsyncAgentRunSchema } } },
        404: { description: "Async agent run not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "agent:cancel")
      const { agentRunId } = validParam<{ agentRunId: string }>(c)
      if (!hasPermission(user, "agent:read:self") && !hasPermission(user, "agent:read:managed")) return c.json({ error: "Forbidden" }, 403)
      const run = await service.cancelAsyncAgentRun(user, agentRunId)
      if (!run) return c.json({ error: "Async agent run not found" }, 404)
      return c.json(run, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/agents/runs/{agentRunId}/artifacts",
      "x-memorag-authorization": agentArtifactReadAuthorization,
      request: { params: z.object({ agentRunId: z.string().min(1) }) },
      responses: {
        200: { description: "List async agent artifact metadata", content: { "application/json": { schema: AgentArtifactListResponseSchema } } },
        404: { description: "Async agent run not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      requirePermission(c.get("user"), "agent:artifact:download")
      const { agentRunId } = validParam<{ agentRunId: string }>(c)
      const artifacts = await service.listAsyncAgentArtifacts(c.get("user"), agentRunId)
      if (!artifacts) return c.json({ error: "Async agent run not found" }, 404)
      return c.json({ artifacts }, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/agents/runs/{agentRunId}/artifacts/{artifactId}",
      "x-memorag-authorization": agentArtifactReadAuthorization,
      request: { params: z.object({ agentRunId: z.string().min(1), artifactId: z.string().min(1) }) },
      responses: {
        200: { description: "Get async agent artifact metadata", content: { "application/json": { schema: AgentArtifactSchema } } },
        404: { description: "Async agent artifact not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      requirePermission(c.get("user"), "agent:artifact:download")
      const { agentRunId, artifactId } = validParam<{ agentRunId: string; artifactId: string }>(c)
      const artifact = await service.getAsyncAgentArtifact(c.get("user"), agentRunId, artifactId)
      if (!artifact) return c.json({ error: "Async agent artifact not found" }, 404)
      return c.json(artifact, 200)
    }
  )
}
