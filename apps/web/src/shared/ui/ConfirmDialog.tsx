import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { Button } from "./Button.js"

export type ConfirmDialogDetail = {
  label: string
  value: ReactNode
}

export function ConfirmDialog({
  title,
  description,
  details = [],
  tone = "danger",
  confirmLabel = "実行",
  cancelLabel = "キャンセル",
  loading = false,
  confirmDisabled = false,
  errorMessage,
  children,
  onCancel,
  onConfirm
}: {
  title: string
  description: string
  details?: ConfirmDialogDetail[]
  tone?: "danger" | "warning"
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  confirmDisabled?: boolean
  errorMessage?: string | null
  children?: ReactNode
  onCancel: () => void
  onConfirm: () => Promise<void> | void
}) {
  const dialogRef = useRef<HTMLElement | null>(null)
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const [confirming, setConfirming] = useState(false)
  const titleId = useId()
  const descriptionId = useId()
  const errorId = useId()
  const busy = loading || confirming

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (cancelButtonRef.current?.disabled) dialogRef.current?.focus()
    else cancelButtonRef.current?.focus()
    return () => {
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus()
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape" || busy) return
      if (!dialogRef.current?.contains(document.activeElement)) return
      event.preventDefault()
      event.stopPropagation()
      onCancel()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [busy, onCancel])

  useEffect(() => {
    if (!busy) return
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement && dialogRef.current?.contains(activeElement)) {
      dialogRef.current.focus()
    }
  }, [busy])

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
    if (!focusable || focusable.length === 0) {
      event.preventDefault()
      dialogRef.current?.focus()
      return
    }
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

  const describedBy = errorMessage ? `${descriptionId} ${errorId}` : descriptionId

  return (
    <div className="confirm-dialog-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className={`confirm-dialog ${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        aria-busy={busy}
        tabIndex={-1}
        onKeyDown={trapFocus}
      >
        <div className="confirm-dialog-body">
          <h2 id={titleId}>{title}</h2>
          <p id={descriptionId}>{description}</p>
          {details.length > 0 && (
            <dl>
              {details.map((detail, index) => (
                <div key={`${detail.label}-${index}`}>
                  <dt>{detail.label}</dt>
                  <dd>{detail.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {children}
          {errorMessage && (
            <p id={errorId} className="confirm-dialog-error" role="alert">
              {errorMessage}
            </p>
          )}
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
