import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose"
import {
  resolveHostedUiRuntimeConfig,
  type HostedUiRuntimeConfig,
  type RuntimeConfig
} from "../../../shared/api/runtimeConfig.js"

export type AuthUiMode = "loading" | "hostedUi" | "credentials" | "unavailable"

export type HostedUiAuthSession = {
  email: string
  idToken: string
  accessToken: string
  refreshToken?: string
  expiresAt: number
  cognitoGroups: string[]
}

type HostedUiTransient = {
  readonly state: string
  readonly nonce: string
  readonly codeVerifier: string
  readonly expiresAt: number
}

type HostedUiTokenResponse = {
  readonly id_token?: unknown
  readonly access_token?: unknown
  readonly refresh_token?: unknown
  readonly expires_in?: unknown
  readonly token_type?: unknown
}

type JwtVerificationOptions = {
  readonly issuer: string
  readonly audience?: string
}

type JwtVerifier = (token: string, options: JwtVerificationOptions) => Promise<JWTPayload>

const transientStorageKey = "memorag.auth.hosted-ui.transient"
const transientTtlMs = 5 * 60 * 1000
const remoteJwkSets = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

export function resolveAuthUiMode(input: {
  readonly config: RuntimeConfig
  readonly currentOrigin: string
  readonly isProduction: boolean
  readonly explicitAuthMode?: unknown
}): Exclude<AuthUiMode, "loading"> {
  if (!input.isProduction && (input.explicitAuthMode === "local" || input.config.authMode === "local")) {
    return "credentials"
  }
  if (resolveHostedUiRuntimeConfig(input.config, input.currentOrigin)) return "hostedUi"
  return input.isProduction ? "unavailable" : "credentials"
}

export function isHostedUiCallback(config: HostedUiRuntimeConfig, currentUrl: string): boolean {
  try {
    const callback = new URL(config.cognitoRedirectUri)
    const current = new URL(currentUrl)
    return current.origin === callback.origin && current.pathname === callback.pathname && Boolean(current.search)
  } catch {
    return false
  }
}

export async function beginHostedUiSignIn(
  config: HostedUiRuntimeConfig,
  options: {
    readonly storage?: Storage
    readonly crypto?: Pick<Crypto, "getRandomValues" | "subtle">
    readonly now?: number
    readonly navigate?: (url: string) => void
  } = {}
): Promise<string> {
  const storage = options.storage ?? window.sessionStorage
  const cryptoProvider = options.crypto ?? globalThis.crypto
  const now = options.now ?? Date.now()
  const state = randomBase64Url(cryptoProvider, 32)
  const nonce = randomBase64Url(cryptoProvider, 32)
  const codeVerifier = randomBase64Url(cryptoProvider, 64)
  const codeChallenge = base64Url(new Uint8Array(await cryptoProvider.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier))))

  const transient: HostedUiTransient = {
    state,
    nonce,
    codeVerifier,
    expiresAt: now + transientTtlMs
  }
  storage.setItem(transientStorageKey, JSON.stringify(transient))

  const url = new URL(`${config.cognitoHostedUiBaseUrl}/oauth2/authorize`)
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: config.cognitoUserPoolClientId,
    redirect_uri: config.cognitoRedirectUri,
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256"
  }).toString()

  const target = url.toString()
  ;(options.navigate ?? ((nextUrl) => window.location.assign(nextUrl)))(target)
  return target
}

