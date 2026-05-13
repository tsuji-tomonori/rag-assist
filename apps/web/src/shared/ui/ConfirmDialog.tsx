import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react"

export function ConfirmDialog({
  title,
  message,
  rows,
  confirmLabel,
  loading = false,
  errorMessage,
  danger = false,
  onCancel,
  onConfirm,
  children
}: {
  title: string
  message: string
  rows?: Array<{ label: string; value: string }>
  confirmLabel: string
  loading?: boolean
  errorMessage?: string | null
  danger?: boolean
  onCancel: () => void
  onConfirm: () => Promise<void> | void
  children?: ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const [confirming, setConfirming] = useState(false)
  const busy = loading || confirming
  const descriptionId = "confirm-dialog-description"
  const errorId = errorMessage ? "confirm-dialog-error" : undefined

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    cancelButtonRef.current?.focus()
    return () => {
      returnFocusRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
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

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable || focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="confirm-dialog-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={errorId ? `${descriptionId} ${errorId}` : descriptionId}
        aria-busy={busy}
        onKeyDown={trapFocus}
      >
        <h3 id="confirm-dialog-title">{title}</h3>
        <p id={descriptionId}>{message}</p>
        {rows && rows.length > 0 && (
          <dl>
            {rows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {children}
        {errorMessage && <p id={errorId} className="confirm-dialog-error" role="alert">{errorMessage}</p>}
        <div className="confirm-dialog-actions">
          <button ref={cancelButtonRef} type="button" onClick={onCancel} disabled={busy}>キャンセル</button>
          <button type="button" className={danger ? "danger" : ""} onClick={() => void confirm()} disabled={busy}>
            {busy ? "処理中" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
