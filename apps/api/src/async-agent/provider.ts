import type { AgentProviderAvailability, AgentRuntimeProvider, AgentRunBudget, AgentWorkspaceMount } from "../types.js"

export type AsyncAgentProviderDefinition = {
  provider: AgentRuntimeProvider
  displayName: string
  availability: AgentProviderAvailability
  reason?: string
  configuredModelIds: string[]
}

export type AsyncAgentProviderInput = {
  agentRunId: string
  requesterUserId: string
  provider: AgentRuntimeProvider
  modelId: string
  instruction: string
  workspaceId: string
  workspaceMounts: AgentWorkspaceMount[]
  selectedSkillIds: string[]
  selectedAgentProfileIds: string[]
  budget?: AgentRunBudget
}

export type AsyncAgentProviderArtifact = {
  artifactType: "file" | "patch" | "report" | "markdown" | "json" | "log"
  fileName: string
  mimeType: string
  text: string
  writebackStatus?: "not_requested" | "pending_approval" | "approved" | "rejected" | "applied"
}

export type AsyncAgentProviderSuccess = {
  status: "completed"
  artifacts: AsyncAgentProviderArtifact[]
  logText?: string
}

export type AsyncAgentProviderFailure = {
  status: "failed" | "expired"
  failureReason: string
  logText?: string
}

export type AsyncAgentProviderResult = AsyncAgentProviderSuccess | AsyncAgentProviderFailure

export interface AsyncAgentProviderAdapter {
  definition(): AsyncAgentProviderDefinition
  execute(input: AsyncAgentProviderInput): Promise<AsyncAgentProviderResult>
}

export class AsyncAgentProviderRegistry {
  private readonly providers: Map<AgentRuntimeProvider, AsyncAgentProviderAdapter>

  constructor(providers: AsyncAgentProviderAdapter[]) {
    this.providers = new Map(providers.map((provider) => [provider.definition().provider, provider]))
  }

  list(): AsyncAgentProviderDefinition[] {
    return [...this.providers.values()].map((provider) => provider.definition())
  }

  get(provider: AgentRuntimeProvider): AsyncAgentProviderAdapter | undefined {
    return this.providers.get(provider)
  }
}

export function sanitizeProviderText(text: string, additionalSecrets: readonly string[] = []): string {
  const secretValues = additionalSecrets.filter((value) => value.trim().length >= 4)
  let sanitized = text
  for (const secret of secretValues) {
    sanitized = sanitized.split(secret).join("[REDACTED]")
  }
  return sanitized
    .replace(/(AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|ANTHROPIC_API_KEY|CLAUDE_CODE_TOKEN|CODEX_TOKEN|OPENCODE_TOKEN|OPENAI_API_KEY|CODEX_API_KEY|OPENCODE_API_KEY)=\S+/g, "$1=[REDACTED]")
    .replace(/(X-Amz-Signature|X-Amz-Credential|X-Amz-Security-Token)=([^&\s]+)/g, "$1=[REDACTED]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]{12,}/g, "$1[REDACTED]")
    .replace(/(secret|token|api[_-]?key)(['":=\s]+)[A-Za-z0-9._~+/=-]{8,}/gi, "$1$2[REDACTED]")
}
