import type { OpenAPIHono } from "@hono/zod-openapi"
import type { AppEnv } from "../app-env.js"
import type { Dependencies } from "../dependencies.js"
import type { MemoRagService } from "../rag/memorag-service.js"

export type ApiRouteContext = {
  app: OpenAPIHono<AppEnv>
  deps: Dependencies
  service: MemoRagService
}
