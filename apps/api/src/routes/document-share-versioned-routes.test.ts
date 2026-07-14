import assert from "node:assert/strict"
import test from "node:test"
import { OpenAPIHono } from "@hono/zod-openapi"
import type { AppEnv } from "../app-env.js"
import type { AppUser } from "../auth.js"
import { DocumentShareConflictError } from "../documents/document-permission-service.js"
import { registerDocumentRoutes } from "./document-routes.js"

const actor: AppUser = {
  userId: "document-manager",
  email: "document-manager@example.test",
  cognitoGroups: ["RAG_GROUP_MANAGER"],
  accountStatus: "active",
  tenantId: "tenant-a"
}

test("document share routes expose and forward the caller-loaded policy version", async () => {
  const calls: unknown[] = []
  const app = createDocumentRouteApp({
    getDocumentShareInfo: async () => shareInfo("policy-version-7"),
    updateDocumentShare: async (_user: AppUser, documentId: string, input: unknown) => {
      calls.push({ documentId, input })
      return shareInfo("policy-version-8")
    }
  })

  const loaded = await app.request("/documents/doc-1/share")
  assert.equal(loaded.status, 200)
  assert.equal((await loaded.json() as { version?: string }).version, "policy-version-7")

  const updated = await app.request("/documents/doc-1/share", shareRequest({
    grants: [{ principalType: "user", principalId: "user-b", permissionLevel: "readOnly" }],
    expectedVersion: "policy-version-7",
    reason: "review access"
  }))
  assert.equal(updated.status, 200)
  assert.equal((await updated.json() as { version?: string }).version, "policy-version-8")
  assert.deepEqual(calls, [{
    documentId: "doc-1",
    input: {
      grants: [{ principalType: "user", principalId: "user-b", permissionLevel: "readOnly" }],
      expectedVersion: "policy-version-7",
      reason: "review access"
    }
  }])
})

test("document share PUT requires expectedVersion and maps a stale policy to 409", async () => {
  let updateCalls = 0
  const app = createDocumentRouteApp({
    getDocumentShareInfo: async () => shareInfo("policy-version-7"),
    updateDocumentShare: async (_user: AppUser, _documentId: string, input: { expectedVersion: string }) => {
      updateCalls += 1
      if (input.expectedVersion === "policy-version-stale") {
        throw new DocumentShareConflictError("document share policy version conflict")
      }
      return shareInfo("policy-version-8")
    }
  })

  const missingVersion = await app.request("/documents/doc-1/share", shareRequest({
    grants: [],
    reason: "missing version"
  }))
  assert.equal(missingVersion.status, 400)
  assert.equal(updateCalls, 0)

  const stale = await app.request("/documents/doc-1/share", shareRequest({
    grants: [],
    expectedVersion: "policy-version-stale",
    reason: "stale update"
  }))
  assert.equal(stale.status, 409)
  assert.equal(updateCalls, 1)
  assert.match((await stale.json() as { error: string }).error, /version conflict/)
})

function createDocumentRouteApp(service: Record<string, unknown>) {
  const app = new OpenAPIHono<AppEnv>()
  app.use("*", async (context, next) => {
    context.set("user", actor)
    await next()
  })
  registerDocumentRoutes({ app, deps: {} as never, service: service as never })
  return app
}

function shareInfo(version: string) {
  return {
    inheritedFolderGrants: [],
    directDocumentGrants: [],
    currentUserEffectivePermission: "full",
    version
  }
}

function shareRequest(body: unknown): RequestInit {
  return {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  }
}
