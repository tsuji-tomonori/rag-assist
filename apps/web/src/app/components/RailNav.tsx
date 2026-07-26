import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import type { AuthSession } from "../../authClient.js"
import { Icon, type IconName } from "../../shared/ui/Icon.js"
import type { AppView } from "../types.js"

type NavigationDestination = {
  view: AppView
  label: string
  icon: IconName
}

export function RailNav({
  activeView,
  authSession,
  canAnswerQuestions,
  canReadBenchmarkRuns,
  canReadDocuments,
  canSeeAdminSettings,
  onChangeView
}: {
  activeView: AppView
  authSession: AuthSession
  canAnswerQuestions: boolean
  canReadBenchmarkRuns: boolean
  canReadDocuments: boolean
  canSeeAdminSettings: boolean
  onChangeView: (view: AppView) => void
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuId = useId()
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const destinations = useMemo<NavigationDestination[]>(() => [
    { view: "chat", label: "チャット", icon: "chat" },
    ...(canAnswerQuestions ? [{ view: "assignee" as const, label: "担当者対応", icon: "inbox" as const }] : []),
    { view: "history", label: "履歴", icon: "clock" },
    ...(canReadBenchmarkRuns ? [{ view: "benchmark" as const, label: "性能テスト", icon: "gauge" as const }] : []),
    { view: "favorites", label: "お気に入り", icon: "star" },
    ...(canReadDocuments ? [{ view: "documents" as const, label: "ドキュメント", icon: "document" as const }] : []),
    ...(canSeeAdminSettings ? [{ view: "admin" as const, label: "管理者設定", icon: "settings" as const }] : [])
  ], [canAnswerQuestions, canReadBenchmarkRuns, canReadDocuments, canSeeAdminSettings])

  const closeMobileMenu = useCallback((restoreFocus: boolean) => {
    setMobileMenuOpen(false)
    if (restoreFocus) queueMicrotask(() => mobileMenuButtonRef.current?.focus())
  }, [])

  useEffect(() => {
    if (!mobileMenuOpen) return
    queueMicrotask(() => {
      const currentItem = mobileMenuRef.current?.querySelector<HTMLElement>('[aria-current="page"]')
      const firstItem = mobileMenuRef.current?.querySelector<HTMLElement>("button")
      ;(currentItem ?? firstItem)?.focus()
    })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      closeMobileMenu(true)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [closeMobileMenu, mobileMenuOpen])

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return
    const media = window.matchMedia("(max-width: 720px)")
    const onChange = (event: MediaQueryListEvent) => {
      if (!event.matches) closeMobileMenu(false)
    }
    media.addEventListener?.("change", onChange)
    return () => media.removeEventListener?.("change", onChange)
  }, [closeMobileMenu])

  const selectMobileView = (view: AppView) => {
    onChangeView(view)
    closeMobileMenu(true)
  }

  return (
    <aside className="rail" aria-label="主要ナビゲーション">
      <a className="rail-logo" href="/" aria-label="ホーム">
        <Icon name="logo" />
      </a>

      <nav className="rail-nav rail-nav-desktop" aria-label="画面">
        <DestinationButtons activeView={activeView} destinations={destinations} onSelect={onChangeView} />
      </nav>

      <AccountButton
        active={activeView === "profile"}
        authSession={authSession}
        className="account-button account-button-desktop"
        onSelect={() => onChangeView("profile")}
      />

      <button
        ref={mobileMenuButtonRef}
        className="mobile-menu-button"
        type="button"
        aria-controls={mobileMenuId}
        aria-expanded={mobileMenuOpen}
        aria-label={mobileMenuOpen ? "メニューを閉じる" : "メニューを開く"}
        onClick={() => setMobileMenuOpen((current) => !current)}
      >
        <Icon name={mobileMenuOpen ? "close" : "menu"} />
        <span>メニュー</span>
      </button>

      {mobileMenuOpen && (
        <div ref={mobileMenuRef} className="mobile-navigation-panel" id={mobileMenuId}>
          <nav className="mobile-navigation-list" aria-label="モバイル画面">
            <DestinationButtons activeView={activeView} destinations={destinations} onSelect={selectMobileView} />
          </nav>
          <AccountButton
            active={activeView === "profile"}
            authSession={authSession}
            className="mobile-account-button"
            onSelect={() => selectMobileView("profile")}
          />
        </div>
      )}
    </aside>
  )
}

function DestinationButtons({
  activeView,
  destinations,
  onSelect
}: {
  activeView: AppView
  destinations: NavigationDestination[]
  onSelect: (view: AppView) => void
}) {
  return destinations.map((destination) => (
    <button
      key={destination.view}
      className={`rail-item ${activeView === destination.view ? "active" : ""}`}
      type="button"
      title={destination.label}
      aria-current={activeView === destination.view ? "page" : undefined}
      onClick={() => onSelect(destination.view)}
    >
      <Icon name={destination.icon} />
      <span>{destination.label}</span>
    </button>
  ))
}

function AccountButton({
  active,
  authSession,
  className,
  onSelect
}: {
  active: boolean
  authSession: AuthSession
  className: string
  onSelect: () => void
}) {
  return (
    <button
      className={`${className} ${active ? "active" : ""}`}
      type="button"
      title="個人設定"
      aria-label="個人設定"
      aria-current={active ? "page" : undefined}
      onClick={onSelect}
    >
      <span className="account-avatar">{authSession.email.slice(0, 1).toUpperCase()}</span>
      <span>個人設定</span>
      <Icon name="chevron" />
    </button>
  )
}
