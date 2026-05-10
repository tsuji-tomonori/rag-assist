import { Icon } from "../../../../shared/components/Icon.js"

export function AnswerCopyAction({
  citationsCount,
  copyStatus,
  canCopy,
  onCopy
}: {
  citationsCount: number
  copyStatus: "idle" | "answer" | "error"
  canCopy: boolean
  onCopy: () => void
}) {
  return (
    <>
      <div className="answer-footer">
        <span>根拠: ドキュメント {citationsCount}件</span>
        <button
          type="button"
          className={`copy-action ${copyStatus === "answer" ? "is-copied" : ""}`}
          onClick={onCopy}
          disabled={!canCopy}
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
    </>
  )
}
