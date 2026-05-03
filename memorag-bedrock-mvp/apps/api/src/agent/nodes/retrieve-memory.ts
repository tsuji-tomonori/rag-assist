import type { AppUser } from "../../auth.js"
import { config } from "../../config.js"
import type { Dependencies } from "../../dependencies.js"
import type { JsonValue, VectorMetadata } from "../../types.js"
import type { QaAgentState, QaAgentUpdate } from "../state.js"

export function createRetrieveMemoryNode(deps: Dependencies, user: AppUser) {
  return async function retrieveMemory(state: QaAgentState): Promise<QaAgentUpdate> {
    if (!state.useMemory) {
      return { memoryCards: [] }
    }

    const vector = await deps.textModel.embed(state.normalizedQuery ?? state.question, {
      modelId: state.embeddingModelId,
      dimensions: config.embeddingDimensions
    })

    const queryTopK = Math.min(100, Math.max(state.memoryTopK, state.memoryTopK * 3))
    const memoryCards = (await deps.memoryVectorStore.query(vector, queryTopK, { kind: "memory" }))
      .filter((hit) => canAccessMemoryVector(hit.metadata, user))
      .slice(0, state.memoryTopK)
    return { memoryCards }
  }
}

function canAccessMemoryVector(metadata: VectorMetadata, user: AppUser): boolean {
  if ((metadata.lifecycleStatus ?? "active") !== "active") return false
  if (user.cognitoGroups.includes("SYSTEM_ADMIN")) return true
  return canAccessMetadata(metadata as unknown as Record<string, JsonValue>, user)
}

function canAccessMetadata(metadata: Record<string, JsonValue>, user: AppUser): boolean {
  const groups = new Set(user.cognitoGroups)
  const aclGroups = stringValues(metadata.aclGroups ?? metadata.allowedGroups ?? metadata.aclGroup ?? metadata.group)
  if (aclGroups.length > 0 && !aclGroups.some((group) => groups.has(group))) return false
  const allowedUsers = stringValues(metadata.allowedUsers ?? metadata.userIds ?? metadata.privateToUserId)
  if (allowedUsers.length > 0 && !allowedUsers.includes(user.userId) && (!user.email || !allowedUsers.includes(user.email))) return false
  return true
}

function stringValues(value: JsonValue | undefined): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string")
  return []
}
