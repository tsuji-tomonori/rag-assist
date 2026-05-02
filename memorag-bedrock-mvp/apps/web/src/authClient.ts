import { getRuntimeConfig, setAuthTokenProvider } from "./api.js"

export type AuthSession = {
  email: string
  idToken: string
  accessToken?: string
  refreshToken?: string
  expiresAt: number
  cognitoGroups?: string[]
}

export type NewPasswordRequiredChallenge = {
  type: "NEW_PASSWORD_REQUIRED"
  email: string
  session: string
  requiredAttributes: string[]
}

export type AuthResult = AuthSession | NewPasswordRequiredChallenge

export type SignUpResult = {
  email: string
  deliveryDestination?: string
}

const sessionKey = "memorag.auth.session"

setAuthTokenProvider(() => getStoredAuthSession()?.idToken)

export async function signIn(input: { email: string; password: string; remember: boolean }): Promise<AuthResult> {
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

  const response = await fetch(cognitoEndpoint(config.cognitoRegion), {
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

  const body = await readCognitoResponse(response)

  if (!response.ok) {
    throw new Error("メールアドレスまたはパスワードが正しくありません。")
  }
  if (body.ChallengeName === "NEW_PASSWORD_REQUIRED") {
    if (!body.Session) {
      throw new Error("パスワード変更セッションを取得できませんでした。")
    }
    return {
      type: "NEW_PASSWORD_REQUIRED",
      email,
      session: body.Session,
      requiredAttributes: parseRequiredAttributes(body.ChallengeParameters?.requiredAttributes)
    }
  }
  if (body.ChallengeName) {
    throw new Error(`追加の認証操作が必要です: ${body.ChallengeName}`)
  }

  return storeAuthenticatedResult(email, body, input.remember)
}

export async function completeNewPasswordChallenge(input: {
  challenge: NewPasswordRequiredChallenge
  newPassword: string
  remember: boolean
}): Promise<AuthSession> {
  const newPassword = input.newPassword.trim()
  if (!newPassword) throw new Error("新しいパスワードを入力してください。")

  const config = await getRuntimeConfig()
  if (!config.cognitoRegion || !config.cognitoUserPoolClientId) {
    throw new Error("Cognito認証設定が未設定です。")
  }

  const response = await fetch(cognitoEndpoint(config.cognitoRegion), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": "AWSCognitoIdentityProviderService.RespondToAuthChallenge"
    },
    body: JSON.stringify({
      ChallengeName: "NEW_PASSWORD_REQUIRED",
      ClientId: config.cognitoUserPoolClientId,
      Session: input.challenge.session,
      ChallengeResponses: {
        USERNAME: input.challenge.email,
        NEW_PASSWORD: newPassword
      }
    })
  })

  const body = await readCognitoResponse(response)
  if (!response.ok) {
    throw new Error("新しいパスワードを設定できませんでした。条件を確認して再入力してください。")
  }
  if (body.ChallengeName) {
    throw new Error(`追加の認証操作が必要です: ${body.ChallengeName}`)
  }

  return storeAuthenticatedResult(input.challenge.email, body, input.remember)
}

export async function signUp(input: { email: string; password: string }): Promise<SignUpResult> {
  const email = input.email.trim()
  if (!email || !input.password) throw new Error("メールアドレスとパスワードを入力してください。")

  if (import.meta.env.VITE_AUTH_MODE === "local") {
    return { email }
  }

  const config = await getRuntimeConfig()
  if (config.authMode === "local") {
    return { email }
  }

  if (!config.cognitoRegion || !config.cognitoUserPoolClientId) {
    throw new Error("Cognito認証設定が未設定です。")
  }

  const response = await fetch(cognitoEndpoint(config.cognitoRegion), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": "AWSCognitoIdentityProviderService.SignUp"
    },
    body: JSON.stringify({
      ClientId: config.cognitoUserPoolClientId,
      Username: email,
      Password: input.password,
      UserAttributes: [{ Name: "email", Value: email }]
    })
  })

  const body = await readCognitoResponse(response)
  if (!response.ok) {
    throw new Error(readCognitoError(body) ?? "アカウントを作成できませんでした。入力内容を確認してください。")
  }

  return {
    email,
    deliveryDestination: body.CodeDeliveryDetails?.Destination
  }
}

