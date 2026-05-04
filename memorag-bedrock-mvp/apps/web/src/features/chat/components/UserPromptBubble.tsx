import { useEffect, useRef, useState } from "react"
import { Icon } from "../../../shared/components/Icon.js"

export function UserPromptBubble({ text }: { text: string }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle")
  const resetTimerRef = useRef<number | null>(null)
  const canCopyPrompt = Boolean(text.trim())

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
    }
  }, [])

  function scheduleCopyStatusReset() {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
    resetTimerRef.current = window.setTimeout(() => {
      setCopyStatus("idle")
      resetTimerRef.current = null
    }, 1800)
  }

  async function copyPrompt() {
    if (!canCopyPrompt) return
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus("copied")
      scheduleCopyStatusReset()
    } catch (err) {
      console.warn("Failed to copy prompt", err)
      setCopyStatus("error")
      scheduleCopyStatusReset()
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
