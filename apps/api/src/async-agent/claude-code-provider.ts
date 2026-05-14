import { config } from "../config.js"
import type { AgentRuntimeProvider } from "../types.js"
import { CommandAsyncAgentProvider } from "./command-provider.js"
import { AsyncAgentProviderRegistry, type AsyncAgentProviderAdapter } from "./provider.js"

const claudeCodeProvider: AgentRuntimeProvider = "claude_code"
const codexProvider: AgentRuntimeProvider = "codex"

export function createDefaultAsyncAgentProviderRegistry(): AsyncAgentProviderRegistry {
  return new AsyncAgentProviderRegistry([
    new CommandAsyncAgentProvider({
      provider: claudeCodeProvider,
      displayName: "Claude Code",
      commandEnvName: "CLAUDE_CODE_COMMAND",
      command: config.claudeCodeCommand,
      modelIds: config.claudeCodeModelIds,
      timeoutMs: config.claudeCodeTimeoutMs,
      outputFileName: "claude-code-output.md"
    }),
    new CommandAsyncAgentProvider({
      provider: codexProvider,
      displayName: "Codex",
      commandEnvName: "CODEX_COMMAND",
      command: config.codexCommand,
      modelIds: config.codexModelIds,
      timeoutMs: config.codexTimeoutMs,
      outputFileName: "codex-output.md"
    }),
    staticUnavailableProvider("opencode", "OpenCode", "OpenCode provider credentials and workspace execution are not configured in G3."),
    staticUnavailableProvider("custom", "Custom", "Custom provider execution is disabled until a tenant provider adapter is configured.", "disabled")
  ])
}

function staticUnavailableProvider(
  provider: AgentRuntimeProvider,
  displayName: string,
  reason: string,
  availability: "disabled" | "not_configured" = "not_configured"
): AsyncAgentProviderAdapter {
  return {
    definition: () => ({ provider, displayName, availability, reason, configuredModelIds: [] }),
    execute: async () => ({ status: "failed", failureReason: reason })
  }
}
