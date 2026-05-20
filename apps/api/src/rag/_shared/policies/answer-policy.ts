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
  classificationAnchors: string[]
  invalidAnswerPatterns: RegExp[]
  searchClueAnchors: string[]
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
  classificationAnchors: ["分類", "種類", "区分"],
  invalidAnswerPatterns: [],
  searchClueAnchors: [],
  policyComputation: defaultPolicyComputationPolicy
}

export const swebokRequirementsAnswerPolicy: AnswerPolicy = {
  id: "swebok-requirements-policy",
  version: "1",
  classificationAnchors: [
    "ソフトウェア要求の分類",
    "要求分類",
    "分類の目的",
    "ソフトウェア製品要求",
    "ソフトウェアプロジェクト要求",
    "機能要求",
    "非機能要求",
    "技術制約",
    "サービス品質制約"
  ],
  invalidAnswerPatterns: [
    /Requirements Elicitation|Requirements Validation|Requirements Scrubbing|ATDD|BDD|UML\s*SysML|UML\/SysML|Kano|要求獲得|要求妥当性確認|要求管理|要求スクラビング|要求の優先順位付け|要求の追跡可能性/
  ],
  searchClueAnchors: [
    "ソフトウェア要求の分類",
    "ソフトウェア製品要求 ソフトウェアプロジェクト要求 機能要求 非機能要求 技術制約 サービス品質制約"
  ],
  policyComputation: defaultPolicyComputationPolicy
}

export function resolveRetrievalProfileId(id: string | undefined, adaptiveRetrievalEnabled = false): RetrievalProfileId {
  const requested = id?.trim() || "default"
  if (requested === "default") return adaptiveRetrievalEnabled ? "adaptive-retrieval" : "default"
  if (requested === "adaptive-retrieval") return "adaptive-retrieval"
  throw new Error(`Unknown RAG_PROFILE_ID: ${requested}`)
}

export function answerPolicyById(id: string | undefined): AnswerPolicy {
  if (id === swebokRequirementsAnswerPolicy.id || id === "swebok") return swebokRequirementsAnswerPolicy
  return neutralAnswerPolicy
}

export function isSwebokPolicyMetadata(metadata: Record<string, unknown> | undefined): boolean {
  const value = String(metadata?.domainPolicy ?? metadata?.ragPolicy ?? metadata?.answerPolicy ?? metadata?.docType ?? "")
  return /swebok|requirements-classification|software-requirements/i.test(value)
}

export function selectAnswerPolicyForMetadata(metadataItems: Array<Record<string, unknown> | undefined>, fallback: AnswerPolicy): AnswerPolicy {
  return metadataItems.some(isSwebokPolicyMetadata) ? swebokRequirementsAnswerPolicy : fallback
}
