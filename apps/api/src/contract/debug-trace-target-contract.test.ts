import assert from "node:assert/strict"
import test from "node:test"
import {
  DEBUG_TRACE_TARGET_TYPES as CONTRACT_DEBUG_TRACE_TARGET_TYPES,
  DebugTraceSchema as ContractDebugTraceSchema
} from "@memorag-mvp/contract"

import { DebugTraceSchema } from "../schemas.js"
import { DEBUG_TRACE_TARGET_TYPES, LEGACY_DEBUG_TRACE_TARGET_TYPE_DEFAULT } from "../types.js"

const candidate = {
  schemaVersion: 1 as const,
  runId: "run-chat-1",
  targetType: "chat_orchestration_run" as const,
  question: "sha256:question",
  modelId: "model-1",
  embeddingModelId: "embedding-1",
  clueModelId: "clue-1",
  topK: 6,
  memoryTopK: 4,
  minScore: 0.2,
  startedAt: "2026-07-17T00:00:00.000Z",
  completedAt: "2026-07-17T00:00:01.000Z",
  totalLatencyMs: 1000,
  status: "success" as const,
  answerPreview: "[redacted:document-content]",
  isAnswerable: true,
  citations: [],
  retrieved: [],
  steps: []
}

test("FR-049 API and package expose the same debug trace target vocabulary", () => {
  assert.deepEqual(DEBUG_TRACE_TARGET_TYPES, CONTRACT_DEBUG_TRACE_TARGET_TYPES)
})

test("FR-049 API and package keep the canonical chat target", () => {
  assert.equal(DebugTraceSchema.parse(candidate).targetType, "chat_orchestration_run")
  assert.equal(ContractDebugTraceSchema.parse(candidate).targetType, "chat_orchestration_run")
})

test("FR-049 missing legacy targets use the bounded rag_run default", () => {
  const { targetType: _targetType, ...legacyCandidate } = candidate

  assert.equal(DebugTraceSchema.parse(legacyCandidate).targetType, LEGACY_DEBUG_TRACE_TARGET_TYPE_DEFAULT)
  assert.equal(ContractDebugTraceSchema.parse(legacyCandidate).targetType, LEGACY_DEBUG_TRACE_TARGET_TYPE_DEFAULT)
})

test("FR-049 API and package reject unknown debug trace targets", () => {
  assert.equal(DebugTraceSchema.safeParse({ ...candidate, targetType: "agent_run" }).success, false)
  assert.equal(ContractDebugTraceSchema.safeParse({ ...candidate, targetType: "agent_run" }).success, false)
})
