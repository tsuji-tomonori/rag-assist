import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { tenantPartitionId } from "../security/tenant-partition.js"
import { AsyncAgentArtifactRepository, type AsyncAgentArtifactRepositoryPorts } from "./async-agent-artifact-repository.js"

const sourceRoot = path.resolve(process.cwd(), "src")
const repositorySource = readFileSync(path.join(sourceRoot, "async-agent/async-agent-artifact-repository.ts"), "utf8")
const facadeSource = readFileSync(path.join(sourceRoot, "rag/memorag-service.ts"), "utf8")

test("artifact persistence is isolated behind narrow ports and facade delegates", () => {
  assert.doesNotMatch(repositorySource, /Dependencies|MemoRagService|config\.|@aws-sdk|authorization|provider\.js/)
  assert.match(repositorySource, /Pick<ObjectStore, "putText" \| "deleteObject">/)
  assert.match(facadeSource, /private readonly asyncAgentArtifactRepository: AsyncAgentArtifactRepository/)
  assert.match(facadeSource, /this\.asyncAgentArtifactRepository = new AsyncAgentArtifactRepository/)
  assert.doesNotMatch(facadeSource, /private async persistAsyncAgentArtifacts/)
  assert.doesNotMatch(facadeSource, /function (?:sanitizeArtifactFileName|asyncAgentArtifactPrefix)/)
})

test("persist maps provider artifacts and a nonblank log to canonical sanitized metadata", async () => {
  const fixture = createFixture()
  const artifacts = await fixture.repository.persist(
    { tenantId: "tenant-a", agentRunId: "run/with space" },
    [{ artifactType: "report", fileName: "__unsafe report?.md", mimeType: "text/markdown", text: "raw-secret", writebackStatus: "approved" }],
    "2026-07-17T14:00:00.000Z",
    "provider log"
  )
  const prefix = `agent-runs/${tenantPartitionId("tenant-a")}/runs/${encodeURIComponent("run/with space")}/artifacts/`

  assert.deepEqual(artifacts, [
    {
      artifactId: "artifact-1", agentRunId: "run/with space", artifactType: "report",
      fileName: "unsafe_report_.md", mimeType: "text/markdown", size: Buffer.byteLength("safe:raw-secret"),
      storageRef: `${prefix}artifact-1/unsafe_report_.md`, createdAt: "2026-07-17T14:00:00.000Z", writebackStatus: "approved"
    },
    {
      artifactId: "artifact-2", agentRunId: "run/with space", artifactType: "log",
      fileName: "provider-log.txt", mimeType: "text/plain", size: Buffer.byteLength("safe:provider log"),
      storageRef: `${prefix}artifact-2/provider-log.txt`, createdAt: "2026-07-17T14:00:00.000Z", writebackStatus: "not_requested"
    }
  ])
  assert.deepEqual(fixture.writes, artifacts.map((artifact, index) => ({ key: artifact.storageRef, text: index === 0 ? "safe:raw-secret" : "safe:provider log" })))
  assert.doesNotMatch(prefix, /tenant-a/)
})

test("blank logs are omitted and empty unsafe filenames use the honest fallback", async () => {
  const fixture = createFixture()
  const artifacts = await fixture.repository.persist(
    { tenantId: "tenant-a", agentRunId: "run" },
    [{ artifactType: "file", fileName: "???", mimeType: "text/plain", text: "x" }],
    "2026-07-17T14:00:00.000Z",
    "   "
  )
  assert.equal(artifacts.length, 1)
  assert.equal(artifacts[0]?.fileName, "artifact.txt")
  assert.equal(artifacts[0]?.writebackStatus, "not_requested")
})

test("the same raw run ID remains physically isolated by tenant", async () => {
  const fixture = createFixture()
  for (const tenantId of ["tenant-a", "tenant-b"]) {
    await fixture.repository.persist(
      { tenantId, agentRunId: "same" },
      [{ artifactType: "file", fileName: "a.txt", mimeType: "text/plain", text: tenantId }],
      "2026-07-17T14:00:00.000Z"
    )
  }
  assert.notEqual(fixture.writes[0]?.key, fixture.writes[1]?.key)
  assert.ok(fixture.writes.every(({ key }) => !key.includes("tenant-a") && !key.includes("tenant-b")))
})

test("persist failures propagate without implicit partial-write compensation", async () => {
  const failure = new Error("artifact store unavailable")
  const fixture = createFixture({ putFailureAt: 2, putFailure: failure })
  await assert.rejects(() => fixture.repository.persist(
    { tenantId: "tenant-a", agentRunId: "run" },
    [
      { artifactType: "file", fileName: "a.txt", mimeType: "text/plain", text: "a" },
      { artifactType: "file", fileName: "b.txt", mimeType: "text/plain", text: "b" }
    ],
    "2026-07-17T14:00:00.000Z"
  ), (error) => error === failure)
  assert.deepEqual(fixture.deletes, [])
})

test("cleanup deletes only supplied storage references and propagates delete failures", async () => {
  const fixture = createFixture()
  await fixture.repository.cleanup([{ storageRef: "one" }, { storageRef: "two" }])
  assert.deepEqual(fixture.deletes, ["one", "two"])

  const failure = new Error("delete unavailable")
  const failing = createFixture({ deleteFailure: failure })
  await assert.rejects(() => failing.repository.cleanup([{ storageRef: "blocked" }]), (error) => error === failure)
})

function createFixture(options: { putFailureAt?: number; putFailure?: Error; deleteFailure?: Error } = {}) {
  const writes: Array<{ key: string; text: string }> = []
  const deletes: string[] = []
  let artifactIndex = 0
  let putIndex = 0
  const ports: AsyncAgentArtifactRepositoryPorts = {
    objectStore: {
      async putText(key, text) {
        putIndex += 1
        if (putIndex === options.putFailureAt) throw options.putFailure
        writes.push({ key, text })
      },
      async deleteObject(key) {
        deletes.push(key)
        if (options.deleteFailure) throw options.deleteFailure
      }
    },
    createArtifactId: () => `artifact-${++artifactIndex}`,
    sanitizeText: (text) => `safe:${text}`
  }
  return { repository: new AsyncAgentArtifactRepository(ports), writes, deletes }
}
