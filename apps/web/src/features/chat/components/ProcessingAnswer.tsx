import { LoadingSpinner } from "../../../shared/components/LoadingSpinner.js"
import { StatusBadge } from "../../../shared/ui/StatusBadge.js"

export function ProcessingAnswer({ label }: { label: string }) {
  return (
    <div className="answer-card processing-answer">
      <LoadingSpinner />
      <div>
        <StatusBadge presentation={{ label: "処理中", tone: "info", description: "回答はまだ確定していません" }} />
        <p>
          {label}
          <span className="animated-dots" aria-hidden="true">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </p>
      </div>
    </div>
  )
}
