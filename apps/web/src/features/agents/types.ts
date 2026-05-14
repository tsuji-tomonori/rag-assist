export type AgentRuntimeProvider = "claude_code" | "codex" | "opencode" | "custom"
export type AgentProviderAvailability = "disabled" | "not_configured" | "provider_unavailable" | "available"
export type AsyncAgentRunStatus = "queued" | "preparing_workspace" | "running" | "waiting_for_approval" | "completed" | "failed" | "blocked" | "cancelled" | "expired"

export type AgentRuntimeProviderDefinition = {
  provider: AgentRuntimeProvider
  displayName: string
  availability: AgentProviderAvailability
  reason?: string
  configuredModelIds: string[]
}

export type AgentWorkspaceMount = {
  mountId: string
  workspaceId: string
  sourceType: "folder" | "document" | "temporaryUpload" | "artifact"
  sourceId: string
  originalFileName?: string
  mountedPath: string
  accessMode: "readOnly" | "writableCopy"
  permissionCheckedAt: string
}

export type AgentArtifact = {
  artifactId: string
  agentRunId: string
  artifactType: "file" | "patch" | "report" | "markdown" | "json" | "log"
  fileName: string
  mimeType: string
  size: number
  storageRef: string
  createdAt: string
  writebackStatus?: "not_requested" | "pending_approval" | "approved" | "rejected" | "applied"
}

export type AsyncAgentRun = {
  agentRunId: string
  runId: string
  tenantId: string
  requesterUserId: string
  provider: AgentRuntimeProvider
  modelId: string
  status: AsyncAgentRunStatus
  providerAvailability: AgentProviderAvailability
  failureReasonCode?: "not_configured" | "provider_unavailable" | "cancelled" | "execution_error"
  failureReason?: string
  instruction: string
  selectedFolderIds: string[]
  selectedDocumentIds: string[]
  selectedSkillIds: string[]
  selectedAgentProfileIds: string[]
  workspaceId: string
  workspaceMounts: AgentWorkspaceMount[]
  artifactIds: string[]
  artifacts: AgentArtifact[]
  createdBy: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  updatedAt: string
}
