import { z } from "zod"

export const SupportTicketSourceSchema = z.enum(["manual_escalation", "answer_unavailable", "negative_feedback", "quality_issue"])
export const SupportTicketQualityCauseSchema = z.enum(["retrieval_gap", "low_quality_evidence", "stale_document", "extraction_warning", "unsupported_answer", "other"])

export const SupportSanitizedDiagnosticsSchema = z.object({
  tier: z.literal("support_sanitized"),
  answerUnavailableReason: z.string().optional(),
  retrievalQuality: z.enum(["no_evidence", "insufficient_evidence", "conflicting_evidence", "low_quality_evidence", "unknown"]).optional(),
  qualityCauses: z.array(SupportTicketQualityCauseSchema).optional(),
  visibleCitationIds: z.array(z.string()).optional(),
  visibleDocumentIds: z.array(z.string()).optional(),
  visibleChunkIds: z.array(z.string()).optional(),
  qualityWarnings: z.array(z.string()).optional(),
  suggestedNextActions: z.array(z.enum(["search_improvement_review", "document_owner_review", "document_reparse", "rag_exclusion_review", "benchmark_case_review"])).optional()
})

export const SupportTicketSchema = z.object({
  questionId: z.string(),
  title: z.string(),
  question: z.string(),
  requesterName: z.string(),
  requesterUserId: z.string().optional(),
  requesterDepartment: z.string(),
  assigneeDepartment: z.string(),
  assigneeUserId: z.string().optional(),
  assigneeGroupId: z.string().optional(),
  category: z.string(),
  priority: z.enum(["normal", "high", "urgent"]),
  status: z.enum(["open", "in_progress", "waiting_requester", "answered", "resolved"]),
  source: SupportTicketSourceSchema.optional(),
  messageId: z.string().optional(),
  ragRunId: z.string().optional(),
  answerUnavailableEventId: z.string().optional(),
  answerUnavailableReason: z.string().optional(),
  sanitizedDiagnostics: SupportSanitizedDiagnosticsSchema.optional(),
  slaDueAt: z.string().optional(),
  qualityCause: SupportTicketQualityCauseSchema.optional(),
  sourceQuestion: z.string().optional(),
  chatAnswer: z.string().optional(),
  chatRunId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const SearchImprovementCandidateSchema = z.object({
  candidateId: z.string(),
  term: z.string(),
  expansions: z.array(z.string()),
  sourceQuestionId: z.string(),
  candidateSource: z.enum(["ai_suggested", "support_ticket"]),
  reviewState: z.enum(["pending_review", "reviewed", "published"]),
  suggestionReason: z.string().optional(),
  reviewReason: z.string().optional(),
  impactSummary: z.string().optional(),
  searchResultDiffSummary: z.string().optional(),
  beforeResultIds: z.array(z.string()).optional(),
  afterResultIds: z.array(z.string()).optional()
})

export type SupportTicket = z.output<typeof SupportTicketSchema>
export type SearchImprovementCandidate = z.output<typeof SearchImprovementCandidateSchema>
