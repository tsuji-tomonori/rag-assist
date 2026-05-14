import { useMemo, useState } from "react"
import { Icon } from "../../../shared/components/Icon.js"
import { LoadingStatus } from "../../../shared/components/LoadingSpinner.js"
import { formatDateTime } from "../../../shared/utils/format.js"
import type { AgentRuntimeProviderDefinition, AsyncAgentRun } from "../types.js"

export function AsyncAgentWorkspace({
  providers,
  runs,
  loading,
  canRun,
  canCancel,
  onRefresh,
  onCancel,
  onBack
}: {
  providers: AgentRuntimeProviderDefinition[]
  runs: AsyncAgentRun[]
  loading: boolean
  canRun: boolean
  canCancel: boolean
  onRefresh: () => void
  onCancel: (agentRunId: string) => Promise<void>
  onBack: () => void
}) {
  const allUnavailable = providers.length > 0 && providers.every((provider) => provider.availability !== "available")
  const [selectedRunId, setSelectedRunId] = useState("")
  const selectedRun = useMemo(() => runs.find((run) => run.agentRunId === selectedRunId) ?? runs[0], [runs, selectedRunId])

  return (
    <section className="agent-workspace" aria-label="非同期エージェント">
      <header className="assignee-header">
        <button type="button" onClick={onBack} title="チャットへ戻る" aria-label="チャットへ戻る">
          <Icon name="chevron" />
        </button>
        <div>
          <h2>非同期エージェント</h2>
          <span>{runs.length} 件の run metadata</span>
        </div>
      </header>
      {loading && <LoadingStatus label="非同期エージェントAPIを処理中" />}

      <div className="agent-layout">
        <section className="agent-panel" aria-label="Provider設定状態">
          <div className="history-list-head">
            <h3>Provider</h3>
            <button type="button" onClick={onRefresh} disabled={loading} title="更新" aria-label="非同期エージェント情報を更新">
              <Icon name="clock" />
              <span>更新</span>
            </button>
          </div>
          {providers.length === 0 ? (
            <p className="agent-empty">provider 設定状態を取得できません。</p>
          ) : (
            <div className="agent-provider-list">
              {providers.map((provider) => (
                <article className="agent-provider-row" key={provider.provider}>
                  <div>
                    <strong>{provider.displayName}</strong>
                    <span>{provider.provider}</span>
                  </div>
                  <span className={`run-status ${provider.availability === "available" ? "succeeded" : "failed"}`}>{providerAvailabilityLabel(provider.availability)}</span>
                  {provider.reason ? <p>{provider.reason}</p> : null}
                </article>
              ))}
            </div>
          )}
          {allUnavailable && (
            <p className="agent-empty">provider は未設定です。G1 では本実行、workspace execution、writeback は利用できません。</p>
          )}
          {!canRun && <p className="agent-empty">非同期エージェント実行権限がありません。</p>}
        </section>

        <section className="agent-panel" aria-label="Run一覧">
          <div className="history-list-head">
            <h3>Run</h3>
            <span>{runs.length} 件</span>
          </div>
          {runs.length === 0 ? (
            <p className="agent-empty">run はまだありません。</p>
          ) : (
            <div className="agent-run-list">
              {runs.map((run) => (
                <button className="agent-run-row" type="button" key={run.agentRunId} aria-label={`${run.agentRunId}の詳細`} aria-current={selectedRun?.agentRunId === run.agentRunId ? "true" : undefined} onClick={() => setSelectedRunId(run.agentRunId)}>
                  <code>{run.agentRunId}</code>
                  <span className={`run-status ${run.status === "completed" ? "succeeded" : run.status === "running" || run.status === "queued" ? "running" : "failed"}`}>{runStatusLabel(run.status)}</span>
                  <span>{run.provider} / {run.modelId}</span>
                  <small>{formatDateTime(run.updatedAt)}</small>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="agent-panel agent-detail-panel" aria-label="Run詳細">
          <div className="history-list-head">
            <h3>詳細</h3>
            {selectedRun ? <code>{selectedRun.runId}</code> : <span>未選択</span>}
          </div>
          {!selectedRun ? (
            <p className="agent-empty">run を選択すると read-only metadata を表示します。</p>
          ) : (
            <div className="agent-detail-grid">
              <span>status</span>
              <strong>{runStatusLabel(selectedRun.status)}</strong>
              <span>provider</span>
              <strong>{selectedRun.providerAvailability === "available" ? selectedRun.provider : providerAvailabilityLabel(selectedRun.providerAvailability)}</strong>
              <span>mount</span>
              <strong>{selectedRun.workspaceMounts.length === 0 ? "未設定" : `${selectedRun.workspaceMounts.length} 件`}</strong>
              <span>artifact</span>
              <strong>{selectedRun.artifacts.length === 0 ? "なし" : `${selectedRun.artifacts.length} 件`}</strong>
              <span>失敗理由</span>
              <strong>{selectedRun.failureReasonCode ? failureReasonLabel(selectedRun.failureReasonCode) : "なし"}</strong>
              {selectedRun.failureReason ? <p className="agent-detail-note">{selectedRun.failureReason}</p> : null}
              <div className="agent-detail-actions">
                <button type="button" disabled={!canCancel || !["queued", "preparing_workspace", "running", "waiting_for_approval"].includes(selectedRun.status)} onClick={() => void onCancel(selectedRun.agentRunId)}>
                  <Icon name="stop" />
                  <span>キャンセル</span>
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  )
}

function providerAvailabilityLabel(availability: AgentRuntimeProviderDefinition["availability"]): string {
  if (availability === "available") return "利用可能"
  if (availability === "not_configured") return "未設定"
  if (availability === "provider_unavailable") return "利用不可"
  return "無効"
}

function runStatusLabel(status: AsyncAgentRun["status"]): string {
  if (status === "completed") return "完了"
  if (status === "blocked") return "ブロック"
  if (status === "cancelled") return "キャンセル"
  if (status === "failed") return "失敗"
  if (status === "running") return "実行中"
  if (status === "preparing_workspace") return "準備中"
  if (status === "waiting_for_approval") return "承認待ち"
  if (status === "expired") return "期限切れ"
  return "待機中"
}

function failureReasonLabel(reason: NonNullable<AsyncAgentRun["failureReasonCode"]>): string {
  if (reason === "not_configured") return "provider 未設定"
  if (reason === "provider_unavailable") return "provider 利用不可"
  if (reason === "cancelled") return "キャンセル"
  return "実行エラー"
}
