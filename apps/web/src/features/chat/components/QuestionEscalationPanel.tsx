import { type FormEvent, useState } from "react"
import type { createQuestion } from "../../questions/api/questionsApi.js"
import type { HumanQuestion, QuestionOperationOutcome } from "../../questions/types.js"
import { LoadingSpinner } from "../../../shared/ui/LoadingSpinner.js"
import type { CurrentUser } from "../../../shared/types/common.js"
import { currentUserDepartmentLabel, currentUserLabel } from "../../../shared/utils/currentUserLabel.js"
import { formatDateTime } from "../../../shared/utils/format.js"
import type { Message } from "../types.js"
import { defaultQuestionBody, defaultQuestionTitle } from "../utils/questionDefaults.js"
import { questionJourneyPresentation } from "../../questions/utils/questionJourney.js"
import { StatusBadge } from "../../../shared/ui/StatusBadge.js"
import {
  OperationFeedback,
  feedbackFromOutcome,
  processingOperationFeedback,
  type OperationFeedbackEntry
} from "../../../shared/ui/index.js"

export function QuestionEscalationPanel({
  message,
  questionTicket,
  currentUser,
  loading,
  onCreateQuestion
}: {
  message: Message
  questionTicket?: HumanQuestion
  currentUser: CurrentUser | null
  loading: boolean
  onCreateQuestion: (input: Parameters<typeof createQuestion>[0]) => Promise<QuestionOperationOutcome>
}) {
  const sourceQuestion = message.sourceQuestion ?? ""
  const [title, setTitle] = useState(defaultQuestionTitle(sourceQuestion))
  const [body, setBody] = useState(defaultQuestionBody(sourceQuestion))
  const [category, setCategory] = useState("その他の質問")
  const [priority, setPriority] = useState<HumanQuestion["priority"]>("normal")
  const [assigneeDepartment, setAssigneeDepartment] = useState("")
  const [operationFeedback, setOperationFeedback] = useState<OperationFeedbackEntry | null>(null)

  if (questionTicket) {
    const journey = questionJourneyPresentation(questionTicket, "requester")
    return (
      <section className="question-status-panel" aria-label={`問い合わせ状態: ${questionTicket.title}`}>
        <header>
          <StatusBadge presentation={journey.presentation} />
          <span>{questionTicket.assigneeDepartment} / {formatDateTime(questionTicket.updatedAt)}</span>
        </header>
        <p>{questionTicket.title}</p>
        <dl>
          <div><dt>対象識別子</dt><dd>{questionTicket.questionId}</dd></div>
          <div><dt>割当</dt><dd>{journey.assignmentLabel}</dd></div>
          <div><dt>次の操作</dt><dd>{journey.nextAction}</dd></div>
        </dl>
        {operationFeedback && <OperationFeedback entry={operationFeedback} className="question-operation-feedback" />}
      </section>
    )
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const feedbackBase = {
      id: `question-create-${message.messageId ?? message.createdAt}`,
      actionLabel: "担当者への問い合わせ送信",
      targetLabel: title,
      targetId: message.messageId,
      details: [{ label: "元の質問", value: sourceQuestion || "API 応答で未提供" }]
    }
    setOperationFeedback(processingOperationFeedback(feedbackBase))
    const outcome = await onCreateQuestion({
      title,
      question: body,
      requesterName: currentUserLabel(currentUser),
      requesterDepartment: currentUserDepartmentLabel(),
      assigneeDepartment: assigneeDepartment.trim() || undefined,
      category,
      priority,
      messageId: message.messageId,
      sourceQuestion,
      chatAnswer: message.text,
      chatRunId: message.result?.debug?.runId
    })
    setOperationFeedback(feedbackFromOutcome(feedbackBase, outcome))
  }

  return (
    <form className="question-escalation-panel" onSubmit={onSubmit} aria-label="担当者へ質問">
      <div className="question-panel-head">
        <div>
          <h2>担当者へ質問</h2>
          <span>自動表示</span>
        </div>
      </div>
      {operationFeedback && <OperationFeedback entry={operationFeedback} className="question-operation-feedback" />}
      <label>
        <span>件名</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required />
      </label>
      <label>
        <span>質問内容</span>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} required />
      </label>
      <div className="question-form-grid">
        <label>
          <span>カテゴリ</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="その他の質問">その他の質問</option>
            <option value="手続き">手続き</option>
            <option value="社内制度">社内制度</option>
            <option value="資料確認">資料確認</option>
          </select>
        </label>
        <label>
          <span>優先度</span>
          <select value={priority} onChange={(event) => setPriority(event.target.value as HumanQuestion["priority"])}>
            <option value="normal">通常</option>
            <option value="high">高</option>
            <option value="urgent">緊急</option>
          </select>
        </label>
      </div>
      <label>
        <span>担当部署</span>
        <input value={assigneeDepartment} onChange={(event) => setAssigneeDepartment(event.target.value)} placeholder="担当部署を入力" />
      </label>
      <div className="question-form-actions">
        <span>担当部署に送信されます</span>
        <button type="submit" disabled={loading || !title.trim() || !body.trim()}>
          {loading && <LoadingSpinner className="button-spinner" />}
          <span>担当者へ送信</span>
        </button>
      </div>
    </form>
  )
}
