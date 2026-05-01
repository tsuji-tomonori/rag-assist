import { getRuntimeConfig, setAuthTokenProvider } from "./api.js"

export type AuthSession = {
  email: string
  idToken: string
  accessToken?: string
  refreshToken?: string
  expiresAt: number
}

const sessionKey = "memorag.auth.session"

setAuthTokenProvider(() => getStoredAuthSession()?.idToken)

export async function signIn(input: { email: string; password: string; remember: boolean }): Promise<AuthSession> {
  const email = input.email.trim()
  if (!email || !input.password) throw new Error("メールアドレスとパスワードを入力してください。")

  if (import.meta.env.VITE_AUTH_MODE === "local") {
    return storeSession(createLocalSession(email), input.remember)
  }

  const config = await getRuntimeConfig()
  if (config.authMode === "local") {
    return storeSession(createLocalSession(email), input.remember)
  }

  if (!config.cognitoRegion || !config.cognitoUserPoolClientId) {
    throw new Error("Cognito認証設定が未設定です。")
  }

  const response = await fetch(`https://cognito-idp.${config.cognitoRegion}.amazonaws.com/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth"
    },
    body: JSON.stringify({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: config.cognitoUserPoolClientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: input.password
      }
    })
  })

  const body = (await response.json().catch(() => ({}))) as {
    AuthenticationResult?: {
      IdToken?: string
      AccessToken?: string
      RefreshToken?: string
      ExpiresIn?: number
    }
    ChallengeName?: string
  }

  if (!response.ok) {
    throw new Error("メールアドレスまたはパスワードが正しくありません。")
  }
  if (body.ChallengeName) {
    throw new Error(`追加の認証操作が必要です: ${body.ChallengeName}`)
  }
  if (!body.AuthenticationResult?.IdToken) {
    throw new Error("Cognito認証レスポンスにIDトークンがありません。")
  }

  return storeSession(
    {
      email,
      idToken: body.AuthenticationResult.IdToken,
      accessToken: body.AuthenticationResult.AccessToken,
      refreshToken: body.AuthenticationResult.RefreshToken,
      expiresAt: Date.now() + (body.AuthenticationResult.ExpiresIn ?? 3600) * 1000
    },
    input.remember
  )
}

export function getStoredAuthSession(): AuthSession | null {
  const session = readSession(window.sessionStorage) ?? readSession(window.localStorage)
  if (!session) return null
  if (session.expiresAt <= Date.now() + 30_000) {
    signOut()
    return null
  }
  return session
}

export function signOut() {
  window.sessionStorage.removeItem(sessionKey)
  window.localStorage.removeItem(sessionKey)
}

function storeSession(session: AuthSession, remember: boolean): AuthSession {
  const targetStorage = remember ? window.localStorage : window.sessionStorage
  const otherStorage = remember ? window.sessionStorage : window.localStorage
  targetStorage.setItem(sessionKey, JSON.stringify(session))
  otherStorage.removeItem(sessionKey)
  setAuthTokenProvider(() => getStoredAuthSession()?.idToken)
  return session
}

function readSession(storage: Storage): AuthSession | null {
  const value = storage.getItem(sessionKey)
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as AuthSession
    return parsed.idToken && parsed.email && parsed.expiresAt ? parsed : null
  } catch {
    storage.removeItem(sessionKey)
    return null
  }
}

function createLocalSession(email: string): AuthSession {
  return {
    email,
    idToken: "local-dev-token",
    expiresAt: Date.now() + 24 * 60 * 60 * 1000
  }
}
