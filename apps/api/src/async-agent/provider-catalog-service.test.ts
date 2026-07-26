import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"
import type {
  AsyncAgentProviderAdapter,
  AsyncAgentProviderDefinition,
  AsyncAgentProviderInput,
  AsyncAgentProviderResult
} from "./provider.js"
import {
  AgentProviderCatalogService,
  type AgentProviderCatalogPorts
} from "./provider-catalog-service.js"

test("AgentProviderCatalogService source depends on a narrow registry port", () => {
  const source = readFileSync(fileURLToPath(new URL("./provider-catalog-service.ts", import.meta.url)), "utf8")

  assert.doesNotMatch(source, /\bDependencies\b/)
  assert.doesNotMatch(source, /@aws-sdk\//)
  assert.doesNotMatch(source, /from "\.\.\/config\.js"/)
})

test("AgentProviderCatalogService preserves the unavailable optional-registry behavior", () => {
  const service = new AgentProviderCatalogService({})

  assert.deepEqual(service.listRuntimeProviders(), [])
  assert.deepEqual(service.listProviderSettings(), [])
  assert.equal(service.findRuntimeProvider("claude_code"), undefined)
  assert.equal(service.getAdapter("claude_code"), undefined)
})

test("AgentProviderCatalogService preserves provider order and setting projection", () => {
  const disabledProvider = definition("claude_code", "Claude Code", "disabled", ["claude-3"], "entry disabled")
  const unconfiguredProvider = definition("codex", "Codex", "not_configured", [], "token missing")
  const unavailableProvider = definition("opencode", "OpenCode", "provider_unavailable", ["open-model"], "binary missing")
  const availableProvider = definition("custom", "Custom", "available", ["custom-model"])
  const definitions = [disabledProvider, unconfiguredProvider, unavailableProvider, availableProvider]
  const { service } = createFixture(definitions)

  assert.deepEqual(service.listRuntimeProviders(), definitions)
  assert.deepEqual(service.listProviderSettings(), [
    setting(disabledProvider, "disabled"),
    setting(unconfiguredProvider, "not_configured"),
    setting(unavailableProvider, "environment"),
    setting(availableProvider, "environment")
  ])
})

test("AgentProviderCatalogService preserves create-time definition lookup and execution-time adapter lookup", () => {
  const definitions = [
    definition("claude_code", "Claude Code", "available", ["claude-3"]),
    definition("codex", "Codex", "available", ["gpt-5"])
  ]
  const { service, adapters, getCalls } = createFixture(definitions)

  assert.equal(service.findRuntimeProvider("codex"), definitions[1])
  assert.equal(service.findRuntimeProvider("opencode"), undefined)
  assert.equal(service.getAdapter("claude_code"), adapters[0])
  assert.equal(service.getAdapter("opencode"), undefined)
  assert.deepEqual(getCalls, ["claude_code", "opencode"])
})

function createFixture(definitions: AsyncAgentProviderDefinition[]) {
  const adapters = definitions.map((providerDefinition) => new StubProviderAdapter(providerDefinition))
  const getCalls: string[] = []
  const ports: AgentProviderCatalogPorts = {
    registry: {
      list: () => definitions,
      get: (provider) => {
        getCalls.push(provider)
        return adapters.find((adapter) => adapter.definition().provider === provider)
      }
    }
  }
  return {
    adapters,
    getCalls,
    service: new AgentProviderCatalogService(ports)
  }
}

function definition(
  provider: AsyncAgentProviderDefinition["provider"],
  displayName: string,
  availability: AsyncAgentProviderDefinition["availability"],
  configuredModelIds: string[],
  reason?: string
): AsyncAgentProviderDefinition {
  return { provider, displayName, availability, configuredModelIds, reason }
}

function setting(
  providerDefinition: AsyncAgentProviderDefinition,
  credentialMode: "disabled" | "not_configured" | "environment"
) {
  return {
    provider: providerDefinition.provider,
    displayName: providerDefinition.displayName,
    availability: providerDefinition.availability,
    credentialMode,
    configuredModelIds: providerDefinition.configuredModelIds,
    reason: providerDefinition.reason
  }
}

class StubProviderAdapter implements AsyncAgentProviderAdapter {
  constructor(private readonly providerDefinition: AsyncAgentProviderDefinition) {}

  definition(): AsyncAgentProviderDefinition {
    return this.providerDefinition
  }

  async execute(_input: AsyncAgentProviderInput): Promise<AsyncAgentProviderResult> {
    return { status: "completed", artifacts: [] }
  }
}
