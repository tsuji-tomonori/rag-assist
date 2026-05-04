import { useEffect, useRef, useState } from "react"
import type { createQuestion } from "../../questions/api/questionsApi.js"
import type { HumanQuestion } from "../../questions/types.js"
import { Icon } from "../../../shared/components/Icon.js"
import type { Message } from "../types.js"
import { QuestionAnswerPanel } from "./QuestionAnswerPanel.js"
import { QuestionEscalationPanel } from "./QuestionEscalationPanel.js"

export function AssistantAnswer({
  message,
  linkedQuestion,
  loading,
  onCreateQuestion,
  onResolveQuestion,
  onAdditionalQuestion
}: {
  message: Message
  linkedQuestion?: HumanQuestion
  loading: boolean
  onCreateQuestion: (input: Parameters<typeof createQuestion>[0]) => Promise<void>
  onResolveQuestion: (questionId: string) => Promise<void>
  onAdditionalQuestion: (value: string) => void
}) {
  const citations = message.result?.citations ?? []
  const [copyStatus, setCopyStatus] = useState<"idle" | "answer" | "error">("idle")
  const resetTimerRef = useRef<number | null>(null)
  const canCopyAnswer = Boolean(message.text.trim())

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

  async function copyText(value: string) {
    if (!value.trim()) return
    try {
      await navigator.clipboard.writeText(value)
      setCopyStatus("answer")
      scheduleCopyStatusReset()
    } catch (err) {
      console.warn("Failed to copy text", err)
      setCopyStatus("error")
      scheduleCopyStatusReset()
    }
  }

  return (
    <div className="answer-card">
      <p className="answer-text">{message.text || "質問すると、社内ドキュメントに基づく回答と実行トレースが表示されます。"}</p>
      {citations.length > 0 && (
        <div className="answer-sources">
          <strong>根拠ドキュメント</strong>
          <ul>
            {citations.slice(0, 3).map((citation, index) => (
              <li key={`${citation.documentId}-${citation.chunkId ?? index}`}>
                <a href={`#source-${index}`}>{citation.fileName}</a>
                <span>score {citation.score}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="answer-footer">
        <span>根拠: ドキュメント {citations.length}件</span>
        <button
          type="button"
          className={`copy-action ${copyStatus === "answer" ? "is-copied" : ""}`}
          onClick={() => copyText(message.text)}
          disabled={!canCopyAnswer}
          aria-label={copyStatus === "answer" ? "回答をコピー済み" : "回答をコピー"}
          title={copyStatus === "answer" ? "回答をコピー済み" : "回答をコピー"}
        >
          <Icon name={copyStatus === "answer" ? "check" : "copy"} />
          <span>{copyStatus === "answer" ? "コピー済み" : "回答"}</span>
        </button>
      </div>
      {copyStatus !== "idle" && (
        <p className="copy-feedback" role="status" aria-live="polite">
          {copyStatus === "answer" && "回答をコピーしました"}
          {copyStatus === "error" && "コピーに失敗しました"}
        </p>
      )}
      {message.result && !message.result.isAnswerable && (
        <QuestionEscalationPanel message={message} questionTicket={linkedQuestion} loading={loading} onCreateQuestion={onCreateQuestion} />
      )}
      {linkedQuestion?.status === "answered" || linkedQuestion?.status === "resolved" ? (
        <QuestionAnswerPanel question={linkedQuestion} loading={loading} onResolveQuestion={onResolveQuestion} onAdditionalQuestion={onAdditionalQuestion} />
      ) : null}
    </div>
  )
}
