import { Badge } from "./Badge.js"
import type { SemanticPresentation } from "./displayMetadata.js"

export function StatusBadge({
  presentation,
  className
}: {
  presentation: SemanticPresentation
  className?: string
}) {
  const classes = ["ui-status-badge", className].filter(Boolean).join(" ")
  return (
    <Badge tone={presentation.tone} className={classes} title={presentation.description}>
      <span className="ui-status-badge-marker" aria-hidden="true" />
      <span>{presentation.label}</span>
    </Badge>
  )
}
