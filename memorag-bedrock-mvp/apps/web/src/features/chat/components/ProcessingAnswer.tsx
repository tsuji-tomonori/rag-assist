export function ProcessingAnswer({ label }: { label: string }) {
  return (
    <div className="answer-card processing-answer">
      <span className="loading-spinner" aria-hidden="true" />
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
