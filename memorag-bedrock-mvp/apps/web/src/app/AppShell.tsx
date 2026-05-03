import type { AuthSession } from "../authClient.js"
import { AppRoutes } from "./AppRoutes.js"
import { RailNav } from "./components/RailNav.js"
import { TopBar } from "./components/TopBar.js"
import { useAppShellState } from "./hooks/useAppShellState.js"

export function AppShell({ authSession, onSignOut }: { authSession: AuthSession; onSignOut: () => void }) {
  const { error, railProps, topBarProps, routeProps } = useAppShellState({ authSession, onSignOut })

  return (
    <main className="app-frame">
      <RailNav {...railProps} />

      <section className="main-area">
        <TopBar {...topBarProps} />

        {error && <div className="error-banner">{error}</div>}

        <AppRoutes {...routeProps} />
      </section>
    </main>
  )
}
