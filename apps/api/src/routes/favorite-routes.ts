import { z } from "@hono/zod-openapi"
import { requirePermission } from "../authorization.js"
import { CreateFavoriteRequestSchema, ErrorResponseSchema, FavoriteListResponseSchema, FavoriteSchema, FavoriteTargetTypeSchema } from "../schemas.js"
import type { ApiRouteContext } from "./route-context.js"
import { looseRoute, routeAuthorization, validJson, validParam } from "./route-utils.js"

export function registerFavoriteRoutes({ app, service }: ApiRouteContext) {
  app.openapi(
    looseRoute({
      method: "get",
      path: "/favorites",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "chat:read:own", operationKey: "favorite.read.self", resourceCondition: "self" }),
      responses: {
        200: { description: "List favorites for the current user", content: { "application/json": { schema: FavoriteListResponseSchema } } },
        500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "chat:read:own")
      return c.json({ favorites: (await service.listFavorites(user)).map((favorite) => FavoriteSchema.parse(favorite)) }, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/favorites",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "chat:create", operationKey: "favorite.create.self", resourceCondition: "self" }),
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateFavoriteRequestSchema } }
        }
      },
      responses: {
        200: { description: "Saved favorite", content: { "application/json": { schema: FavoriteSchema } } },
        400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "chat:create")
      const body = validJson<z.infer<typeof CreateFavoriteRequestSchema>>(c)
      return c.json(FavoriteSchema.parse(await service.saveFavorite(user, body)), 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "delete",
      path: "/favorites/{targetType}/{targetId}",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "chat:delete:own", operationKey: "favorite.delete.self", resourceCondition: "self" }),
      request: {
        params: FavoriteTargetTypeParamSchema
      },
      responses: {
        200: { description: "Deleted favorite", content: { "application/json": { schema: z.object({ targetType: FavoriteTargetTypeSchema, targetId: z.string() }) } } },
        400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "chat:delete:own")
      const { targetType, targetId } = validParam<z.infer<typeof FavoriteTargetTypeParamSchema>>(c)
      await service.deleteFavorite(user, targetType, targetId)
      return c.json({ targetType, targetId }, 200)
    }
  )
}

const FavoriteTargetTypeParamSchema = z.object({ targetType: FavoriteTargetTypeSchema, targetId: z.string().min(1) })
