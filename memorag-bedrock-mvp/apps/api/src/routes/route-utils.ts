import { createRoute, type RouteConfig } from "@hono/zod-openapi"
import type { Context } from "hono"
import { routeAuthorization, type RouteAuthorizationMetadata } from "../authorization.js"
import { ErrorResponseSchema } from "../schemas.js"

export { routeAuthorization }

type MemoragRouteConfig = RouteConfig & {
  "x-memorag-authorization"?: RouteAuthorizationMetadata
}

type RequestWithValid = {
  valid: (target: "json" | "param" | "query" | "header" | "cookie" | "form") => unknown
}

export function looseRoute(config: MemoragRouteConfig): RouteConfig {
  return createRoute(withAuthorizationMetadata(config)) as unknown as RouteConfig
}

export function validJson<T>(c: Context): T {
  return validRequest(c, "json") as T
}

export function validParam<T>(c: Context): T {
  return validRequest(c, "param") as T
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function validRequest(c: Context, target: Parameters<RequestWithValid["valid"]>[0]): unknown {
  return (c.req as unknown as RequestWithValid).valid(target)
}

function withAuthorizationMetadata(config: MemoragRouteConfig): MemoragRouteConfig {
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
