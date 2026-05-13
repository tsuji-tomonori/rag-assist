import { describe, expect, it } from "vitest"
import type { DebugTrace } from "../types.js"
import {
  buildDebugReplayEnvelope,
  buildEvidenceRows,
  extractAnswerSupport,
  extractContextAssembly,
  extractFactCoverage,
  parseDebugReplayJson,
  stringifyDebugJson
} from "./debugTraceReplay.js"

const citation = {
  documentId: "doc-1",
  fileName: "requirements.md",
  chunkId: "chunk-1",
  score: 0.91,
  text: "製品要求とプロジェクト要求に分類します。"
}

const trace: DebugTrace = {
  schemaVersion: 1,
  runId: "run-1",
  question: "要求分類を教えて",
  modelId: "model",
  embeddingModelId: "embedding",
  clueModelId: "clue",
  pipelineVersions: { graph: "v2" },
  topK: 6,
  memoryTopK: 4,
  minScore: 0.2,
  startedAt: "2026-05-03T00:00:00.000Z",
  completedAt: "2026-05-03T00:00:01.250Z",
  totalLatencyMs: 1250,
  status: "success",
  answerPreview: "回答",
  isAnswerable: true,
  citations: [citation],
  retrieved: [
    citation,
    { ...citation, chunkId: "chunk-2", score: 0.32, text: "候補の根拠です。" }
  ],
  steps: [
    {
      id: 1,
      label: "analyze_input",
      status: "success",
      latencyMs: 10,
      summary: "入力解析",
      output: {},
      startedAt: "2026-05-03T00:00:00.000Z",
      completedAt: "2026-05-03T00:00:00.010Z"
    },
    {
      id: 2,
      label: "plan_search",
      status: "success",
      latencyMs: 20,
      summary: "検索計画",
      output: {
        iteration: 1,
        searchDecision: "initial_search",
        searchPlan: {
          requiredFacts: [
            { id: "fact-supported", description: "分類体系" },
            { id: "fact-unknown", description: "不明な観点" }
          ]
        }
      },
      startedAt: "2026-05-03T00:00:00.010Z",
      completedAt: "2026-05-03T00:00:00.030Z"
    },
    {
      id: 3,
      label: "retrieval_evaluator",
      status: "warning",
      latencyMs: 30,
      summary: "一部不足",
      output: {
        retrievalEvaluation: {
          supportedFactIds: ["fact-supported"],
          missingFactIds: ["fact-missing"],
          conflictingFactIds: ["fact-conflicting"],
          retrievalQuality: "partial",
          nextAction: { type: "continue_search" },
          reason: "追加検索が必要"
        }
      },
      startedAt: "2026-05-03T00:00:00.030Z",
      completedAt: "2026-05-03T00:00:00.060Z"
    },
    {
      id: 4,
      label: "evaluate_search_progress",
      status: "success",
      latencyMs: 5,
      summary: "継続",
      output: {},
      startedAt: "2026-05-03T00:00:00.060Z",
      completedAt: "2026-05-03T00:00:00.065Z"
    },
    {
      id: 5,
      label: "plan_search",
      status: "success",
      latencyMs: 15,
      summary: "再検索計画",
      output: {
        iteration: 2,
        searchPlan: {
          requiredFacts: [
            { id: "fact-supported", description: "分類体系" },
            { id: "fact-unknown", description: "不明な観点" }
          ]
        }
      },
      startedAt: "2026-05-03T00:00:00.065Z",
      completedAt: "2026-05-03T00:00:00.080Z"
    },
    {
      id: 6,
      label: "verify_answer_support",
      status: "success",
      latencyMs: 25,
      summary: "回答支持を確認",
      output: {
        answerSupport: { supported: true },
        contextAssembly: { selectedChunkIds: ["chunk-1"] }
      },
      startedAt: "2026-05-03T00:00:00.080Z",
      completedAt: "2026-05-03T00:00:00.105Z"
    },
    {
      id: 7,
      label: "finalize_response",
      status: "success",
      latencyMs: 12,
      summary: "回答確定",
      output: {},
      startedAt: "2026-05-03T00:00:00.105Z",
      completedAt: "2026-05-03T00:00:00.117Z"
    }
  ]
}

