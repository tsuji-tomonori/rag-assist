export type RuntimeConfig = {
  apiBaseUrl?: string
  authMode?: "cognito" | "local"
  cognitoRegion?: string
  cognitoUserPoolId?: string
  cognitoUserPoolClientId?: string
  cognitoHostedUiBaseUrl?: string
  cognitoRedirectUri?: string
  cognitoLogoutUri?: string
}

export type HostedUiRuntimeConfig = {
  readonly cognitoRegion: string
  readonly cognitoUserPoolId: string
  readonly cognitoUserPoolClientId: string
  readonly cognitoHostedUiBaseUrl: string
  readonly cognitoRedirectUri: string
  readonly cognitoLogoutUri: string
}

let runtimeConfigPromise: Promise<RuntimeConfig> | undefined

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  runtimeConfigPromise ??= fetch("/config.json")
    .then(async (response) => (response.ok ? parseRuntimeConfig(await response.json()) : {}))
    .catch(() => ({}))

  const fileConfig = await runtimeConfigPromise
  const isProduction = import.meta.env.PROD
  return {
    ...fileConfig,
    apiBaseUrl: resolveApiBaseUrl({
      viteApiBaseUrl: import.meta.env.VITE_API_BASE_URL,
      fileApiBaseUrl: fileConfig.apiBaseUrl,
      isProduction
    }),
    authMode: isProduction
      ? fileConfig.authMode
      : (import.meta.env.VITE_AUTH_MODE as RuntimeConfig["authMode"] | undefined) || fileConfig.authMode,
    cognitoRegion: fileConfig.cognitoRegion,
    cognitoUserPoolId: fileConfig.cognitoUserPoolId,
    cognitoUserPoolClientId: fileConfig.cognitoUserPoolClientId,
    cognitoHostedUiBaseUrl: fileConfig.cognitoHostedUiBaseUrl,
    cognitoRedirectUri: fileConfig.cognitoRedirectUri,
    cognitoLogoutUri: fileConfig.cognitoLogoutUri
  }
}

export function resolveHostedUiRuntimeConfig(
  config: RuntimeConfig,
  currentOrigin: string
): HostedUiRuntimeConfig | undefined {
  const cognitoRegion = stringValue(config.cognitoRegion)
  const cognitoUserPoolId = stringValue(config.cognitoUserPoolId)
  const cognitoUserPoolClientId = stringValue(config.cognitoUserPoolClientId)
  if (!cognitoRegion || !cognitoUserPoolId || !cognitoUserPoolClientId) return undefined
  if (!/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(cognitoRegion)) return undefined
  if (!cognitoUserPoolId.startsWith(`${cognitoRegion}_`) || !/^[a-z0-9_-]+$/i.test(cognitoUserPoolId)) return undefined
  if (!/^[a-z0-9]+$/i.test(cognitoUserPoolClientId)) return undefined

  const cognitoHostedUiBaseUrl = normalizeHostedUiBaseUrl(config.cognitoHostedUiBaseUrl, cognitoRegion)
  const cognitoRedirectUri = normalizeExactSameOriginUrl(config.cognitoRedirectUri, currentOrigin, "/auth/callback")
  const cognitoLogoutUri = normalizeExactSameOriginUrl(config.cognitoLogoutUri, currentOrigin, "/")
  if (!cognitoHostedUiBaseUrl || !cognitoRedirectUri || !cognitoLogoutUri) return undefined

  return {
    cognitoRegion,
    cognitoUserPoolId,
    cognitoUserPoolClientId,
    cognitoHostedUiBaseUrl,
    cognitoRedirectUri,
    cognitoLogoutUri
  }
}

export async function getApiBaseUrl(): Promise<string> {
  if (import.meta.env.PROD) return "/api"
  const viteApiBaseUrl = normalizeConfiguredApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
  if (viteApiBaseUrl) return viteApiBaseUrl
  const config = await getRuntimeConfig()
  return config.apiBaseUrl ?? "http://localhost:8787"
}

export function resolveApiBaseUrl(input: {
  readonly viteApiBaseUrl: unknown
  readonly fileApiBaseUrl: unknown
  readonly isProduction: boolean
}): string {
  if (input.isProduction) return "/api"
  return normalizeConfiguredApiBaseUrl(input.viteApiBaseUrl)
    ?? normalizeConfiguredApiBaseUrl(input.fileApiBaseUrl)
    ?? "http://localhost:8787"
}

export function joinApiPath(apiBaseUrl: string, requestPath: string): string {
  const baseUrl = normalizeApiBaseUrl(apiBaseUrl)
  const normalizedPath = requestPath.replace(/^\/+/, "")
  return normalizedPath ? `${baseUrl}/${normalizedPath}` : baseUrl
}

export function resetRuntimeConfigForTests() {
  runtimeConfigPromise = undefined
}

function normalizeApiBaseUrl(input: string): string {
  return input.trim().replace(/\/+$/, "")
}

function normalizeConfiguredApiBaseUrl(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined
  const normalized = normalizeApiBaseUrl(input)
  if (!normalized) return undefined
  if (normalized.startsWith("/") && !normalized.startsWith("//") && !/[?#]/.test(normalized)) return normalized

  try {
    const url = new URL(normalized)
    if (!(["http:", "https:"] as string[]).includes(url.protocol)) return undefined
    if (url.username || url.password || url.search || url.hash) return undefined
    return normalizeApiBaseUrl(url.toString())
  } catch {
    return undefined
  }
}

function parseRuntimeConfig(input: unknown): RuntimeConfig {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {}
  const record = input as Record<string, unknown>
  return {
    apiBaseUrl: typeof record.apiBaseUrl === "string" ? record.apiBaseUrl : undefined,
    authMode: record.authMode === "cognito" || record.authMode === "local" ? record.authMode : undefined,
    cognitoRegion: stringValue(record.cognitoRegion),
    cognitoUserPoolId: stringValue(record.cognitoUserPoolId),
    cognitoUserPoolClientId: stringValue(record.cognitoUserPoolClientId),
    cognitoHostedUiBaseUrl: stringValue(record.cognitoHostedUiBaseUrl),
    cognitoRedirectUri: stringValue(record.cognitoRedirectUri),
    cognitoLogoutUri: stringValue(record.cognitoLogoutUri)
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}

function normalizeHostedUiBaseUrl(value: unknown, region: string): string | undefined {
  if (typeof value !== "string") return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return undefined
    if (url.pathname !== "/") return undefined
    const managedDomainSuffix = `.auth.${region}.amazoncognito.com`
    if (!url.hostname.endsWith(managedDomainSuffix)) return undefined
    const domainPrefix = url.hostname.slice(0, -managedDomainSuffix.length)
    if (!domainPrefix || !/^[a-z0-9-]+$/.test(domainPrefix)) return undefined
    return url.toString().replace(/\/$/, "")
  } catch {
    return undefined
  }
}

function normalizeExactSameOriginUrl(value: unknown, currentOrigin: string, pathname: string): string | undefined {
  if (typeof value !== "string") return undefined
  try {
    const expectedOriginUrl = new URL(currentOrigin)
    if (expectedOriginUrl.protocol !== "https:" && !isLoopbackHostname(expectedOriginUrl.hostname)) return undefined
    const expectedOrigin = expectedOriginUrl.origin
    const url = new URL(value)
    if (url.origin !== expectedOrigin || url.pathname !== pathname || url.search || url.hash) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
}
