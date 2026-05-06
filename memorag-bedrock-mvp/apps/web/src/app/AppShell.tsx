import type { AuthSession } from "../authClient.js"
import { AppRoutes } from "./AppRoutes.js"
import { RailNav } from "./components/RailNav.js"
import { TopBar } from "./components/TopBar.js"
import { useAppShellState } from "./hooks/useAppShellState.js"
import { LoadingStatus } from "../shared/components/LoadingSpinner.js"

export function AppShell({ authSession, onSignOut }: { authSession: AuthSession; onSignOut: () => void }) {
  const { error, loading, railProps, topBarProps, routeProps } = useAppShellState({ authSession, onSignOut })

  return (
    <main className="app-frame">
      <RailNav {...railProps} />

      <section className="main-area">
        <TopBar {...topBarProps} />

        {(loading || error) && (
          <div className="app-status-stack">
            {loading && <LoadingStatus label="API処理中" />}
            {error && <div className="error-banner">{error}</div>}
          </div>
        )}

        <AppRoutes {...routeProps} />
      </section>
    </main>
  )
}
