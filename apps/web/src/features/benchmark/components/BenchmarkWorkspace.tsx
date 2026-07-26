import { useState } from "react"
import type { BenchmarkRun, BenchmarkSuite } from "../types.js"
import { ConfirmDialog } from "../../../shared/ui/index.js"
import { Icon } from "../../../shared/ui/Icon.js"
import { LoadingSpinner, LoadingStatus } from "../../../shared/ui/LoadingSpinner.js"
import { downloadBenchmarkArtifact } from "../../../shared/utils/downloads.js"
import { formatDateTime, formatMetricLatency, formatPercent } from "../../../shared/utils/format.js"
import { StatusBadge } from "../../../shared/ui/StatusBadge.js"
import {
  benchmarkModeLabel,
  benchmarkRunnerLabel,
  benchmarkRunStatusPresentation,
  type SemanticTone
} from "../../../shared/ui/displayMetadata.js"
import {
  ResourceStateBoundary,
  type UiResourceState
} from "../../../shared/ui/ResourceState.js"
import {
  hasConfirmedResourceResult,
  isResourcePartAvailable,
  isResourceStateBusy
} from "../../../shared/ui/resourceStateModel.js"
import {
  OperationFeedback,
  feedbackFromOutcome,
  processingOperationFeedback,
  upsertOperationFeedback,
  type OperationFeedbackEntry,
  type OperationOutcome
} from "../../../shared/ui/index.js"

const benchmarkArtifacts = [
  { kind: "report", label: "レポート", description: "レポートMarkdown" },
  { kind: "summary", label: "サマリ", description: "サマリJSON" },
  { kind: "results", label: "結果", description: "未加工の結果 JSONL" },
  { kind: "logs", label: "ログ", description: "実行ログ" }
] as const

