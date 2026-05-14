import { spawn } from "node:child_process"
import type { AgentRuntimeProvider } from "../types.js"
import {
  sanitizeProviderText,
  type AsyncAgentProviderAdapter,
  type AsyncAgentProviderDefinition,
  type AsyncAgentProviderInput,
  type AsyncAgentProviderResult
} from "./provider.js"

export type CommandAsyncAgentProviderOptions = {
  provider: AgentRuntimeProvider
  displayName: string
  commandEnvName: string
  command: string
  modelIds: readonly string[]
  timeoutMs: number
  outputFileName: string
}

export class CommandAsyncAgentProvider implements AsyncAgentProviderAdapter {
  constructor(private readonly options: CommandAsyncAgentProviderOptions) {}

  definition(): AsyncAgentProviderDefinition {
    const configured = this.options.command.trim().length > 0
    return {
      provider: this.options.provider,
      displayName: this.options.displayName,
      availability: configured ? "available" : "not_configured",
      reason: configured
        ? `${this.options.displayName} provider command is configured. The worker sends a redacted JSON execution request to the configured command.`
        : `${this.options.commandEnvName} is not configured. ${this.options.displayName} provider execution is unavailable.`,
      configuredModelIds: configured ? [...this.options.modelIds] : []
    }
  }

  async execute(input: AsyncAgentProviderInput): Promise<AsyncAgentProviderResult> {
    if (!this.options.command.trim()) {
      return {
        status: "failed",
        failureReason: `${this.options.displayName} provider is not configured.`
      }
    }

    const timeoutMs = Math.min(input.budget?.maxDurationMinutes ? input.budget.maxDurationMinutes * 60_000 : this.options.timeoutMs, this.options.timeoutMs)
    const result = await runCommand(this.options.command, {
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
    }, timeoutMs, this.options.commandEnvName)

    const output = sanitizeProviderText(result.stdout)
    const errorOutput = sanitizeProviderText(result.stderr)
    if (result.timedOut) {
      return {
        status: "expired",
        failureReason: `${this.options.displayName} provider execution timed out.`,
        logText: [output, errorOutput].filter(Boolean).join("\n")
      }
    }
    if (result.exitCode !== 0) {
      return {
        status: "failed",
        failureReason: `${this.options.displayName} provider exited with code ${result.exitCode}.`,
        logText: [output, errorOutput].filter(Boolean).join("\n")
      }
    }

    return {
      status: "completed",
      artifacts: output ? [
        {
          artifactType: "markdown",
          fileName: this.options.outputFileName,
          mimeType: "text/markdown",
          text: output,
          writebackStatus: "not_requested"
        }
      ] : [],
      logText: errorOutput
    }
  }
}

async function runCommand(commandLine: string, request: unknown, timeoutMs: number, commandEnvName: string): Promise<{
  stdout: string
  stderr: string
  exitCode: number | null
  timedOut: boolean
}> {
  const [command, ...args] = splitCommandLine(commandLine)
  if (!command) throw new Error(`${commandEnvName} is empty`)
  const child = spawn(command, args, {
    stdio: ["pipe", "pipe", "pipe"],
    shell: false
  })
  let stdout = ""
  let stderr = ""
  let timedOut = false
  let stdinError: Error | undefined
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
  child.stdin.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code !== "EPIPE") stdinError = error
  })
  child.stdin.end(JSON.stringify(request))
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject)
    child.on("close", (code) => {
      if (stdinError) {
        reject(stdinError)
        return
      }
      resolve(code)
    })
  }).finally(() => clearTimeout(timeout))
  return { stdout, stderr, exitCode, timedOut }
}

function splitCommandLine(commandLine: string): string[] {
  return commandLine.trim().split(/\s+/).filter(Boolean)
}
