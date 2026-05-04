import { useState } from "react"
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
  onAdditionalQuestion,
  onSubmitClarificationOption
}: {
  message: Message
  linkedQuestion?: HumanQuestion
  loading: boolean
  onCreateQuestion: (input: Parameters<typeof createQuestion>[0]) => Promise<void>
  onResolveQuestion: (questionId: string) => Promise<void>
  onAdditionalQuestion: (value: string) => void
  onSubmitClarificationOption: (value: string) => Promise<void>
}) {
  const citations = message.result?.citations ?? []
  const clarification = message.result?.clarification
  const isClarification = message.result?.responseType === "clarification" || message.result?.needsClarification === true
  const [copyStatus, setCopyStatus] = useState<"idle" | "answer" | "error">("idle")
  const canCopyAnswer = Boolean(message.text.trim())

  async function copyText(value: string) {
    if (!value.trim()) return
    try {
      await navigator.clipboard.writeText(value)
      setCopyStatus("answer")
      window.setTimeout(() => setCopyStatus("idle"), 1800)
    } catch (err) {
      console.warn("Failed to copy text", err)
      setCopyStatus("error")
      window.setTimeout(() => setCopyStatus("idle"), 1800)
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
      {isClarification && clarification && (
        <div className="clarification-options" aria-label="確認質問の選択肢">
          {clarification.options.map((option) => (
            <button
              type="button"
              key={option.id}
              onClick={() => void onSubmitClarificationOption(option.resolvedQuery)}
              title={option.reason ?? "この候補で質問する"}
            >
              {option.label}
            </button>
          ))}
          <button type="button" className="clarification-freeform" onClick={() => onAdditionalQuestion("")}>
            自分で入力
          </button>
        </div>
      )}
      {message.result && !message.result.isAnswerable && !isClarification && (
        <QuestionEscalationPanel message={message} questionTicket={linkedQuestion} loading={loading} onCreateQuestion={onCreateQuestion} />
      )}
      {linkedQuestion?.status === "answered" || linkedQuestion?.status === "resolved" ? (
        <QuestionAnswerPanel question={linkedQuestion} loading={loading} onResolveQuestion={onResolveQuestion} onAdditionalQuestion={onAdditionalQuestion} />
      ) : null}
    </div>
  )
}
