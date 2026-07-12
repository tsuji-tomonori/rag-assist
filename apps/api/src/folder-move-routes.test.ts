import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { OpenAPIHono } from "@hono/zod-openapi"
import { HTTPException } from "hono/http-exception"
import { LocalDocumentGroupStore } from "./adapters/local-document-group-store.js"
import { LocalFolderPolicyStore } from "./adapters/local-folder-policy-store.js"
import { LocalGroupMembershipStore } from "./adapters/local-group-membership-store.js"
import { LocalObjectStore } from "./adapters/local-object-store.js"
import { LocalUserGroupStore } from "./adapters/local-user-group-store.js"
import { LocalVectorStore } from "./adapters/local-vector-store.js"
import type { AppEnv } from "./app-env.js"
import type { AppUser } from "./auth.js"
import type { Dependencies } from "./dependencies.js"
import { MemoRagService } from "./rag/memorag-service.js"
import { registerDocumentRoutes } from "./routes/document-routes.js"
import { ResourceUnavailableError } from "./security/public-resource-response.js"
import type { DocumentGroup } from "./types.js"

test("dedicated folder move route requires folder.move and returns only the coherent subtree result", async () => {
  const fixture = await createRouteFixture()
  const destination = folder("destination", "Destination")
  const source = folder("source", "Source")
  const child = folder("child", "Child", source)
  for (const value of [destination, source, child]) await fixture.documentGroupStore.createWithPathLock(value)

  const denied = await request(fixture.appFor({ ...manager, cognitoGroups: ["CHAT_USER"] }), source.groupId, {
    destinationParentId: destination.groupId,
    reason: "role must not be substituted",
    expectedVersion: source.updatedAt
  })
  assert.equal(denied.status, 404)

  const movedResponse = await request(fixture.appFor(manager), source.groupId, {
    destinationParentId: destination.groupId,
    newName: "Moved",
    reason: "approved folder move",
    expectedVersion: source.updatedAt
  })
  assert.equal(movedResponse.status, 200)
  const moved = await movedResponse.json() as {
    operationId: string
    folder: { canonicalPath: string }
    subtree: Array<{ canonicalPath: string }>
    affectedDocumentCount: number
    directDocumentGrantsPreserved: boolean
    folderLocalPoliciesPreserved: boolean
    documentVersionsPreserved: boolean
    affectedDocumentIds?: unknown
  }
  assert.match(moved.operationId, /^folder_move_/u)
  assert.equal(moved.folder.canonicalPath, "/Destination/Moved")
  assert.deepEqual(moved.subtree.map((item) => item.canonicalPath), ["/Destination/Moved", "/Destination/Moved/Child"])
  assert.equal(moved.affectedDocumentCount, 0)
  assert.equal(moved.directDocumentGrantsPreserved, true)
  assert.equal(moved.folderLocalPoliciesPreserved, true)
  assert.equal(moved.documentVersionsPreserved, true)
  assert.equal(moved.affectedDocumentIds, undefined)

  const staleDifferentRequest = await request(fixture.appFor(manager), source.groupId, {
    destinationParentId: destination.groupId,
    newName: "Moved Again",
    reason: "stale writer",
    expectedVersion: source.updatedAt
  })
  assert.equal(staleDifferentRequest.status, 409)
  assert.deepEqual(await staleDifferentRequest.json(), { error: "Folder move conflict" })
})

