import { AppShell } from "./app/AppShell.js"
import { useAuthSession } from "./features/auth/hooks/useAuthSession.js"
import LoginPage from "./LoginPage.js"

export default function App() {
  const { authSession, login, signUp, confirmSignUp, completeNewPassword, logout } = useAuthSession()

  if (!authSession) {
    return (
      <LoginPage
        onLogin={login}
        onSignUp={signUp}
        onConfirmSignUp={confirmSignUp}
        onCompleteNewPassword={completeNewPassword}
      />
    )
  }

  return <AppShell authSession={authSession} onSignOut={logout} />
}
