import { useEffect, useMemo, useState } from "react"
import type { ConversationHistoryItem } from "../types.js"
import { Icon } from "../../../shared/components/Icon.js"
import { formatDateTime } from "../../../shared/utils/format.js"

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
  const favoriteCount = history.filter((item) => item.isFavorite).length

  useEffect(() => {
    setFavoritesOnly(favoriteOnly)
  }, [favoriteOnly])

  const visibleHistory = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const scope = favoritesOnly ? history.filter((item) => item.isFavorite) : history
    const filtered = normalizedQuery.length === 0
      ? scope
      : scope.filter((item) => {
          const messageText = item.messages.map((message) => message.text).join(" ").toLowerCase()
          return item.title.toLowerCase().includes(normalizedQuery) || messageText.includes(normalizedQuery)
        })

    return [...filtered].sort((a, b) => {
      if (Boolean(a.isFavorite) !== Boolean(b.isFavorite)) return a.isFavorite ? -1 : 1
      if (sortOrder === "messages") return b.messages.length - a.messages.length
      const timeDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      return sortOrder === "newest" ? timeDiff : -timeDiff
    })
  }, [favoritesOnly, history, query, sortOrder])

  return (
    <section className="assignee-workspace" aria-label="履歴">
      <header className="assignee-header">
        <button type="button" onClick={onBack} title="チャットへ戻る">
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
            visibleHistory.map((item) => (
              <div className="question-list-item history-item" key={item.id}>
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
                  <strong>{item.title}</strong>
                  <span>{formatDateTime(item.updatedAt)}</span>
                  <small>{item.messages.length} メッセージ</small>
                </button>
                <button className="history-delete-button" type="button" onClick={() => onDelete(item.id)}>
                  削除
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