test("dedicated folder move route hides missing and cross-tenant source or destination distinctions", async () => {
  const fixture = await createRouteFixture()
  const source = folder("source", "Source")
  const crossTenantDestination = {
    ...folder("tenant-b-destination", "Tenant B"),
    tenantId: "tenant-b",
    adminPathPk: "tenant-b#user#manager-1",
    parentPathPk: "tenant-b#user#manager-1#ROOT"
  }
  await fixture.documentGroupStore.createWithPathLock(source)
  await fixture.documentGroupStore.createWithPathLock(crossTenantDestination)
  const app = fixture.appFor(manager)

  const missing = await request(app, "missing", {
    destinationParentId: null,
    reason: "missing source",
    expectedVersion: source.updatedAt
  })
  const crossTenant = await request(app, source.groupId, {
    destinationParentId: crossTenantDestination.groupId,
    reason: "cross tenant destination",
    expectedVersion: source.updatedAt
  })
  const unauthorizedApp = fixture.appFor({
    ...manager,
    userId: "unauthorized-manager",
    identityUsername: "unauthorized-manager",
    email: "unauthorized-manager@example.com"
  })
  const unauthorizedStale = await request(unauthorizedApp, source.groupId, {
    destinationParentId: null,
    reason: "stale unauthorized request",
    expectedVersion: "stale-version"
  })
  const unauthorizedCurrent = await request(unauthorizedApp, source.groupId, {
    destinationParentId: null,
    reason: "current unauthorized request",
    expectedVersion: source.updatedAt
  })
  assert.equal(missing.status, 404)
  assert.equal(crossTenant.status, 404)
  assert.equal(unauthorizedStale.status, 404)
  assert.equal(unauthorizedCurrent.status, 404)
  assert.deepEqual(await missing.json(), await crossTenant.json())
  assert.deepEqual(await unauthorizedStale.json(), await unauthorizedCurrent.json())
})

async function createRouteFixture() {
  const dataDir = await mkdtemp(path.join(tmpdir(), "folder-move-route-test-"))
  const documentGroupStore = new LocalDocumentGroupStore(dataDir)
  const deps = {
    objectStore: new LocalObjectStore(dataDir),
    evidenceVectorStore: new LocalVectorStore(dataDir, "evidence-vectors.json"),
    memoryVectorStore: new LocalVectorStore(dataDir, "memory-vectors.json"),
    documentGroupStore,
    folderPolicyStore: new LocalFolderPolicyStore(dataDir),
    userGroupStore: new LocalUserGroupStore(dataDir),
    groupMembershipStore: new LocalGroupMembershipStore(dataDir)
  } as unknown as Dependencies
  return {
    deps,
    documentGroupStore,
    appFor: (actor: AppUser) => routeApp(actor, deps)
  }
}

function routeApp(actor: AppUser, deps: Dependencies): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => result.success
      ? undefined
      : c.json({ error: "Validation failed", details: result.error.flatten() }, 400)
  })
  app.use("*", async (c, next) => {
    c.set("user", actor)
    await next()
  })
  registerDocumentRoutes({ app, deps, service: new MemoRagService(deps) })
  app.onError((error, c) => {
    if (error instanceof ResourceUnavailableError) return c.json({ error: "Resource unavailable" }, 404)
    if (error instanceof HTTPException) return c.json({ error: error.message }, error.status)
    return c.json({ error: "Internal server error" }, 500)
  })
  return app
}

async function request(app: OpenAPIHono<AppEnv>, groupId: string, body: unknown): Promise<Response> {
  return app.request(`/document-groups/${encodeURIComponent(groupId)}/move`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
}

const manager: AppUser = {
  userId: "manager-1",
  identityUsername: "manager-1",
  email: "manager-1@example.com",
  cognitoGroups: ["RAG_GROUP_MANAGER"],
  accountStatus: "active",
  tenantId: "default"
}

function folder(groupId: string, name: string, parent?: DocumentGroup): DocumentGroup {
  const now = "2026-07-11T00:00:00.000Z"
  const normalizedName = name.toLocaleLowerCase("ja-JP")
  const canonicalPath = parent ? `${parent.canonicalPath}/${name}` : `/${name}`
  const normalizedCanonicalPath = parent ? `${parent.normalizedCanonicalPath}/${normalizedName}` : `/${normalizedName}`
  const adminPathPk = "default#user#manager-1"
  return {
    groupId,
    schemaVersion: 2,
    itemType: "documentGroup",
    tenantId: "default",
    adminPrincipalType: "user",
    adminPrincipalId: manager.userId,
    name,
    normalizedName,
    canonicalPath,
    normalizedCanonicalPath,
    adminPathPk,
    parentPathPk: `${adminPathPk}#${parent?.groupId ?? "ROOT"}`,
    parentGroupId: parent?.groupId,
    ancestorGroupIds: parent ? [...(parent.ancestorGroupIds ?? []), parent.groupId] : [],
    ownerUserId: manager.userId,
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: [manager.userId],
    status: "active",
    createdBy: manager.userId,
    createdAt: now,
    updatedAt: now
  }
}
