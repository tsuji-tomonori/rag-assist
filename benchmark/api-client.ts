import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import type { ApiClient } from "@memorag-mvp/contract"

export function createBenchmarkApiClient(options: {
  apiBaseUrl: string
  authToken?: string
  fetchImpl?: typeof fetch
}): ApiClient {
  const fetchImpl = options.fetchImpl
  const link = new RPCLink({
    url: `${options.apiBaseUrl.replace(/\/$/, "")}/rpc`,
    headers: () => ({
      ...(options.authToken ? { Authorization: `Bearer ${options.authToken}` } : {})
    }),
    ...(fetchImpl ? { fetch: (request: Request, init: RequestInit) => fetchImpl(request, init) } : {})
  })

  return createORPCClient<ApiClient>(link)
}
