export function LoadingSpinner({ className = "", label }: { className?: string; label?: string }) {
  const classes = ["loading-spinner", className].filter(Boolean).join(" ")

  if (label) {
    return <span className={classes} role="status" aria-label={label} />
  }

  return <span className={classes} aria-hidden="true" />
}

export function LoadingStatus({ className = "", label }: { className?: string; label: string }) {
  const classes = ["loading-status", className].filter(Boolean).join(" ")

  return (
    <div className={classes} role="status" aria-live="polite" aria-busy="true">
      <LoadingSpinner />
      <span>{label}</span>
    </div>
  )
}
