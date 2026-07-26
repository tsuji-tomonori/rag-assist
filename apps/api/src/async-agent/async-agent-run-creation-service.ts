import { randomUUID } from "node:crypto"
import type { AppUser } from "../auth.js"
import type { AgentRuntimeProvider, AsyncAgentRun } from "../types.js"
import type { AsyncAgentProviderDefinition } from "./provider.js"
import type { AsyncAgentRunRepository } from "./async-agent-run-repository.js"

export type CreateAsyncAgentRunInput = {
  provider: AgentRuntimeProvider
  modelId: string
  instruction: string
  selectedFolderIds?: string[]
  selectedDocumentIds?: string[]
  selectedSkillIds?: string[]
  selectedAgentProfileIds?: string[]
  budget?: AsyncAgentRun["budget"]
}

export interface AsyncAgentRunCreationServicePorts {
  runRepository: Pick<AsyncAgentRunRepository, "save">
  authorizeSelections: (actor: AppUser, input: CreateAsyncAgentRunInput) => Promise<void>
  findProvider: (provider: AgentRuntimeProvider) => AsyncAgentProviderDefinition | undefined
  tenantIdForActor: (actor: AppUser) => string
  now: () => string
  createRunId: (now: string) => string
  createMountId: () => string
}

export class AsyncAgentRunCreationService {
  constructor(private readonly ports: AsyncAgentRunCreationServicePorts) {}

  async create(actor: AppUser, input: CreateAsyncAgentRunInput): Promise<AsyncAgentRun> {
    await this.ports.authorizeSelections(actor, input)

    const now = this.ports.now()
    const agentRunId = this.ports.createRunId(now)
    const provider = this.ports.findProvider(input.provider)
    const availability = provider?.availability ?? "provider_unavailable"
    const blocked = availability !== "available"
    const selectedFolderIds = uniqueStrings(input.selectedFolderIds ?? [])
    const selectedDocumentIds = uniqueStrings(input.selectedDocumentIds ?? [])
    const workspaceId = `workspace_${agentRunId}`
    const run: AsyncAgentRun = {
      agentRunId,
      runId: agentRunId,
      tenantId: this.ports.tenantIdForActor(actor),
      requesterUserId: actor.userId,
      requesterEmail: actor.email,
      requesterGroups: [...actor.cognitoGroups],
      provider: input.provider,
      modelId: input.modelId,
      status: blocked ? "blocked" : "queued",
      providerAvailability: availability,
      failureReasonCode: blocked
        ? availability === "not_configured" || availability === "disabled" ? "not_configured" : "provider_unavailable"
        : undefined,
      failureReason: blocked
        ? availability === "not_configured" || availability === "disabled"
          ? "Provider execution is not configured. G1 records the run contract without starting a provider."
          : "Provider is unavailable. G1 does not create mock provider executions."
        : undefined,
      instruction: input.instruction,
      selectedFolderIds,
      selectedDocumentIds,
      selectedSkillIds: uniqueStrings(input.selectedSkillIds ?? []),
      selectedAgentProfileIds: uniqueStrings(input.selectedAgentProfileIds ?? []),
      workspaceId,
      workspaceMounts: [
        ...selectedFolderIds.map((folderId) => this.readOnlyMount(workspaceId, "folder", folderId, now)),
        ...selectedDocumentIds.map((documentId) => this.readOnlyMount(workspaceId, "document", documentId, now))
      ],
      artifactIds: [],
      artifacts: [],
      budget: input.budget,
      createdBy: actor.userId,
      createdAt: now,
      completedAt: blocked ? now : undefined,
      updatedAt: now
    }

    await this.ports.runRepository.save(run)
    return run
  }

  private readOnlyMount(
    workspaceId: string,
    sourceType: "folder" | "document",
    sourceId: string,
    permissionCheckedAt: string
  ): AsyncAgentRun["workspaceMounts"][number] {
    return {
      mountId: this.ports.createMountId(),
      workspaceId,
      sourceType,
      sourceId,
      mountedPath: `/workspace/read-only/${sourceType}s/${sourceId}`,
      accessMode: "readOnly",
      permissionCheckedAt
    }
  }
}

export function createAsyncAgentRunId(now: string): string {
  const compact = now.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
  return `agent_${compact}_${randomUUID().slice(0, 8)}`
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort()
}
