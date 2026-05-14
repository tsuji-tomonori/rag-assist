import type { OpenAPIHono } from "@hono/zod-openapi"
import type { AppEnv } from "../app-env.js"
import type { Dependencies } from "../dependencies.js"
import type { MemoRagService } from "../rag/memorag-service.js"
import { registerAgentRoutes } from "./agent-routes.js"
import { registerAdminRoutes } from "./admin-routes.js"
import { registerBenchmarkRoutes } from "./benchmark-routes.js"
import { registerChatRoutes } from "./chat-routes.js"
import { registerConversationHistoryRoutes } from "./conversation-history-routes.js"
import { registerDebugRoutes } from "./debug-routes.js"
import { registerDocumentRoutes } from "./document-routes.js"
import { registerQuestionRoutes } from "./question-routes.js"
import { registerSystemRoutes } from "./system-routes.js"

export { isBenchmarkSeedUpload, isBenchmarkSeedUploadedObjectIngest } from "./benchmark-seed.js"

export function registerApiRoutes(app: OpenAPIHono<AppEnv>, deps: Dependencies, service: MemoRagService) {
  const context = { app, deps, service }
  registerSystemRoutes(context)
  registerAdminRoutes(context)
  registerDocumentRoutes(context)
  registerChatRoutes(context)
  registerQuestionRoutes(context)
  registerConversationHistoryRoutes(context)
  registerDebugRoutes(context)
  registerBenchmarkRoutes(context)
  registerAgentRoutes(context)
}
