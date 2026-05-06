import type { BenchmarkRun, BenchmarkSuite } from "../types.js"
import { Icon } from "../../../shared/components/Icon.js"
import { downloadBenchmarkArtifact } from "../../../shared/utils/downloads.js"
import { formatDateTime, formatMetricLatency, formatPercent, formatShortDate, runStatusLabel } from "../../../shared/utils/format.js"

const benchmarkArtifacts = [
  { kind: "report", label: "レポート", description: "レポートMarkdown" },
  { kind: "summary", label: "サマリ", description: "サマリJSON" },
  { kind: "results", label: "結果", description: "Raw results JSONL" }
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

      <div className="benchmark-kpi-grid">
        <BenchmarkMetricCard
          title="最新テスト結果"
          value={summary.latestRun ? runStatusLabel(summary.latestRun.status) : "未実行"}
          subValue={summary.latestRun ? `実行ID: ${summary.latestRun.runId}` : "ジョブ起動後に表示"}
          tone={summary.latestRun?.status ?? "queued"}
        />
        <BenchmarkMetricCard title="平均応答時間" value={formatSummaryLatency(summary.averageLatencyMs, summary.completedCount)} subValue="直近完了 run の平均" />
        <BenchmarkMetricCard title="回答正答率" value={formatSummaryPercent(summary.answerableAccuracy, summary.completedCount)} subValue="answerable accuracy" />
        <BenchmarkMetricCard title="検索再現率" value={formatSummaryPercent(summary.retrievalRecallAt20, summary.completedCount)} subValue="retrieval recall@20" />
        <BenchmarkMetricCard title="確認質問F1" value={formatSummaryPercent(summary.clarificationNeedF1, summary.completedCount)} subValue="clarification need F1" />
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
              <Icon name="send" />
              <span>性能テストを実行</span>
            </button>
            <button type="button" onClick={onRefresh} disabled={loading}>
              <Icon name="clock" />
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
                  <th>suite</th>
                  <th>p50</th>
                  <th>p95</th>
                  <th>accuracy</th>
                  <th>recall</th>
                  <th>startedAt</th>
                  <th>成果物</th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={9}>実行履歴はまだありません。</td>
                  </tr>
                ) : (
                  runs.map((run) => (
                    <tr key={run.runId}>
                      <td><code>{run.runId}</code></td>
                      <td><span className={`run-status ${run.status}`}>{runStatusLabel(run.status)}</span></td>
                      <td>{run.suiteId}</td>
                      <MetricCell value={run.metrics?.p50LatencyMs} formatter={formatMetricLatency} run={run} />
                      <MetricCell value={run.metrics?.p95LatencyMs} formatter={formatMetricLatency} run={run} />
                      <MetricCell value={run.metrics?.answerableAccuracy} formatter={formatPercent} run={run} />
                      <MetricCell value={run.metrics?.retrievalRecallAt20} formatter={formatPercent} run={run} />
                      <td>{formatDateTime(run.startedAt ?? run.createdAt)}</td>
                      <td>
                        <div className="benchmark-row-actions">
                          {benchmarkArtifacts.map((artifact) => (
                            <button
                              type="button"
                              key={artifact.kind}
                              title={`${artifact.description}をダウンロード`}
                              aria-label={`${artifact.description}をダウンロード`}
                              disabled={!canDownload || !artifactKeyForRun(run, artifact.kind)}
                              onClick={() => void downloadBenchmarkArtifact(run.runId, artifact.kind)}
                            >
                              <Icon name="download" />
                              <span>{artifact.label}</span>
                            </button>
                          ))}
                          <button className="benchmark-cancel-action" type="button" title="ジョブをキャンセル" aria-label="ジョブをキャンセル" disabled={!canCancel || loading || !["queued", "running"].includes(run.status)} onClick={() => void onCancel(run.runId)}>
                            <Icon name="stop" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="benchmark-summary-grid">
        <section className="benchmark-summary-panel">
          <div className="history-list-head">
            <h3>結果サマリー</h3>
            <span>{summary.completedCount} 件の完了 run</span>
          </div>
          <div className="benchmark-trend-bars" aria-label="p95応答時間推移">
            {summary.trendRuns.length === 0 ? (
              <span>完了 run の metrics が登録されると推移を表示します。</span>
            ) : (
              summary.trendRuns.map((run) => (
                <div className="benchmark-trend-bar" key={run.runId}>
                  <i style={{ height: `${Math.max(12, Math.min(108, (run.metrics?.p95LatencyMs ?? 0) / 25))}px` }} />
                  <strong>{formatShortDate(run.completedAt ?? run.updatedAt)}</strong>
                </div>
              ))
            )}
          </div>
          <div className="benchmark-quality-grid">
            <div><span>成功率</span><strong>{formatSummaryPercent(summary.runSuccessRate, summary.completedCount)}</strong></div>
            <div><span>エラー率</span><strong>{formatSummaryPercent(summary.errorRate, summary.completedCount)}</strong></div>
            <div><span>失敗HTTP</span><strong>{summary.failedHttpCount}</strong></div>
          </div>
        </section>

        <section className="benchmark-contract-panel">
          <div className="history-list-head">
            <h3>必要なAPI/データ</h3>
            <span>main 実装を利用</span>
          </div>
          <ul>
            <li><code>GET /benchmark-suites</code><span>実行可能な suite と dataset を取得</span></li>
            <li><code>POST /benchmark-runs</code><span>性能テスト run を queue に登録</span></li>
            <li><code>GET /benchmark-runs</code><span>履歴、status、metrics、artifact key を取得</span></li>
            <li><code>BenchmarkRunsTable</code><span><code>runId</code> 単位で実行状態と metrics を保持</span></li>
          </ul>
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

function MetricCell({
  value,
  formatter,
  run
}: {
  value?: number | null
  formatter: (value?: number | null) => string
  run: BenchmarkRun
}) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return <td>{formatter(value)}</td>
  }

  return <td><span className="metric-unavailable">{metricUnavailableLabel(run)}</span></td>
}

function formatSummaryLatency(value: number | null | undefined, completedCount: number): string {
  if (typeof value === "number" && Number.isFinite(value)) return formatMetricLatency(value)
  return completedCount === 0 ? "完了後に集計" : "未計測"
}

function formatSummaryPercent(value: number | null | undefined, completedCount: number): string {
  if (typeof value === "number" && Number.isFinite(value)) return formatPercent(value)
  return completedCount === 0 ? "完了後に集計" : "未計測"
}

function metricUnavailableLabel(run: BenchmarkRun): string {
  if (run.status === "queued" || run.status === "running") return "完了後に集計"
  return "未計測"
}

function artifactKeyForRun(run: BenchmarkRun, artifact: (typeof benchmarkArtifacts)[number]["kind"]): string | undefined {
  if (artifact === "report") return run.reportS3Key
  if (artifact === "summary") return run.summaryS3Key
  return run.resultsS3Key
}

function summarizeBenchmarkRuns(runs: BenchmarkRun[]): {
  latestRun?: BenchmarkRun
  completedCount: number
  runSuccessRate?: number
  averageLatencyMs?: number | null
  answerableAccuracy?: number | null
  clarificationNeedF1?: number | null
  retrievalRecallAt20?: number | null
  errorRate?: number | null
  failedHttpCount: number
  trendRuns: BenchmarkRun[]
} {
  const completedRuns = runs.filter((run) => ["succeeded", "failed", "cancelled"].includes(run.status))
  const metricRuns = completedRuns.filter((run) => run.metrics)
  const runSuccessRate = completedRuns.length > 0
    ? completedRuns.filter((run) => run.status === "succeeded").length / completedRuns.length
    : undefined

  return {
    latestRun: runs[0],
    completedCount: completedRuns.length,
    runSuccessRate,
    averageLatencyMs: averageNullable(metricRuns.map((run) => run.metrics?.averageLatencyMs ?? run.metrics?.p50LatencyMs)),
    answerableAccuracy: averageNullable(metricRuns.map((run) => run.metrics?.answerableAccuracy)),
    clarificationNeedF1: averageNullable(metricRuns.map((run) => run.metrics?.clarificationNeedF1)),
    retrievalRecallAt20: averageNullable(metricRuns.map((run) => run.metrics?.retrievalRecallAt20)),
    errorRate: averageNullable(metricRuns.map((run) => run.metrics?.errorRate)),
    failedHttpCount: metricRuns.reduce((total, run) => total + (run.metrics?.failedHttp ?? 0), 0),
    trendRuns: metricRuns
      .filter((run) => typeof run.metrics?.p95LatencyMs === "number")
      .sort((a, b) => (a.completedAt ?? a.updatedAt).localeCompare(b.completedAt ?? b.updatedAt))
      .slice(-7)
  }
}

function averageNullable(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  if (valid.length === 0) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}