export async function confirmSignUp(input: { email: string; code: string }): Promise<void> {
  const email = input.email.trim()
  const code = input.code.trim()
  if (!email || !code) throw new Error("メールアドレスと確認コードを入力してください。")

  if (import.meta.env.VITE_AUTH_MODE === "local") return

  const config = await getRuntimeConfig()
  if (config.authMode === "local") return

  if (!config.cognitoRegion || !config.cognitoUserPoolClientId) {
    throw new Error("Cognito認証設定が未設定です。")
  }

  const response = await fetch(cognitoEndpoint(config.cognitoRegion), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": "AWSCognitoIdentityProviderService.ConfirmSignUp"
    },
    body: JSON.stringify({
      ClientId: config.cognitoUserPoolClientId,
      Username: email,
      ConfirmationCode: code
    })
  })

  const body = await readCognitoResponse(response)
  if (!response.ok) {
    throw new Error(readCognitoError(body) ?? "確認コードを検証できませんでした。")
  }
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

function storeAuthenticatedResult(email: string, body: CognitoResponseBody, remember: boolean): AuthSession {
  if (!body.AuthenticationResult?.IdToken) {
    throw new Error("Cognito認証レスポンスにIDトークンがありません。")
  }

  return storeSession(
    {
      email,
      idToken: body.AuthenticationResult.IdToken,
      accessToken: body.AuthenticationResult.AccessToken,
      refreshToken: body.AuthenticationResult.RefreshToken,
      expiresAt: Date.now() + (body.AuthenticationResult.ExpiresIn ?? 3600) * 1000,
      cognitoGroups: readCognitoGroups(body.AuthenticationResult.IdToken)
    },
    remember
  )
}

type CognitoResponseBody = {
  AuthenticationResult?: {
    IdToken?: string
    AccessToken?: string
    RefreshToken?: string
    ExpiresIn?: number
  }
  ChallengeName?: string
  ChallengeParameters?: Record<string, string | undefined>
  Session?: string
  CodeDeliveryDetails?: {
    Destination?: string
  }
  __type?: string
  message?: string
}

async function readCognitoResponse(response: Response): Promise<CognitoResponseBody> {
  return (await response.json().catch(() => ({}))) as CognitoResponseBody
}

function cognitoEndpoint(region: string): string {
  return `https://cognito-idp.${region}.amazonaws.com/`
}

function parseRequiredAttributes(value: string | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }
}

function readCognitoError(body: CognitoResponseBody): string | undefined {
  if (!body.__type) return body.message
  if (body.__type.includes("UsernameExistsException")) return "このメールアドレスはすでに登録されています。"
  if (body.__type.includes("InvalidPasswordException")) return "パスワード条件を満たしていません。"
  if (body.__type.includes("CodeMismatchException")) return "確認コードが正しくありません。"
  if (body.__type.includes("ExpiredCodeException")) return "確認コードの有効期限が切れています。"
  if (body.__type.includes("LimitExceededException")) return "試行回数が多すぎます。時間をおいて再試行してください。"
  return body.message
}

function readSession(storage: Storage): AuthSession | null {
  const value = storage.getItem(sessionKey)
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as AuthSession
    return parsed.idToken && parsed.email && parsed.expiresAt
      ? { ...parsed, cognitoGroups: parsed.cognitoGroups ?? readCognitoGroups(parsed.idToken) }
      : null
  } catch {
    storage.removeItem(sessionKey)
    return null
  }
}

function createLocalSession(email: string): AuthSession {
  return {
    email,
    idToken: "local-dev-token",
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    cognitoGroups: ["SYSTEM_ADMIN"]
  }
}

function readCognitoGroups(idToken: string): string[] {
  const payload = parseJwtPayload(idToken)
  const groups = payload?.["cognito:groups"]
  return Array.isArray(groups) ? groups.filter((item): item is string => typeof item === "string") : []
}

function parseJwtPayload(token: string): Record<string, unknown> | undefined {
  const payload = token.split(".")[1]
  if (!payload) return undefined
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
    return JSON.parse(globalThis.atob(padded)) as Record<string, unknown>
  } catch {
    return undefined
  }
}
