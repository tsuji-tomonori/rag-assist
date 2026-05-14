import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { AgentRuntimeProviderDefinition, AsyncAgentRun } from "../types.js"
import { AsyncAgentWorkspace } from "./AsyncAgentWorkspace.js"

const provider = (overrides: Partial<AgentRuntimeProviderDefinition> = {}): AgentRuntimeProviderDefinition => ({
  provider: "claude_code",
  displayName: "Claude Code",
  availability: "not_configured",
  reason: "credential is missing",
  configuredModelIds: [],
  ...overrides
})

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

function renderWorkspace(overrides: Partial<Parameters<typeof AsyncAgentWorkspace>[0]> = {}) {
  const props: Parameters<typeof AsyncAgentWorkspace>[0] = {
    providers: [provider()],
    runs: [run()],
    loading: false,
    canRun: true,
    canCancel: true,
    onRefresh: vi.fn(),
    onCancel: vi.fn().mockResolvedValue(undefined),
    onBack: vi.fn(),
    ...overrides
  }
  render(<AsyncAgentWorkspace {...props} />)
  return props
}

describe("AsyncAgentWorkspace", () => {
  it("shows provider-not-configured and permission states without fake run or artifact data", () => {
    renderWorkspace({
      canRun: false,
      providers: [provider({ availability: "not_configured" })],
      runs: []
    })

    expect(screen.getByText("未設定")).toBeInTheDocument()
    expect(screen.getByText("provider は未設定です。G1 では本実行、workspace execution、writeback は利用できません。")).toBeInTheDocument()
    expect(screen.getByText("非同期エージェント実行権限がありません。")).toBeInTheDocument()
    expect(screen.getByText("run はまだありません。")).toBeInTheDocument()
    expect(screen.getByText("run を選択すると read-only metadata を表示します。")).toBeInTheDocument()
    expect(screen.queryByText("artifact-1")).not.toBeInTheDocument()
  })

  it("renders read-only blocked run metadata and disables cancel for non-running states", () => {
    renderWorkspace()

    const detail = screen.getByRole("region", { name: "Run詳細" })
    expect(within(detail).getByText("ブロック")).toBeInTheDocument()
    expect(within(detail).getByText("provider 未設定")).toBeInTheDocument()
    expect(within(detail).getByText("credential is missing")).toBeInTheDocument()
    expect(within(detail).getByRole("button", { name: "キャンセル" })).toBeDisabled()
  })

  it("refreshes, navigates back, selects another run, and cancels a running run", async () => {
    const onRefresh = vi.fn()
    const onBack = vi.fn()
    const onCancel = vi.fn().mockResolvedValue(undefined)
    renderWorkspace({
      onRefresh,
      onBack,
      onCancel,
      providers: [provider({ availability: "available", reason: undefined })],
      runs: [
        run({ agentRunId: "agent-run-1", runId: "agent-run-1", status: "completed", providerAvailability: "available", workspaceMounts: [{ mountId: "mount-1", workspaceId: "workspace-1", sourceType: "folder", sourceId: "folder-1", mountedPath: "/workspace/folder-1", accessMode: "readOnly", permissionCheckedAt: "2026-05-14T00:00:00.000Z" }], artifactIds: ["artifact-1"], artifacts: [{ artifactId: "artifact-1", agentRunId: "agent-run-1", artifactType: "markdown", fileName: "report.md", mimeType: "text/markdown", size: 12, storageRef: "s3://bucket/report.md", createdAt: "2026-05-14T00:00:00.000Z" }] }),
        run({ agentRunId: "agent-run-2", runId: "agent-run-2", status: "running", providerAvailability: "available", updatedAt: "2026-05-14T00:01:00.000Z" })
      ]
    })

    await userEvent.click(screen.getByRole("button", { name: "非同期エージェント情報を更新" }))
    await userEvent.click(screen.getByRole("button", { name: "チャットへ戻る" }))
    await userEvent.click(screen.getByRole("button", { name: "agent-run-2の詳細" }))
    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }))

    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledWith("agent-run-2")
    expect(within(screen.getByRole("region", { name: "Run詳細" })).getByText("実行中")).toBeInTheDocument()
  })
})
