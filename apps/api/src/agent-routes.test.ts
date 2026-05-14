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

test("async agent run read, cancel, and artifact detail endpoints keep metadata read-only", async () => {
  const createResponse = await app.request("/agents/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "custom",
      modelId: "custom-placeholder",
      instruction: "生成物を作らず状態だけ確認する"
    })
  })
  assert.equal(createResponse.status, 200)
  const created = await createResponse.json() as {
    agentRunId: string
    status: string
    providerAvailability: string
    failureReasonCode?: string
  }
  assert.equal(created.status, "blocked")
  assert.equal(created.providerAvailability, "disabled")
  assert.equal(created.failureReasonCode, "not_configured")

  const getResponse = await app.request(`/agents/runs/${encodeURIComponent(created.agentRunId)}`)
  assert.equal(getResponse.status, 200)
  const fetched = await getResponse.json() as { agentRunId: string; artifacts: unknown[]; workspaceMounts: unknown[] }
  assert.equal(fetched.agentRunId, created.agentRunId)
  assert.deepEqual(fetched.artifacts, [])
  assert.deepEqual(fetched.workspaceMounts, [])

  const cancelResponse = await app.request(`/agents/runs/${encodeURIComponent(created.agentRunId)}/cancel`, { method: "POST" })
  assert.equal(cancelResponse.status, 200)
  const cancelled = await cancelResponse.json() as { agentRunId: string; status: string; failureReasonCode?: string }
  assert.equal(cancelled.agentRunId, created.agentRunId)
  assert.equal(cancelled.status, "cancelled")
  assert.equal(cancelled.failureReasonCode, "cancelled")

  const missingRunResponse = await app.request("/agents/runs/missing-agent-run")
  assert.equal(missingRunResponse.status, 404)
  assert.deepEqual(await missingRunResponse.json(), { error: "Async agent run not found" })

  const missingCancelResponse = await app.request("/agents/runs/missing-agent-run/cancel", { method: "POST" })
  assert.equal(missingCancelResponse.status, 404)
  assert.deepEqual(await missingCancelResponse.json(), { error: "Async agent run not found" })

  const missingArtifactListResponse = await app.request("/agents/runs/missing-agent-run/artifacts")
  assert.equal(missingArtifactListResponse.status, 404)
  assert.deepEqual(await missingArtifactListResponse.json(), { error: "Async agent run not found" })

  const missingArtifactResponse = await app.request(`/agents/runs/${encodeURIComponent(created.agentRunId)}/artifacts/missing-artifact`)
  assert.equal(missingArtifactResponse.status, 404)
  assert.deepEqual(await missingArtifactResponse.json(), { error: "Async agent artifact not found" })
})
