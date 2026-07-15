import { getApiBaseUrl } from "./runtimeConfig.js"

let authTokenProvider: (() => string | undefined) | undefined

export class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "HttpError"
    this.status = status
  }
}

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
  await assertResponseOk(response)
  return response.json() as Promise<T>
}

export async function getText(requestPath: string): Promise<string> {
  const apiBaseUrl = await getApiBaseUrl()
  const response = await fetch(`${apiBaseUrl}${requestPath}`, { headers: createHeaders() })
  await assertResponseOk(response)
  return response.text()
}

export async function getBlob(requestPath: string): Promise<{ blob: Blob; headers: Headers }> {
  const apiBaseUrl = await getApiBaseUrl()
  const response = await fetch(`${apiBaseUrl}${requestPath}`, { headers: createHeaders() })
  await assertResponseOk(response)
  return { blob: await response.blob(), headers: response.headers }
}

export async function post<T>(requestPath: string, body: unknown): Promise<T> {
  const apiBaseUrl = await getApiBaseUrl()
  const response = await fetch(`${apiBaseUrl}${requestPath}`, {
    method: "POST",
    headers: createHeaders(true),
    body: JSON.stringify(body)
  })
  await assertResponseOk(response)
  return response.json() as Promise<T>
}

export async function put<T>(requestPath: string, body: unknown): Promise<T> {
  const apiBaseUrl = await getApiBaseUrl()
  const response = await fetch(`${apiBaseUrl}${requestPath}`, {
    method: "PUT",
    headers: createHeaders(true),
    body: JSON.stringify(body)
  })
  await assertResponseOk(response)
  return response.json() as Promise<T>
}

export async function del<T = void>(requestPath: string, parseJson = false): Promise<T> {
  const apiBaseUrl = await getApiBaseUrl()
  const response = await fetch(`${apiBaseUrl}${requestPath}`, { method: "DELETE", headers: createHeaders() })
  await assertResponseOk(response)
  if (!parseJson || response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function delJson<T = void>(requestPath: string, body: unknown, parseJson = false): Promise<T> {
  const apiBaseUrl = await getApiBaseUrl()
  const response = await fetch(`${apiBaseUrl}${requestPath}`, {
    method: "DELETE",
    headers: createHeaders(true),
    body: JSON.stringify(body)
  })
  await assertResponseOk(response)
  if (!parseJson || response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

async function assertResponseOk(response: Response): Promise<void> {
  if (response.ok) return
  throw new HttpError(response.status, await response.text())
}
