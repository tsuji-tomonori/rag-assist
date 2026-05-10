import type { DebugTrace } from "../types.js"
import { useDebugReplay } from "../hooks/useDebugReplay.js"
import { DebugExpandedDialog } from "./panel/DebugExpandedDialog.js"
import { DebugPanelBody } from "./panel/DebugPanelBody.js"
import { DebugPanelFooter } from "./panel/DebugPanelFooter.js"
import { DebugPanelHeader } from "./panel/DebugPanelHeader.js"
import { getPlaceholderSteps, getProcessingSteps } from "./panel/debugPanelUtils.js"

export function DebugPanel({
  trace,
  pending = false,
  pendingQuestion,
  allExpanded,
  expandedStepId,
  onToggleAll,
  onToggleStep
}: {
  trace?: DebugTrace
  pending?: boolean
  pendingQuestion?: string
  allExpanded: boolean
  expandedStepId: number | null
  onToggleAll: () => void
  onToggleStep: (stepId: number) => void
}) {
  const replay = useDebugReplay({ trace, pending })
  const steps = pending ? getProcessingSteps(pendingQuestion) : trace?.steps ?? getPlaceholderSteps()
  const body = (
    <>
      {replay.uploadError && <p className="debug-upload-error">{replay.uploadError}</p>}
      <DebugPanelBody
        pending={pending}
        envelope={replay.envelope}
        activeTrace={replay.activeTrace}
        steps={steps}
        selectedNode={replay.selectedNode}
        selectedDetail={replay.selectedDetail}
        allExpanded={allExpanded}
        expandedStepId={expandedStepId}
        onSelectNode={replay.setSelectedNodeId}
        onToggleStep={onToggleStep}
      />
    </>
  )
  const footer = <DebugPanelFooter pending={pending} envelope={replay.envelope} activeTrace={replay.activeTrace} />

  return (
    <>
      <aside className={`debug-card ${pending ? "processing" : ""}`} aria-label="デバッグパネル" aria-busy={pending}>
        <DebugPanelHeader
          pending={pending}
          envelope={replay.envelope}
          replayEnvelope={replay.replayEnvelope}
          activeTrace={replay.activeTrace}
          steps={steps}
          allExpanded={allExpanded}
          onUploadDebugJson={replay.onUploadDebugJson}
          onClearReplay={replay.clearReplay}
          onToggleAll={onToggleAll}
          onExpand={() => replay.setExpanded(true)}
        />
        {body}
        {footer}
      </aside>
      {replay.expanded && (
        <DebugExpandedDialog
          pending={pending}
          envelope={replay.envelope}
          replayEnvelope={replay.replayEnvelope}
          steps={steps}
          footer={footer}
          onClose={() => replay.setExpanded(false)}
        >
          {body}
        </DebugExpandedDialog>
      )}
    </>
  )
}
