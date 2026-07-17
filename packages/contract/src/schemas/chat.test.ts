import assert from "node:assert/strict"
import test from "node:test"

import {
  CHAT_ORCHESTRATION_TRACE_TARGET_TYPE,
  DebugTraceSchema,
  LEGACY_DEBUG_TRACE_TARGET_TYPE_DEFAULT
} from "./chat.js"

const debugTrace = () => ({
  schemaVersion: 1 as const,
  runId: "run-1",
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
})

test("FR-049 contract preserves the canonical chat orchestration trace target", () => {
  const parsed = DebugTraceSchema.parse({
    ...debugTrace(),
    targetType: CHAT_ORCHESTRATION_TRACE_TARGET_TYPE
  })

  assert.equal(parsed.targetType, CHAT_ORCHESTRATION_TRACE_TARGET_TYPE)
})

test("FR-049 contract bounds legacy missing targetType to rag_run", () => {
  const parsed = DebugTraceSchema.parse(debugTrace())

  assert.equal(parsed.targetType, LEGACY_DEBUG_TRACE_TARGET_TYPE_DEFAULT)
})

test("FR-049 contract rejects an unknown trace target", () => {
  const parsed = DebugTraceSchema.safeParse({ ...debugTrace(), targetType: "agent_run" })

  assert.equal(parsed.success, false)
})
