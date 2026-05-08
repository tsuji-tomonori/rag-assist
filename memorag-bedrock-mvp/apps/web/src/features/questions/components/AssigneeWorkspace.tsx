import { type FormEvent, useEffect, useState } from "react"
import type { answerQuestion } from "../api/questionsApi.js"
import type { HumanQuestion } from "../types.js"
import { Icon } from "../../../shared/components/Icon.js"
import { LoadingSpinner, LoadingStatus } from "../../../shared/components/LoadingSpinner.js"
import { formatDateTime, priorityLabel, statusLabel } from "../../../shared/utils/format.js"

type AssigneeLaneId = "unassigned" | "inProgress" | "waitingReview" | "resolved"

const ASSIGNEE_LANES: { id: AssigneeLaneId; label: string; description: string }[] = [
  { id: "unassigned", label: "未対応", description: "担当者の回答作成に着手していない問い合わせ" },
  { id: "inProgress", label: "対応中", description: "回答作成中または内部確認中の問い合わせ" },
  { id: "waitingReview", label: "確認待ち", description: "担当者回答済みで質問者確認待ちの問い合わせ" },
  { id: "resolved", label: "解決済み", description: "質問者または担当者が解決済みにした問い合わせ" }
]

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
  const [answerTitle, setAnswerTitle] = useState("")
  const [answerBody, setAnswerBody] = useState("")
  const [references, setReferences] = useState("")
  const [internalMemo, setInternalMemo] = useState("")
  const [notifyRequester, setNotifyRequester] = useState(true)
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [localDraftQuestionIds, setLocalDraftQuestionIds] = useState<Set<string>>(() => new Set())
  const [statusFilter, setStatusFilter] = useState<AssigneeLaneId | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const visibleQuestions = questions.filter((question) => {
    const lane = assigneeLane(question, localDraftQuestionIds.has(question.questionId))
    const matchesLane = statusFilter === "all" || lane === statusFilter
    const haystack = [
      question.title,
      question.question,
      question.requesterName,
      question.requesterDepartment,
      question.assigneeDepartment,
      question.category
    ].join("\n").toLowerCase()
    return matchesLane && (normalizedQuery.length === 0 || haystack.includes(normalizedQuery))
  })
  const selected = visibleQuestions.find((question) => question.questionId === selectedQuestionId) ?? visibleQuestions[0]
  const openCount = questions.filter((question) => question.status === "open").length

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
    if (selected) {
      setLocalDraftQuestionIds((prev) => {
        if (prev.has(selected.questionId)) return prev
        const next = new Set(prev)
        next.add(selected.questionId)
        return next
      })
    }
    if (!isDirty) setIsDirty(true)
  }

  function onSaveDraft() {
    if (selected) {
      setLocalDraftQuestionIds((prev) => {
        if (prev.has(selected.questionId)) return prev
        const next = new Set(prev)
        next.add(selected.questionId)
        return next
      })
    }
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
        <button type="button" onClick={onBack} title="チャットへ戻る" aria-label="チャットへ戻る">
          <Icon name="chevron" />
        </button>
        <div>
          <h2>担当者対応</h2>
          <span>{openCount} 件が対応待ち</span>
        </div>
      </header>
      {loading && <LoadingStatus label="問い合わせAPIを処理中" />}
      {questions.length > 0 ? (
        <>
          <div className="assignee-toolbar" aria-label="問い合わせ一覧">
            <h3>問い合わせ一覧</h3>
            <label>
              <span>ステータス</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AssigneeLaneId | "all")}>
                <option value="all">すべて</option>
                {ASSIGNEE_LANES.map((lane) => (
                  <option key={lane.id} value={lane.id}>{lane.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>検索</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="タイトル・名前・部署で検索"
              />
            </label>
          </div>
          <div className="assignee-grid">
            <div className="assignee-kanban" aria-label="担当者対応カンバン">
              {ASSIGNEE_LANES.map((lane) => {
                const laneQuestions = visibleQuestions.filter((question) => assigneeLane(question, localDraftQuestionIds.has(question.questionId)) === lane.id)
                return (
                  <section className={`kanban-column lane-${lane.id}`} key={lane.id} aria-label={lane.label}>
                    <header>
                      <div>
                        <span className="kanban-status-dot" aria-hidden="true" />
                        <h3>{lane.label}</h3>
                      </div>
                      <span>{laneQuestions.length}</span>
                    </header>
                    <p>{lane.description}</p>
                    <div className="kanban-card-list">
                      {laneQuestions.length > 0 ? laneQuestions.map((question) => (
                        <button
                          type="button"
                          className={`question-kanban-card priority-${question.priority} ${selected?.questionId === question.questionId ? "active" : ""}`}
                          key={question.questionId}
                          onClick={() => onSelect(question.questionId)}
                          aria-pressed={selected?.questionId === question.questionId}
                          aria-label={`${question.title}を選択`}
                        >
                          <span className="kanban-card-title">
                            <strong>{question.title}</strong>
                            <span>{priorityLabel(question.priority)}</span>
                          </span>
                          <span>{lane.label} / {question.assigneeDepartment}</span>
                          <span>{question.requesterName}（{question.requesterDepartment}）</span>
                          <time dateTime={question.createdAt}>{formatDateTime(question.createdAt)}</time>
                        </button>
                      )) : (
                        <span className="kanban-empty">該当する問い合わせはありません</span>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
            {selected ? (
              <aside className="assignee-side-panel">
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
              </aside>
            ) : (
              <div className="empty-question-panel">条件に一致する問い合わせはありません。</div>
            )}
          </div>
        </>
      ) : (
        <div className="empty-question-panel">担当者へ送信された質問はまだありません。</div>
      )}
    </section>
  )
}

function assigneeLane(question: HumanQuestion, hasLocalDraft = false): AssigneeLaneId {
  if (question.status === "resolved") return "resolved"
  if (question.status === "answered") return "waitingReview"
  if (hasLocalDraft || question.answerBody || question.references || question.internalMemo) return "inProgress"
  return "unassigned"
}
