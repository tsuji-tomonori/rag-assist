import type { ReactNode } from "react"

export function ConfirmDialog({
  title,
  message,
  rows,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
  children
}: {
  title: string
  message: string
  rows?: Array<{ label: string; value: string }>
  confirmLabel: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
  children?: ReactNode
}) {
  return (
    <div className="confirm-dialog-backdrop" role="presentation">
      <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <h3 id="confirm-dialog-title">{title}</h3>
        <p>{message}</p>
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
        <div className="confirm-dialog-actions">
          <button type="button" onClick={onCancel}>キャンセル</button>
          <button type="button" className={danger ? "danger" : ""} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
