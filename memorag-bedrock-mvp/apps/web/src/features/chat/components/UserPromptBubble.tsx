import { useState } from "react"
import { Icon } from "../../../shared/components/Icon.js"

export function UserPromptBubble({ text }: { text: string }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle")
  const canCopyPrompt = Boolean(text.trim())

  async function copyPrompt() {
    if (!canCopyPrompt) return
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus("copied")
      window.setTimeout(() => setCopyStatus("idle"), 1800)
    } catch (err) {
      console.warn("Failed to copy prompt", err)
      setCopyStatus("error")
      window.setTimeout(() => setCopyStatus("idle"), 1800)
    }
  }

  return (
    <div className="user-message-line">
      <p className="user-bubble">{text}</p>
      <button
        type="button"
        className={`prompt-copy-button ${copyStatus === "copied" ? "is-copied" : ""}`}
        onClick={copyPrompt}
        disabled={!canCopyPrompt}
        aria-label={copyStatus === "copied" ? "プロンプトをコピー済み" : "プロンプトをコピー"}
        title={copyStatus === "copied" ? "プロンプトをコピー済み" : "プロンプトをコピー"}
      >
        <Icon name={copyStatus === "copied" ? "check" : "copy"} />
      </button>
      {copyStatus !== "idle" && (
        <span className="sr-only" role="status" aria-live="polite">
          {copyStatus === "copied" ? "プロンプトをコピーしました" : "コピーに失敗しました"}
        </span>
      )}
    </div>
  )
}
