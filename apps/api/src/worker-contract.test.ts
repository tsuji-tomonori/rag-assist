import assert from "node:assert/strict"
import test from "node:test"
import { handler as chatRunWorkerHandler, toChatWorkerResult } from "./chat-run-worker.js"
import { handler as documentIngestRunWorkerHandler, toDocumentIngestWorkerResult } from "./document-ingest-run-worker.js"

test("chat run worker keeps missing runId as a validation error", async () => {
  await assert.rejects(() => chatRunWorkerHandler({ tenantId: "default" }), /tenantId and runId are required/)
})

test("document ingest run worker keeps missing runId as a validation error", async () => {
  await assert.rejects(() => documentIngestRunWorkerHandler({ tenantId: "default" }), /tenantId and runId are required/)
})

test("FR-091 revoked worker results use the versioned minimal response profile", () => {
  const common = {
    status: "failed" as const,
    createdBy: "user-1",
    tenantId: "tenant-a",
    error: "sensitive document title and policy detail",
    errorCode: "permission_revoked" as const,
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:01.000Z"
  }
  const chat = toChatWorkerResult({
    ...common,
    runId: "chat-run-1",
    question: "sensitive question",
    modelId: "model-a"
  })
  const ingest = toDocumentIngestWorkerResult({
    ...common,
    runId: "ingest-run-1",
    uploadId: "upload-1",
    objectKey: "secret/path.txt",
    purpose: "document",
    fileName: "secret-title.txt"
  })

  for (const result of [chat, ingest]) {
    assert.equal(result.status, "permission_revoked")
    assert.equal(result.responseProfileVersion, "resource-non-enumeration-v1")
    assert.deepEqual(result.error, { code: "permission_revoked", message: "permission_revoked", retryable: false })
    assert.doesNotMatch(JSON.stringify(result), /sensitive|secret|policy detail/u)
  }
})

test("FR-074 document ingest worker preserves a policy rejection as a terminal non-error outcome", () => {
  const result = toDocumentIngestWorkerResult({
    runId: "ingest-rejected-1",
    status: "rejected",
    createdBy: "user-1",
    tenantId: "tenant-a",
    uploadId: "upload-1",
    objectKey: "uploads/rejected.txt",
    purpose: "document",
    fileName: "rejected.txt",
    traceId: "ingest:document-1:version-1",
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:01.000Z"
  })

  assert.equal(result.status, "rejected")
  assert.equal(result.resultType, "succeeded")
  assert.equal(result.traceId, "ingest:document-1:version-1")
  assert.equal(result.error, undefined)
})
