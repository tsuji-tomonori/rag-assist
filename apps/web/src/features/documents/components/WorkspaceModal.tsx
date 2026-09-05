import type { ReactNode } from "react"

export function WorkspaceModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="document-modal-backdrop" role="presentation">
      <section className="document-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h3>{title}</h3>
          <button type="button" onClick={onClose} aria-label={`${title}を閉じる`}>×</button>
        </header>
        {children}
      </section>
    </div>
  )
}
