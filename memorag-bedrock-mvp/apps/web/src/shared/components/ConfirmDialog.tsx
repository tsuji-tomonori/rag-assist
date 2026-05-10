import { useEffect, useState } from "react"

export function ConfirmDialog({
  title,
  description,
  details = [],
  confirmLabel = "実行",
  cancelLabel = "キャンセル",
  tone = "danger",
  loading = false,
  onCancel,
  onConfirm
}: {
  title: string
  description: string
  details?: string[]
  confirmLabel?: string
  cancelLabel?: string
  tone?: "danger" | "warning"
  loading?: boolean
  onCancel: () => void
  onConfirm: () => Promise<void> | void
}) {
  const [confirming, setConfirming] = useState(false)
  const busy = loading || confirming

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [busy, onCancel])

  async function confirm() {
    if (busy) return
    setConfirming(true)
    try {
      await onConfirm()
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="confirm-dialog-backdrop" role="presentation">
      <section className={`confirm-dialog ${tone}`} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description">
        <div className="confirm-dialog-body">
          <h2 id="confirm-dialog-title">{title}</h2>
          <p id="confirm-dialog-description">{description}</p>
          {details.length > 0 && (
            <dl>
              {details.map((detail) => {
                const [label, ...valueParts] = detail.split(":")
                const value = valueParts.join(":").trim()
                return (
                  <div key={detail}>
                    <dt>{value ? label : "影響"}</dt>
                    <dd>{value || detail}</dd>
                  </div>
                )
              })}
            </dl>
          )}
        </div>
        <div className="confirm-dialog-actions">
          <button type="button" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button type="button" className="confirm-dialog-primary" onClick={() => void confirm()} disabled={busy}>
            {busy ? "処理中" : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
