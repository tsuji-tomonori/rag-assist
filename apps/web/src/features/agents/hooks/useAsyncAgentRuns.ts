import { useCallback, useState } from "react"
import { cancelAsyncAgentRun, listAgentProviders, listAsyncAgentRuns } from "../api/agentsApi.js"
import type { AgentRuntimeProviderDefinition, AsyncAgentRun } from "../types.js"

export function useAsyncAgentRuns({
  setLoading,
  setError
}: {
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}) {
  const [agentRuns, setAgentRuns] = useState<AsyncAgentRun[]>([])
  const [agentProviders, setAgentProviders] = useState<AgentRuntimeProviderDefinition[]>([])

  const refreshAgentRuns = useCallback(async () => {
    setAgentRuns(await listAsyncAgentRuns())
  }, [])

  const refreshAgentProviders = useCallback(async () => {
    setAgentProviders(await listAgentProviders())
  }, [])

  async function onCancelAgentRun(agentRunId: string) {
    setLoading(true)
    setError(null)
    try {
      const cancelled = await cancelAsyncAgentRun(agentRunId)
      setAgentRuns((prev) => [cancelled, ...prev.filter((run) => run.agentRunId !== agentRunId)])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return {
    agentRuns,
    agentProviders,
    refreshAgentRuns,
    refreshAgentProviders,
    onCancelAgentRun
  }
}
