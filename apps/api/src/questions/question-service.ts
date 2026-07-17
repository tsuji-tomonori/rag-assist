import type {
  AnswerQuestionInput,
  CreateQuestionInput,
  QuestionStore
} from "../adapters/question-store.js"
import type { AppUser } from "../auth.js"
import type { HumanQuestion } from "../types.js"

export type QuestionServicePorts = {
  questionStore: Pick<
    QuestionStore,
    | "create"
    | "listAssignedToUser"
    | "listRequestedByUser"
    | "listAllForAdmin"
    | "get"
    | "answer"
    | "resolve"
  >
  defaultAssigneeGroupId?: string
  resolveUserDisplayName: (user?: AppUser) => string
}

export class QuestionService {
  constructor(private readonly ports: QuestionServicePorts) {}

  async create(input: CreateQuestionInput, user?: AppUser): Promise<HumanQuestion> {
    const defaultAssigneeGroupId = this.ports.defaultAssigneeGroupId || undefined
    const assigneeGroupId = input.assigneeUserId || input.assigneeGroupId
      ? input.assigneeGroupId
      : defaultAssigneeGroupId
    return this.ports.questionStore.create({
      ...input,
      requesterUserId: user?.userId,
      requesterName: input.requesterName?.trim() || this.ports.resolveUserDisplayName(user),
      requesterDepartment: input.requesterDepartment?.trim() || "未設定",
      assigneeGroupId,
      sanitizedDiagnostics: sanitizeSupportDiagnostics(
        input.sanitizedDiagnostics,
        input.answerUnavailableReason
      )
    })
  }

  async listAssigned(userId: string, groupIds: string[]): Promise<HumanQuestion[]> {
    return this.ports.questionStore.listAssignedToUser(userId, groupIds)
  }

  async listRequested(userId: string): Promise<HumanQuestion[]> {
    return this.ports.questionStore.listRequestedByUser(userId)
  }

  async listAllForAdmin(): Promise<HumanQuestion[]> {
    return this.ports.questionStore.listAllForAdmin()
  }

  async get(questionId: string): Promise<HumanQuestion | undefined> {
    return this.ports.questionStore.get(questionId)
  }

  async answer(questionId: string, input: AnswerQuestionInput, user?: AppUser): Promise<HumanQuestion> {
    return this.ports.questionStore.answer(questionId, {
      ...input,
      responderName: input.responderName?.trim() || this.ports.resolveUserDisplayName(user)
    })
  }

  async resolve(questionId: string): Promise<HumanQuestion> {
    return this.ports.questionStore.resolve(questionId)
  }
}

export function questionUserDisplayName(user?: AppUser): string {
  return user?.email?.trim() || user?.userId?.trim() || "未設定"
}

function sanitizeSupportDiagnostics(
  diagnostics: HumanQuestion["sanitizedDiagnostics"] | undefined,
  fallbackAnswerUnavailableReason?: string
): HumanQuestion["sanitizedDiagnostics"] | undefined {
  if (!diagnostics && !fallbackAnswerUnavailableReason) return undefined
  const sanitized: NonNullable<HumanQuestion["sanitizedDiagnostics"]> = {
    tier: "support_sanitized",
    answerUnavailableReason: trimOptional(diagnostics?.answerUnavailableReason)
      ?? trimOptional(fallbackAnswerUnavailableReason),
    retrievalQuality: diagnostics?.retrievalQuality,
    qualityCauses: diagnostics?.qualityCauses?.filter(isSupportQualityCause),
    visibleCitationIds: normalizeStringList(diagnostics?.visibleCitationIds, 20),
    visibleDocumentIds: normalizeStringList(diagnostics?.visibleDocumentIds, 20),
    visibleChunkIds: normalizeStringList(diagnostics?.visibleChunkIds, 50),
    qualityWarnings: normalizeStringList(diagnostics?.qualityWarnings, 20),
    suggestedNextActions: diagnostics?.suggestedNextActions?.filter(isSupportNextAction)
  }
  return Object.fromEntries(
    Object.entries(sanitized).filter(([, value]) => value !== undefined)
  ) as HumanQuestion["sanitizedDiagnostics"]
}

function normalizeStringList(values: string[] | undefined, maxItems: number): string[] | undefined {
  const normalized = [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))]
    .slice(0, maxItems)
  return normalized.length > 0 ? normalized : undefined
}

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function isSupportQualityCause(value: unknown): value is NonNullable<HumanQuestion["qualityCause"]> {
  return [
    "retrieval_gap",
    "low_quality_evidence",
    "stale_document",
    "extraction_warning",
    "unsupported_answer",
    "other"
  ].includes(String(value))
}

function isSupportNextAction(
  value: unknown
): value is NonNullable<NonNullable<HumanQuestion["sanitizedDiagnostics"]>["suggestedNextActions"]>[number] {
  return [
    "search_improvement_review",
    "document_owner_review",
    "document_reparse",
    "rag_exclusion_review",
    "benchmark_case_review"
  ].includes(String(value))
}
