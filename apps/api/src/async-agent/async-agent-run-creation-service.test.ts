import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import type { AppUser } from "../auth.js"
import type { AsyncAgentRun } from "../types.js"
import {
  AsyncAgentRunCreationService,
  createAsyncAgentRunId,
  type AsyncAgentRunCreationServicePorts,
  type CreateAsyncAgentRunInput
} from "./async-agent-run-creation-service.js"

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const serviceSource = readFileSync(path.join(sourceRoot, "async-agent/async-agent-run-creation-service.ts"), "utf8")
const facadeSource = readFileSync(path.join(sourceRoot, "rag/memorag-service.ts"), "utf8")

test("run creation is isolated behind narrow ports and facade delegates", () => {
  assert.doesNotMatch(serviceSource, /Dependencies|MemoRagService|config\.|@aws-sdk|objectStore|\.execute\(/)
  assert.match(serviceSource, /Pick<AsyncAgentRunRepository, "save">/)
  assert.match(facadeSource, /private readonly asyncAgentRunCreationService: AsyncAgentRunCreationService/)
  assert.match(facadeSource, /this\.asyncAgentRunCreationService = new AsyncAgentRunCreationService/)
  assert.match(facadeSource, /createAsyncAgentRun\([^}]+this\.asyncAgentRunCreationService\.create/s)
})

test("selection denial stops clock, IDs, provider lookup, and save", async () => {
  const denial = new Error("Forbidden")
  const effects: string[] = []
  const service = fixture({
    authorizeSelections: async () => {
      effects.push("authorize")
      throw denial
    },
    now: () => { effects.push("clock"); return timestamp },
    createRunId: () => { effects.push("run-id"); return "agent-a" },
    findProvider: () => { effects.push("provider"); return provider("available") },
    save: async () => { effects.push("save") }
  }).service

  await assert.rejects(() => service.create(actor, input()), (error) => error === denial)
  assert.deepEqual(effects, ["authorize"])
})

test("available provider creates one canonical queued run with unique read-only mounts", async () => {
  const { service, saved, effects } = fixture()
  const run = await service.create(actor, input({
    selectedFolderIds: [" folder-b ", "folder-a", "folder-b"],
    selectedDocumentIds: ["doc-b", "", "doc-a", "doc-b"],
    selectedSkillIds: ["skill-b", "skill-a", "skill-b"],
    selectedAgentProfileIds: ["profile-b", "profile-a", "profile-b"],
    budget: { maxToolCalls: 3 }
  }))

  assert.equal(run.status, "queued")
  assert.equal(run.completedAt, undefined)
  assert.equal(run.tenantId, "tenant-a")
  assert.equal(run.requesterUserId, actor.userId)
  assert.deepEqual(run.requesterGroups, actor.cognitoGroups)
  assert.deepEqual(run.selectedFolderIds, ["folder-a", "folder-b"])
  assert.deepEqual(run.selectedDocumentIds, ["doc-a", "doc-b"])
  assert.deepEqual(run.selectedSkillIds, ["skill-a", "skill-b"])
  assert.deepEqual(run.selectedAgentProfileIds, ["profile-a", "profile-b"])
  assert.deepEqual(run.workspaceMounts.map(({ mountId, sourceType, sourceId, mountedPath, accessMode }) => ({ mountId, sourceType, sourceId, mountedPath, accessMode })), [
    { mountId: "mount-1", sourceType: "folder", sourceId: "folder-a", mountedPath: "/workspace/read-only/folders/folder-a", accessMode: "readOnly" },
    { mountId: "mount-2", sourceType: "folder", sourceId: "folder-b", mountedPath: "/workspace/read-only/folders/folder-b", accessMode: "readOnly" },
    { mountId: "mount-3", sourceType: "document", sourceId: "doc-a", mountedPath: "/workspace/read-only/documents/doc-a", accessMode: "readOnly" },
    { mountId: "mount-4", sourceType: "document", sourceId: "doc-b", mountedPath: "/workspace/read-only/documents/doc-b", accessMode: "readOnly" }
  ])
  assert.deepEqual(run.artifacts, [])
  assert.deepEqual(saved, [run])
  assert.deepEqual(effects, ["authorize", "clock", "run-id", "provider", "tenant", "mount", "mount", "mount", "mount", "save"])
})

test("unavailable provider states remain blocked without mock artifacts", async () => {
  for (const [availability, failureReasonCode] of [
    ["disabled", "not_configured"],
    ["not_configured", "not_configured"],
    ["provider_unavailable", "provider_unavailable"],
    [undefined, "provider_unavailable"]
  ] as const) {
    const { service } = fixture({ availability })
    const run = await service.create(actor, input())
    assert.equal(run.status, "blocked")
    assert.equal(run.providerAvailability, availability ?? "provider_unavailable")
    assert.equal(run.failureReasonCode, failureReasonCode)
    assert.equal(run.completedAt, timestamp)
    assert.deepEqual(run.artifacts, [])
    assert.deepEqual(run.artifactIds, [])
    assert.match(run.failureReason ?? "", availability === "disabled" || availability === "not_configured" ? /not configured/i : /unavailable/i)
  }
})

test("save failure propagates and createAsyncAgentRunId keeps the canonical format", async () => {
  const failure = new Error("store unavailable")
  const service = fixture({ save: async () => { throw failure } }).service
  await assert.rejects(() => service.create(actor, input()), (error) => error === failure)
  assert.match(createAsyncAgentRunId(timestamp), /^agent_20260718T005100Z_[a-f0-9-]{8}$/)
})

const timestamp = "2026-07-18T00:51:00.000Z"
const actor: AppUser = { userId: "user-a", email: "user-a@example.com", tenantId: "tenant-a", cognitoGroups: ["ASYNC_AGENT_USER"], accountStatus: "active" }

function input(overrides: Partial<CreateAsyncAgentRunInput> = {}): CreateAsyncAgentRunInput {
  return { provider: "custom", modelId: "model-a", instruction: "inspect", ...overrides }
}

function provider(availability: "available" | "disabled" | "not_configured" | "provider_unavailable") {
  return { provider: "custom" as const, displayName: "Custom", availability, configuredModelIds: [] }
}

function fixture(overrides: {
  authorizeSelections?: AsyncAgentRunCreationServicePorts["authorizeSelections"]
  now?: AsyncAgentRunCreationServicePorts["now"]
  createRunId?: AsyncAgentRunCreationServicePorts["createRunId"]
  findProvider?: AsyncAgentRunCreationServicePorts["findProvider"]
  save?: (run: AsyncAgentRun) => Promise<void>
  availability?: "available" | "disabled" | "not_configured" | "provider_unavailable"
} = {}) {
  const saved: AsyncAgentRun[] = []
  const effects: string[] = []
  let mount = 0
  const service = new AsyncAgentRunCreationService({
    authorizeSelections: overrides.authorizeSelections ?? (async () => { effects.push("authorize") }),
    now: overrides.now ?? (() => { effects.push("clock"); return timestamp }),
    createRunId: overrides.createRunId ?? (() => { effects.push("run-id"); return "agent-a" }),
    findProvider: overrides.findProvider ?? (() => {
      effects.push("provider")
      return overrides.availability === undefined && "availability" in overrides ? undefined : provider(overrides.availability ?? "available")
    }),
    tenantIdForActor: (candidate) => { effects.push("tenant"); return candidate.tenantId ?? "default" },
    createMountId: () => { effects.push("mount"); return `mount-${++mount}` },
    runRepository: {
      save: overrides.save ?? (async (run) => { effects.push("save"); saved.push(run) })
    }
  })
  return { service, saved, effects }
}
