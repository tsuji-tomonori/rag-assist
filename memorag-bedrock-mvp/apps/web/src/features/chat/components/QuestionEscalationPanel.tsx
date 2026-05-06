import { type FormEvent, useState } from "react"
import type { createQuestion } from "../../questions/api/questionsApi.js"
import type { HumanQuestion } from "../../questions/types.js"
import { LoadingSpinner } from "../../../shared/components/LoadingSpinner.js"
import { formatDateTime } from "../../../shared/utils/format.js"
import type { Message } from "../types.js"
import { defaultQuestionBody, defaultQuestionTitle } from "../utils/questionDefaults.js"

export function QuestionEscalationPanel({
  message,
  questionTicket,
  loading,
  onCreateQuestion
}: {
  message: Message
  questionTicket?: HumanQuestion
  loading: boolean
  onCreateQuestion: (input: Parameters<typeof createQuestion>[0]) => Promise<void>
}) {
  const sourceQuestion = message.sourceQuestion ?? ""
  const [title, setTitle] = useState(defaultQuestionTitle(sourceQuestion))
  const [body, setBody] = useState(defaultQuestionBody(sourceQuestion))
  const [category, setCategory] = useState("その他の質問")
  const [priority, setPriority] = useState<HumanQuestion["priority"]>("normal")
  const [assigneeDepartment, setAssigneeDepartment] = useState("総務部")

  if (questionTicket) {
    return (
      <section className="question-status-panel">
        <div>
          <strong>{questionTicket.status === "open" ? "担当者へ送信済み" : questionTicket.status === "answered" ? "担当者が回答済み" : "解決済み"}</strong>
          <span>{questionTicket.assigneeDepartment} / {formatDateTime(questionTicket.updatedAt)}</span>
        </div>
        <p>{questionTicket.title}</p>
      </section>
    )
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    await onCreateQuestion({
      title,
      question: body,
      requesterName: "山田 太郎",
      requesterDepartment: "利用部門",
      assigneeDepartment,
      category,
      priority,
      sourceQuestion,
      chatAnswer: message.text,
      chatRunId: message.result?.debug?.runId
    })
  }

  return (
    <form className="question-escalation-panel" onSubmit={onSubmit} aria-label="担当者へ質問">
      <div className="question-panel-head">
        <div>
          <h3>担当者へ質問</h3>
          <span>自動表示</span>
        </div>
      </div>
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
        <select value={assigneeDepartment} onChange={(event) => setAssigneeDepartment(event.target.value)}>
          <option value="総務部">総務部</option>
          <option value="人事部">人事部</option>
          <option value="情報システム部">情報システム部</option>
          <option value="経理部">経理部</option>
        </select>
      </label>
      <div className="question-form-actions">
        <span>通常 1 営業日以内に回答予定</span>
        <button type="submit" disabled={loading || !title.trim() || !body.trim()}>
          {loading && <LoadingSpinner className="button-spinner" />}
          <span>担当者へ送信</span>
        </button>
      </div>
    </form>
  )
}
