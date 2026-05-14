import { get, post } from "../../../shared/api/http.js"
import type { AgentRuntimeProvider, AgentRuntimeProviderDefinition, AsyncAgentRun } from "../types.js"

export async function listAgentProviders(): Promise<AgentRuntimeProviderDefinition[]> {
  const result = await get<{ providers?: AgentRuntimeProviderDefinition[] }>("/agents/providers")
  return result.providers ?? []
}

export async function listAsyncAgentRuns(): Promise<AsyncAgentRun[]> {
  const result = await get<{ agentRuns?: AsyncAgentRun[] }>("/agents/runs")
  return result.agentRuns ?? []
}

export async function createAsyncAgentRun(input: {
  provider: AgentRuntimeProvider
  modelId: string
  instruction: string
  selectedFolderIds?: string[]
  selectedDocumentIds?: string[]
  selectedSkillIds?: string[]
  selectedAgentProfileIds?: string[]
}): Promise<AsyncAgentRun> {
  return post<AsyncAgentRun>("/agents/runs", input)
}

export async function cancelAsyncAgentRun(agentRunId: string): Promise<AsyncAgentRun> {
  return post<AsyncAgentRun>(`/agents/runs/${encodeURIComponent(agentRunId)}/cancel`, {})
}
