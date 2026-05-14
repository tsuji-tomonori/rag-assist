import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { cancelAsyncAgentRun, listAgentProviders, listAsyncAgentRuns } from "../api/agentsApi.js"
import type { AgentRuntimeProviderDefinition, AsyncAgentRun } from "../types.js"
import { useAsyncAgentRuns } from "./useAsyncAgentRuns.js"

vi.mock("../api/agentsApi.js", () => ({
  cancelAsyncAgentRun: vi.fn(),
  listAgentProviders: vi.fn(),
  listAsyncAgentRuns: vi.fn()
}))

const provider: AgentRuntimeProviderDefinition = {
  provider: "claude_code",
  displayName: "Claude Code",
  availability: "not_configured",
  reason: "credential is missing",
  configuredModelIds: []
}

const run = (overrides: Partial<AsyncAgentRun> = {}): AsyncAgentRun => ({
  agentRunId: "agent-run-1",
  runId: "agent-run-1",
  tenantId: "tenant-1",
  requesterUserId: "user-1",
  provider: "claude_code",
  modelId: "claude-sonnet",
  status: "blocked",
  providerAvailability: "not_configured",
  failureReasonCode: "not_configured",
  failureReason: "credential is missing",
  instruction: "README を更新して",
  selectedFolderIds: [],
  selectedDocumentIds: [],
  selectedSkillIds: [],
  selectedAgentProfileIds: [],
  workspaceId: "workspace-1",
  workspaceMounts: [],
  artifactIds: [],
  artifacts: [],
  createdBy: "user-1",
  createdAt: "2026-05-14T00:00:00.000Z",
  updatedAt: "2026-05-14T00:00:00.000Z",
  ...overrides
})

function createProps() {
  return {
    setLoading: vi.fn(),
    setError: vi.fn()
  }
}

describe("useAsyncAgentRuns", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listAsyncAgentRuns).mockResolvedValue([run()])
    vi.mocked(listAgentProviders).mockResolvedValue([provider])
    vi.mocked(cancelAsyncAgentRun).mockResolvedValue(run({ status: "cancelled", failureReasonCode: "cancelled" }))
  })

  it("refreshes provider and run metadata from the API", async () => {
    const props = createProps()
    const { result } = renderHook(() => useAsyncAgentRuns(props))

    await act(() => result.current.refreshAgentProviders())
    await act(() => result.current.refreshAgentRuns())

    expect(result.current.agentProviders).toEqual([provider])
    expect(result.current.agentRuns).toEqual([run()])
  })

  it("replaces a cancelled run and clears loading after the request", async () => {
    const props = createProps()
    const { result } = renderHook(() => useAsyncAgentRuns(props))

    await act(() => result.current.refreshAgentRuns())
    await act(() => result.current.onCancelAgentRun("agent-run-1"))

    expect(cancelAsyncAgentRun).toHaveBeenCalledWith("agent-run-1")
    expect(result.current.agentRuns[0]).toMatchObject({ agentRunId: "agent-run-1", status: "cancelled" })
    expect(props.setError).toHaveBeenCalledWith(null)
    expect(props.setLoading).toHaveBeenNthCalledWith(1, true)
    expect(props.setLoading).toHaveBeenLastCalledWith(false)
  })

  it("reports string cancel errors without mutating the existing run list", async () => {
    vi.mocked(cancelAsyncAgentRun).mockRejectedValueOnce("cancel failed")
    const props = createProps()
    const { result } = renderHook(() => useAsyncAgentRuns(props))

    await act(() => result.current.refreshAgentRuns())
    await act(() => result.current.onCancelAgentRun("agent-run-1"))

    expect(result.current.agentRuns[0]).toMatchObject({ agentRunId: "agent-run-1", status: "blocked" })
    expect(props.setError).toHaveBeenCalledWith("cancel failed")
    expect(props.setLoading).toHaveBeenLastCalledWith(false)
  })
})
