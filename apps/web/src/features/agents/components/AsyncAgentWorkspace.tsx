import { useMemo, useState } from "react"
import { Icon } from "../../../shared/components/Icon.js"
import { LoadingStatus } from "../../../shared/components/LoadingSpinner.js"
import { formatDateTime } from "../../../shared/utils/format.js"
import { StatusBadge } from "../../../shared/ui/StatusBadge.js"
import {
  agentAvailabilityPresentation,
  agentFailureReasonLabel,
  agentRunStatusPresentation
} from "../../../shared/ui/displayMetadata.js"
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
  const providerDisplayName = (run: AsyncAgentRun) => providers.find((provider) => provider.provider === run.provider)?.displayName ?? "名称未提供"

  return (
    <section className="agent-workspace" aria-label="非同期エージェント">
      <header className="assignee-header">
        <button type="button" onClick={onBack} title="チャットへ戻る" aria-label="チャットへ戻る">
          <Icon name="chevron" />
        </button>
        <div>
          <h2>非同期エージェント</h2>
          <span>{runs.length} 件の実行履歴</span>
        </div>
      </header>
      {loading && <LoadingStatus label="非同期エージェントAPIを処理中" />}

      <div className="agent-layout">
        <section className="agent-panel" aria-label="実行環境の設定状態">
          <div className="history-list-head">
            <h3>実行環境</h3>
            <button type="button" onClick={onRefresh} disabled={loading} title="更新" aria-label="非同期エージェント情報を更新">
              <Icon name="clock" />
              <span>更新</span>
            </button>
          </div>
          {providers.length === 0 ? (
            <p className="agent-empty">実行環境の設定状態を取得できません。</p>
          ) : (
            <div className="agent-provider-list">
              {providers.map((provider) => (
                <article className="agent-provider-row" key={provider.provider}>
                  <div>
                    <strong>{provider.displayName}</strong>
                    <span>非同期処理の実行環境</span>
                  </div>
                  <StatusBadge presentation={agentAvailabilityPresentation(provider.availability)} />
                  {provider.reason ? <p>設定の詳細は管理者に確認してください。</p> : null}
                </article>
              ))}
            </div>
          )}
          {allUnavailable && (
            <p className="agent-empty">実行環境は未設定です。非同期実行、作業領域での処理、結果の書き戻しは利用できません。</p>
          )}
          {!canRun && <p className="agent-empty">非同期エージェント実行権限がありません。</p>}
        </section>

        <section className="agent-panel" aria-label="実行一覧">
          <div className="history-list-head">
            <h3>実行履歴</h3>
            <span>{runs.length} 件</span>
          </div>
          {runs.length === 0 ? (
            <p className="agent-empty">実行履歴はまだありません。</p>
          ) : (
            <div className="agent-run-list">
              {runs.map((run) => (
                <button className="agent-run-row" type="button" key={run.agentRunId} aria-label={`${providerDisplayName(run)}の非同期実行（${formatDateTime(run.updatedAt)}、識別子: ${run.agentRunId}）を表示`} aria-current={selectedRun?.agentRunId === run.agentRunId ? "true" : undefined} onClick={() => setSelectedRunId(run.agentRunId)}>
                  <strong>{providerDisplayName(run)} の実行</strong>
                  <StatusBadge presentation={agentRunStatusPresentation(run.status)} />
                  <span>{run.modelId}</span>
                  <small>{formatDateTime(run.updatedAt)}</small>
                  <small>実行識別子: <code>{run.agentRunId}</code></small>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="agent-panel agent-detail-panel" aria-label="実行詳細">
          <div className="history-list-head">
            <h3>詳細</h3>
            {selectedRun ? <code>{selectedRun.runId}</code> : <span>未選択</span>}
          </div>
          {!selectedRun ? (
            <p className="agent-empty">実行を選択すると読み取り専用の詳細を表示します。</p>
          ) : (
            <div className="agent-detail-grid">
              <span>状態</span>
              <strong><StatusBadge presentation={agentRunStatusPresentation(selectedRun.status)} /></strong>
              <span>実行環境</span>
              <strong>{selectedRun.providerAvailability === "available" ? providerDisplayName(selectedRun) : agentAvailabilityPresentation(selectedRun.providerAvailability).label}</strong>
              <span>作業領域</span>
              <strong>{selectedRun.workspaceMounts.length === 0 ? "未設定" : `${selectedRun.workspaceMounts.length} 件`}</strong>
              <span>成果物</span>
              <strong>{selectedRun.artifacts.length === 0 ? "なし" : `${selectedRun.artifacts.length} 件`}</strong>
              <span>失敗理由</span>
              <strong>{selectedRun.failureReasonCode ? agentFailureReasonLabel(selectedRun.failureReasonCode) : "なし"}</strong>
              {selectedRun.failureReason ? <p className="agent-detail-note">詳細は実行ログを確認してください。</p> : null}
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
