import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import type { AppUser } from "../auth.js"
import type { AsyncAgentRun } from "../types.js"
import { AsyncAgentRunQueryService, type AsyncAgentRunQueryServicePorts } from "./async-agent-run-query-service.js"

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const serviceSource = readFileSync(path.join(sourceRoot, "async-agent/async-agent-run-query-service.ts"), "utf8")
const facadeSource = readFileSync(path.join(sourceRoot, "rag/memorag-service.ts"), "utf8")

test("run query is isolated behind narrow ports and facade delegates", () => {
  assert.doesNotMatch(serviceSource, /Dependencies|MemoRagService|config\.|@aws-sdk|objectStore|provider|writeback/)
  assert.match(serviceSource, /Pick<AsyncAgentRunRepository, "list" \| "get">/)
  assert.match(facadeSource, /private readonly asyncAgentRunQueryService: AsyncAgentRunQueryService/)
  assert.match(facadeSource, /this\.asyncAgentRunQueryService = new AsyncAgentRunQueryService/)
  for (const method of ["listAsyncAgentRuns", "getAsyncAgentRun", "listAsyncAgentArtifacts", "getAsyncAgentArtifact"]) {
    assert.match(facadeSource, new RegExp(`${method}\\([^}]+this\\.asyncAgentRunQueryService`, "s"))
  }
})

test("list uses the authoritative tenant then filters, sorts, and limits readable runs", async () => {
  const actor = user("reader", "tenant-a")
  const runs = Array.from({ length: 103 }, (_, index) => run({
    agentRunId: `run-${index}`,
    runId: `run-${index}`,
    requesterUserId: index === 101 ? "hidden" : actor.userId,
    updatedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString()
  }))
  let listedTenant: string | undefined
  const service = createService({
    list: async (tenantId) => {
      listedTenant = tenantId
      return [...runs].reverse()
    }
  })

  const result = await service.list(actor)

  assert.equal(listedTenant, "tenant-a")
  assert.equal(result.length, 100)
  assert.equal(result[0]?.agentRunId, "run-102")
  assert.equal(result.some((candidate) => candidate.requesterUserId === "hidden"), false)
  assert.ok(result.every((candidate, index) => index === 0 || result[index - 1]!.updatedAt >= candidate.updatedAt))
})

test("get preserves missing non-enumeration and rejects same-tenant unreadable runs", async () => {
  const actor = user("reader", "tenant-a")
  let canReadCalls = 0
  const service = createService({
    get: async (_tenantId, agentRunId) => agentRunId === "missing"
      ? undefined
      : run({ agentRunId, runId: agentRunId, requesterUserId: agentRunId === "forbidden" ? "other" : actor.userId }),
    canGetRun: (_candidateActor, candidate) => {
      canReadCalls += 1
      return candidate.requesterUserId === actor.userId
    }
  })

  assert.equal(await service.get(actor, "missing"), undefined)
  assert.equal(canReadCalls, 0)
  await assert.rejects(
    () => service.get(actor, "forbidden"),
    (error: unknown) => error instanceof Error && error.message === "Forbidden" && (error as Error & { status?: number }).status === 403
  )
  assert.equal((await service.get(actor, "allowed"))?.agentRunId, "allowed")
})

test("query failures propagate without fallback or cross-tenant retry", async () => {
  const actor = user("reader", "tenant-a")
  const listFailure = new Error("list unavailable")
  await assert.rejects(() => createService({ list: async () => { throw listFailure } }).list(actor), (error) => error === listFailure)

  const getFailure = new Error("get unavailable")
  const tenants: string[] = []
  const service = createService({
    get: async (tenantId) => {
      tenants.push(tenantId)
      throw getFailure
    }
  })
  await assert.rejects(() => service.get(actor, "run-a"), (error) => error === getFailure)
  assert.deepEqual(tenants, ["tenant-a"])
})

test("artifact queries project only from an authorized run and preserve missing semantics", async () => {
  const actor = user("reader", "tenant-a")
  const artifact = {
    artifactId: "artifact-a",
    agentRunId: "run-a",
    artifactType: "report" as const,
    fileName: "report.md",
    mimeType: "text/markdown",
    size: 7,
    storageRef: "tenant-partition/run-a/report.md",
    createdAt: "2026-01-01T00:00:00.000Z",
    writebackStatus: "not_requested" as const
  }
  const service = createService({
    get: async (_tenantId, agentRunId) => agentRunId === "missing" ? undefined : run({ artifacts: [artifact], artifactIds: [artifact.artifactId] })
  })

  assert.deepEqual(await service.listArtifacts(actor, "run-a"), [artifact])
  assert.deepEqual(await service.getArtifact(actor, "run-a", "artifact-a"), artifact)
  assert.equal(await service.getArtifact(actor, "run-a", "missing-artifact"), undefined)
  assert.equal(await service.listArtifacts(actor, "missing"), undefined)
})

function createService(overrides: Partial<AsyncAgentRunQueryServicePorts["runRepository"]> & {
  canListRun?: AsyncAgentRunQueryServicePorts["canListRun"]
  canGetRun?: AsyncAgentRunQueryServicePorts["canGetRun"]
} = {}): AsyncAgentRunQueryService {
  return new AsyncAgentRunQueryService({
    runRepository: {
      list: overrides.list ?? (async () => []),
      get: overrides.get ?? (async () => undefined)
    },
    tenantIdForActor: (actor) => actor.tenantId ?? "",
    canListRun: overrides.canListRun ?? ((actor, candidate) => actor.userId === candidate.requesterUserId),
    canGetRun: overrides.canGetRun ?? ((actor, candidate) => actor.userId === candidate.requesterUserId)
  })
}

function user(userId: string, tenantId: string): AppUser {
  return { userId, tenantId, cognitoGroups: ["ASYNC_AGENT_USER"], accountStatus: "active" }
}

function run(overrides: Partial<AsyncAgentRun> = {}): AsyncAgentRun {
  return {
    agentRunId: "run-a",
    runId: "run-a",
    tenantId: "tenant-a",
    requesterUserId: "reader",
    requesterGroups: ["ASYNC_AGENT_USER"],
    provider: "custom",
    modelId: "model-a",
    status: "completed",
    providerAvailability: "available",
    instruction: "inspect",
    selectedFolderIds: [],
    selectedDocumentIds: [],
    selectedSkillIds: [],
    selectedAgentProfileIds: [],
    workspaceId: "workspace-a",
    workspaceMounts: [],
    artifactIds: [],
    artifacts: [],
    createdBy: "reader",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  }
}
