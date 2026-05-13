import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import type { ApiClient } from "@memorag-mvp/contract"

export function createBenchmarkApiClient(options: {
  apiBaseUrl: string
  authToken?: string
}): ApiClient {
  const link = new RPCLink({
    url: `${options.apiBaseUrl.replace(/\/$/, "")}/rpc`,
    headers: () => ({
      ...(options.authToken ? { Authorization: `Bearer ${options.authToken}` } : {})
    })
  })

  return createORPCClient<ApiClient>(link)
}
