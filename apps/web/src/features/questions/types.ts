export type HumanQuestion = {
  questionId: string
  title: string
  question: string
  requesterName: string
  requesterUserId?: string
  requesterDepartment: string
  assigneeDepartment: string
  category: string
  priority: "normal" | "high" | "urgent"
  status: "open" | "in_progress" | "waiting_requester" | "answered" | "resolved"
  source?: "manual_escalation" | "answer_unavailable" | "negative_feedback" | "quality_issue"
  messageId?: string
  ragRunId?: string
  answerUnavailableEventId?: string
  answerUnavailableReason?: string
  sanitizedDiagnostics?: {
    tier: "support_sanitized"
    answerUnavailableReason?: string
    retrievalQuality?: "no_evidence" | "insufficient_evidence" | "conflicting_evidence" | "low_quality_evidence" | "unknown"
    qualityCauses?: Array<"retrieval_gap" | "low_quality_evidence" | "stale_document" | "extraction_warning" | "unsupported_answer" | "other">
    visibleCitationIds?: string[]
    visibleDocumentIds?: string[]
    visibleChunkIds?: string[]
    qualityWarnings?: string[]
    suggestedNextActions?: Array<"search_improvement_review" | "document_owner_review" | "document_reparse" | "rag_exclusion_review" | "benchmark_case_review">
  }
  assigneeUserId?: string
  assigneeGroupId?: string
  slaDueAt?: string
  qualityCause?: "retrieval_gap" | "low_quality_evidence" | "stale_document" | "extraction_warning" | "unsupported_answer" | "other"
  sourceQuestion?: string
  chatAnswer?: string
  chatRunId?: string
  references?: string
  answerTitle?: string
  answerBody?: string
  responderName?: string
  responderDepartment?: string
  internalMemo?: string
  notifyRequester?: boolean
  createdAt: string
  updatedAt: string
  answeredAt?: string
  resolvedAt?: string
}
