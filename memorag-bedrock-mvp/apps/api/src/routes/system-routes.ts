import { getPermissionsForGroups } from "../authorization.js"
import { CurrentUserResponseSchema, ErrorResponseSchema, HealthResponseSchema } from "../schemas.js"
import type { ApiRouteContext } from "./route-context.js"
import { looseRoute } from "./route-utils.js"

export function registerSystemRoutes({ app }: ApiRouteContext) {
  app.openapi(
    looseRoute({
      method: "get",
      path: "/health",
      responses: {
        200: { description: "Health check", content: { "application/json": { schema: HealthResponseSchema } } }
      }
    }),
    (c) => c.json({ ok: true, service: "memorag-bedrock-mvp", timestamp: new Date().toISOString() }, 200)
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/me",
      responses: {
        200: {
          description: "Current authenticated user and effective permissions",
          content: { "application/json": { schema: CurrentUserResponseSchema } }
        },
        401: { description: "Authentication required", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    (c) => {
      const user = c.get("user")
      return c.json({
        user: {
          userId: user.userId,
          email: user.email,
          groups: user.cognitoGroups,
          permissions: getPermissionsForGroups(user.cognitoGroups)
        }
      }, 200)
    }
  )
}
