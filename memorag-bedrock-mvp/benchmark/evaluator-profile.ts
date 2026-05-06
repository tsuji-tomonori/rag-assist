import { defaultThresholds, type RegressionThresholds } from "./metrics/quality.js"

export type EvaluatorProfile = {
  id: string
  version: string
  answerMatching: {
    noAnswerTexts: string[]
    caseInsensitive: boolean
  }
  retrieval: {
    recallK: number
  }
  thresholds: RegressionThresholds
}

export const defaultEvaluatorProfile: EvaluatorProfile = {
  id: "default",
  version: "1",
  answerMatching: {
    noAnswerTexts: ["資料からは回答できません", "回答できません", "noanswer"],
    caseInsensitive: true
  },
  retrieval: {
    recallK: 20
  },
  thresholds: defaultThresholds
}

export const strictJaEvaluatorProfile: EvaluatorProfile = {
  id: "strict-ja",
  version: "1",
  answerMatching: {
    noAnswerTexts: ["資料からは回答できません"],
    caseInsensitive: true
  },
  retrieval: {
    recallK: 10
  },
  thresholds: defaultThresholds
}

const profiles = new Map<string, EvaluatorProfile>([
  [profileKey(defaultEvaluatorProfile), defaultEvaluatorProfile],
  [profileKey(strictJaEvaluatorProfile), strictJaEvaluatorProfile]
])

export function resolveEvaluatorProfile(idOrVersion?: string): EvaluatorProfile {
  if (!idOrVersion) return defaultEvaluatorProfile
  const normalized = idOrVersion.includes("@") ? idOrVersion : `${idOrVersion}@1`
  return profiles.get(normalized) ?? defaultEvaluatorProfile
}

export function profileKey(profile: Pick<EvaluatorProfile, "id" | "version">): string {
  return `${profile.id}@${profile.version}`
}

export function assertComparableProfiles(current: EvaluatorProfile, baseline: unknown, allowMismatch: boolean): string | undefined {
  const baselineProfile = typeof baseline === "object" && baseline !== null
    ? (baseline as { evaluatorProfile?: { id?: string; version?: string } }).evaluatorProfile
    : undefined
  if (!baselineProfile?.id || !baselineProfile.version) return undefined
  const baselineKey = `${baselineProfile.id}@${baselineProfile.version}`
  const currentKey = profileKey(current)
  if (baselineKey === currentKey) return undefined
  const message = `baseline evaluator profile ${baselineKey} differs from current ${currentKey}`
  if (allowMismatch) return `${message}; treated as reference comparison`
  throw new Error(`${message}. Set ALLOW_EVALUATOR_PROFILE_MISMATCH=1 to compare as reference only.`)
}
