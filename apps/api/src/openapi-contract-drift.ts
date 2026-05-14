import { apiContract } from "@memorag-mvp/contract"
import { isHttpMethod, type OpenApiDocument, type OperationObject } from "./openapi-doc-quality.js"

type OrpcContractNode = {
  "~orpc"?: {
    route?: {
      method?: string
      path?: string
    }
    inputSchema?: unknown
    outputSchema?: unknown
  }
}

type RestOrpcRoute = {
  procedure: string
  method: string
  path: string
  hasInput: boolean
  hasOutput: boolean
}

export function validateRestOrpcContractDrift(api: OpenApiDocument): string[] {
  const errors: string[] = []
  const routes = collectRestOrpcRoutes(apiContract)

  for (const route of routes) {
    const operation = findOperation(api, route.method, route.path)
    if (!operation) {
      errors.push(`${route.procedure}: oRPC route ${route.method.toUpperCase()} ${route.path} に対応する OpenAPI operation がありません`)
      continue
    }
    if (route.hasInput && !operation.requestBody) {
      errors.push(`${route.procedure}: oRPC input があるのに OpenAPI requestBody がありません`)
    }
    if (route.hasOutput && !operation.responses?.["200"]) {
      errors.push(`${route.procedure}: oRPC output があるのに OpenAPI 200 response がありません`)
    }
  }

  return errors
}

export function collectRestOrpcRoutes(root: unknown): RestOrpcRoute[] {
  const routes: RestOrpcRoute[] = []
  visitContractNode(root, [], routes)
  return routes.sort((a, b) => a.procedure.localeCompare(b.procedure))
}

function visitContractNode(node: unknown, path: string[], routes: RestOrpcRoute[]): void {
  if (!node || typeof node !== "object") return
  const contract = node as OrpcContractNode
  const route = contract["~orpc"]?.route
  if (route?.method && route.path) {
    routes.push({
      procedure: path.join("."),
      method: route.method.toLowerCase(),
      path: route.path,
      hasInput: Boolean(contract["~orpc"]?.inputSchema),
      hasOutput: Boolean(contract["~orpc"]?.outputSchema)
    })
    return
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "~orpc") continue
    visitContractNode(value, [...path, key], routes)
  }
}

function findOperation(api: OpenApiDocument, method: string, path: string): OperationObject | undefined {
  if (!isHttpMethod(method)) return undefined
  return api.paths?.[path]?.[method]
}
