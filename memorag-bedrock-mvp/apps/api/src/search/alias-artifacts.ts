import type { Dependencies } from "../dependencies.js"
import type { AliasDefinition, AliasScope, JsonValue, PublishedAliasArtifact } from "../types.js"

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
  filters?: AliasScope,
  visibleMetadata: Array<Record<string, JsonValue> | undefined> = []
): Promise<{ aliases: AliasMap; version: string }> {
  const artifact = await loadPublishedAliasArtifact(deps)
  if (!artifact) return { aliases: {}, version: "none" }
  return {
    aliases: aliasMapFromDefinitions(
      artifact.aliases.filter((alias) => alias.status === "approved" && scopeMatches(alias.scope, filters, visibleMetadata))
    ),
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

export function scopeMatches(
  scope: AliasScope | undefined,
  filters?: AliasScope,
  visibleMetadata: Array<Record<string, JsonValue> | undefined> = []
): boolean {
  if (!scope) return true
  if (matchesScope(scope, filters)) return true
  if (!filters) {
    return visibleMetadata.some((metadata) => matchesScope(scope, metadataToScope(metadata)))
  }
  return false
}

function matchesScope(scope: AliasScope, candidate?: AliasScope): boolean {
  for (const key of ["tenantId", "department", "source", "docType"] as const) {
    if (scope[key] && scope[key] !== candidate?.[key]) return false
  }
  return true
}

function metadataToScope(metadata: Record<string, JsonValue> | undefined): AliasScope | undefined {
  if (!metadata) return undefined
  return {
    tenantId: stringValue(metadata.tenantId),
    department: stringValue(metadata.department),
    source: stringValue(metadata.source),
    docType: stringValue(metadata.docType)
  }
}

function stringValue(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function normalizeAliasTerm(value: string): string {
  return value.trim().toLowerCase()
}
