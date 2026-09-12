import { useState } from "react"
import { Icon } from "../../../shared/ui/Icon.js"
import { LoadingSpinner } from "../../../shared/ui/LoadingSpinner.js"
import { formatDateTime } from "../../../shared/utils/format.js"
import type { HumanQuestion, QuestionOperationOutcome } from "../../questions/types.js"
import { questionJourneyPresentation } from "../../questions/utils/questionJourney.js"
import {
  OperationFeedback,
  feedbackFromOutcome,
  processingOperationFeedback,
  type OperationFeedbackEntry
} from "../../../shared/ui/index.js"
import { StatusBadge } from "../../../shared/ui/StatusBadge.js"

export function QuestionAnswerPanel({
  question,
  loading,
  onResolveQuestion,
  onAdditionalQuestion
}: {
  question: HumanQuestion
  loading: boolean
  onResolveQuestion: (questionId: string) => Promise<QuestionOperationOutcome>
  onAdditionalQuestion: (value: string) => void
}) {
  const [operationFeedback, setOperationFeedback] = useState<OperationFeedbackEntry | null>(null)
  const journey = questionJourneyPresentation(question, "requester")

  async function resolveQuestion() {
    const feedbackBase = {
      id: `question-resolve-${question.questionId}`,
      actionLabel: "問い合わせの解決",
      targetLabel: question.title,
      targetId: question.questionId
    }
    setOperationFeedback(processingOperationFeedback(feedbackBase))
    const outcome = await onResolveQuestion(question.questionId)
    setOperationFeedback(feedbackFromOutcome(feedbackBase, outcome))
  }

  return (
    <section className="question-answer-panel" aria-label="担当者からの回答" role="status" aria-live="polite">
      <header>
        <span className="status-dot"><Icon name="check" /></span>
        <div>
          <strong>担当者からの回答</strong>
          <span>{question.responderName ?? "担当者"}（{question.responderDepartment ?? question.assigneeDepartment}）</span>
        </div>
        <StatusBadge presentation={journey.presentation} />
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
      <p className="question-next-action"><strong>次の操作:</strong> {journey.nextAction}</p>
      {operationFeedback && <OperationFeedback entry={operationFeedback} className="question-operation-feedback" />}
      <footer>
        <button type="button" disabled={loading || question.status === "resolved"} onClick={() => void resolveQuestion()}>
          {loading && <LoadingSpinner className="button-spinner" />}
          <span>解決した</span>
        </button>
        <button type="button" onClick={() => onAdditionalQuestion(`追加確認: ${question.title}\n`)}>
          追加で質問する
        </button>
      </footer>
    </section>
  )
}
