import { createRoute } from "@hono/zod-openapi"
import { routeAuthorizationMetadata, routeAuthorizationPolicyByKey, routeAuthorizationKey } from "../authorization.js"
import { ErrorResponseSchema } from "../schemas.js"

export function looseRoute(config: any) {
  return createRoute(withAuthorizationMetadata(config)) as any
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withAuthorizationMetadata(config: any): any {
  const policy = routeAuthorizationPolicyByKey.get(routeAuthorizationKey(String(config.method), String(config.path)))
  if (!policy) return config
  const metadata = routeAuthorizationMetadata(policy)
  const responses = { ...(config.responses ?? {}) }
  if (policy.mode !== "public") {
    responses[401] ??= {
      description: "Authentication required",
      content: { "application/json": { schema: ErrorResponseSchema } }
    }
  }
  if (policy.mode !== "public" && policy.mode !== "authenticated") {
    responses[403] ??= {
      description: "Forbidden",
      content: { "application/json": { schema: ErrorResponseSchema } }
    }
  }
  return {
    ...config,
    responses,
    "x-memorag-authorization": metadata
  }
}
