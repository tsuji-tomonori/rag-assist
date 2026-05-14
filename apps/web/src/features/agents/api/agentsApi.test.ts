import { beforeEach, describe, expect, it, vi } from "vitest"
import { cancelAsyncAgentRun, createAsyncAgentRun, listAgentProviders, listAsyncAgentRuns } from "./agentsApi.js"
import type { AsyncAgentRun } from "../types.js"

function mockFetch(response: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    json: vi.fn().mockResolvedValue(response),
    text: vi.fn().mockResolvedValue(typeof response === "string" ? response : JSON.stringify(response))
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

const run: AsyncAgentRun = {
  agentRunId: "agent-run-1",
  runId: "agent-run-1",
  tenantId: "tenant-1",
  requesterUserId: "user-1",
  provider: "claude_code",
  modelId: "claude-sonnet",
  status: "blocked",
  providerAvailability: "not_configured",
  failureReasonCode: "not_configured",
  failureReason: "provider credential is not configured",
  instruction: "README を更新して",
  selectedFolderIds: ["folder-1"],
  selectedDocumentIds: [],
  selectedSkillIds: [],
  selectedAgentProfileIds: [],
  workspaceId: "workspace-1",
  workspaceMounts: [],
  artifactIds: [],
  artifacts: [],
  createdBy: "user-1",
  createdAt: "2026-05-14T00:00:00.000Z",
  updatedAt: "2026-05-14T00:00:00.000Z"
}

describe("agentsApi", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "/api")
  })

  it("lists providers and runs without inserting fallback product data", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ providers: [{ provider: "claude_code", displayName: "Claude Code", availability: "not_configured", configuredModelIds: [] }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ agentRuns: [run] }) })

    vi.stubGlobal("fetch", fetchMock)

    await expect(listAgentProviders()).resolves.toEqual([{ provider: "claude_code", displayName: "Claude Code", availability: "not_configured", configuredModelIds: [] }])
    await expect(listAsyncAgentRuns()).resolves.toEqual([run])
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/agents/providers", { headers: {} })
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/agents/runs", { headers: {} })
  })

  it("returns empty arrays when API omits optional list fields", async () => {
    mockFetch({})

    await expect(listAgentProviders()).resolves.toEqual([])
    await expect(listAsyncAgentRuns()).resolves.toEqual([])
  })

  it("posts create and cancel requests to provider-neutral agent run endpoints", async () => {
    const fetchMock = mockFetch(run)

    await expect(createAsyncAgentRun({
      provider: "codex",
      modelId: "gpt-5.4",
      instruction: "テストを追加して",
      selectedFolderIds: ["folder-1"],
      selectedDocumentIds: ["doc-1"]
    })).resolves.toEqual(run)
    await expect(cancelAsyncAgentRun("agent run/1")).resolves.toEqual(run)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/agents/runs",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "codex",
          modelId: "gpt-5.4",
          instruction: "テストを追加して",
          selectedFolderIds: ["folder-1"],
          selectedDocumentIds: ["doc-1"]
        })
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/agents/runs/agent%20run%2F1/cancel",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({})
      })
    )
  })
})
