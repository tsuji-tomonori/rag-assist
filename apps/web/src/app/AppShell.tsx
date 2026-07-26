import type { AuthSession } from "../authClient.js"
import { AppRoutes } from "./AppRoutes.js"
import { RailNav } from "./components/RailNav.js"
import { TopBar } from "./components/TopBar.js"
import { useAppShellState } from "./hooks/useAppShellState.js"
import { ResourceStatePanel } from "../shared/ui/ResourceState.js"

export function AppShell({ authSession, onSignOut }: { authSession: AuthSession; onSignOut: () => void }) {
  const { error, routeNotice, railProps, topBarProps, routeProps } = useAppShellState({ authSession, onSignOut })

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        メインコンテンツへ移動
      </a>

      <RailNav {...railProps} />

      <main className="main-area" id="main-content" tabIndex={-1}>
        <TopBar {...topBarProps} />

        {(error || routeNotice) && (
          <div className="app-status-stack">
            {error && (
              <ResourceStatePanel state={{
                kind: "error",
                target: error.target,
                parts: [],
                message: error.message
              }} />
            )}
            {routeNotice && (
              <div
                className={`route-notice route-notice-${routeNotice.kind}`}
                role={routeNotice.kind === "permission" ? "alert" : "status"}
              >
                {routeNotice.message}
              </div>
            )}
          </div>
        )}

        <AppRoutes {...routeProps} />
      </main>
    </div>
  )
}
