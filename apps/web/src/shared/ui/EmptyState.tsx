import type { ReactNode } from "react"

export function EmptyState({
  title,
  description,
  action,
  className
}: {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  const classes = ["empty-question-panel", "ui-empty-state", className].filter(Boolean).join(" ")
  return (
    <div className={classes}>
      <strong>{title}</strong>
      {description && <span>{description}</span>}
      {action}
    </div>
  )
}
