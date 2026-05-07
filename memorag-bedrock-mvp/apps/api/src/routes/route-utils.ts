import { createRoute } from "@hono/zod-openapi"

export function looseRoute(config: any) {
  return createRoute(config) as any
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
