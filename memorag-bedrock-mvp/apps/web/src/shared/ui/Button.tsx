import type { ButtonHTMLAttributes, ReactNode } from "react"

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"
type ButtonSize = "sm" | "md"

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}) {
  const classes = ["ui-button", `ui-button-${variant}`, `ui-button-${size}`, className].filter(Boolean).join(" ")
  return (
    <button {...props} className={classes}>
      {children}
    </button>
  )
}
