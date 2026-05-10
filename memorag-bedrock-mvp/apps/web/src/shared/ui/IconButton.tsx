import type { ButtonHTMLAttributes, ReactNode } from "react"

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  children: ReactNode
}) {
  const classes = ["ui-icon-button", className].filter(Boolean).join(" ")
  return (
    <button {...props} className={classes} aria-label={label} title={props.title ?? label}>
      {children}
    </button>
  )
}
