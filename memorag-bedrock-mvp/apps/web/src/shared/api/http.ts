import { getApiBaseUrl } from "./runtimeConfig.js"

let authTokenProvider: (() => string | undefined) | undefined

export function setAuthTokenProvider(provider?: () => string | undefined) {
  authTokenProvider = provider
}

export function createHeaders(hasJsonBody = false): HeadersInit {
  const headers: Record<string, string> = {}
  if (hasJsonBody) headers["Content-Type"] = "application/json"
  const token = authTokenProvider?.()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export async function get<T>(requestPath: string): Promise<T> {
  const apiBaseUrl = await getApiBaseUrl()
  const response = await fetch(`${apiBaseUrl}${requestPath}`, { headers: createHeaders() })
  if (!response.ok) throw new Error(await response.text())
  return response.json() as Promise<T>
}

export async function post<T>(requestPath: string, body: unknown): Promise<T> {
  const apiBaseUrl = await getApiBaseUrl()
  const response = await fetch(`${apiBaseUrl}${requestPath}`, {
    method: "POST",
    headers: createHeaders(true),
    body: JSON.stringify(body)
  })
  if (!response.ok) throw new Error(await response.text())
  return response.json() as Promise<T>
}

export async function del<T = void>(requestPath: string, parseJson = false): Promise<T> {
  const apiBaseUrl = await getApiBaseUrl()
  const response = await fetch(`${apiBaseUrl}${requestPath}`, { method: "DELETE", headers: createHeaders() })
  if (!response.ok) throw new Error(await response.text())
  if (!parseJson || response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