export function BenchmarkWorkspace({
  dataState,
  runs,
  suites,
  suiteId,
  modelId,
  concurrency,
  loading,
  canRun,
  canCancel,
  canDownload,
  onSuiteChange,
  onModelChange,
  onConcurrencyChange,
  onStart,
  onRefresh,
  onCancel,
  onBack
}: {
  dataState: UiResourceState
  runs: BenchmarkRun[]
  suites: BenchmarkSuite[]
  suiteId: string
  modelId: string
  concurrency: number
  loading: boolean
  canRun: boolean
  canCancel: boolean
  canDownload: boolean
  onSuiteChange: (suiteId: string) => void
  onModelChange: (modelId: string) => void
  onConcurrencyChange: (concurrency: number) => void
  onStart: () => Promise<OperationOutcome<BenchmarkRun>>
  onRefresh: () => void
  onCancel: (runId: string) => Promise<OperationOutcome<BenchmarkRun>>
  onBack: () => void
}) {
  const selectedSuite = suites.find((suite) => suite.suiteId === suiteId)
  const summary = summarizeBenchmarkRuns(runs)
  const runningCount = runs.filter((run) => run.status === "queued" || run.status === "running").length
  const failedCount = runs.filter((run) => run.status === "failed").length
  const latestRunPresentation = summary.latestRun ? benchmarkRunStatusPresentation(summary.latestRun.status) : undefined
  const hasSuites = suites.length > 0
  const hasRunsResult = dataState.parts.length === 0
    ? hasConfirmedResourceResult(dataState)
    : isResourcePartAvailable(dataState, "runs")
  const hasSuitesResult = dataState.parts.length === 0
    ? hasConfirmedResourceResult(dataState)
    : isResourcePartAvailable(dataState, "suites")
  const [confirmStartOpen, setConfirmStartOpen] = useState(false)
  const [cancelCandidate, setCancelCandidate] = useState<BenchmarkRun | null>(null)
  const [operationFeedback, setOperationFeedback] = useState<OperationFeedbackEntry[]>([])
  const unboundFeedback = operationFeedback.filter((entry) => !entry.targetId || !runs.some((run) => run.runId === entry.targetId))

  return (
    <section className="benchmark-workspace" aria-label="性能テスト">
      <header className="assignee-header">
        <button type="button" onClick={onBack} title="チャットへ戻る" aria-label="チャットへ戻る">
          <Icon name="chevron" />
        </button>
        <div>
          <h2>性能テスト</h2>
          <span>{hasRunsResult ? `${runs.length} 件の実行履歴` : "実行履歴を確認中"}</span>
        </div>
      </header>
      {loading && !isResourceStateBusy(dataState) && <LoadingStatus label="性能テストAPIを処理中" />}

      <ResourceStateBoundary state={dataState} onRetry={onRefresh} onBack={onBack}>
      {hasRunsResult ? <div className="benchmark-kpi-grid">
        <BenchmarkMetricCard
          title="最新テスト結果"
          value={latestRunPresentation?.label ?? "未実行"}
          subValue={summary.latestRun ? `${benchmarkModeLabel(summary.latestRun.mode)} / ${benchmarkRunnerLabel(summary.latestRun.runner)}` : "ジョブ起動後に表示"}
          tone={latestRunPresentation?.tone ?? "neutral"}
        />
        <BenchmarkMetricCard title="成功した実行" value={String(summary.succeededCount)} subValue="成果物をダウンロード可能" tone="success" />
        <BenchmarkMetricCard title="処理中の実行" value={String(runningCount)} subValue="待機中と実行中の合計" tone={runningCount > 0 ? "info" : "neutral"} />
        <BenchmarkMetricCard title="失敗した実行" value={String(failedCount)} subValue="実行ログで原因を確認" tone={failedCount > 0 ? "danger" : "neutral"} />
      </div> : null}

      {unboundFeedback.length > 0 && (
        <div className="benchmark-operation-feedback" aria-label="性能テスト操作結果">
          {unboundFeedback.map((entry) => <OperationFeedback key={entry.id} entry={entry} />)}
        </div>
      )}

      <div className="benchmark-layout">
        <section className="benchmark-run-panel">
          <h3><Icon name="gauge" />ジョブ起動</h3>
          <p className="benchmark-run-panel-note">選択したテスト設定でジョブを起動します。</p>
          <label>
            <span>テスト種別</span>
            <select value={selectedSuite?.suiteId ?? ""} disabled={!hasSuites || !hasSuitesResult} onChange={(event) => onSuiteChange(event.target.value)}>
              {(!hasSuites || !hasSuitesResult) && <option value="">テスト設定を取得できません</option>}
              {suites.map((suite) => (
                <option value={suite.suiteId} key={suite.suiteId}>
                  {suite.label}
                </option>
              ))}
            </select>
          </label>
          <div className="benchmark-mode-grid">
            <div>
              <span>対象</span>
              <strong>{selectedSuite ? benchmarkModeLabel(selectedSuite.mode) : "未選択"}</strong>
            </div>
            <div>
              <span>実行基盤</span>
              <strong>{benchmarkRunnerLabel("codebuild")}</strong>
            </div>
          </div>
          <label>
            <span>データセット</span>
            <input value={selectedSuite?.datasetS3Key ?? "テスト設定を選択してください"} readOnly />
          </label>
          <label>
            <span>モデル</span>
            <select value={modelId} onChange={(event) => onModelChange(event.target.value)}>
              <option value="amazon.nova-lite-v1:0">Nova Lite v1</option>
              <option value="anthropic.claude-3-5-sonnet-20240620-v1:0">Claude 3.5 Sonnet</option>
              <option value="anthropic.claude-3-haiku-20240307-v1:0">Claude 3 Haiku</option>
            </select>
          </label>
          <label>
            <span>並列数</span>
            <input
              type="number"
              min={1}
              max={20}
              value={concurrency}
              onChange={(event) => onConcurrencyChange(Math.max(1, Math.min(20, Number(event.target.value) || 1)))}
            />
          </label>
          <div className="benchmark-actions">
            <button type="button" onClick={() => setConfirmStartOpen(true)} disabled={loading || !canRun || !selectedSuite || !hasSuitesResult}>
              {loading ? <LoadingSpinner className="button-spinner" /> : <Icon name="send" />}
              <span>性能テストを実行</span>
            </button>
            <button type="button" onClick={onRefresh} disabled={loading}>
              {loading ? <LoadingSpinner className="button-spinner" /> : <Icon name="clock" />}
              <span>更新</span>
            </button>
          </div>
        </section>

        {hasRunsResult ? <section className="benchmark-history-panel">
          <div className="history-list-head">
            <h3>実行履歴</h3>
            <span>{runs.length} 件</span>
          </div>
          <div className="benchmark-table-wrap">
            <table className="benchmark-table">
              <thead>
                <tr>
                  <th>実行識別子</th>
                  <th>状態</th>
                  <th>実行内容</th>
                  <th>時刻</th>
                  <th>測定値</th>
                  <th>成果物 / 操作</th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={6}>実行履歴はまだありません。</td>
                  </tr>
                ) : (
                  runs.map((run) => (
                    <tr key={run.runId} className={run.error ? "has-error" : undefined}>
                      <td><code>{run.runId}</code></td>
                      <td><StatusBadge presentation={benchmarkRunStatusPresentation(run.status)} /></td>
                      <td>
                        <div className="benchmark-run-summary">
                          <strong>{suites.find((suite) => suite.suiteId === run.suiteId)?.label ?? "名称未提供"}</strong>
                          <span>{benchmarkModeLabel(run.mode)} / {benchmarkRunnerLabel(run.runner)}</span>
                          {run.modelId ? <small>{run.modelId}</small> : null}
                        </div>
                      </td>
                      <td>
                        <div className="benchmark-time-stack">
                          <span>開始 {formatDateTime(run.startedAt ?? run.createdAt)}</span>
                          <span>更新 {formatDateTime(run.updatedAt)}</span>
                          {run.completedAt ? <span>完了 {formatDateTime(run.completedAt)}</span> : null}
                        </div>
                      </td>
                      <td><BenchmarkMetricChips run={run} /></td>
                      <td>
                        <div className="benchmark-row-actions">
                          {benchmarkArtifacts.map((artifact) => (
                            <button
                              type="button"
                              key={artifact.kind}
                              title={`${artifact.description}をダウンロード`}
                              aria-label={`${artifact.description}をダウンロード`}
                              disabled={!canDownload || !canDownloadArtifact(run, artifact.kind)}
                              onClick={() => void downloadBenchmarkArtifact(run.runId, artifact.kind)}
                            >
                              <Icon name="download" />
                              <span>{artifact.label}</span>
                            </button>
                          ))}
                          <button className="benchmark-cancel-action" type="button" title="ジョブをキャンセル" aria-label={`${run.runId}のジョブをキャンセル`} disabled={!canCancel || loading || !["queued", "running"].includes(run.status)} onClick={() => setCancelCandidate(run)}>
                            {loading ? <LoadingSpinner className="button-spinner" /> : <Icon name="stop" />}
                          </button>
                        </div>
                        {run.error ? <p className="benchmark-run-error">実行ログで詳細を確認してください。</p> : null}
                        {operationFeedback.filter((entry) => entry.targetId === run.runId).map((entry) => (
                          <OperationFeedback key={entry.id} entry={entry} className="benchmark-row-feedback" />
                        ))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section> : null}
      </div>
      </ResourceStateBoundary>
      {confirmStartOpen && (
        <ConfirmDialog
          title="性能テストを実行しますか？"
          description="性能テストの実行基盤を起動します。コストと待ち時間が発生するため、選択内容を確認してください。"
          confirmLabel="実行"
          tone="warning"
          loading={loading}
          details={[
            { label: "テスト設定", value: selectedSuite?.label ?? "未設定" },
            { label: "データセット", value: selectedSuite?.datasetS3Key ?? "未設定" },
            { label: "モデル", value: modelId },
            { label: "並列数", value: String(concurrency) }
          ]}
          onCancel={() => setConfirmStartOpen(false)}
          onConfirm={async () => {
            const base = {
              id: `benchmark-start-${selectedSuite?.suiteId ?? "unselected"}`,
              actionLabel: "性能テスト起動",
              targetLabel: selectedSuite?.label ?? "未選択のテスト設定",
              details: [
                { label: "影響", value: "実行基盤を起動し、コストと待ち時間が発生" },
                { label: "回復条件", value: "起動後は対象 run の取消操作で停止" }
              ]
            }
            setOperationFeedback((current) => upsertOperationFeedback(current, processingOperationFeedback(base)))
            const outcome = await onStart()
            const confirmedBase = outcome.ok && outcome.value
              ? { ...base, targetId: outcome.value.runId }
              : base
            setOperationFeedback((current) => upsertOperationFeedback(current, feedbackFromOutcome(confirmedBase, outcome)))
            if (outcome.ok) setConfirmStartOpen(false)
          }}
        />
      )}
      {cancelCandidate && (
        <ConfirmDialog
          title="この性能テストを取り消しますか？"
          description="実行中の処理を停止します。取消結果が確認できない場合は、再実行せず先に一覧を更新してください。"
          confirmLabel="取り消す"
          tone="danger"
          loading={operationFeedback.some((entry) => entry.id === `benchmark-cancel-${cancelCandidate.runId}` && entry.status === "processing")}
          details={[
            { label: "対象", value: suites.find((suite) => suite.suiteId === cancelCandidate.suiteId)?.label ?? cancelCandidate.suiteId },
            { label: "実行識別子", value: cancelCandidate.runId },
            { label: "影響", value: "未完了の測定と成果物生成を停止します" },
            { label: "回復条件", value: "取消後は再開できず、新しい実行が必要です" },
            { label: "確認が必要な理由", value: "未完了結果の破棄と追加コストを判断するため" }
          ]}
          onCancel={() => setCancelCandidate(null)}
          onConfirm={async () => {
            const target = cancelCandidate
            const base = {
              id: `benchmark-cancel-${target.runId}`,
              actionLabel: "性能テスト取消",
              targetLabel: suites.find((suite) => suite.suiteId === target.suiteId)?.label ?? target.runId,
              targetId: target.runId,
              details: [
                { label: "影響", value: "未完了の測定と成果物生成を停止" },
                { label: "回復条件", value: "取消後は新しい実行が必要" }
              ]
            }
            setOperationFeedback((current) => upsertOperationFeedback(current, processingOperationFeedback(base)))
            const outcome = await onCancel(target.runId)
            setOperationFeedback((current) => upsertOperationFeedback(current, feedbackFromOutcome(base, outcome)))
            if (outcome.ok) setCancelCandidate(null)
          }}
        />
      )}
    </section>
  )
}

function BenchmarkMetricCard({
  title,
  value,
  subValue,
  tone = "neutral"
}: {
  title: string
  value: string
  subValue: string
  tone?: SemanticTone
}) {
  return (
    <article className={`benchmark-kpi-card tone-${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{subValue}</small>
    </article>
  )
}

function BenchmarkMetricChips({ run }: { run: BenchmarkRun }) {
  const chips = [
    run.metrics?.p50LatencyMs == null ? undefined : `p50 ${formatMetricLatency(run.metrics.p50LatencyMs)}`,
    run.metrics?.p95LatencyMs == null ? undefined : `p95 ${formatMetricLatency(run.metrics.p95LatencyMs)}`,
    run.metrics?.answerableAccuracy == null
      ? run.metrics?.turnAnswerCorrectRate == null ? undefined : `ターン正解率 ${formatPercent(run.metrics.turnAnswerCorrectRate)}`
      : `正解率 ${formatPercent(run.metrics.answerableAccuracy)}`,
    run.metrics?.retrievalRecallAt20 == null
      ? run.metrics?.retrievalRecallAtK == null ? undefined : `検索再現率 ${formatPercent(run.metrics.retrievalRecallAtK)}`
      : `検索再現率 ${formatPercent(run.metrics.retrievalRecallAt20)}`,
    run.metrics?.historyDependentAccuracy == null ? undefined : `履歴依存正解率 ${formatPercent(run.metrics.historyDependentAccuracy)}`,
    run.metrics?.clarificationNeedF1 == null ? undefined : `質問F1 ${formatPercent(run.metrics.clarificationNeedF1)}`,
    run.metrics?.errorRate == null ? undefined : `エラー率 ${formatPercent(run.metrics.errorRate)}`
  ].filter((chip): chip is string => Boolean(chip))

  if (chips.length === 0) return <span className="metric-unavailable">{run.status === "queued" || run.status === "running" ? "完了後に集計" : "-"}</span>
  return (
    <div className="benchmark-metric-chips">
      {chips.map((chip) => <span key={chip}>{chip}</span>)}
    </div>
  )
}

function artifactKeyForRun(run: BenchmarkRun, artifact: (typeof benchmarkArtifacts)[number]["kind"]): string | undefined {
  if (artifact === "report") return run.reportS3Key
  if (artifact === "summary") return run.summaryS3Key
  if (artifact === "results") return run.resultsS3Key
  return run.codeBuildLogStreamName ?? run.codeBuildBuildId ?? run.codeBuildLogUrl
}

function canDownloadArtifact(run: BenchmarkRun, artifact: (typeof benchmarkArtifacts)[number]["kind"]): boolean {
  if (!artifactKeyForRun(run, artifact)) return false
  if (artifact === "logs") return true
  return run.status === "succeeded"
}

function summarizeBenchmarkRuns(runs: BenchmarkRun[]): {
  latestRun?: BenchmarkRun
  succeededCount: number
} {
  const completedRuns = runs.filter((run) => ["succeeded", "failed", "cancelled"].includes(run.status))

  return {
    latestRun: runs[0],
    succeededCount: completedRuns.filter((run) => run.status === "succeeded").length
  }
}
