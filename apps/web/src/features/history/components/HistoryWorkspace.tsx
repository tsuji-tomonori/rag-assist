import { useEffect, useMemo, useState } from "react"
import type { ConversationHistoryItem } from "../types.js"
import { ConfirmDialog } from "../../../shared/ui/index.js"
import { Icon } from "../../../shared/ui/Icon.js"
import { formatDateTime } from "../../../shared/utils/format.js"
import { searchConversationHistory, type ConversationHistorySearchResult } from "../utils/conversationHistorySearch.js"
import {
  ResourceStateBoundary,
  type UiResourceState
} from "../../../shared/ui/ResourceState.js"
import {
  hasConfirmedResourceResult,
  isResourcePartAvailable
} from "../../../shared/ui/resourceStateModel.js"
import {
  OperationFeedback,
  feedbackFromOutcome,
  processingOperationFeedback,
  type OperationFeedbackEntry,
  type OperationOutcome
} from "../../../shared/ui/index.js"
import { StatusBadge } from "../../../shared/ui/StatusBadge.js"
import { summarizeQuestionJourney } from "../../questions/utils/questionJourney.js"
import type { HumanQuestion } from "../../questions/types.js"

export function HistoryWorkspace({
  dataState,
  history,
  favoriteOnly = false,
  onSelect,
  onDelete,
  onToggleFavorite,
  onRetry,
  onBack
}: {
  dataState: UiResourceState
  history: ConversationHistoryItem[]
  favoriteOnly?: boolean
  onSelect: (item: ConversationHistoryItem) => void
  onDelete: (id: string) => Promise<OperationOutcome>
  onToggleFavorite: (item: ConversationHistoryItem) => void
  onRetry: () => void
  onBack: () => void
}) {
  const [query, setQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "messages">("newest")
  const [favoritesOnly, setFavoritesOnly] = useState(favoriteOnly)
  const [deleteCandidate, setDeleteCandidate] = useState<ConversationHistoryItem | null>(null)
  const [deleteFeedback, setDeleteFeedback] = useState<OperationFeedbackEntry | null>(null)
  const favoriteCount = history.filter((item) => item.isFavorite).length
  const hasHistoryResult = dataState.parts.length === 0
    ? hasConfirmedResourceResult(dataState)
    : isResourcePartAvailable(dataState, "conversations")

  useEffect(() => {
    setFavoritesOnly(favoriteOnly)
  }, [favoriteOnly])

  const visibleHistory = useMemo(() => {
    const hasQuery = query.trim().length > 0
    const scope = favoritesOnly ? history.filter((item) => item.isFavorite) : history
    const results = hasQuery
      ? searchConversationHistory(scope, query)
      : scope.map((item) => ({ item, score: 0, matchedTerms: [] }))

    return [...results].sort((a, b) => {
      if (hasQuery && Math.abs(b.score - a.score) > 0.001) return b.score - a.score
      if (Boolean(a.item.isFavorite) !== Boolean(b.item.isFavorite)) return a.item.isFavorite ? -1 : 1
      const timeDiff = new Date(b.item.updatedAt).getTime() - new Date(a.item.updatedAt).getTime()
      if (hasQuery) return timeDiff
      if (sortOrder === "messages") return b.item.messages.length - a.item.messages.length
      return sortOrder === "newest" ? timeDiff : -timeDiff
    })
  }, [favoritesOnly, history, query, sortOrder])

  return (
    <section className="assignee-workspace" aria-label="履歴">
      <header className="assignee-header">
        <button type="button" onClick={onBack} title="チャットへ戻る" aria-label="チャットへ戻る">
          <Icon name="chevron" />
        </button>
        <div>
          <h2>{favoriteOnly ? "お気に入り" : "履歴"}</h2>
          <span>{hasHistoryResult ? `${history.length} 件の会話 / ${favoriteCount} 件のお気に入り` : "会話履歴を確認中"}</span>
        </div>
      </header>
      {deleteFeedback && <OperationFeedback entry={deleteFeedback} className="history-operation-feedback" />}
      <ResourceStateBoundary
        state={dataState}
        isEmpty={history.length === 0}
        emptyScope="保存済みの会話履歴"
        emptyTitle="保存済みの会話履歴はありません。"
        emptyDescription="会話を始めると、取得が確認できた履歴がここに表示されます。"
        onRetry={onRetry}
        onBack={onBack}
      >
      <div className="question-list-panel history-panel">
        <div className="history-list-head">
          <h3>会話一覧</h3>
          <span>{visibleHistory.length} 件を表示中</span>
        </div>
        <div className="history-toolbar">
          <input
            type="search"
            placeholder="タイトルや会話内容で検索"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="履歴を検索"
          />
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as "newest" | "oldest" | "messages")} aria-label="履歴の並び順">
            <option value="newest">新しい順</option>
            <option value="oldest">古い順</option>
            <option value="messages">メッセージ数順</option>
          </select>
          <label className="favorite-filter">
            <input type="checkbox" checked={favoritesOnly} onChange={(event) => setFavoritesOnly(event.target.checked)} />
            <span>お気に入りのみ</span>
          </label>
        </div>
        <div className="question-list history-list">
          {visibleHistory.length === 0 ? (
            <div className="empty-question-panel">条件に一致する履歴はありません。</div>
          ) : (
            visibleHistory.map((result) => {
              const item = result.item
              const questionStatus = summarizeQuestionJourney(
                item.messages
                  .map((message) => message.questionTicket)
                  .filter((ticket): ticket is HumanQuestion => Boolean(ticket)),
                "requester"
              )
              return (
                <div className={`question-list-item history-item ${questionStatus ? `history-tone-${questionStatus.presentation.tone}` : ""}`} key={item.id}>
                  <button
                    type="button"
                    className={`favorite-toggle ${item.isFavorite ? "active" : ""}`}
                    onClick={() => onToggleFavorite(item)}
                    aria-label={item.isFavorite ? `${item.title}をお気に入りから外す` : `${item.title}をお気に入りに追加`}
                    title={item.isFavorite ? "お気に入りから外す" : "お気に入りに追加"}
                  >
                    <Icon name="star" />
                  </button>
                  <button type="button" onClick={() => onSelect(item)}>
                    <span className="history-title-line">
                      <strong>{item.title}</strong>
                      {questionStatus && (
                        <StatusBadge
                          className="history-question-badge"
                          presentation={{
                            ...questionStatus.presentation,
                            label: questionStatus.ticketCount > 1
                              ? `${questionStatus.presentation.label}（${questionStatus.ticketCount}件）`
                              : questionStatus.presentation.label
                          }}
                        />
                      )}
                    </span>
                    <span>{formatDateTime(item.updatedAt)}</span>
                    <HistorySearchSummary result={result} />
                    {questionStatus && <small className="history-question-next">次の操作: {questionStatus.nextAction}</small>}
                  </button>
                  <button
                    className="history-delete-button"
                    type="button"
                    disabled={deleteFeedback?.status === "processing"}
                    onClick={() => setDeleteCandidate(item)}
                  >
                    削除
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
      </ResourceStateBoundary>
      {deleteCandidate && (
        <ConfirmDialog
          title="この会話履歴を削除しますか？"
          description="削除した会話履歴はこの画面から復元できません。必要な内容が残っていないか確認してください。"
          confirmLabel="削除"
          details={[
            { label: "対象", value: deleteCandidate.title },
            { label: "影響", value: "この会話履歴と画面から参照するメッセージを削除します" },
            { label: "回復条件", value: "この画面からは復元できません" },
            { label: "確認が必要な理由", value: "必要な会話内容を失わないため" },
            { label: "更新日時", value: formatDateTime(deleteCandidate.updatedAt) },
            { label: "メッセージ数", value: String(deleteCandidate.messages.length) }
          ]}
          loading={deleteFeedback?.status === "processing" && deleteFeedback.targetId === deleteCandidate.id}
          onCancel={() => setDeleteCandidate(null)}
          onConfirm={async () => {
            const target = deleteCandidate
            const feedbackBase = {
              id: `history-delete-${target.id}`,
              actionLabel: "会話履歴削除",
              targetLabel: target.title,
              targetId: target.id,
              details: [
                { label: "影響", value: `${target.messages.length} メッセージの会話履歴を削除` },
                { label: "回復条件", value: "この画面からは復元不可" }
              ]
            }
            setDeleteFeedback(processingOperationFeedback(feedbackBase))
            const outcome = await onDelete(target.id)
            setDeleteFeedback(feedbackFromOutcome(feedbackBase, outcome))
            if (outcome.ok) setDeleteCandidate(null)
          }}
        />
      )}
    </section>
  )
}

function HistorySearchSummary({ result }: { result: ConversationHistorySearchResult }) {
  if (!result.snippet) return <small>{result.item.messages.length} メッセージ</small>
  return (
    <>
      <small>{result.item.messages.length} メッセージ</small>
      <small className="history-search-snippet">{result.snippet.text}</small>
    </>
  )
}
