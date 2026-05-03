import type { DebugTrace, DocumentManifest } from "../../api.js"
import { Icon } from "../../shared/components/Icon.js"

export function TopBar({
  modelId,
  documents,
  selectedDocumentId,
  debugRuns,
  latestTrace,
  selectedRunValue,
  totalLatency,
  debugMode,
  canReadDocuments,
  canReadDebugRuns,
  pendingDebugQuestion,
  onModelChange,
  onDocumentChange,
  onRunChange,
  onDebugModeChange,
  onNewConversation
}: {
  modelId: string
  documents: DocumentManifest[]
  selectedDocumentId: string
  debugRuns: DebugTrace[]
  latestTrace?: DebugTrace
  selectedRunValue: string
  totalLatency: string
  debugMode: boolean
  canReadDocuments: boolean
  canReadDebugRuns: boolean
  pendingDebugQuestion: string | null
  onModelChange: (modelId: string) => void
  onDocumentChange: (documentId: string) => void
  onRunChange: (runId: string) => void
  onDebugModeChange: (enabled: boolean) => void
  onNewConversation: () => void
}) {
  return (
    <header className="topbar">
      <h1>社内QAチャットボットエージェント</h1>
      <label className="top-control">
        <span>モデル</span>
        <select value={modelId} onChange={(event) => onModelChange(event.target.value)}>
          <option value="amazon.nova-lite-v1:0">Nova Lite v1</option>
          <option value="anthropic.claude-3-5-sonnet-20240620-v1:0">Claude 3.5 Sonnet</option>
          <option value="anthropic.claude-3-haiku-20240307-v1:0">Claude 3 Haiku</option>
        </select>
      </label>
      {canReadDocuments && (
        <div className="top-control document-control">
          <label htmlFor="document-select">ドキュメント</label>
          <div className="document-select-row">
            <select id="document-select" value={selectedDocumentId} onChange={(event) => onDocumentChange(event.target.value)}>
              <option value="all">すべての資料</option>
              {documents.map((document) => (
                <option value={document.documentId} key={document.documentId}>
                  {document.fileName}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {canReadDebugRuns && (
        <>
          <label className="top-control run-control">
            <span>実行ID</span>
            <select
              value={selectedRunValue}
              onChange={(event) => onRunChange(event.target.value)}
              disabled={pendingDebugQuestion !== null || (debugRuns.length === 0 && !latestTrace)}
            >
              {pendingDebugQuestion ? <option value="__processing__">処理中</option> : <option value="">未実行</option>}
              {(latestTrace && !debugRuns.some((run) => run.runId === latestTrace.runId) ? [latestTrace, ...debugRuns] : debugRuns).map((run) => (
                <option value={run.runId} key={run.runId}>
                  {run.runId}
                </option>
              ))}
            </select>
          </label>
          <div className="latency-block">
            <span>総レイテンシ</span>
            <strong>{totalLatency}</strong>
          </div>
          <label className="debug-toggle">
            <span>デバッグモード</span>
            <input type="checkbox" checked={debugMode} onChange={(event) => onDebugModeChange(event.target.checked)} />
            <i aria-hidden="true">{debugMode ? "ON" : "OFF"}</i>
          </label>
        </>
      )}
      <button className="new-chat-button" type="button" onClick={onNewConversation}>
        <Icon name="plus" />
        <span>新しい会話</span>
      </button>
    </header>
  )
}
