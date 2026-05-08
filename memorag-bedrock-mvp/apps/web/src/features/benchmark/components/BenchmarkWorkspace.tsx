import type { BenchmarkRun, BenchmarkSuite } from "../types.js"
import { Icon } from "../../../shared/components/Icon.js"
import { LoadingSpinner, LoadingStatus } from "../../../shared/components/LoadingSpinner.js"
import { downloadBenchmarkArtifact } from "../../../shared/utils/downloads.js"
import { formatDateTime, formatMetricLatency, formatPercent, runStatusLabel } from "../../../shared/utils/format.js"

const benchmarkArtifacts = [
  { kind: "report", label: "レポート", description: "レポートMarkdown" },
  { kind: "summary", label: "サマリ", description: "サマリJSON" },
  { kind: "results", label: "結果", description: "Raw results JSONL" },
  { kind: "logs", label: "ログ", description: "CodeBuildログ" }
] as const

export function BenchmarkWorkspace({
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
  onStart: () => Promise<void>
  onRefresh: () => void
  onCancel: (runId: string) => Promise<void>
  onBack: () => void
}) {
  const selectedSuite = suites.find((suite) => suite.suiteId === suiteId)
  const summary = summarizeBenchmarkRuns(runs)
  const runningCount = runs.filter((run) => run.status === "queued" || run.status === "running").length
  const failedCount = runs.filter((run) => run.status === "failed").length

  return (
    <section className="benchmark-workspace" aria-label="性能テスト">
      <header className="assignee-header">
        <button type="button" onClick={onBack} title="チャットへ戻る">
          <Icon name="chevron" />
        </button>
        <div>
          <h2>性能テスト</h2>
          <span>{runs.length} 件の実行履歴</span>
        </div>
      </header>
      {loading && <LoadingStatus label="性能テストAPIを処理中" />}

      <div className="benchmark-kpi-grid">
        <BenchmarkMetricCard
          title="最新テスト結果"
          value={summary.latestRun ? runStatusLabel(summary.latestRun.status) : "未実行"}
          subValue={summary.latestRun ? `実行ID: ${summary.latestRun.runId}` : "ジョブ起動後に表示"}
          tone={summary.latestRun?.status ?? "queued"}
        />
        <BenchmarkMetricCard title="成功 run" value={String(summary.succeededCount)} subValue="成果物をダウンロード可能" tone="succeeded" />
        <BenchmarkMetricCard title="処理中 run" value={String(runningCount)} subValue="queued / running" tone={runningCount > 0 ? "running" : "queued"} />
        <BenchmarkMetricCard title="失敗 run" value={String(failedCount)} subValue="CodeBuildログで原因確認" tone={failedCount > 0 ? "failed" : "queued"} />
      </div>

      <div className="benchmark-layout">
        <section className="benchmark-run-panel">
          <h3><Icon name="gauge" />ジョブ起動</h3>
          <p className="benchmark-run-panel-note">ワンクリックで選択 suite を実行します。</p>
          <label>
            <span>テスト種別</span>
            <select value={suiteId} onChange={(event) => onSuiteChange(event.target.value)}>
              {suites.length === 0 && <option value={suiteId}>standard-agent-v1</option>}
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
              <strong>{selectedSuite?.mode === "agent" ? "エージェント" : selectedSuite?.mode ?? "agent"}</strong>
            </div>
            <div>
              <span>Runner</span>
              <strong>CodeBuild</strong>
            </div>
          </div>
          <label>
            <span>データセット</span>
            <input value={selectedSuite?.datasetS3Key ?? "datasets/agent/standard-v1.jsonl"} readOnly />
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
            <button type="button" onClick={onStart} disabled={loading || !canRun}>
              {loading ? <LoadingSpinner className="button-spinner" /> : <Icon name="send" />}
              <span>性能テストを実行</span>
            </button>
            <button type="button" onClick={onRefresh} disabled={loading}>
              {loading ? <LoadingSpinner className="button-spinner" /> : <Icon name="clock" />}
              <span>更新</span>
            </button>
          </div>
        </section>

        <section className="benchmark-history-panel">
          <div className="history-list-head">
            <h3>実行履歴</h3>
            <span>{runs.length} 件</span>
          </div>
          <div className="benchmark-table-wrap">
            <table className="benchmark-table">
              <thead>
                <tr>
                  <th>runId</th>
                  <th>status</th>
                  <th>実行内容</th>
                  <th>時刻</th>
                  <th>metrics</th>
                  <th>DL / 操作</th>
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
                      <td><span className={`run-status ${run.status}`}>{runStatusLabel(run.status)}</span></td>
                      <td>
                        <div className="benchmark-run-summary">
                          <strong>{run.suiteId}</strong>
                          <span>{run.mode} / {run.runner}</span>
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
                          <button className="benchmark-cancel-action" type="button" title="ジョブをキャンセル" aria-label="ジョブをキャンセル" disabled={!canCancel || loading || !["queued", "running"].includes(run.status)} onClick={() => void onCancel(run.runId)}>
                            {loading ? <LoadingSpinner className="button-spinner" /> : <Icon name="stop" />}
                          </button>
                        </div>
                        {run.error ? <p className="benchmark-run-error">{summarizeRunError(run.error)}</p> : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  )
}

function BenchmarkMetricCard({
  title,
  value,
  subValue,
  tone = "succeeded"
}: {
  title: string
  value: string
  subValue: string
  tone?: BenchmarkRun["status"]
}) {
  return (
    <article className={`benchmark-kpi-card ${tone}`}>
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
    run.metrics?.answerableAccuracy == null ? undefined : `accuracy ${formatPercent(run.metrics.answerableAccuracy)}`,
    run.metrics?.retrievalRecallAt20 == null ? undefined : `recall ${formatPercent(run.metrics.retrievalRecallAt20)}`,
    run.metrics?.clarificationNeedF1 == null ? undefined : `質問F1 ${formatPercent(run.metrics.clarificationNeedF1)}`,
    run.metrics?.errorRate == null ? undefined : `error ${formatPercent(run.metrics.errorRate)}`
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

function summarizeRunError(error: string): string {
  const compact = error.replace(/\s+/g, " ").trim()
  return compact.length <= 72 ? compact : `${compact.slice(0, 72)}...`
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
