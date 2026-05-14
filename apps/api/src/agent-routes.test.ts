import assert from "node:assert/strict"
import test from "node:test"
import app from "./app.js"

test("async agent providers report honest not configured state", async () => {
  const response = await app.request("/agents/providers")
  assert.equal(response.status, 200)
  const body = await response.json() as { providers: Array<{ provider: string; availability: string; configuredModelIds: string[] }> }

  assert.ok(body.providers.some((provider) => provider.provider === "claude_code" && provider.availability === "not_configured"))
  assert.ok(body.providers.every((provider) => provider.configuredModelIds.length === 0))
})

test("creating async agent run returns blocked metadata without mock artifacts", async () => {
  const response = await app.request("/agents/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "codex",
      modelId: "codex-placeholder",
      instruction: "仕様差分を確認する",
      selectedFolderIds: [],
      selectedDocumentIds: [],
      selectedSkillIds: [],
      selectedAgentProfileIds: []
    })
  })
  assert.equal(response.status, 200)
  const run = await response.json() as {
    agentRunId: string
    runId: string
    status: string
    providerAvailability: string
    failureReasonCode?: string
    artifacts: unknown[]
    artifactIds: string[]
    workspaceMounts: unknown[]
  }

  assert.equal(run.runId, run.agentRunId)
  assert.equal(run.status, "blocked")
  assert.equal(run.providerAvailability, "not_configured")
  assert.equal(run.failureReasonCode, "not_configured")
  assert.deepEqual(run.artifacts, [])
  assert.deepEqual(run.artifactIds, [])
  assert.deepEqual(run.workspaceMounts, [])

  const listResponse = await app.request("/agents/runs")
  assert.equal(listResponse.status, 200)
  const listBody = await listResponse.json() as { agentRuns: Array<{ agentRunId: string }> }
  assert.ok(listBody.agentRuns.some((item) => item.agentRunId === run.agentRunId))

  const artifactResponse = await app.request(`/agents/runs/${encodeURIComponent(run.agentRunId)}/artifacts`)
  assert.equal(artifactResponse.status, 200)
  assert.deepEqual(await artifactResponse.json(), { artifacts: [] })
})
