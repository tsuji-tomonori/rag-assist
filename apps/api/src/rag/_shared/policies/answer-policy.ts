export const retrievalProfileIds = ["default", "adaptive-retrieval"] as const

export type RetrievalProfileId = typeof retrievalProfileIds[number]

export type RetrievalProfile = {
  id: RetrievalProfileId
  version: string
  strategy: "fixed" | "adaptive"
  topK: {
    default: number
    max: number
    searchBenchmarkDefault: number
  }
  candidate: {
    lexicalTopK: number
    semanticTopK: number
    searchCandidateMinTopK: number
    searchRagMaxTopK: number
    searchRagMaxSourceTopK: number
    semanticPrefetchMultiplier: number
  }
  fusion: {
    rrfK: number
    weights: [number, number]
  }
  bm25: {
    k1: number
    b: number
  }
  scoring: {
    minScore: number
    combinedMaxScore: number
    lexicalBaseScore: number
    lexicalLogDivisor: number
    sourceScoreMax: number
    exactQueryBonus: number
    fileNameBonus: number
    tokenCoverageBonus: number
    recencyBonus: number
  }
  adaptive: {
    enabled: boolean
    minTopK: number
    topGapExpandBelow: number
    overlapBoostAtLeast: number
    scoreFloorQuantile: number
    minCombinedScore: number
  }
}

export type AnswerPolicy = {
  id: string
  version: string
  policyComputation: PolicyComputationPolicy
}

export const policyComparatorOperators = ["gte", "gt", "lte", "lt", "eq"] as const
export const policyConcreteEffects = ["required", "not_required", "allowed", "not_allowed", "eligible", "not_eligible"] as const
export const policyEffectValues = [...policyConcreteEffects, "unknown"] as const

export type PolicyComparatorOperator = typeof policyComparatorOperators[number]
export type PolicyConcreteEffect = typeof policyConcreteEffects[number]
export type PolicyEffectValue = typeof policyEffectValues[number]

export type PolicyTextMapping<T extends string> = {
  value: T
  texts: string[]
}

export type PolicyComputationPolicy = {
  comparatorTextMappings: Array<PolicyTextMapping<PolicyComparatorOperator>>
  effectTextMappings: Array<PolicyTextMapping<PolicyConcreteEffect>>
}

export type RAGProfile = {
  id: string
  version: string
  retrieval: RetrievalProfile
  answerPolicy: AnswerPolicy
}

export const defaultPolicyComputationPolicy: PolicyComputationPolicy = {
  comparatorTextMappings: [
    { value: "gte", texts: ["以上"] },
    { value: "gt", texts: ["超", "より大きい"] },
    { value: "lte", texts: ["以下"] },
    { value: "lt", texts: ["未満", "より小さい"] },
    { value: "eq", texts: ["等しい", "と等しい", "同額"] }
  ],
  effectTextMappings: [
    { value: "required", texts: ["必要", "必須", "要"] },
    { value: "not_required", texts: ["不要", "免除"] },
    { value: "allowed", texts: ["可能", "可", "できる", "認められる"] },
    { value: "not_allowed", texts: ["不可", "禁止", "できない", "認められない"] },
    { value: "eligible", texts: ["対象", "該当"] },
    { value: "not_eligible", texts: ["対象外", "非該当"] }
  ]
}

export const neutralAnswerPolicy: AnswerPolicy = {
  id: "default-answer-policy",
  version: "1",
  policyComputation: defaultPolicyComputationPolicy
}

export function resolveRetrievalProfileId(id: string | undefined, adaptiveRetrievalEnabled = false): RetrievalProfileId {
  const requested = id?.trim() || "default"
  if (requested === "default") return adaptiveRetrievalEnabled ? "adaptive-retrieval" : "default"
  if (requested === "adaptive-retrieval") return "adaptive-retrieval"
  throw new Error(`Unknown RAG_PROFILE_ID: ${requested}`)
}

export function answerPolicyById(id: string | undefined): AnswerPolicy {
  const requested = id?.trim() || neutralAnswerPolicy.id
  if (requested === neutralAnswerPolicy.id || requested === "default") return neutralAnswerPolicy
  throw new Error(`Unknown RAG_DOMAIN_POLICY_ID: ${requested}`)
}
