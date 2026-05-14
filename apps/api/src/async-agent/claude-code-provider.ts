import { spawn } from "node:child_process"
import { config } from "../config.js"
import type { AgentRuntimeProvider } from "../types.js"
import {
  AsyncAgentProviderRegistry,
  sanitizeProviderText,
  type AsyncAgentProviderAdapter,
  type AsyncAgentProviderDefinition,
  type AsyncAgentProviderInput,
  type AsyncAgentProviderResult
} from "./provider.js"

const claudeCodeProvider: AgentRuntimeProvider = "claude_code"

export class ClaudeCodeCommandProvider implements AsyncAgentProviderAdapter {
  constructor(
    private readonly command: string,
    private readonly modelIds: readonly string[],
    private readonly timeoutMs: number
  ) {}

  definition(): AsyncAgentProviderDefinition {
    const configured = this.command.trim().length > 0
    return {
      provider: claudeCodeProvider,
      displayName: "Claude Code",
      availability: configured ? "available" : "not_configured",
      reason: configured
        ? "Claude Code provider command is configured. The worker sends a redacted JSON execution request to the configured command."
        : "CLAUDE_CODE_COMMAND is not configured. Claude Code provider execution is unavailable.",
      configuredModelIds: configured ? [...this.modelIds] : []
    }
  }

  async execute(input: AsyncAgentProviderInput): Promise<AsyncAgentProviderResult> {
    if (!this.command.trim()) {
      return {
        status: "failed",
        failureReason: "Claude Code provider is not configured."
      }
    }

    const timeoutMs = Math.min(input.budget?.maxDurationMinutes ? input.budget.maxDurationMinutes * 60_000 : this.timeoutMs, this.timeoutMs)
    const result = await runCommand(this.command, {
      agentRunId: input.agentRunId,
      requesterUserId: input.requesterUserId,
      provider: input.provider,
      modelId: input.modelId,
      instruction: input.instruction,
      workspaceId: input.workspaceId,
      workspaceMounts: input.workspaceMounts,
      selectedSkillIds: input.selectedSkillIds,
      selectedAgentProfileIds: input.selectedAgentProfileIds,
      budget: input.budget
    }, timeoutMs)

    const output = sanitizeProviderText(result.stdout)
    const errorOutput = sanitizeProviderText(result.stderr)
    if (result.timedOut) {
      return {
        status: "expired",
        failureReason: "Claude Code provider execution timed out.",
        logText: [output, errorOutput].filter(Boolean).join("\n")
      }
    }
    if (result.exitCode !== 0) {
      return {
        status: "failed",
        failureReason: `Claude Code provider exited with code ${result.exitCode}.`,
        logText: [output, errorOutput].filter(Boolean).join("\n")
      }
    }

    return {
      status: "completed",
      artifacts: output ? [
        {
          artifactType: "markdown",
          fileName: "claude-code-output.md",
          mimeType: "text/markdown",
          text: output,
          writebackStatus: "not_requested"
        }
      ] : [],
      logText: errorOutput
    }
  }
}

export function createDefaultAsyncAgentProviderRegistry(): AsyncAgentProviderRegistry {
  return new AsyncAgentProviderRegistry([
    new ClaudeCodeCommandProvider(
      config.claudeCodeCommand,
      config.claudeCodeModelIds,
      config.claudeCodeTimeoutMs
    ),
    staticUnavailableProvider("codex", "Codex", "Codex provider credentials and workspace execution are not configured in G2."),
    staticUnavailableProvider("opencode", "OpenCode", "OpenCode provider credentials and workspace execution are not configured in G2."),
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

async function runCommand(commandLine: string, request: unknown, timeoutMs: number): Promise<{
  stdout: string
  stderr: string
  exitCode: number | null
  timedOut: boolean
}> {
  const [command, ...args] = splitCommandLine(commandLine)
  if (!command) throw new Error("CLAUDE_CODE_COMMAND is empty")
  const child = spawn(command, args, {
    stdio: ["pipe", "pipe", "pipe"],
    shell: false
  })
  let stdout = ""
  let stderr = ""
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    child.kill("SIGTERM")
  }, timeoutMs)
  child.stdout.setEncoding("utf-8")
  child.stderr.setEncoding("utf-8")
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk)
  })
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk)
  })
  child.stdin.end(JSON.stringify(request))
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject)
    child.on("close", (code) => resolve(code))
  }).finally(() => clearTimeout(timeout))
  return { stdout, stderr, exitCode, timedOut }
}

function splitCommandLine(commandLine: string): string[] {
  return commandLine.trim().split(/\s+/).filter(Boolean)
}
