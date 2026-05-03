import type { DebugStep, DebugTrace } from "../../../api.js"
import { Icon } from "../../../shared/components/Icon.js"
import { downloadDebugTrace } from "../../../shared/utils/downloads.js"
import { formatLatency } from "../../../shared/utils/format.js"

export function DebugPanel({
  trace,
  pending = false,
  pendingQuestion,
  allExpanded,
  expandedStepId,
  onToggleAll,
  onToggleStep
}: {
  trace?: DebugTrace
  pending?: boolean
  pendingQuestion?: string
  allExpanded: boolean
  expandedStepId: number | null
  onToggleAll: () => void
  onToggleStep: (stepId: number) => void
}) {
  const steps = pending ? getProcessingSteps(pendingQuestion) : trace?.steps ?? getPlaceholderSteps()
  const statusLabel = pending ? "処理中" : trace ? (trace.status === "success" ? "成功" : trace.status === "warning" ? "注意" : "失敗") : "未実行"

  return (
    <aside className={`debug-card ${pending ? "processing" : ""}`} aria-label="デバッグパネル" aria-busy={pending}>
      <header className="debug-head">
        <div>
          <h2>デバッグパネル</h2>
          <span>{pending ? "実行中" : `${steps.length} ステップ`}</span>
        </div>
        <div className="debug-head-actions">
          <button type="button" onClick={() => void downloadDebugTrace(trace)} disabled={!trace || pending} title="JSONでダウンロード">
            <Icon name="download" />
            <span>JSON DL</span>
          </button>
          <button type="button" onClick={onToggleAll}>{allExpanded ? "すべて閉じる" : "すべて展開"}</button>
          <button type="button" title="拡大表示">
            <Icon name="expand" />
          </button>
        </div>
      </header>

      <div className="debug-steps">
        {steps.map((step) => {
          const expanded = allExpanded || expandedStepId === step.id
          return (
            <article className={`debug-step ${step.status} ${pending ? "processing" : ""}`} key={step.id}>
              <div className="step-index">{step.id}</div>
              <div className="step-body">
                <button className="step-summary" type="button" onClick={() => onToggleStep(step.id)}>
                  <span className="step-state">
                    {pending ? <span className="loading-spinner" aria-hidden="true" /> : <Icon name={step.status === "warning" ? "warning" : "check"} />}
                  </span>
                  <strong>{step.label}</strong>
                  <span className="step-latency">{formatLatency(step.latencyMs)}</span>
                  {step.modelId && <span className="model-chip">{step.modelId}</span>}
                  {step.hitCount !== undefined && <span className="sub-chip">ヒット数: {step.hitCount}件</span>}
                  {step.tokenCount !== undefined && <span className="sub-chip">トークン: {step.tokenCount}</span>}
                  <span className="step-description">{step.summary}</span>
                  <Icon name="chevron" />
                </button>
                {expanded && step.detail && <pre className="step-detail">{step.detail}</pre>}
              </div>
            </article>
          )
        })}
      </div>

      <footer className={`debug-footer ${pending ? "processing" : trace?.status ?? "idle"}`}>
        <span className="footer-status">
          {pending ? <span className="loading-spinner" aria-hidden="true" /> : <Icon name={trace?.status === "warning" ? "warning" : "check"} />}
          <strong>{statusLabel}</strong>
        </span>
        <span>{pending ? "検索と回答生成を実行しています" : trace ? (trace.isAnswerable ? "正常に完了しました" : "回答拒否として完了しました") : "質問すると実行トレースを保存します"}</span>
        <span className="footer-latency">合計レイテンシ <strong>{pending ? "計測中" : trace ? formatLatency(trace.totalLatencyMs) : "-"}</strong></span>
      </footer>
    </aside>
  )
}

function getPlaceholderSteps(): DebugStep[] {
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

function getProcessingSteps(question?: string): DebugStep[] {
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
