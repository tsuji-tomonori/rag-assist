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
    .then(async (response) => (response.ok ? ((await response.json()) as RuntimeConfig) : {}))
    .catch(() => ({}))

  const fileConfig = await runtimeConfigPromise
  return {
    ...fileConfig,
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || fileConfig.apiBaseUrl || "http://localhost:8787",
    authMode: (import.meta.env.VITE_AUTH_MODE as RuntimeConfig["authMode"] | undefined) || fileConfig.authMode,
    cognitoRegion: import.meta.env.VITE_COGNITO_REGION || fileConfig.cognitoRegion,
    cognitoUserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || fileConfig.cognitoUserPoolId,
    cognitoUserPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID || fileConfig.cognitoUserPoolClientId
  }
}

export async function getApiBaseUrl(): Promise<string> {
  if (import.meta.env.VITE_API_BASE_URL) return trimSlash(import.meta.env.VITE_API_BASE_URL)
  const config = await getRuntimeConfig()
  return trimSlash(config.apiBaseUrl || "http://localhost:8787")
}

export function resetRuntimeConfigForTests() {
  runtimeConfigPromise = undefined
}

function trimSlash(input: string): string {
  return input.replace(/\/+$/, "")
}
