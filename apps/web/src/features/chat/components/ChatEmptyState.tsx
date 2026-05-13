import { Icon } from "../../../shared/components/Icon.js"

export function ChatEmptyState({ documentsCount, onSelectPrompt }: { documentsCount: number; onSelectPrompt: (value: string) => void }) {
  const prompts = [
    "社内規程の申請手順を確認したい",
    "この資料の重要ポイントを整理して",
    "担当部署へ確認が必要な内容を洗い出して"
  ]

  return (
    <section className="chat-empty-state" aria-label="チャット開始">
      <div className="empty-orbit" aria-hidden="true">
        <Icon name="logo" />
      </div>
      <div className="empty-copy">
        <span>{documentsCount > 0 ? `${documentsCount} 件の資料を参照できます` : "資料を添付して開始できます"}</span>
        <h2>何を確認しますか？</h2>
      </div>
      <div className="prompt-grid">
        {prompts.map((prompt) => (
          <button type="button" key={prompt} onClick={() => onSelectPrompt(prompt)}>
            {prompt}
          </button>
        ))}
      </div>
    </section>
  )
}
