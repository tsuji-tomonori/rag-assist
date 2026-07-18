import assert from "node:assert/strict"
import test from "node:test"
import { ROLE_PERMISSION_CATALOG, UNASSIGNED_APPLICATION_PERMISSIONS } from "@memorag-mvp/contract/access-control"
import { ChatToolDefinitionSchema, ChatToolInvocationSchema } from "../schemas.js"
import { CHAT_TOOL_DEFINITIONS, RAG_CHAT_TOOL_NODE_MAPPINGS, RAG_IMPLEMENTED_TOOL_IDS, buildChatToolInvocationsFromTrace, getChatToolAuthorizationContractsForGraphNode, listEnabledChatToolDefinitions, resolveChatToolAuthorizationContracts } from "./tool-registry.js"

test("chat tool registry exposes implemented RAG tools with permission, approval, audit, and trace metadata", () => {
  const enabled = listEnabledChatToolDefinitions()

  assert.deepEqual(enabled.map((tool) => tool.toolId).sort(), [...RAG_IMPLEMENTED_TOOL_IDS].sort())
  for (const definition of enabled) {
    assert.equal(ChatToolDefinitionSchema.safeParse(definition).success, true)
    assert.equal(definition.category, "rag")
    assert.equal(definition.enabled, true)
    assert.equal(definition.approvalRequired, false)
    assert.equal(definition.auditRequired, true)
    assert.equal(definition.requiredResourcePermission, "readOnly")
    assert.ok(definition.requiredFeaturePermission.length > 0)
    assert.ok(definition.traceLabels.length > 0)
  }
})

test("enabled RAG tools use canonical feature permissions granted to CHAT_USER", () => {
  const enabled = listEnabledChatToolDefinitions()
  const canonicalPermissions = new Set<string>([
    ...Object.values(ROLE_PERMISSION_CATALOG).flat(),
    ...UNASSIGNED_APPLICATION_PERMISSIONS
  ])
  const chatUserPermissions = new Set<string>(ROLE_PERMISSION_CATALOG.CHAT_USER)

  assert.deepEqual(
    enabled.filter((tool) => !canonicalPermissions.has(tool.requiredFeaturePermission)).map((tool) => tool.toolId),
    [],
    "enabled tool permissions must exist in the canonical application permission catalog"
  )
  assert.deepEqual(
    enabled.filter((tool) => !chatUserPermissions.has(tool.requiredFeaturePermission)).map((tool) => tool.toolId),
    [],
    "enabled graph-backed tools must not exceed the current CHAT_USER feature grant"
  )
  assert.deepEqual(
    enabled.filter((tool) => tool.requiredFeaturePermission !== "chat:create").map((tool) => tool.toolId),
    [],
    "all enabled graph-backed tools execute within the current chat:create boundary"
  )
})

test("non-RAG and follow-up dependent tools remain disabled metadata, not executable placeholders", () => {
  const disabled = CHAT_TOOL_DEFINITIONS.filter((tool) => !tool.enabled)

  assert.ok(disabled.some((tool) => tool.toolId === "support.ticket.create"))
  assert.ok(disabled.some((tool) => tool.toolId === "quality.document.update_status"))
  assert.ok(disabled.some((tool) => tool.toolId === "external.webhook.post"))
  for (const definition of disabled) {
    assert.equal(ChatToolDefinitionSchema.safeParse(definition).success, true)
    assert.equal(definition.enabled, false)
    assert.ok(definition.disabledReason)
    assert.equal(definition.graphNodeLabels.length, 0)
    assert.equal(definition.traceLabels.length, 0)
  }
})

test("RAG tool node mappings fix existing graph trace labels without changing runtime policy", () => {
  const mapping = new Map(RAG_CHAT_TOOL_NODE_MAPPINGS.map((item) => [item.toolId, item.traceLabels]))

  assert.deepEqual(mapping.get("rag.decontextualize_query"), ["build_conversation_state", "decontextualize_query"])
  assert.deepEqual(mapping.get("rag.select_final_context"), ["rerank_chunks"])
  assert.deepEqual(mapping.get("rag.verify_answer_support"), ["verify_answer_support"])
  assert.deepEqual(mapping.get("rag.repair_supported_only"), ["verify_answer_support"])
})

test("debug trace steps can be projected into audit-oriented ChatToolInvocation metadata", () => {
  const invocations = buildChatToolInvocationsFromTrace({
    orchestrationRunId: "run-1",
    requesterUserId: "user-1",
    steps: [
      {
        id: 1,
        label: "decontextualize_query",
        status: "success",
        latencyMs: 12,
        summary: "standalone query を作成",
        output: { retrievalQueryCount: 2 },
        startedAt: "2026-05-14T00:00:00.000Z",
        completedAt: "2026-05-14T00:00:00.012Z"
      },
      {
        id: 2,
        label: "finalize_refusal",
        status: "warning",
        latencyMs: 1,
        summary: "回答不能を返却",
        startedAt: "2026-05-14T00:00:01.000Z",
        completedAt: "2026-05-14T00:00:01.001Z"
      }
    ]
  })

  assert.deepEqual(invocations.map((item) => item.toolId), ["rag.decontextualize_query", "rag.explain_unavailable"])
  for (const invocation of invocations) {
    assert.equal(ChatToolInvocationSchema.safeParse(invocation).success, true)
    assert.equal(invocation.status, "succeeded")
    assert.equal(invocation.requesterUserId, "user-1")
  }
})

test("FR-049 graph-node authorization validates every mapped enabled tool and deduplicates equivalent contracts", () => {
  assert.deepEqual(getChatToolAuthorizationContractsForGraphNode("rerank_chunks"), [{
    toolIds: ["rag.rerank", "rag.select_final_context"],
    requiredFeaturePermission: "chat:create",
    requiredResourcePermission: "readOnly"
  }])
  assert.deepEqual(getChatToolAuthorizationContractsForGraphNode("analyze_input"), [])

  for (const mapping of RAG_CHAT_TOOL_NODE_MAPPINGS) {
    for (const graphNodeLabel of mapping.traceLabels) {
      assert.ok(
        getChatToolAuthorizationContractsForGraphNode(graphNodeLabel)
          .some((contract) => contract.toolIds.includes(mapping.toolId)),
        `${mapping.toolId}:${graphNodeLabel} must be validated before node execution`
      )
    }
  }

  assert.throws(
    () => resolveChatToolAuthorizationContracts(["support.ticket.create"]),
    /enabled implemented RAG tool/
  )
  assert.throws(
    () => resolveChatToolAuthorizationContracts(["missing.tool"]),
    /enabled implemented RAG tool/
  )
})
