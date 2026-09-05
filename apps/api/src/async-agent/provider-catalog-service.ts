import type {
  AsyncAgentProviderAdapter,
  AsyncAgentProviderDefinition,
  AsyncAgentProviderRegistry
} from "./provider.js"
import type { AgentProviderSetting, AgentRuntimeProvider } from "../types.js"

export type AgentProviderCatalogPorts = {
  registry?: Pick<AsyncAgentProviderRegistry, "list" | "get">
}

export class AgentProviderCatalogService {
  constructor(private readonly ports: AgentProviderCatalogPorts) {}

  listRuntimeProviders(): AsyncAgentProviderDefinition[] {
    return this.ports.registry?.list() ?? []
  }

  listProviderSettings(): AgentProviderSetting[] {
    return this.listRuntimeProviders().map((provider) => ({
      provider: provider.provider,
      displayName: provider.displayName,
      availability: provider.availability,
      credentialMode: provider.availability === "disabled"
        ? "disabled"
        : provider.availability === "not_configured"
          ? "not_configured"
          : "environment",
      configuredModelIds: provider.configuredModelIds,
      reason: provider.reason
    }))
  }

  findRuntimeProvider(provider: AgentRuntimeProvider): AsyncAgentProviderDefinition | undefined {
    return this.listRuntimeProviders().find((candidate) => candidate.provider === provider)
  }

  getAdapter(provider: AgentRuntimeProvider): AsyncAgentProviderAdapter | undefined {
    return this.ports.registry?.get(provider)
  }
}
