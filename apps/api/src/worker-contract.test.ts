import assert from "node:assert/strict"
import test from "node:test"
import { handler as chatRunWorkerHandler } from "./chat-run-worker.js"
import { handler as documentIngestRunWorkerHandler } from "./document-ingest-run-worker.js"

test("chat run worker keeps missing runId as a validation error", async () => {
  await assert.rejects(() => chatRunWorkerHandler({}), /runId is required/)
})

test("document ingest run worker keeps missing runId as a validation error", async () => {
  await assert.rejects(() => documentIngestRunWorkerHandler({}), /runId is required/)
})
