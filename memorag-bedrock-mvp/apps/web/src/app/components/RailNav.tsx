import type { AuthSession } from "../../authClient.js"
import { Icon } from "../../shared/components/Icon.js"
import type { AppView } from "../types.js"

export function RailNav({
  activeView,
  authSession,
  canAnswerQuestions,
  canReadBenchmarkRuns,
  canManageDocuments,
  canSeeAdminSettings,
  onChangeView
}: {
  activeView: AppView
  authSession: AuthSession
  canAnswerQuestions: boolean
  canReadBenchmarkRuns: boolean
  canManageDocuments: boolean
  canSeeAdminSettings: boolean
  onChangeView: (view: AppView) => void
}) {
  return (
    <aside className="rail" aria-label="主要ナビゲーション">
      <a className="rail-logo" href="/" aria-label="ホーム">
        <Icon name="logo" />
      </a>
      <nav className="rail-nav">
        <button className={`rail-item ${activeView === "chat" ? "active" : ""}`} type="button" title="チャット" onClick={() => onChangeView("chat")}>
          <Icon name="chat" />
          <span>チャット</span>
        </button>
        {canAnswerQuestions && (
          <button className={`rail-item ${activeView === "assignee" ? "active" : ""}`} type="button" title="担当者対応" onClick={() => onChangeView("assignee")}>
            <Icon name="inbox" />
            <span>担当者対応</span>
          </button>
        )}
        <button className={`rail-item ${activeView === "history" ? "active" : ""}`} type="button" title="履歴" onClick={() => onChangeView("history")}>
          <Icon name="clock" />
          <span>履歴</span>
        </button>
        {canReadBenchmarkRuns && (
          <button className={`rail-item ${activeView === "benchmark" ? "active" : ""}`} type="button" title="性能テスト" onClick={() => onChangeView("benchmark")}>
            <Icon name="gauge" />
            <span>性能テスト</span>
          </button>
        )}
        <button className={`rail-item ${activeView === "favorites" ? "active" : ""}`} type="button" title="お気に入り" onClick={() => onChangeView("favorites")}>
          <Icon name="star" />
          <span>お気に入り</span>
        </button>
        {canManageDocuments && (
          <button className={`rail-item ${activeView === "documents" ? "active" : ""}`} type="button" title="ドキュメント" onClick={() => onChangeView("documents")}>
            <Icon name="document" />
            <span>ドキュメント</span>
          </button>
        )}
        {canSeeAdminSettings && (
          <button className={`rail-item ${activeView === "admin" ? "active" : ""}`} type="button" title="管理者設定" onClick={() => onChangeView("admin")}>
            <Icon name="settings" />
            <span>管理者設定</span>
          </button>
        )}
      </nav>
      <button
        className={`account-button ${activeView === "profile" ? "active" : ""}`}
        type="button"
        title="個人設定"
        aria-label="個人設定"
        onClick={() => onChangeView("profile")}
      >
        <span className="account-avatar">{authSession.email.slice(0, 1).toUpperCase()}</span>
        <span>個人設定</span>
        <Icon name="chevron" />
      </button>
    </aside>
  )
}
