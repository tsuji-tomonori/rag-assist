import type { DebugStep } from "../../types.js"
import { stringifyDebugJson, type DebugGraphNode, type DebugReplayEnvelope } from "../../utils/debugTraceReplay.js"

export function formatGraphGroup(group: DebugGraphNode["group"]): string {
  switch (group) {
    case "preprocess":
      return "preprocess"
    case "search-loop":
      return "search loop"
    case "context":
      return "context"
    case "answer":
      return "answer"
    case "finalize":
      return "finalize"
    case "other":
      return "other"
  }
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
