import type { ReactNode } from "react"
import { Icon } from "../../../../shared/components/Icon.js"
import type { DebugStep } from "../../types.js"
import type { DebugReplayEnvelope } from "../../utils/debugTraceReplay.js"

export function DebugExpandedDialog({
  pending,
  envelope,
  replayEnvelope,
  steps,
  children,
  footer,
  onClose
}: {
  pending: boolean
  envelope?: DebugReplayEnvelope | null
  replayEnvelope?: DebugReplayEnvelope | null
  steps: DebugStep[]
  children: ReactNode
  footer: ReactNode
  onClose: () => void
}) {
  return (
    <div className="debug-expanded-backdrop" role="presentation">
      <section className={`debug-expanded-panel ${pending ? "processing" : ""}`} role="dialog" aria-modal="true" aria-label="拡大デバッグパネル" aria-busy={pending}>
        <header className="debug-expanded-head">
          <div>
            <h2>デバッグパネル</h2>
            <span>{pending ? "実行中" : envelope ? `${envelope.graph.nodes.length} ノード` : `${steps.length} ステップ`}</span>
            {replayEnvelope && <span className="debug-source-chip">ローカルJSON</span>}
          </div>
          <button type="button" aria-label="拡大デバッグパネルを閉じる" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        {children}
        {footer}
      </section>
    </div>
  )
}
