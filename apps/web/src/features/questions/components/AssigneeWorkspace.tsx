import { type FormEvent, useEffect, useRef, useState } from "react"
import type { answerQuestion } from "../api/questionsApi.js"
import type { HumanQuestion, QuestionOperationOutcome } from "../types.js"
import { Icon } from "../../../shared/ui/Icon.js"
import { LoadingSpinner, LoadingStatus } from "../../../shared/ui/LoadingSpinner.js"
import type { CurrentUser } from "../../../shared/types/common.js"
import { currentUserLabel } from "../../../shared/utils/currentUserLabel.js"
import { formatDateTime, priorityLabel } from "../../../shared/utils/format.js"
import {
  ResourceStateBoundary,
  type UiResourceState
} from "../../../shared/ui/ResourceState.js"
import {
  hasConfirmedResourceResult,
  isResourcePartAvailable,
  isResourceStateBusy
} from "../../../shared/ui/resourceStateModel.js"
import { questionJourneyPresentation } from "../utils/questionJourney.js"
import { StatusBadge } from "../../../shared/ui/StatusBadge.js"
import {
  OperationFeedback,
  feedbackFromOutcome,
  processingOperationFeedback,
  type OperationFeedbackEntry
} from "../../../shared/ui/index.js"

type AssigneeLaneId = "unassigned" | "inProgress" | "waitingReview" | "resolved"

const ASSIGNEE_LANES: { id: AssigneeLaneId; label: string; description: string }[] = [
  { id: "unassigned", label: "未対応", description: "担当者の回答作成に着手していない問い合わせ" },
  { id: "inProgress", label: "対応中", description: "回答作成中または内部確認中の問い合わせ" },
  { id: "waitingReview", label: "確認待ち", description: "依頼者の追加情報または回答確認を待つ問い合わせ" },
  { id: "resolved", label: "解決済み", description: "質問者または担当者が解決済みにした問い合わせ" }
]

