import { useState } from "react"
import { AppShell } from "./app/AppShell.js"
import { completeNewPasswordChallenge, confirmSignUp, getStoredAuthSession, signIn, signOut, signUp, type AuthSession } from "./authClient.js"
import LoginPage from "./LoginPage.js"

export default function App() {
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => getStoredAuthSession())

  if (!authSession) {
    return (
      <LoginPage
        onLogin={async (payload) => {
          const result = await signIn(payload)
          if (!("type" in result)) setAuthSession(result)
          return result
        }}
        onSignUp={signUp}
        onConfirmSignUp={confirmSignUp}
        onCompleteNewPassword={async (payload) => {
          const session = await completeNewPasswordChallenge(payload)
          setAuthSession(session)
          return session
        }}
      />
    )
  }

  return (
    <AppShell
      authSession={authSession}
      onSignOut={() => {
        signOut()
        setAuthSession(null)
      }}
    />
  )
}
