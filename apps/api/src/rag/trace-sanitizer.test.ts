import assert from "node:assert/strict"
import test from "node:test"

import {
  sanitizeDebugTraceForPersistence,
  sanitizeDebugTraceForView
} from "./_shared/security/trace-sanitizer.js"
import type { DebugTrace } from "../types.js"

function rawTrace(): DebugTrace {
  return {
    schemaVersion: 1,
    runId: "run-1",
    requestTraceId: "request-1",
    parentTraceIds: ["ingest-doc-1", "search-1"],
    targetType: "rag_run",
    question: "Contact alice@example.com with password=CANARY_SECRET_PASSWORD",
    modelId: "model-1",
    embeddingModelId: "embedding-1",
    clueModelId: "clue-1",
    decision: {
      candidateCount: 7,
      deniedCandidateCount: 2,
      finalEvidenceCount: 3,
      responseStatus: "warning",
      decisionCode: "refused",
      reasonCodes: ["insufficient_evidence"],
      totalLatencyMs: 1000
    },
    topK: 5,
    memoryTopK: 3,
    minScore: 0.2,
    conversationHistory: [{ role: "user", text: "CANARY_SECRET_HISTORY" }],
    conversation: { raw: "CANARY_SECRET_CONVERSATION" },
    conversationState: { raw: "CANARY_SECRET_STATE" },
    decontextualizedQuery: { raw: "CANARY_SECRET_QUERY" },
    startedAt: "2026-07-11T00:00:00.000Z",
    completedAt: "2026-07-11T00:00:01.000Z",
    totalLatencyMs: 1000,
    status: "success",
    answerPreview: "Bearer CANARY_SECRET_ANSWER_TOKEN",
    isAnswerable: true,
    citations: [{ documentId: "doc-1", fileName: "alice@example.com", score: 0.9, text: "CANARY_SECRET_CITATION document body" }],
    retrieved: [{ documentId: "doc-2", fileName: "other.pdf", score: 0.8, text: "CANARY_SECRET_RETRIEVED" }],
    finalEvidence: [{ documentId: "doc-1", fileName: "safe.pdf", score: 0.9, text: "CANARY_SECRET_FINAL" }],
    toolInvocations: [{
      invocationId: "tool-1",
      orchestrationRunId: "run-1",
      toolId: "rag.search",
      requesterUserId: "alice@example.com",
      status: "failed",
      input: { secret: "CANARY_SECRET_TOOL_INPUT" },
      output: { secret: "CANARY_SECRET_TOOL_OUTPUT" },
      errorMessage: "password=CANARY_SECRET_TOOL_ERROR"
    }],
    steps: [{
      id: 1,
      label: "retrieve",
      status: "success",
      latencyMs: 10,
      summary: "retrieved password=CANARY_SECRET_STEP_SUMMARY",
      detail: "CANARY_SECRET_STEP_DETAIL",
      output: { secret: "CANARY_SECRET_STEP_OUTPUT" },
      startedAt: "2026-07-11T00:00:00.000Z",
      completedAt: "2026-07-11T00:00:00.010Z"
    }]
  }
}

test("FR-088 minimizes and redacts a trace before persistence", () => {
  const sanitized = sanitizeDebugTraceForPersistence(rawTrace())
  const serialized = JSON.stringify(sanitized)

  assert.doesNotMatch(serialized, /CANARY_SECRET|alice@example\.com|document body/)
  assert.equal(sanitized.conversationHistory, undefined)
  assert.equal(sanitized.conversation, undefined)
  assert.equal(sanitized.conversationState, undefined)
  assert.equal(sanitized.decontextualizedQuery, undefined)
  assert.match(sanitized.question, /^sha256:[a-f0-9]{64}$/)
  assert.equal(sanitized.requestTraceId, "request-1")
  assert.deepEqual(sanitized.parentTraceIds, ["ingest-doc-1", "search-1"])
  assert.equal(sanitized.answerPreview, "[redacted:document-content]")
  assert.equal(sanitized.citations[0]?.text, "[redacted:document-content]")
  assert.equal(sanitized.steps[0]?.detail, undefined)
  assert.equal(sanitized.steps[0]?.output, undefined)
  assert.equal(sanitized.steps[0]?.summary, "retrieve:success")
  assert.deepEqual(sanitized.decision, rawTrace().decision)
  assert.deepEqual(sanitized.toolInvocations?.[0]?.input, { redacted: true })
  assert.equal(sanitized.toolInvocations?.[0]?.output, undefined)
  assert.match(sanitized.toolInvocations?.[0]?.requesterUserId ?? "", /^actor:[0-9a-f]{16}$/)
  assert.ok(sanitized.exportRedaction?.redactedFields.includes("citations[].text"))
})

test("FR-088 reapplies the same allowlist before view and download", () => {
  const persisted = sanitizeDebugTraceForPersistence(rawTrace())
  const viewed = sanitizeDebugTraceForView(persisted)
  const viewedAgain = sanitizeDebugTraceForView(viewed)

  assert.deepEqual(viewedAgain, viewed)
  assert.doesNotMatch(JSON.stringify(viewed), /CANARY_SECRET|alice@example\.com/)
  assert.equal(viewed.visibility, "operator_sanitized")
})

test("FR-088 drops unknown future fields instead of treating the schema as a denylist", () => {
  const candidate = rawTrace() as DebugTrace & { futureRawField?: string }
  candidate.futureRawField = "CANARY_SECRET_FUTURE_TRACE"
  Object.assign(candidate.citations[0]!, { futureRawField: "CANARY_SECRET_FUTURE_CITATION" })
  Object.assign(candidate.steps[0]!, { futureRawField: "CANARY_SECRET_FUTURE_STEP" })
  Object.assign(candidate.toolInvocations![0]!, { futureRawField: "CANARY_SECRET_FUTURE_TOOL" })
  const reasonCodes = candidate.decision!.reasonCodes as unknown as string[]
  reasonCodes.push("CANARY_SECRET_FUTURE_REASON")

  const sanitized = sanitizeDebugTraceForPersistence(candidate)
  const serialized = JSON.stringify(sanitized)

  assert.doesNotMatch(serialized, /CANARY_SECRET_FUTURE/)
  assert.equal("futureRawField" in sanitized, false)
  assert.equal("futureRawField" in sanitized.citations[0]!, false)
  assert.equal("futureRawField" in sanitized.steps[0]!, false)
  assert.equal("futureRawField" in sanitized.toolInvocations![0]!, false)
  assert.deepEqual(sanitized.decision?.reasonCodes, ["insufficient_evidence"])
})
