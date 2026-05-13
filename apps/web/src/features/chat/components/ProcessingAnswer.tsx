import { LoadingSpinner } from "../../../shared/components/LoadingSpinner.js"

export function ProcessingAnswer({ label }: { label: string }) {
  return (
    <div className="answer-card processing-answer">
      <LoadingSpinner />
      <p>
        {label}
        <span className="animated-dots" aria-hidden="true">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </p>
    </div>
  )
}
