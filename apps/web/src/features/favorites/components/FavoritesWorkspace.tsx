import { useMemo } from "react"
import { Icon } from "../../../shared/components/Icon.js"
import type { FavoriteItem } from "../types.js"

const targetTypeLabels: Record<FavoriteItem["targetType"], string> = {
  chatSession: "会話",
  chatMessage: "メッセージ",
  folder: "フォルダ",
  document: "文書",
  agentExecutionPreset: "実行プリセット",
  skill: "スキル",
  agentProfile: "プロファイル",
  benchmarkRun: "ベンチマーク"
}

export function FavoritesWorkspace({
  favorites,
  onBack
}: {
  favorites: FavoriteItem[]
  onBack: () => void
}) {
  const grouped = useMemo(() => {
    const groups = new Map<FavoriteItem["targetType"], FavoriteItem[]>()
    for (const favorite of favorites) {
      groups.set(favorite.targetType, [...(groups.get(favorite.targetType) ?? []), favorite])
    }
    return [...groups.entries()]
  }, [favorites])

  return (
    <section className="assignee-workspace" aria-label="お気に入り">
      <header className="assignee-header">
        <button type="button" onClick={onBack} title="チャットへ戻る" aria-label="チャットへ戻る">
          <Icon name="chevron" />
        </button>
        <div>
          <h2>お気に入り</h2>
          <span>{favorites.length} 件のショートカット</span>
        </div>
      </header>
      <div className="question-list-panel history-panel">
        <div className="history-list-head">
          <h3>項目一覧</h3>
          <span>{grouped.length} 種類</span>
        </div>
        {favorites.length === 0 ? (
          <div className="empty-question-panel">お気に入りはありません。</div>
        ) : (
          grouped.map(([targetType, items]) => (
            <div className="question-list history-list" key={targetType}>
              <h3>{targetTypeLabels[targetType]}</h3>
              {items.map((favorite) => (
                <div className={`question-list-item history-item ${favorite.accessible ? "" : "is-waiting"}`} key={favorite.favoriteId}>
                  <span>
                    <strong>{favorite.label || favorite.targetId}</strong>
                    <small>{favorite.accessible ? favorite.targetId : "アクセス不可"}</small>
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
