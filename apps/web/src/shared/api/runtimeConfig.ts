export type RuntimeConfig = {
  apiBaseUrl?: string
  authMode?: "cognito" | "local"
  cognitoRegion?: string
  cognitoUserPoolId?: string
  cognitoUserPoolClientId?: string
}

let runtimeConfigPromise: Promise<RuntimeConfig> | undefined

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  runtimeConfigPromise ??= fetch("/config.json")
    .then(async (response) => (response.ok ? parseRuntimeConfig(await response.json()) : {}))
    .catch(() => ({}))

  const fileConfig = await runtimeConfigPromise
  return {
    ...fileConfig,
    apiBaseUrl: resolveApiBaseUrl({
      viteApiBaseUrl: import.meta.env.VITE_API_BASE_URL,
      fileApiBaseUrl: fileConfig.apiBaseUrl,
      isProduction: import.meta.env.PROD
    }),
    authMode: (import.meta.env.VITE_AUTH_MODE as RuntimeConfig["authMode"] | undefined) || fileConfig.authMode,
    cognitoRegion: import.meta.env.VITE_COGNITO_REGION || fileConfig.cognitoRegion,
    cognitoUserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || fileConfig.cognitoUserPoolId,
    cognitoUserPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID || fileConfig.cognitoUserPoolClientId
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
    cognitoUserPoolClientId: stringValue(record.cognitoUserPoolClientId)
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}
