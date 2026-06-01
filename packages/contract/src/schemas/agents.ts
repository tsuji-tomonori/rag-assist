import { z } from "zod"

export const AgentRuntimeProviderSchema = z.enum(["claude_code", "codex", "opencode", "custom"])
export const AgentProviderAvailabilitySchema = z.enum(["disabled", "not_configured", "provider_unavailable", "available"])

export const AgentModelSelectionSchema = z.object({
  provider: AgentRuntimeProviderSchema,
  modelId: z.string().min(1),
  modelDisplayName: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional()
})

export const AgentRunBudgetSchema = z.object({
  maxCost: z.number().nonnegative().optional(),
  maxDurationMinutes: z.number().int().positive().optional(),
  maxToolCalls: z.number().int().positive().optional()
})

export const AgentWorkspaceMountSchema = z.object({
  mountId: z.string(),
  workspaceId: z.string(),
  sourceType: z.enum(["folder", "document", "temporaryUpload", "artifact"]),
  sourceId: z.string(),
  originalFileName: z.string().optional(),
  mountedPath: z.string(),
  accessMode: z.enum(["readOnly", "writableCopy"]),
  permissionCheckedAt: z.string()
})

export const AgentArtifactSchema = z.object({
  artifactId: z.string(),
  agentRunId: z.string(),
  artifactType: z.enum(["file", "patch", "report", "markdown", "json", "log"]),
  fileName: z.string(),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  storageRef: z.string(),
  createdAt: z.string(),
  writebackStatus: z.enum(["not_requested", "pending_approval", "approved", "rejected", "applied"]).optional(),
  writebackTarget: z.object({
    sourceType: z.enum(["folder", "document"]),
    sourceId: z.string(),
    targetPath: z.string().optional()
  }).optional(),
  writebackRequestedBy: z.string().optional(),
  writebackRequestedAt: z.string().optional(),
  writebackReviewedBy: z.string().optional(),
  writebackReviewedAt: z.string().optional(),
  writebackAppliedBy: z.string().optional(),
  writebackAppliedAt: z.string().optional(),
  writebackDecisionReason: z.string().optional()
})

export const AgentProviderSettingSchema = z.object({
  provider: AgentRuntimeProviderSchema,
  displayName: z.string(),
  availability: AgentProviderAvailabilitySchema,
  credentialMode: z.enum(["environment", "not_configured", "disabled"]),
  configuredModelIds: z.array(z.string()),
  reason: z.string().optional()
})

export const SkillDefinitionSchema = z.object({
  skillId: z.string(),
  tenantId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  folderId: z.string(),
  markdownDocumentId: z.string(),
  version: z.string(),
  status: z.enum(["draft", "active", "archived"]),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const AgentProfileDefinitionSchema = z.object({
  agentProfileId: z.string(),
  tenantId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  folderId: z.string(),
  markdownDocumentId: z.string(),
  defaultSkillIds: z.array(z.string()),
  recommendedProvider: AgentRuntimeProviderSchema.optional(),
  recommendedModelId: z.string().optional(),
  version: z.string(),
  status: z.enum(["draft", "active", "archived"]),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const AgentExecutionPresetSchema = z.object({
  presetId: z.string(),
  ownerUserId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  provider: AgentRuntimeProviderSchema,
  modelId: z.string(),
  defaultFolderIds: z.array(z.string()),
  defaultSkillIds: z.array(z.string()),
  defaultAgentProfileIds: z.array(z.string()),
  defaultBudget: AgentRunBudgetSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const AsyncAgentRunStatusSchema = z.enum(["queued", "preparing_workspace", "running", "waiting_for_approval", "completed", "failed", "blocked", "cancelled", "expired"])

export const AsyncAgentRunSchema = z.object({
  agentRunId: z.string(),
  runId: z.string(),
  tenantId: z.string(),
  requesterUserId: z.string(),
  provider: AgentRuntimeProviderSchema,
  modelId: z.string(),
  status: AsyncAgentRunStatusSchema,
  providerAvailability: AgentProviderAvailabilitySchema,
  failureReasonCode: z.enum(["not_configured", "provider_unavailable", "cancelled", "execution_error"]).optional(),
  failureReason: z.string().optional(),
  instruction: z.string(),
  selectedFolderIds: z.array(z.string()),
  selectedDocumentIds: z.array(z.string()),
  selectedSkillIds: z.array(z.string()),
  selectedAgentProfileIds: z.array(z.string()),
  workspaceId: z.string(),
  workspaceMounts: z.array(AgentWorkspaceMountSchema),
  artifactIds: z.array(z.string()),
  artifacts: z.array(AgentArtifactSchema),
  budget: AgentRunBudgetSchema.optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  updatedAt: z.string()
})

export type AgentRuntimeProvider = z.infer<typeof AgentRuntimeProviderSchema>
export type AgentModelSelection = z.infer<typeof AgentModelSelectionSchema>
export type AsyncAgentRun = z.infer<typeof AsyncAgentRunSchema>
export type AgentWorkspaceMount = z.infer<typeof AgentWorkspaceMountSchema>
export type AgentArtifact = z.infer<typeof AgentArtifactSchema>
export type AgentProviderSetting = z.infer<typeof AgentProviderSettingSchema>
export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>
export type AgentProfileDefinition = z.infer<typeof AgentProfileDefinitionSchema>
export type AgentExecutionPreset = z.infer<typeof AgentExecutionPresetSchema>