export function AssigneeWorkspace({
  dataState,
  questions,
  selectedQuestionId,
  user,
  loading,
  onRetry,
  onSelect,
  onAnswer,
  onBack
}: {
  dataState: UiResourceState
  questions: HumanQuestion[]
  selectedQuestionId: string
  user: CurrentUser | null
  loading: boolean
  onRetry: () => void
  onSelect: (questionId: string) => void
  onAnswer: (questionId: string, input: Parameters<typeof answerQuestion>[1]) => Promise<QuestionOperationOutcome>
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
  const [answerFeedback, setAnswerFeedback] = useState<OperationFeedbackEntry | null>(null)
  const selectedQuestionIdRef = useRef("")
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
  const openCount = questions.filter((question) => question.status === "open" || question.status === "in_progress").length
  const hasQuestionResult = dataState.parts.length === 0
    ? hasConfirmedResourceResult(dataState)
    : isResourcePartAvailable(dataState, "questions")

  useEffect(() => {
    selectedQuestionIdRef.current = selected?.questionId ?? ""
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

  function onHoldDraft() {
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
    if (!selected || selected.status === "answered" || selected.status === "resolved") return
    const targetQuestionId = selected.questionId
    const feedbackBase = {
      id: `question-answer-${targetQuestionId}`,
      actionLabel: "担当者回答の送信",
      targetLabel: selected.title,
      targetId: targetQuestionId,
      details: [
        { label: "依頼者", value: selected.requesterName },
        { label: "通知", value: notifyRequester ? "質問者へ通知" : "質問者へ通知しない" }
      ]
    }
    setAnswerFeedback(processingOperationFeedback(feedbackBase))
    const outcome = await onAnswer(targetQuestionId, {
      answerTitle,
      answerBody,
      responderName: currentUserLabel(user),
      responderDepartment: selected.assigneeDepartment,
      references,
      internalMemo,
      notifyRequester
    })
    setAnswerFeedback(feedbackFromOutcome(feedbackBase, outcome))
    if (outcome.ok && selectedQuestionIdRef.current === targetQuestionId) {
      setDraftSavedAt(new Date())
      setIsDirty(false)
      setLocalDraftQuestionIds((prev) => {
        if (!prev.has(targetQuestionId)) return prev
        const next = new Set(prev)
        next.delete(targetQuestionId)
        return next
      })
    }
  }

  const selectedJourney = selected ? questionJourneyPresentation(selected, "assignee") : undefined
  const answerWritable = Boolean(selected && selected.status !== "answered" && selected.status !== "resolved")

  return (
    <section className="assignee-workspace" aria-label="担当者対応">
      <header className="assignee-header">
        <button type="button" onClick={onBack} title="チャットへ戻る" aria-label="チャットへ戻る">
          <Icon name="chevron" />
        </button>
        <div>
          <h2>担当者対応</h2>
          <span>{hasQuestionResult ? `${openCount} 件が対応待ち` : "問い合わせを確認中"}</span>
        </div>
      </header>
      {loading && !isResourceStateBusy(dataState) && <LoadingStatus label="問い合わせAPIを処理中" />}
      {answerFeedback && <OperationFeedback entry={answerFeedback} className="question-operation-feedback assignee-operation-feedback" />}
      <ResourceStateBoundary
        state={dataState}
        isEmpty={questions.length === 0}
        emptyScope="担当者向け問い合わせ"
        emptyTitle="担当者へ送信された質問はまだありません。"
        emptyDescription="取得は完了しており、現在対応できる問い合わせは 0 件です。"
        onRetry={onRetry}
        onBack={onBack}
      >
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
                      {laneQuestions.length > 0 ? laneQuestions.map((question) => {
                        const journey = questionJourneyPresentation(question, "assignee")
                        return (
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
                          <span>{journey.presentation.label} / {question.assigneeDepartment}</span>
                          <span>{journey.assignmentLabel}</span>
                          <span>{question.requesterName}（{question.requesterDepartment}）</span>
                          <time dateTime={question.createdAt}>{formatDateTime(question.createdAt)}</time>
                        </button>
                        )
                      }) : (
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
                    <div><dt>ステータス</dt><dd>{selectedJourney && <StatusBadge presentation={selectedJourney.presentation} />}</dd></div>
                    <div><dt>割当</dt><dd>{selectedJourney?.assignmentLabel}</dd></div>
                    <div><dt>次の操作</dt><dd>{selectedJourney?.nextAction}</dd></div>
                    <div><dt>優先度</dt><dd>{priorityLabel(selected.priority)}</dd></div>
                    <div><dt>カテゴリ</dt><dd>{selected.category}</dd></div>
                    <div><dt>受付日時</dt><dd>{formatDateTime(selected.createdAt)}</dd></div>
                    <div><dt>質問者</dt><dd>{selected.requesterName}（{selected.requesterDepartment}）</dd></div>
                    <div><dt>担当部署</dt><dd>{selected.assigneeDepartment}</dd></div>
                  </dl>
                  <h4>チャット履歴</h4>
                  <div className="chat-excerpt">
                    <strong>エージェント</strong>
                    <p>{selected.chatAnswer || "チャット回答は記録されていません。"}</p>
                  </div>
                </section>
                <form className="answer-form-panel" onSubmit={onSubmit}>
                  <h3>回答作成</h3>
                  <label>
                    <span>回答タイトル</span>
                    <input value={answerTitle} onChange={(event) => { setAnswerTitle(event.target.value); markDirty() }} maxLength={120} required disabled={!answerWritable || loading} />
                  </label>
                  <label>
                    <span>回答内容</span>
                    <textarea value={answerBody} onChange={(event) => { setAnswerBody(event.target.value); markDirty() }} maxLength={4000} required disabled={!answerWritable || loading} />
                  </label>
                  <label>
                    <span>参照資料 / 関連リンク</span>
                    <input value={references} onChange={(event) => { setReferences(event.target.value); markDirty() }} placeholder="資料名、URL、またはナレッジリンク" disabled={!answerWritable || loading} />
                  </label>
                  <label>
                    <span>内部メモ</span>
                    <textarea value={internalMemo} onChange={(event) => { setInternalMemo(event.target.value); markDirty() }} maxLength={1000} disabled={!answerWritable || loading} />
                  </label>
                  <label className="notify-row">
                    <input type="checkbox" checked={notifyRequester} onChange={(event) => { setNotifyRequester(event.target.checked); markDirty() }} disabled={!answerWritable || loading} />
                    <span>質問者へ通知する</span>
                  </label>
                  <div className="answer-draft-status" role="status" aria-live="polite">
                    {!answerWritable
                      ? "回答送信後の内容です。変更する API は提供されていません。"
                      : isDirty
                        ? "未送信の変更があります"
                        : draftSavedAt
                          ? `この画面に入力を一時保持（${formatDateTime(draftSavedAt.toISOString())}）`
                          : "入力はこの画面に一時保持されていません"}
                  </div>
                  <div className="answer-form-actions">
                    <button type="button" disabled={loading || !answerWritable || !isDirty} onClick={onHoldDraft}>入力を一時保持</button>
                    <button type="submit" disabled={loading || !answerWritable || !answerTitle.trim() || !answerBody.trim()}>
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
      </ResourceStateBoundary>
    </section>
  )
}

function assigneeLane(question: HumanQuestion, hasLocalDraft = false): AssigneeLaneId {
  if (question.status === "resolved") return "resolved"
  if (question.status === "answered" || question.status === "waiting_requester") return "waitingReview"
  if (question.status === "in_progress" || hasLocalDraft || question.answerBody || question.references || question.internalMemo) return "inProgress"
  return "unassigned"
}
