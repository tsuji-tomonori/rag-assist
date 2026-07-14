import { StatusBadge } from "./StatusBadge.js"
import { operationStatusPresentation, type OperationFeedbackEntry } from "./operationOutcome.js"

export function OperationFeedback({ entry, className }: { entry: OperationFeedbackEntry; className?: string }) {
  const alert = entry.status === "failure" || entry.status === "unknown"
  const classes = ["operation-feedback", `is-${entry.status}`, className].filter(Boolean).join(" ")
  const evidenceRows = evidenceDetails(entry)

  return (
    <section
      className={classes}
      role={alert ? "alert" : "status"}
      aria-live={alert ? "assertive" : "polite"}
      aria-label={`${entry.actionLabel}: ${entry.targetLabel}`}
    >
      <header>
        <div>
          <strong>{entry.actionLabel}</strong>
          <span>{entry.targetLabel}</span>
        </div>
        <StatusBadge presentation={operationStatusPresentation(entry.status)} />
      </header>
      <p>{entry.message}</p>
      <dl>
        {entry.targetId && <FeedbackRow label="対象識別子" value={entry.targetId} />}
        {entry.reason && <FeedbackRow label="理由" value={entry.reason} />}
        {entry.details?.map((detail) => <FeedbackRow key={`${detail.label}-${detail.value}`} label={detail.label} value={detail.value} />)}
        {evidenceRows.map((detail) => <FeedbackRow key={detail.label} label={detail.label} value={detail.value} />)}
      </dl>
    </section>
  )
}

function FeedbackRow({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}

function evidenceDetails(entry: OperationFeedbackEntry): Array<{ label: string; value: string }> {
  const unavailable = "API 応答で未提供"
  const evidence = entry.evidence
  const rows = [
    { label: "操作者", value: evidence?.actor },
    { label: "結果参照", value: evidence?.resultReference },
    { label: "version", value: evidence?.version },
    { label: "監査参照", value: evidence?.auditReference }
  ]
  return rows.flatMap((row) => row.value
    ? [{ label: row.label, value: row.value }]
    : entry.showUnavailableEvidence ? [{ label: row.label, value: unavailable }] : [])
}
