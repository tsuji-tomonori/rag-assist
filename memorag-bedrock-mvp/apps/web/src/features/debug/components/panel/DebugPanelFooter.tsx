import type { DebugTrace } from "../../types.js"
import { Icon } from "../../../../shared/components/Icon.js"
import { formatLatency } from "../../../../shared/utils/format.js"
import type { DebugReplayEnvelope } from "../../utils/debugTraceReplay.js"

export function DebugPanelFooter({
  pending,
  envelope,
  activeTrace
}: {
  pending: boolean
  envelope?: DebugReplayEnvelope | null
  activeTrace?: DebugTrace
}) {
  const statusLabel = pending
    ? "処理中"
    : envelope
      ? envelope.runSummary.status === "answered"
        ? "回答"
        : envelope.runSummary.status === "refused"
          ? "拒否"
          : envelope.runSummary.status === "warning"
            ? "注意"
            : "失敗"
      : "未実行"

  return (
    <footer className={`debug-footer ${pending ? "processing" : activeTrace?.status ?? "idle"}`}>
      <span className="footer-status">
        {pending ? <span className="loading-spinner" aria-hidden="true" /> : <Icon name={activeTrace?.status === "warning" ? "warning" : "check"} />}
        <strong>{statusLabel}</strong>
      </span>
      <span>{pending ? "検索と回答生成を実行しています" : activeTrace ? (activeTrace.isAnswerable ? "正常に完了しました" : "回答拒否として完了しました") : "質問すると実行トレースを保存します"}</span>
      <span className="footer-latency">合計レイテンシ <strong>{pending ? "計測中" : activeTrace ? formatLatency(activeTrace.totalLatencyMs) : "-"}</strong></span>
    </footer>
  )
}
