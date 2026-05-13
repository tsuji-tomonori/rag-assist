import { useEffect, useRef, useState } from "react"
import { Icon } from "../../../shared/components/Icon.js"

export function ChatRunIdBar({ runId, pending }: { runId: string | null; pending: boolean }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle")
  const resetTimerRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const canCopy = Boolean(runId)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
        resetTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    setCopyStatus("idle")
  }, [runId])

  function scheduleCopyStatusReset() {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
    resetTimerRef.current = window.setTimeout(() => {
      setCopyStatus("idle")
      resetTimerRef.current = null
    }, 1800)
  }

  async function copyRunId() {
    if (!runId) return
    try {
      await navigator.clipboard.writeText(runId)
      if (!mountedRef.current) return
      setCopyStatus("copied")
      scheduleCopyStatusReset()
    } catch (err) {
      if (!mountedRef.current) return
      console.warn("Failed to copy run id", err)
      setCopyStatus("error")
      scheduleCopyStatusReset()
    }
  }

  return (
    <div className="chat-run-id-bar" aria-live="polite">
      <span className="chat-run-id-label">実行ID</span>
      <code>{pending ? "処理中" : runId ?? "未生成"}</code>
      <button
        type="button"
        className={`run-id-copy-button ${copyStatus === "copied" ? "is-copied" : ""}`}
        disabled={!canCopy}
        onClick={() => void copyRunId()}
        aria-label={copyStatus === "copied" ? "実行IDをコピー済み" : "実行IDをコピー"}
        title={copyStatus === "copied" ? "実行IDをコピー済み" : "実行IDをコピー"}
      >
        <Icon name={copyStatus === "copied" ? "check" : "copy"} />
      </button>
      {copyStatus === "error" && <span className="run-id-copy-feedback">コピーに失敗しました</span>}
    </div>
  )
}
