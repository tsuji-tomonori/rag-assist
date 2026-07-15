import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { Button } from "../ui/Button.js"

export function ConfirmDialog({
  title,
  description,
  details = [],
  confirmLabel = "実行",
  cancelLabel = "キャンセル",
  tone = "danger",
  loading = false,
  confirmDisabled = false,
  children,
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
  confirmDisabled?: boolean
  children?: ReactNode
  onCancel: () => void
  onConfirm: () => Promise<void> | void
}) {
  const dialogRef = useRef<HTMLElement | null>(null)
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const [confirming, setConfirming] = useState(false)
  const busy = loading || confirming

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

  function trapFocus(event: KeyboardEvent<HTMLElement>) {
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
      <section
        ref={dialogRef}
        className={`confirm-dialog ${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        aria-busy={busy}
        onKeyDown={trapFocus}
      >
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
          {children}
        </div>
        <div className="confirm-dialog-actions">
          <Button ref={cancelButtonRef} type="button" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
          <Button type="button" variant={tone} onClick={() => void confirm()} disabled={busy || confirmDisabled}>
            {busy ? "処理中" : confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  )
}
