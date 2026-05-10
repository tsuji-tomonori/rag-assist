import type { HTMLAttributes, ReactNode } from "react"

export function Panel({
  as: Element = "section",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: "article" | "aside" | "section"
  children: ReactNode
}) {
  const classes = ["ui-panel", className].filter(Boolean).join(" ")
  return (
    <Element {...props} className={classes}>
      {children}
    </Element>
  )
}
