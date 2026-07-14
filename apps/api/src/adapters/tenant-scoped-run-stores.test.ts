import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalBenchmarkRunStore } from "./local-benchmark-run-store.js"
import { LocalChatRunEventStore } from "./local-chat-run-event-store.js"
import { LocalChatRunStore } from "./local-chat-run-store.js"
import { LocalDocumentIngestRunEventStore } from "./local-document-ingest-run-event-store.js"
import { LocalDocumentIngestRunStore } from "./local-document-ingest-run-store.js"
import type { BenchmarkRun, ChatRun, DocumentIngestRun } from "../types.js"

test("local run and event stores allow the same raw run ID without cross-tenant reads", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-tenant-runs-"))
  const chatRuns = new LocalChatRunStore(dataDir)
  const chatEvents = new LocalChatRunEventStore(dataDir)
  const ingestRuns = new LocalDocumentIngestRunStore(dataDir)
  const ingestEvents = new LocalDocumentIngestRunEventStore(dataDir)
  const benchmarkRuns = new LocalBenchmarkRunStore(dataDir)

  await chatRuns.create(chatRun("tenant-a"))
  await chatRuns.create(chatRun("tenant-b"))
  assert.equal((await chatRuns.get("tenant-a", "same-run"))?.question, "tenant-a question")
  assert.equal((await chatRuns.get("tenant-b", "same-run"))?.question, "tenant-b question")
  assert.equal(await chatRuns.get("tenant-c", "same-run"), undefined)
  await chatRuns.update("tenant-a", "same-run", { answer: "tenant-a answer" })
  assert.equal((await chatRuns.get("tenant-b", "same-run"))?.answer, undefined)

  await chatEvents.append("tenant-a", { runId: "same-run", type: "status", message: "tenant-a" })
  await chatEvents.append("tenant-b", { runId: "same-run", type: "status", message: "tenant-b" })
  assert.deepEqual((await chatEvents.listAfter("tenant-a", "same-run", 0)).map((event) => event.message), ["tenant-a"])
  assert.deepEqual((await chatEvents.listAfter("tenant-b", "same-run", 0)).map((event) => event.message), ["tenant-b"])

  await ingestRuns.create(ingestRun("tenant-a"))
  await ingestRuns.create(ingestRun("tenant-b"))
  assert.equal((await ingestRuns.get("tenant-a", "same-run"))?.objectKey, "tenant-a/upload")
  assert.equal((await ingestRuns.get("tenant-b", "same-run"))?.objectKey, "tenant-b/upload")
  assert.equal(await ingestRuns.get("tenant-c", "same-run"), undefined)
  await ingestEvents.append("tenant-a", { runId: "same-run", type: "status", message: "tenant-a" })
  await ingestEvents.append("tenant-b", { runId: "same-run", type: "status", message: "tenant-b" })
  assert.deepEqual((await ingestEvents.listAfter("tenant-a", "same-run", 0)).map((event) => event.message), ["tenant-a"])
  assert.deepEqual((await ingestEvents.listAfter("tenant-b", "same-run", 0)).map((event) => event.message), ["tenant-b"])

  await benchmarkRuns.create(benchmarkRun("tenant-a"))
  await benchmarkRuns.create(benchmarkRun("tenant-b"))
  assert.deepEqual((await benchmarkRuns.list("tenant-a")).map((run) => run.tenantId), ["tenant-a"])
  assert.deepEqual((await benchmarkRuns.list("tenant-b")).map((run) => run.tenantId), ["tenant-b"])
  assert.equal(await benchmarkRuns.get("tenant-c", "same-run"), undefined)
})

function chatRun(tenantId: string): ChatRun {
  return {
    runId: "same-run",
    tenantId,
    status: "queued",
    createdBy: "same-user",
    question: `${tenantId} question`,
    modelId: "model",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z"
  }
}

function ingestRun(tenantId: string): DocumentIngestRun {
  return {
    runId: "same-run",
    tenantId,
    status: "queued",
    createdBy: "same-user",
    uploadId: "upload",
    objectKey: `${tenantId}/upload`,
    purpose: "document",
    fileName: "document.txt",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z"
  }
}

function benchmarkRun(tenantId: string): BenchmarkRun {
  return {
    runId: "same-run",
    tenantId,
    status: "queued",
    mode: "agent",
    runner: "codebuild",
    suiteId: "suite",
    datasetS3Key: "dataset.jsonl",
    createdBy: "same-user",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z"
  }
}
