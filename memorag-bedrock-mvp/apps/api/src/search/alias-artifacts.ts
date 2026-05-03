import type { Dependencies } from "../dependencies.js"
import type { AliasDefinition, AliasScope, PublishedAliasArtifact } from "../types.js"

export type AliasMap = Record<string, string[]>

export const aliasArtifactLatestKey = "aliases/latest.json"

export async function loadPublishedAliasArtifact(
  deps: Pick<Dependencies, "objectStore">
): Promise<PublishedAliasArtifact | undefined> {
  try {
    const latest = JSON.parse(await deps.objectStore.getText(aliasArtifactLatestKey)) as { objectKey?: string }
    if (!latest.objectKey) return undefined
    const artifact = JSON.parse(await deps.objectStore.getText(latest.objectKey)) as PublishedAliasArtifact
    if (artifact.schemaVersion !== 1 || !artifact.version) return undefined
    return artifact
  } catch {
    return undefined
  }
}

export async function loadPublishedAliasMap(
  deps: Pick<Dependencies, "objectStore">,
  filters?: AliasScope
): Promise<{ aliases: AliasMap; version: string }> {
  const artifact = await loadPublishedAliasArtifact(deps)
  if (!artifact) return { aliases: {}, version: "none" }
  return {
    aliases: aliasMapFromDefinitions(artifact.aliases.filter((alias) => alias.status === "approved" && scopeMatches(alias.scope, filters))),
    version: artifact.version
  }
}

export function aliasMapFromDefinitions(definitions: AliasDefinition[]): AliasMap {
  const merged = new Map<string, Set<string>>()
  for (const definition of definitions) {
    const term = normalizeAliasTerm(definition.term)
    if (!term) continue
    const values = merged.get(term) ?? new Set<string>()
    for (const expansion of definition.expansions) {
      const normalized = normalizeAliasTerm(expansion)
      if (normalized) values.add(normalized)
    }
    if (values.size > 0) merged.set(term, values)
  }
  return Object.fromEntries([...merged.entries()].map(([term, values]) => [term, [...values].sort()]))
}

export function scopeMatches(scope: AliasScope | undefined, filters?: AliasScope): boolean {
  if (!scope) return true
  for (const key of ["tenantId", "department", "source", "docType"] as const) {
    if (scope[key] && scope[key] !== filters?.[key]) return false
  }
  return true
}

function normalizeAliasTerm(value: string): string {
  return value.trim().toLowerCase()
}