export async function completeHostedUiCallback(
  config: HostedUiRuntimeConfig,
  currentUrl: string,
  options: {
    readonly storage?: Storage
    readonly fetch?: typeof fetch
    readonly now?: number
    readonly verifyJwt?: JwtVerifier
  } = {}
): Promise<HostedUiAuthSession> {
  const storage = options.storage ?? window.sessionStorage
  const transient = consumeTransient(storage)
  if (!transient) throw new Error("認証要求の一時情報が見つからないか、すでに使用されています。")

  const now = options.now ?? Date.now()
  if (transient.expiresAt <= now) throw new Error("認証要求の有効期限が切れています。もう一度サインインしてください。")

  const callback = new URL(config.cognitoRedirectUri)
  const current = new URL(currentUrl)
  if (current.origin !== callback.origin || current.pathname !== callback.pathname) {
    throw new Error("認証callback URLが許可されたURLと一致しません。")
  }

  const state = singleParam(current.searchParams, "state")
  if (!state || state !== transient.state) throw new Error("認証stateを検証できませんでした。")

  const code = singleParam(current.searchParams, "code")
  const errorValues = current.searchParams.getAll("error")
  if (errorValues.length > 0) {
    if (errorValues.length !== 1 || !errorValues[0] || code) {
      throw new Error("認証callbackに矛盾したparameterがあります。")
    }
    throw new Error("Cognito認証がキャンセルまたは拒否されました。")
  }
  if (!code) throw new Error("認証codeを取得できませんでした。")

  const tokenResponse = await (options.fetch ?? fetch)(`${config.cognitoHostedUiBaseUrl}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.cognitoUserPoolClientId,
      code,
      redirect_uri: config.cognitoRedirectUri,
      code_verifier: transient.codeVerifier
    }).toString()
  })
  const tokenBody = await tokenResponse.json().catch(() => ({})) as HostedUiTokenResponse
  if (!tokenResponse.ok) throw new Error("認証codeをtokenへ交換できませんでした。")

  return verifyHostedUiTokenResponse(tokenBody, config, transient.nonce, options.verifyJwt)
}

export function buildHostedUiLogoutUrl(config: HostedUiRuntimeConfig): string {
  const url = new URL(`${config.cognitoHostedUiBaseUrl}/logout`)
  url.search = new URLSearchParams({
    client_id: config.cognitoUserPoolClientId,
    logout_uri: config.cognitoLogoutUri
  }).toString()
  return url.toString()
}

export async function verifyHostedUiTokenResponse(
  tokenBody: HostedUiTokenResponse,
  config: HostedUiRuntimeConfig,
  expectedNonce: string,
  verifyJwt: JwtVerifier = verifyJwtWithCognitoJwks
): Promise<HostedUiAuthSession> {
  const idToken = typeof tokenBody.id_token === "string" ? tokenBody.id_token : undefined
  const accessToken = typeof tokenBody.access_token === "string" ? tokenBody.access_token : undefined
  if (!idToken || !accessToken || tokenBody.token_type !== "Bearer") {
    throw new Error("Cognito token responseが必要なtokenを含んでいません。")
  }

  const issuer = `https://cognito-idp.${config.cognitoRegion}.amazonaws.com/${config.cognitoUserPoolId}`
  const idPayload = await verifyJwt(idToken, { issuer, audience: config.cognitoUserPoolClientId })
  if (idPayload.token_use !== "id") throw new Error("ID tokenの用途を検証できませんでした。")
  if (idPayload.nonce !== expectedNonce) throw new Error("ID tokenのnonceを検証できませんでした。")
  if (typeof idPayload.exp !== "number" || idPayload.exp * 1000 <= Date.now()) {
    throw new Error("ID tokenの有効期限を検証できませんでした。")
  }
  if (typeof idPayload.email !== "string" || !idPayload.email) {
    throw new Error("ID tokenにemail claimがありません。")
  }

  const accessPayload = await verifyJwt(accessToken, { issuer })
  if (accessPayload.token_use !== "access" || accessPayload.client_id !== config.cognitoUserPoolClientId) {
    throw new Error("Access tokenのclient bindingを検証できませんでした。")
  }
  if (typeof accessPayload.exp !== "number" || accessPayload.exp * 1000 <= Date.now()) {
    throw new Error("Access tokenの有効期限を検証できませんでした。")
  }

  const groups = idPayload["cognito:groups"]
  return {
    email: idPayload.email,
    idToken,
    accessToken,
    refreshToken: typeof tokenBody.refresh_token === "string" ? tokenBody.refresh_token : undefined,
    expiresAt: Math.min(idPayload.exp, accessPayload.exp) * 1000,
    cognitoGroups: Array.isArray(groups) ? groups.filter((group): group is string => typeof group === "string") : []
  }
}

export function clearHostedUiTransient(storage: Storage = window.sessionStorage) {
  storage.removeItem(transientStorageKey)
}

function consumeTransient(storage: Storage): HostedUiTransient | undefined {
  const value = storage.getItem(transientStorageKey)
  storage.removeItem(transientStorageKey)
  if (!value) return undefined
  try {
    const parsed = JSON.parse(value) as Partial<HostedUiTransient>
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.codeVerifier !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) return undefined
    return parsed as HostedUiTransient
  } catch {
    return undefined
  }
}

function singleParam(params: URLSearchParams, name: string): string | undefined {
  const values = params.getAll(name)
  return values.length === 1 && values[0] ? values[0] : undefined
}

function randomBase64Url(cryptoProvider: Pick<Crypto, "getRandomValues">, byteLength: number): string {
  const bytes = new Uint8Array(byteLength)
  cryptoProvider.getRandomValues(bytes)
  return base64Url(bytes)
}

function base64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return globalThis.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function verifyJwtWithCognitoJwks(token: string, options: JwtVerificationOptions): Promise<JWTPayload> {
  let jwks = remoteJwkSets.get(options.issuer)
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${options.issuer}/.well-known/jwks.json`))
    remoteJwkSets.set(options.issuer, jwks)
  }
  const result = await jwtVerify(token, jwks, {
    issuer: options.issuer,
    ...(options.audience ? { audience: options.audience } : {}),
    algorithms: ["RS256"],
    clockTolerance: 5
  })
  return result.payload
}

export function requireHostedUiRuntimeConfig(config: RuntimeConfig, currentOrigin: string): HostedUiRuntimeConfig {
  const hostedUiConfig = resolveHostedUiRuntimeConfig(config, currentOrigin)
  if (!hostedUiConfig) throw new Error("Hosted UI認証設定が未設定または不正です。")
  return hostedUiConfig
}
