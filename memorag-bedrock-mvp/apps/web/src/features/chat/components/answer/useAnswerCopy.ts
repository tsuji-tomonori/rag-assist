import { useEffect, useRef, useState } from "react"

export function useAnswerCopy() {
  const [copyStatus, setCopyStatus] = useState<"idle" | "answer" | "error">("idle")
  const resetTimerRef = useRef<number | null>(null)
  const mountedRef = useRef(true)

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

  function scheduleCopyStatusReset() {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
    resetTimerRef.current = window.setTimeout(() => {
      setCopyStatus("idle")
      resetTimerRef.current = null
    }, 1800)
  }

  async function copyText(value: string) {
    if (!value.trim()) return
    try {
      await navigator.clipboard.writeText(value)
      if (!mountedRef.current) return
      setCopyStatus("answer")
      scheduleCopyStatusReset()
    } catch (err) {
      if (!mountedRef.current) return
      console.warn("Failed to copy text", err)
      setCopyStatus("error")
      scheduleCopyStatusReset()
    }
  }

  return { copyStatus, copyText }
}
