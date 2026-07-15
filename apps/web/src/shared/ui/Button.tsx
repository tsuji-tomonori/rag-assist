import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react"

type ButtonVariant = "primary" | "secondary" | "ghost" | "warning" | "danger"
type ButtonSize = "sm" | "md"

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}>(function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}, ref) {
  const classes = ["ui-button", `ui-button-${variant}`, `ui-button-${size}`, className].filter(Boolean).join(" ")
  return (
    <button {...props} ref={ref} className={classes}>
      {children}
    </button>
  )
})
