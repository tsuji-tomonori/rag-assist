import assert from "node:assert/strict"
import test from "node:test"
import { handler as asyncAgentRunWorkerHandler } from "./async-agent-run-worker.js"
import { handler as chatRunWorkerHandler } from "./chat-run-worker.js"
import { handler as documentIngestRunWorkerHandler } from "./document-ingest-run-worker.js"

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
