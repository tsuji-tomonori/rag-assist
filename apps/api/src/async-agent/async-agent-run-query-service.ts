import type { AppUser } from "../auth.js"
import type { AsyncAgentRun } from "../types.js"
import type { AsyncAgentRunRepository } from "./async-agent-run-repository.js"

type AsyncAgentRunQueryRepository = Pick<AsyncAgentRunRepository, "list" | "get">

export interface AsyncAgentRunQueryServicePorts {
  runRepository: AsyncAgentRunQueryRepository
  tenantIdForActor: (actor: AppUser) => string
  canListRun: (actor: AppUser, run: AsyncAgentRun) => boolean
  canGetRun: (actor: AppUser, run: AsyncAgentRun) => boolean
}

export class AsyncAgentRunQueryService {
  constructor(private readonly ports: AsyncAgentRunQueryServicePorts) {}

  async list(actor: AppUser): Promise<AsyncAgentRun[]> {
    const runs = await this.ports.runRepository.list(this.ports.tenantIdForActor(actor))
    return runs
      .filter((run) => this.ports.canListRun(actor, run))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 100)
  }

  async get(actor: AppUser, agentRunId: string): Promise<AsyncAgentRun | undefined> {
    const run = await this.ports.runRepository.get(this.ports.tenantIdForActor(actor), agentRunId)
    if (!run) return undefined
    if (!this.ports.canGetRun(actor, run)) throw forbiddenError("Forbidden")
    return run
  }

  async listArtifacts(actor: AppUser, agentRunId: string): Promise<AsyncAgentRun["artifacts"] | undefined> {
    const run = await this.get(actor, agentRunId)
    return run?.artifacts
  }

  async getArtifact(
    actor: AppUser,
    agentRunId: string,
    artifactId: string
  ): Promise<AsyncAgentRun["artifacts"][number] | undefined> {
    const artifacts = await this.listArtifacts(actor, agentRunId)
    return artifacts?.find((artifact) => artifact.artifactId === artifactId)
  }
}

function forbiddenError(message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status: 403 })
}
