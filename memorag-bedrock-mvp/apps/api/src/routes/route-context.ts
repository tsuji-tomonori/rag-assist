import type { OpenAPIHono } from "@hono/zod-openapi"
import type { Dependencies } from "../dependencies.js"
import type { MemoRagService } from "../rag/memorag-service.js"

export type ApiRouteContext = {
  app: OpenAPIHono
  deps: Dependencies
  service: MemoRagService
}
