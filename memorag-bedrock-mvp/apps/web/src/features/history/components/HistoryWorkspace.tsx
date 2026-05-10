import { useEffect, useMemo, useState } from "react"
import type { ConversationHistoryItem } from "../types.js"
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog.js"
import { Icon } from "../../../shared/components/Icon.js"
import { formatDateTime } from "../../../shared/utils/format.js"
import { searchConversationHistory, type ConversationHistorySearchResult } from "../utils/conversationHistorySearch.js"

export function HistoryWorkspace({
  history,
  favoriteOnly = false,
  onSelect,
  onDelete,
  onToggleFavorite,
  onBack
}: {
  history: ConversationHistoryItem[]
  favoriteOnly?: boolean
  onSelect: (item: ConversationHistoryItem) => void
  onDelete: (id: string) => void
  onToggleFavorite: (item: ConversationHistoryItem) => void
  onBack: () => void
}) {
  const [query, setQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "messages">("newest")
  const [favoritesOnly, setFavoritesOnly] = useState(favoriteOnly)
  const [deleteCandidate, setDeleteCandidate] = useState<ConversationHistoryItem | null>(null)
  const favoriteCount = history.filter((item) => item.isFavorite).length

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
          <span>{history.length} 件の会話 / {favoriteCount} 件のお気に入り</span>
        </div>
      </header>
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
              const questionStatus = summarizeQuestionStatus(item)
              return (
                <div className={`question-list-item history-item ${questionStatus?.tone ?? ""}`} key={item.id}>
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
                      {questionStatus && <span className="history-question-badge">{questionStatus.label}</span>}
                    </span>
                    <span>{formatDateTime(item.updatedAt)}</span>
                    <HistorySearchSummary result={result} />
                  </button>
                  <button className="history-delete-button" type="button" onClick={() => setDeleteCandidate(item)}>
                    削除
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
      {deleteCandidate && (
        <ConfirmDialog
          title="この会話履歴を削除しますか？"
          description="削除した会話履歴はこの画面から復元できません。必要な内容が残っていないか確認してください。"
          confirmLabel="削除"
          details={[
            `対象:${deleteCandidate.title}`,
            `更新日時:${formatDateTime(deleteCandidate.updatedAt)}`,
            `メッセージ数:${deleteCandidate.messages.length}`
          ]}
          onCancel={() => setDeleteCandidate(null)}
          onConfirm={() => {
            onDelete(deleteCandidate.id)
            setDeleteCandidate(null)
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

function summarizeQuestionStatus(item: ConversationHistoryItem): { label: string; tone: string } | undefined {
  const tickets = item.messages.map((message) => message.questionTicket).filter(Boolean)
  if (tickets.some((ticket) => ticket?.status === "answered")) return { label: "返答あり", tone: "has-answer" }
  if (tickets.some((ticket) => ticket?.status === "open")) return { label: "確認待ち", tone: "is-waiting" }
  if (tickets.some((ticket) => ticket?.status === "resolved")) return { label: "解決済み", tone: "is-resolved" }
  return undefined
}
