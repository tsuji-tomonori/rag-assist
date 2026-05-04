import { useState } from "react"
import {
  completeNewPasswordChallenge,
  confirmSignUp,
  getStoredAuthSession,
  signIn,
  signOut,
  signUp,
  type AuthResult,
  type AuthSession,
  type NewPasswordRequiredChallenge,
  type SignUpResult
} from "../../../authClient.js"

type LoginPayload = { email: string; password: string; remember: boolean }
type NewPasswordPayload = { challenge: NewPasswordRequiredChallenge; newPassword: string; remember: boolean }

export function useAuthSession() {
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => getStoredAuthSession())

  async function login(payload: LoginPayload): Promise<AuthResult> {
    const result = await signIn(payload)
    if (!("type" in result)) setAuthSession(result)
    return result
  }

  async function completeNewPassword(payload: NewPasswordPayload): Promise<AuthSession> {
    const session = await completeNewPasswordChallenge(payload)
    setAuthSession(session)
    return session
  }

  function logout() {
    signOut()
    setAuthSession(null)
  }

  return {
    authSession,
    login,
    signUp: signUp as (payload: { email: string; password: string }) => Promise<SignUpResult>,
    confirmSignUp,
    completeNewPassword,
    logout
  }
}