describe("debugTraceReplay", () => {
  it("DebugTrace から replay envelope、graph、diagnostics を構築する", () => {
    const envelope = buildDebugReplayEnvelope(trace)

    expect(envelope.schemaVersion).toBe(2)
    expect(envelope.runSummary).toMatchObject({ runId: "run-1", status: "answered", mainFailureStage: "retrieval" })
    expect(envelope.pipelineVersions).toEqual({ graph: "v2" })
    expect(envelope.graph.nodes.map((node) => [node.label, node.group, node.type])).toContainEqual(["retrieval_evaluator", "search-loop", "retrieval"])
    expect(envelope.graph.edges.some((edge) => edge.kind === "loop" && edge.label === "continue_search")).toBe(true)
    expect(envelope.graph.edges.some((edge) => edge.kind === "repair" && edge.label === "repair/finalize")).toBe(true)
    expect(envelope.evidence.selected).toHaveLength(1)

    expect(extractFactCoverage(trace)).toEqual([
      { id: "fact-supported", description: "分類体系", status: "supported", reason: "追加検索が必要" },
      { id: "fact-missing", description: "fact-missing", status: "missing", reason: "追加検索が必要" },
      { id: "fact-conflicting", description: "fact-conflicting", status: "conflicting", reason: "追加検索が必要" },
      { id: "fact-unknown", description: "不明な観点", status: "unknown", reason: "追加検索が必要" }
    ])
    expect(extractAnswerSupport(trace)).toEqual({ supported: true })
    expect(extractContextAssembly(trace)).toEqual({ selectedChunkIds: ["chunk-1"] })
    expect(buildEvidenceRows(trace).map((row) => row.tags)).toEqual([
      ["retrieved", "cited"],
      ["retrieved", "context-candidate"]
    ])
  })

  it("raw DebugTrace と v2 envelope JSON を parse できる", () => {
    expect(parseDebugReplayJson(trace).runSummary.runId).toBe("run-1")

    const parsedEnvelope = parseDebugReplayJson({
      traceType: "memorag-debug-trace",
      schemaVersion: 2,
      rawTrace: trace,
      graph: { nodes: [{ id: "custom" }], edges: [] },
      details: { custom: true },
      pipelineVersions: { graph: "custom" }
    })

    expect(parsedEnvelope.graph.nodes).toEqual([{ id: "custom" }])
    expect(parsedEnvelope.details).toEqual({ custom: true })
    expect(parsedEnvelope.pipelineVersions).toEqual({ graph: "custom" })
    expect(stringifyDebugJson({ runId: "run-1" })).toContain("\n")
  })

  it("不正な replay JSON を拒否し、refusal/error summary を分類する", () => {
    expect(() => parseDebugReplayJson(null)).toThrow("JSON object")
    expect(() => parseDebugReplayJson({ traceType: "memorag-debug-trace", schemaVersion: 2, rawTrace: {} })).toThrow("rawTrace")
    expect(() => parseDebugReplayJson({ runId: "missing-shape" })).toThrow("DebugTrace")

    const refusal = buildDebugReplayEnvelope({
      ...trace,
      status: "warning",
      isAnswerable: false,
      steps: [
        {
          id: 1,
          label: "answerability_gate",
          status: "warning",
          latencyMs: 1,
          summary: "根拠不足",
          output: { answerability: { label: "insufficient_context" } },
          startedAt: "2026-05-03T00:00:00.000Z",
          completedAt: "2026-05-03T00:00:00.001Z"
        }
      ]
    })
    expect(refusal.runSummary).toMatchObject({ status: "warning", mainFailureStage: "context", refusalReason: "根拠不足" })

    const errored = buildDebugReplayEnvelope({
      ...trace,
      status: "error",
      isAnswerable: false,
      steps: [
        {
          id: 1,
          label: "generate_answer",
          status: "error",
          latencyMs: 1,
          summary: "生成失敗",
          startedAt: "2026-05-03T00:00:00.000Z",
          completedAt: "2026-05-03T00:00:00.001Z"
        }
      ]
    })
    expect(errored.runSummary).toMatchObject({ status: "error", mainFailureStage: "answer_generation" })
  })

  it("診断情報がない trace は空の diagnostics と fallback pipeline を返す", () => {
    const minimalTrace = { ...trace, pipelineVersions: undefined, citations: [], retrieved: [], steps: [] }

    expect(buildDebugReplayEnvelope(minimalTrace).pipelineVersions).toMatchObject({ modelId: "model", embeddingModelId: "embedding" })
    expect(extractFactCoverage(minimalTrace)).toEqual([])
    expect(extractAnswerSupport(minimalTrace)).toBeUndefined()
    expect(extractContextAssembly(minimalTrace)).toBeUndefined()
    expect(buildEvidenceRows(minimalTrace)).toEqual([])
  })
})
