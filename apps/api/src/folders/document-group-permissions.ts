import type { DocumentGroup } from "../types.js"

export function documentGroupHasLegacyExplicitPolicy(input: {
  visibility?: DocumentGroup["visibility"]
  sharedUserIds?: string[]
  sharedGroups?: string[]
  managerUserIds?: string[]
}): boolean {
  return input.visibility !== undefined ||
    input.sharedUserIds !== undefined ||
    input.sharedGroups !== undefined ||
    input.managerUserIds !== undefined
}
