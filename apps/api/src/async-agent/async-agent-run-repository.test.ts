import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { tenantPartitionId } from "../security/tenant-partition.js"
import type { AsyncAgentRun } from "../types.js"
import {
  AsyncAgentRunRepository,
  type AsyncAgentRunRepositoryPort
} from "./async-agent-run-repository.js"

const sourceRoot = path.resolve(process.cwd(), "src")
const repositorySource = readFileSync(path.join(sourceRoot, "async-agent/async-agent-run-repository.ts"), "utf8")
const facadeSource = readFileSync(path.join(sourceRoot, "rag/memorag-service.ts"), "utf8")

test("async-agent run persistence is isolated behind a narrow object-store port", () => {
  assert.doesNotMatch(repositorySource, /Dependencies|MemoRagService|config\.|@aws-sdk|authorization|provider/)
  assert.match(repositorySource, /Pick<ObjectStore, "listKeys" \| "getText" \| "putText">/)
  assert.match(facadeSource, /private readonly asyncAgentRunRepository: AsyncAgentRunRepository/)
  assert.match(facadeSource, /this\.asyncAgentRunRepository = new AsyncAgentRunRepository\(deps\.objectStore\)/)
  assert.doesNotMatch(facadeSource, /private async (?:load|save)AsyncAgentRun/)
  assert.doesNotMatch(facadeSource, /function (?:asyncAgentRunPrefix|asyncAgentRunObjectKey|normalizeAsyncAgentRun|assertAsyncAgentTenant)/)
})

test("list uses the exact tenant prefix and reads only flat allowlisted run objects", async () => {
  const tenantId = "tenant-a"
  const prefix = `agent-runs/${tenantPartitionId(tenantId)}/runs/`
  const validKey = `${prefix}valid.json`
  const invalidKeys = [
    `${prefix}nested/run.json`,
    `${prefix}missing-extension`,
    `agent-runs/${tenantPartitionId("tenant-b")}/runs/cross-tenant.json`,
    "agent-runs/tenant:not-a-partition/runs/malformed.json"
  ]
  const reads: string[] = []
  let listedPrefix: string | undefined
  const repository = new AsyncAgentRunRepository({
    async listKeys(requestedPrefix) {
      listedPrefix = requestedPrefix
      return [validKey, ...invalidKeys]
    },
    async getText(key) {
      reads.push(key)
      if (key !== validKey) throw new Error(`unexpected read: ${key}`)
      return JSON.stringify(runFixture({ tenantId, agentRunId: "valid", runId: "valid" }))
    },
    async putText() {}
  })

  assert.deepEqual(await repository.list(tenantId), [runFixture({ tenantId, agentRunId: "valid", runId: "valid" })])
  assert.equal(listedPrefix, prefix)
  assert.deepEqual(reads, [validKey])
  assert.doesNotMatch(prefix, /tenant-a/)
})

test("same raw run ID is physically isolated by tenant and save uses the canonical JSON mapping", async () => {
  const store = new MemoryRunStore()
  const repository = new AsyncAgentRunRepository(store)
  const rawRunId = "same/run id"
  const tenantARun = runFixture({ tenantId: "tenant-a", agentRunId: rawRunId, runId: rawRunId, requesterUserId: "user-a" })
  const tenantBRun = runFixture({ tenantId: "tenant-b", agentRunId: rawRunId, runId: rawRunId, requesterUserId: "user-b" })

  await repository.save(tenantARun)
  await repository.save(tenantBRun)

  assert.equal((await repository.get("tenant-a", rawRunId))?.requesterUserId, "user-a")
  assert.equal((await repository.get("tenant-b", rawRunId))?.requesterUserId, "user-b")
  const expectedKeys = ["tenant-a", "tenant-b"].map(
    (tenantId) => `agent-runs/${tenantPartitionId(tenantId)}/runs/${encodeURIComponent(rawRunId)}.json`
  )
  assert.deepEqual([...store.values.keys()].sort(), expectedKeys.sort())
  assert.equal(store.puts[0]?.contentType, "application/json; charset=utf-8")
  assert.equal(store.puts[0]?.text, JSON.stringify(tenantARun, null, 2))
  assert.ok(expectedKeys.every((key) => !key.includes("tenant-a") && !key.includes("tenant-b")))
})

test("get and list preserve only the established legacy-compatible defaults", async () => {
  const tenantId = "tenant-normalize"
  const raw: Partial<AsyncAgentRun> = runFixture({ tenantId, agentRunId: "legacy-shape", runId: "legacy-shape" })
  delete raw.runId
  delete raw.workspaceMounts
  delete raw.artifactIds
  delete raw.artifacts
  const key = `agent-runs/${tenantPartitionId(tenantId)}/runs/legacy-shape.json`
  const repository = new AsyncAgentRunRepository({
    async listKeys() { return [key] },
    async getText(requestedKey) {
      if (requestedKey === key) return JSON.stringify(raw)
      throw missingError()
    },
    async putText() {}
  })
  const expected = { ...raw, runId: "legacy-shape", workspaceMounts: [], artifactIds: [], artifacts: [] }

  assert.deepEqual(await repository.get(tenantId, "legacy-shape"), expected)
  assert.deepEqual(await repository.list(tenantId), [expected])
})

