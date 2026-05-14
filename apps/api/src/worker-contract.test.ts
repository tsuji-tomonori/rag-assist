import assert from "node:assert/strict"
import test from "node:test"
import { handler as asyncAgentRunWorkerHandler } from "./async-agent-run-worker.js"
import { handler as chatRunWorkerHandler } from "./chat-run-worker.js"
import { createDependencies } from "./dependencies.js"
import { handler as documentIngestRunWorkerHandler } from "./document-ingest-run-worker.js"
import type { AsyncAgentRun } from "./types.js"

test("chat run worker keeps missing runId as a validation error", async () => {
  await assert.rejects(() => chatRunWorkerHandler({}), /runId is required/)
})

test("document ingest run worker keeps missing runId as a validation error", async () => {
  await assert.rejects(() => documentIngestRunWorkerHandler({}), /runId is required/)
})

test("async agent worker keeps missing runId as a validation error", async () => {
  await assert.rejects(() => asyncAgentRunWorkerHandler({}), /runId is required/)
})

test("async agent worker accepts agentRunId as the runId alias before execution lookup", async () => {
  await assert.rejects(
    () => asyncAgentRunWorkerHandler({ agentRunId: "agent_run_missing" }),
    /Async agent run not found: agent_run_missing/
  )
})

test("async agent worker preserves explicit async target type before execution lookup", async () => {
  await assert.rejects(
    () => asyncAgentRunWorkerHandler({ runId: "agent_run_missing_explicit", targetType: "async_agent_run" }),
    /Async agent run not found: agent_run_missing_explicit/
  )
})

test("async agent worker returns blocked and completed run results without provider execution", async () => {
  const deps = createDependencies()
  const now = "2026-05-14T00:00:00.000Z"
  const queuedRun: AsyncAgentRun = {
    agentRunId: "agent_worker_queued_fixture",
    runId: "agent_worker_queued_fixture",
    tenantId: "default",
    requesterUserId: "worker-owner",
    provider: "codex",
    modelId: "codex-placeholder",
    status: "queued",
    providerAvailability: "not_configured",
    instruction: "worker contract fixture",
    selectedFolderIds: [],
    selectedDocumentIds: [],
    selectedSkillIds: [],
    selectedAgentProfileIds: [],
    workspaceId: "workspace_agent_worker_queued_fixture",
    workspaceMounts: [],
    artifactIds: [],
    artifacts: [],
    createdBy: "worker-owner",
    createdAt: now,
    updatedAt: now
  }
  const completedRun: AsyncAgentRun = {
    ...queuedRun,
    agentRunId: "agent_worker_completed_fixture",
    runId: "agent_worker_completed_fixture",
    status: "completed",
    providerAvailability: "available",
    workspaceId: "workspace_agent_worker_completed_fixture",
    completedAt: now
  }
  const cancelledRun: AsyncAgentRun = {
    ...queuedRun,
    agentRunId: "agent_worker_cancelled_fixture",
    runId: "agent_worker_cancelled_fixture",
    status: "cancelled",
    failureReasonCode: "cancelled",
    workspaceId: "workspace_agent_worker_cancelled_fixture",
    completedAt: now
  }
  await deps.objectStore.putText("agent-runs/agent_worker_queued_fixture.json", JSON.stringify(queuedRun), "application/json; charset=utf-8")
  await deps.objectStore.putText("agent-runs/agent_worker_completed_fixture.json", JSON.stringify(completedRun), "application/json; charset=utf-8")
  await deps.objectStore.putText("agent-runs/agent_worker_cancelled_fixture.json", JSON.stringify(cancelledRun), "application/json; charset=utf-8")

  const blocked = await asyncAgentRunWorkerHandler({ agentRunId: queuedRun.agentRunId })
  assert.equal(blocked.runId, queuedRun.runId)
  assert.equal(blocked.targetType, "async_agent_run")
  assert.equal(blocked.status, "blocked")
  assert.equal(blocked.resultType, "failed")
  assert.equal(blocked.error?.code, "execution_error")

  const completed = await asyncAgentRunWorkerHandler({ runId: completedRun.runId })
  assert.equal(completed.runId, completedRun.runId)
  assert.equal(completed.status, "completed")
  assert.equal(completed.resultType, "succeeded")
  assert.equal(completed.error, undefined)

  const cancelled = await asyncAgentRunWorkerHandler({ runId: cancelledRun.runId })
  assert.equal(cancelled.status, "cancelled")
  assert.equal(cancelled.resultType, "failed")
  assert.equal(cancelled.error?.message, "cancelled")
})
