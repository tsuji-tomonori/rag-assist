import { type FormEvent, useEffect, useState } from "react"
import type { answerQuestion } from "../api/questionsApi.js"
import type { HumanQuestion } from "../types.js"
import { Icon } from "../../../shared/components/Icon.js"
import { LoadingSpinner, LoadingStatus } from "../../../shared/components/LoadingSpinner.js"
import { formatDateTime, priorityLabel, statusLabel } from "../../../shared/utils/format.js"

export function AssigneeWorkspace({
  questions,
  selectedQuestionId,
  loading,
  onSelect,
  onAnswer,
  onBack
}: {
  questions: HumanQuestion[]
  selectedQuestionId: string
  loading: boolean
  onSelect: (questionId: string) => void
  onAnswer: (questionId: string, input: Parameters<typeof answerQuestion>[1]) => Promise<void>
  onBack: () => void
}) {
  const selected = questions.find((question) => question.questionId === selectedQuestionId) ?? questions[0]
  const [answerTitle, setAnswerTitle] = useState("")
  const [answerBody, setAnswerBody] = useState("")
  const [references, setReferences] = useState("")
  const [internalMemo, setInternalMemo] = useState("")
  const [notifyRequester, setNotifyRequester] = useState(true)
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    setAnswerTitle(selected ? `${selected.title}への回答` : "")
    setAnswerBody(selected?.answerBody ?? "")
    setReferences(selected?.references ?? "")
    setInternalMemo(selected?.internalMemo ?? "")
    setNotifyRequester(selected?.notifyRequester ?? true)
    setDraftSavedAt(null)
    setIsDirty(false)
  }, [selected])

  function markDirty() {
    if (!isDirty) setIsDirty(true)
  }

  function onSaveDraft() {
    setDraftSavedAt(new Date())
    setIsDirty(false)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    await onAnswer(selected.questionId, {
      answerTitle,
      answerBody,
      responderName: "佐藤 花子",
      responderDepartment: selected.assigneeDepartment,
      references,
      internalMemo,
      notifyRequester
    })
    setDraftSavedAt(new Date())
    setIsDirty(false)
  }

  return (
    <section className="assignee-workspace" aria-label="担当者対応">
      <header className="assignee-header">
        <button type="button" onClick={onBack} title="チャットへ戻る">
          <Icon name="chevron" />
        </button>
        <div>
          <h2>担当者対応</h2>
          <span>{questions.filter((question) => question.status === "open").length} 件が対応待ち</span>
        </div>
      </header>
      {loading && <LoadingStatus label="問い合わせAPIを処理中" />}
      {selected ? (
        <div className="assignee-grid">
          <aside className="question-list-panel">
            <h3>問い合わせ一覧</h3>
            <div className="question-list">
              {questions.map((question) => (
                <button
                  type="button"
                  className={`question-list-item ${question.questionId === selected.questionId ? "active" : ""}`}
                  key={question.questionId}
                  onClick={() => onSelect(question.questionId)}
                >
                  <strong>{question.title}</strong>
                  <span>{statusLabel(question.status)} / {question.assigneeDepartment}</span>
                </button>
              ))}
            </div>
          </aside>
          <section className="question-detail-panel">
            <h3>問い合わせ概要</h3>
            <div className="requester-question">
              <span className="message-avatar">U</span>
              <p>{selected.question}</p>
            </div>
            <dl>
              <div><dt>ステータス</dt><dd>{statusLabel(selected.status)}</dd></div>
              <div><dt>優先度</dt><dd>{priorityLabel(selected.priority)}</dd></div>
              <div><dt>カテゴリ</dt><dd>{selected.category}</dd></div>
              <div><dt>受付日時</dt><dd>{formatDateTime(selected.createdAt)}</dd></div>
              <div><dt>質問者</dt><dd>{selected.requesterName}（{selected.requesterDepartment}）</dd></div>
              <div><dt>担当部署</dt><dd>{selected.assigneeDepartment}</dd></div>
            </dl>
            <h4>チャット履歴</h4>
            <div className="chat-excerpt">
              <strong>エージェント</strong>
              <p>{selected.chatAnswer || "資料からは回答できません。担当者へ確認します。"}</p>
            </div>
          </section>
          <form className="answer-form-panel" onSubmit={onSubmit}>
            <h3>回答作成</h3>
            <label>
              <span>回答タイトル</span>
              <input value={answerTitle} onChange={(event) => { setAnswerTitle(event.target.value); markDirty() }} maxLength={120} required />
            </label>
            <label>
              <span>回答内容</span>
              <textarea value={answerBody} onChange={(event) => { setAnswerBody(event.target.value); markDirty() }} maxLength={4000} required />
            </label>
            <label>
              <span>参照資料 / 関連リンク</span>
              <input value={references} onChange={(event) => { setReferences(event.target.value); markDirty() }} placeholder="資料名、URL、またはナレッジリンク" />
            </label>
            <label>
              <span>内部メモ</span>
              <textarea value={internalMemo} onChange={(event) => { setInternalMemo(event.target.value); markDirty() }} maxLength={1000} />
            </label>
            <label className="notify-row">
              <input type="checkbox" checked={notifyRequester} onChange={(event) => { setNotifyRequester(event.target.checked); markDirty() }} />
              <span>質問者へ通知する</span>
            </label>
            <div className="answer-draft-status" role="status" aria-live="polite">
              {isDirty ? "未保存の変更があります" : draftSavedAt ? `下書きを保存済み（${formatDateTime(draftSavedAt.toISOString())}）` : "下書きは未保存です"}
            </div>
            <div className="answer-form-actions">
              <button type="button" disabled={loading || !isDirty} onClick={onSaveDraft}>下書き保存</button>
              <button type="submit" disabled={loading || !answerTitle.trim() || !answerBody.trim()}>
                {loading && <LoadingSpinner className="button-spinner" />}
                <span>回答を送信</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="empty-question-panel">担当者へ送信された質問はまだありません。</div>
      )}
    </section>
  )
}
