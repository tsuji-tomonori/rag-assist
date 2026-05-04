import { Icon } from "../../../shared/components/Icon.js"
import { formatDateTime } from "../../../shared/utils/format.js"
import type { HumanQuestion } from "../../questions/types.js"

export function QuestionAnswerPanel({
  question,
  loading,
  onResolveQuestion,
  onAdditionalQuestion
}: {
  question: HumanQuestion
  loading: boolean
  onResolveQuestion: (questionId: string) => Promise<void>
  onAdditionalQuestion: (value: string) => void
}) {
  return (
    <section className="question-answer-panel" aria-label="担当者からの回答" role="status" aria-live="polite">
      <header>
        <span className="status-dot"><Icon name="check" /></span>
        <div>
          <strong>担当者からの回答</strong>
          <span>{question.responderName ?? "担当者"}（{question.responderDepartment ?? question.assigneeDepartment}）</span>
        </div>
      </header>
      <p>{question.answerBody}</p>
      <dl>
        <div>
          <dt>回答日時</dt>
          <dd>{formatDateTime(question.answeredAt ?? question.updatedAt)}</dd>
        </div>
        {question.references && (
          <div>
            <dt>参照情報</dt>
            <dd>{question.references}</dd>
          </div>
        )}
      </dl>
      <footer>
        <button type="button" disabled={loading || question.status === "resolved"} onClick={() => onResolveQuestion(question.questionId)}>
          解決した
        </button>
        <button type="button" onClick={() => onAdditionalQuestion(`追加確認: ${question.title}\n`)}>
          追加で質問する
        </button>
      </footer>
    </section>
  )
}
