import { useEffect, useRef, useState } from "react"
import {
  completeNewPasswordChallenge,
  confirmSignUp,
  getStoredAuthSession,
  signIn,
  signOut,
  signUp,
  storeAuthSession,
  type AuthResult,
  type AuthSession,
  type NewPasswordRequiredChallenge,
  type SignUpResult
} from "../../../authClient.js"
import { getRuntimeConfig, resolveHostedUiRuntimeConfig, type HostedUiRuntimeConfig } from "../../../shared/api/runtimeConfig.js"
import {
  beginHostedUiSignIn,
  buildHostedUiLogoutUrl,
  clearHostedUiTransient,
  completeHostedUiCallback,
  isHostedUiCallback,
  resolveAuthUiMode,
  type AuthUiMode
} from "../api/hostedUiAuth.js"

type LoginPayload = { email: string; password: string; remember: boolean }
type NewPasswordPayload = { challenge: NewPasswordRequiredChallenge; newPassword: string; remember: boolean }

export function useAuthSession() {
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => getStoredAuthSession())
  const [authUiMode, setAuthUiMode] = useState<AuthUiMode>(() => (
    !import.meta.env.PROD && import.meta.env.VITE_AUTH_MODE === "local" ? "credentials" : "loading"
  ))
  const [authError, setAuthError] = useState<string | null>(null)
  const hostedUiConfigRef = useRef<HostedUiRuntimeConfig | null>(null)

  useEffect(() => {
    if (authUiMode !== "loading") return
    let active = true

    void getRuntimeConfig()
      .then(async (config) => {
        const mode = resolveAuthUiMode({
          config,
          currentOrigin: window.location.origin,
          isProduction: import.meta.env.PROD,
          explicitAuthMode: import.meta.env.VITE_AUTH_MODE
        })
        const hostedUiConfig = resolveHostedUiRuntimeConfig(config, window.location.origin)
        if (!active) return
        hostedUiConfigRef.current = hostedUiConfig ?? null

        if (mode !== "hostedUi" || !hostedUiConfig) {
          if (window.location.pathname === "/auth/callback") clearHostedUiTransient()
          setAuthUiMode(mode)
          if (mode === "unavailable") setAuthError("Hosted UI認証設定が未設定または不正です。")
          return
        }

        if (isHostedUiCallback(hostedUiConfig, window.location.href)) {
          try {
            const session = await completeHostedUiCallback(hostedUiConfig, window.location.href)
            if (!active) return
            setAuthSession(storeAuthSession(session, false))
            setAuthError(null)
          } catch (error) {
            if (!active) return
            setAuthSession(null)
            setAuthError(error instanceof Error ? error.message : String(error))
          } finally {
            if (active) window.history.replaceState(window.history.state, "", new URL(hostedUiConfig.cognitoLogoutUri).pathname)
          }
        }
        if (active) setAuthUiMode("hostedUi")
      })
      .catch((error) => {
        if (!active) return
        clearHostedUiTransient()
        setAuthUiMode(import.meta.env.PROD ? "unavailable" : "credentials")
        setAuthError(error instanceof Error ? error.message : String(error))
      })

    return () => {
      active = false
    }
  }, [authUiMode])

  async function login(payload: LoginPayload): Promise<AuthResult> {
    const result = await signIn(payload)
    if (!("type" in result)) setAuthSession(result)
    return result
  }

  async function loginWithHostedUi(): Promise<void> {
    setAuthError(null)
    const hostedUiConfig = hostedUiConfigRef.current
    if (!hostedUiConfig) throw new Error("Hosted UI認証設定が未設定または不正です。")
    await beginHostedUiSignIn(hostedUiConfig)
  }

  async function completeNewPassword(payload: NewPasswordPayload): Promise<AuthSession> {
    const session = await completeNewPasswordChallenge(payload)
    setAuthSession(session)
    return session
  }

  function logout() {
    signOut()
    setAuthSession(null)
    const hostedUiConfig = hostedUiConfigRef.current
    if (authUiMode === "hostedUi" && hostedUiConfig) {
      window.location.assign(buildHostedUiLogoutUrl(hostedUiConfig))
    }
  }

  return {
    authSession,
    authUiMode,
    authError,
    login,
    loginWithHostedUi,
    signUp: signUp as (payload: { email: string; password: string }) => Promise<SignUpResult>,
    confirmSignUp,
    completeNewPassword,
    logout
  }
}
