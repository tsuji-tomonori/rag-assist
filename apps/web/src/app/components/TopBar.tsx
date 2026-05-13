import { Icon } from "../../shared/components/Icon.js"

export function TopBar({
  debugMode,
  canReadDebugRuns,
  onDebugModeChange,
  onNewConversation
}: {
  debugMode: boolean
  canReadDebugRuns: boolean
  onDebugModeChange: (enabled: boolean) => void
  onNewConversation: () => void
}) {
  return (
    <header className="topbar">
      <h1>社内QAチャットボットエージェント</h1>
      {canReadDebugRuns && (
        <label className="debug-toggle">
          <span>デバッグモード</span>
          <input type="checkbox" checked={debugMode} onChange={(event) => onDebugModeChange(event.target.checked)} />
          <i aria-hidden="true">{debugMode ? "ON" : "OFF"}</i>
        </label>
      )}
      <button className="new-chat-button" type="button" onClick={onNewConversation}>
        <Icon name="plus" />
        <span>新しい会話</span>
      </button>
    </header>
  )
}
