import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import type { ApiClient } from "@memorag-mvp/contract"
import { createHeaders } from "./http.js"
import { getApiBaseUrl } from "./runtimeConfig.js"

let cachedBaseUrl: string | undefined
let cachedClient: ApiClient | undefined

export async function getOrpcClient(): Promise<ApiClient> {
  const baseUrl = (await getApiBaseUrl()).replace(/\/$/, "")

  if (cachedClient && cachedBaseUrl === baseUrl) return cachedClient

  const link = new RPCLink({
    url: `${baseUrl}/rpc`,
    headers: () => createHeaders(false) as Record<string, string>,
    fetch: async (request, init) => {
      const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.clone().text()
      const response = await globalThis.fetch(request.url, {
        ...init,
        method: request.method,
        headers: request.headers,
        body
      })
      return normalizePlainJsonMockResponse(response)
    }
  })

  cachedBaseUrl = baseUrl
  cachedClient = createORPCClient<ApiClient>(link)
  return cachedClient
}

async function normalizePlainJsonMockResponse(response: Response): Promise<Response> {
  if (typeof response.headers?.get === "function") return response

  const mockResponse = response as Response & {
    ok?: boolean
    status?: number
    json?: () => Promise<unknown>
    text?: () => Promise<string>
  }
  if (mockResponse.ok === false) {
    throw new Error(mockResponse.text ? await mockResponse.text() : "Request failed")
  }
  const json = mockResponse.json ? await mockResponse.json() : undefined
  return new Response(JSON.stringify({ json }), {
    status: mockResponse.status ?? 200,
    headers: { "content-type": "application/json" }
  })
}
