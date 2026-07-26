import { AppShell } from "./app/AppShell.js"
import { useAuthSession } from "./features/auth/hooks/useAuthSession.js"
import LoginPage from "./LoginPage.js"

export default function App() {
  const {
    authSession,
    authUiMode,
    authError,
    login,
    loginWithHostedUi,
    signUp,
    confirmSignUp,
    completeNewPassword,
    logout
  } = useAuthSession()

  if (!authSession) {
    if (authUiMode === "loading") {
      return <main className="login-page"><p role="status">認証状態を確認しています。</p></main>
    }
    return (
      <LoginPage
        authUiMode={authUiMode}
        externalError={authError}
        onLogin={login}
        onHostedUiLogin={loginWithHostedUi}
        onSignUp={signUp}
        onConfirmSignUp={confirmSignUp}
        onCompleteNewPassword={completeNewPassword}
      />
    )
  }

  return <AppShell authSession={authSession} onSignOut={logout} />
}
