import type { ChangeEvent } from "react"
import type { DebugStep, DebugTrace } from "../../types.js"
import { Icon } from "../../../../shared/components/Icon.js"
import { downloadDebugTrace } from "../../../../shared/utils/downloads.js"
import type { DebugReplayEnvelope } from "../../utils/debugTraceReplay.js"
import { downloadDebugReplayEnvelope } from "./debugPanelUtils.js"

export function DebugPanelHeader({
  pending,
  envelope,
  replayEnvelope,
  activeTrace,
  steps,
  allExpanded,
  onUploadDebugJson,
  onClearReplay,
  onToggleAll,
  onExpand
}: {
  pending: boolean
  envelope?: DebugReplayEnvelope | null
  replayEnvelope?: DebugReplayEnvelope | null
  activeTrace?: DebugTrace
  steps: DebugStep[]
  allExpanded: boolean
  onUploadDebugJson: (event: ChangeEvent<HTMLInputElement>) => void
  onClearReplay: () => void
  onToggleAll: () => void
  onExpand: () => void
}) {
  return (
    <header className="debug-head">
      <div>
        <h2>デバッグパネル</h2>
        <span>{pending ? "実行中" : envelope ? `${envelope.graph.nodes.length} ノード` : `${steps.length} ステップ`}</span>
        {replayEnvelope && <span className="debug-source-chip">ローカルJSON</span>}
      </div>
      <div className="debug-head-actions">
        <button type="button" onClick={() => void downloadDebugTrace(activeTrace)} disabled={!activeTrace || pending || Boolean(replayEnvelope)} title="保存済みJSONをダウンロード">
          <Icon name="download" />
          <span>保存JSON</span>
        </button>
        <button type="button" onClick={() => downloadDebugReplayEnvelope(envelope)} disabled={!envelope || pending} title="可視化JSONをダウンロード">
          <Icon name="download" />
          <span>可視化JSON</span>
        </button>
        <label className="debug-upload-button" title="JSONをアップロード">
          <Icon name="plus" />
          <span>JSONをアップロード</span>
          <input type="file" accept="application/json,.json" onChange={(event) => void onUploadDebugJson(event)} />
        </label>
        {replayEnvelope && (
          <button type="button" onClick={onClearReplay} title="アップロード表示を解除">
            解除
          </button>
        )}
        {!envelope && (
          <button type="button" aria-expanded={allExpanded} onClick={onToggleAll}>{allExpanded ? "すべて閉じる" : "すべて展開"}</button>
        )}
        <button type="button" className="debug-expand-button" title="拡大表示" aria-label="デバッグパネルを拡大表示" onClick={onExpand}>
          <Icon name="expand" />
        </button>
      </div>
    </header>
  )
}
