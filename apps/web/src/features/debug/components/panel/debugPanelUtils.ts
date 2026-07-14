import type { DebugStep } from "../../types.js"
import { stringifyDebugJson, type DebugGraphNode, type DebugReplayEnvelope } from "../../utils/debugTraceReplay.js"

export function formatGraphGroup(group: DebugGraphNode["group"]): string {
  switch (group) {
    case "preprocess":
      return "前処理"
    case "search-loop":
      return "検索ループ"
    case "context":
      return "根拠構成"
    case "answer":
      return "回答"
    case "finalize":
      return "最終処理"
    case "other":
      return "その他"
  }
}

const debugStepLabels: Record<string, string> = {
  analyze_input: "入力解析",
  normalize_query: "クエリ正規化",
  retrieve_memory: "メモリ検索",
  generate_clues: "検索手掛かり生成",
  plan_search: "検索計画",
  execute_search_action: "検索実行",
  retrieval_evaluator: "検索結果評価",
  evaluate_search_progress: "検索継続判定",
  rerank_chunks: "検索結果再ランキング",
  answerability_gate: "回答可否判定",
  sufficient_context_gate: "根拠充足判定",
  generate_answer: "回答生成",
  validate_citations: "引用検証",
  verify_answer_support: "回答根拠検証",
  finalize_response: "回答確定",
  finalize_refusal: "回答保留確定"
}

export function formatDebugStepLabel(label: string): string {
  return debugStepLabels[label] ?? (label.includes("_") ? "その他の処理" : label)
}

export function formatGraphNodeType(type: DebugGraphNode["type"]): string {
  if (type === "retrieval") return "検索"
  if (type === "decision") return "判定"
  if (type === "answer") return "回答"
  if (type === "refusal") return "回答保留"
  if (type === "repair") return "修復"
  return "処理"
}

export function downloadDebugReplayEnvelope(envelope?: DebugReplayEnvelope | null) {
  if (!envelope) return

  const json = stringifyDebugJson(envelope)
  const blob = new Blob([json], { type: "application/json;charset=utf-8" })
  const objectUrl = typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : undefined
  const link = document.createElement("a")
  link.href = objectUrl ?? `data:application/json;charset=utf-8,${encodeURIComponent(json)}`
  link.download = `debug-replay-${sanitizeFileName(envelope.runSummary.runId)}.json`
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
  if (objectUrl && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(objectUrl)
}

export function getPlaceholderSteps(): DebugStep[] {
  const now = new Date().toISOString()
  return ["入力解析", "クエリ正規化", "MemoRAGメモリ検索", "ベクトル検索", "再ランキング", "根拠チェック", "Bedrock推論", "最終回答"].map((label, index) => ({
    id: index + 1,
    label,
    status: "success" as const,
    latencyMs: 0,
    summary: "質問を送信すると、このステップの実行内容が表示されます。",
    startedAt: now,
    completedAt: now
  }))
}

export function getProcessingSteps(question?: string): DebugStep[] {
  const now = new Date().toISOString()
  const compactQuestion = question?.replace(/\s+/g, " ").trim()
  const summaries = [
    compactQuestion ? `質問を受け付けました: ${compactQuestion.slice(0, 72)}` : "質問を受け付けました。",
    "検索しやすい形に整えています。",
    "関連するメモリとドキュメントを探しています。",
    "候補の根拠を確認しています。",
    "回答を生成しています。"
  ]

  return ["入力受付", "クエリ準備", "根拠検索", "根拠チェック", "回答生成"].map((label, index) => ({
    id: index + 1,
    label,
    status: "success" as const,
    latencyMs: 0,
    summary: summaries[index] ?? "処理しています。",
    startedAt: now,
    completedAt: now
  }))
}

function sanitizeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_")
}
