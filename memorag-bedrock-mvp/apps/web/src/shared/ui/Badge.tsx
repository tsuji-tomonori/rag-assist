import type { HTMLAttributes, ReactNode } from "react"

export function Badge({
  tone = "neutral",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "warning" | "danger" | "info"
  children: ReactNode
}) {
  const classes = ["ui-badge", `ui-badge-${tone}`, className].filter(Boolean).join(" ")
  return (
    <span {...props} className={classes}>
      {children}
    </span>
  )
}
