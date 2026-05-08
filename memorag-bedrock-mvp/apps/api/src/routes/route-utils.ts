import { createRoute } from "@hono/zod-openapi"
import { routeAuthorization, type RouteAuthorizationMetadata } from "../authorization.js"
import { ErrorResponseSchema } from "../schemas.js"

export { routeAuthorization }

export function looseRoute(config: any) {
  return createRoute(withAuthorizationMetadata(config)) as any
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withAuthorizationMetadata(config: any): any {
  const metadata = config["x-memorag-authorization"] as RouteAuthorizationMetadata | undefined
  if (!metadata) return config
  const responses = { ...(config.responses ?? {}) }
  if (metadata.mode !== "public") {
    responses[401] ??= {
      description: "Authentication required",
      content: { "application/json": { schema: ErrorResponseSchema } }
    }
  }
  if (metadata.mode !== "public" && metadata.mode !== "authenticated") {
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
