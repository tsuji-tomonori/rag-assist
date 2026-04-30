import { serve } from "@hono/node-server"
import app from "./app.js"
import { config } from "./config.js"

serve({
  fetch: app.fetch,
  port: config.port
})

console.log(`MemoRAG API listening on http://localhost:${config.port}`)
console.log(`OpenAPI: http://localhost:${config.port}/openapi.json`)