test("decoded tenant mismatches fail closed for get and list", async () => {
  const tenantId = "tenant-requested"
  const key = `agent-runs/${tenantPartitionId(tenantId)}/runs/crossed.json`
  const repository = new AsyncAgentRunRepository({
    async listKeys() { return [key] },
    async getText() { return JSON.stringify(runFixture({ tenantId: "tenant-stored", agentRunId: "crossed", runId: "crossed" })) },
    async putText() {}
  })

  await assert.rejects(() => repository.get(tenantId, "crossed"), /tenant storage integrity mismatch/)
  await assert.rejects(() => repository.list(tenantId), /tenant storage integrity mismatch/)
})

test("scoped and legacy missing variants resolve to absence", async () => {
  const missingVariants = [
    Object.assign(new Error("object missing"), { Code: "NoSuchKey" }),
    Object.assign(new Error("object missing"), { code: "ENOENT" }),
    Object.assign(new Error("object missing"), { name: "NoSuchKey" }),
    Object.assign(new Error("object missing"), { name: "NotFound" }),
    Object.assign(new Error("object missing"), { $metadata: { httpStatusCode: 404 } }),
    new Error("NoSuchKey: object missing"),
    new Error("ENOENT: object missing")
  ]

  for (const missing of missingVariants) {
    const repository = new AsyncAgentRunRepository({
      async listKeys() { return [] },
      async getText() { throw missing },
      async putText() {}
    })
    assert.equal(await repository.get("tenant-a", "absent"), undefined)
  }
})

test("a legacy unscoped object fails closed with the scoped missing error as cause", async () => {
  const scopedMissing = missingError()
  const legacyKey = "agent-runs/legacy-run.json"
  const repository = new AsyncAgentRunRepository({
    async listKeys() { return [] },
    async getText(key) {
      if (key === legacyKey) return JSON.stringify(runFixture({ agentRunId: "legacy-run", runId: "legacy-run" }))
      throw scopedMissing
    },
    async putText() {}
  })

  await assert.rejects(
    () => repository.get("default", "legacy-run"),
    (error: unknown) => error instanceof Error
      && error.message === "Legacy unscoped async agent run requires tenant migration"
      && error.cause === scopedMissing
  )
})

test("non-missing scoped, legacy, and parse errors propagate without becoming absence", async () => {
  const scopedFailure = new Error("scoped store unavailable")
  const scopedRepository = new AsyncAgentRunRepository(failingGetPort(() => { throw scopedFailure }))
  await assert.rejects(() => scopedRepository.get("tenant-a", "run"), (error) => error === scopedFailure)

  const legacyFailure = new Error("legacy store unavailable")
  const legacyRepository = new AsyncAgentRunRepository(failingGetPort((key) => {
    if (key.startsWith("agent-runs/tenant:")) throw missingError()
    throw legacyFailure
  }))
  await assert.rejects(() => legacyRepository.get("tenant-a", "run"), (error) => error === legacyFailure)

  const parseRepository = new AsyncAgentRunRepository(failingGetPort(() => "{"))
  await assert.rejects(() => parseRepository.get("tenant-a", "run"), SyntaxError)
})

class MemoryRunStore implements AsyncAgentRunRepositoryPort {
  readonly values = new Map<string, string>()
  readonly puts: Array<{ key: string; text: string; contentType?: string }> = []

  async listKeys(prefix: string): Promise<string[]> {
    return [...this.values.keys()].filter((key) => key.startsWith(prefix))
  }

  async getText(key: string): Promise<string> {
    const value = this.values.get(key)
    if (value === undefined) throw missingError()
    return value
  }

  async putText(key: string, text: string, contentType?: string): Promise<void> {
    this.puts.push({ key, text, contentType })
    this.values.set(key, text)
  }
}

function failingGetPort(getText: (key: string) => string): AsyncAgentRunRepositoryPort {
  return {
    async listKeys() { return [] },
    async getText(key) { return getText(key) },
    async putText() {}
  }
}

function missingError(): Error {
  return Object.assign(new Error("NoSuchKey: object missing"), { name: "NoSuchKey" })
}

function runFixture(overrides: Partial<AsyncAgentRun> = {}): AsyncAgentRun {
  return {
    agentRunId: "agent-run",
    runId: "agent-run",
    tenantId: "default",
    requesterUserId: "requester",
    provider: "custom",
    modelId: "model",
    status: "queued",
    providerAvailability: "available",
    instruction: "analyze",
    selectedFolderIds: [],
    selectedDocumentIds: [],
    selectedSkillIds: [],
    selectedAgentProfileIds: [],
    workspaceId: "workspace-agent-run",
    workspaceMounts: [],
    artifactIds: [],
    artifacts: [],
    createdBy: "requester",
    createdAt: "2026-07-17T10:00:00.000Z",
    updatedAt: "2026-07-17T10:00:00.000Z",
    ...overrides
  }
}
