import assert from "node:assert/strict"
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { OpenAPIHono } from "@hono/zod-openapi"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "./app-env.js"
import type { AppUser } from "./auth.js"
import { LocalDocumentGroupStore } from "./adapters/local-document-group-store.js"
import { LocalFolderPolicyStore } from "./adapters/local-folder-policy-store.js"
import { LocalGroupMembershipStore } from "./adapters/local-group-membership-store.js"
import { LocalObjectStore } from "./adapters/local-object-store.js"
import { LocalUserGroupStore } from "./adapters/local-user-group-store.js"
import type { Dependencies } from "./dependencies.js"
import { MemoRagService } from "./rag/memorag-service.js"
import { registerDocumentRoutes } from "./routes/document-routes.js"
import type { ResourceUserPrincipal, ResourceUserPrincipalDirectory } from "./security/resource-group-membership-service.js"
import { publicResourceUnavailable, ResourceUnavailableError } from "./security/public-resource-response.js"
import { ObjectStoreSecurityMutationAuditOutbox } from "./security/security-mutation-audit-outbox.js"
import { tenantPartitionId } from "./security/tenant-partition.js"
import type { DocumentGroup } from "./types.js"

test("folder share production routes enforce complete versioned replacement and close the legacy ACL bypass", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-folder-share-route-"))
  const documentGroupStore = new LocalDocumentGroupStore(dataDir)
  const folderPolicyStore = new LocalFolderPolicyStore(dataDir)
  const userGroupStore = new LocalUserGroupStore(dataDir)
  const groupMembershipStore = new LocalGroupMembershipStore(dataDir)
  const objectStore = new LocalObjectStore(dataDir)
  const directory = new MapPrincipalDirectory([
    { userId: "owner-1", tenantId: "default", status: "active" },
    { userId: "reader-1", tenantId: "default", status: "active" },
    { userId: "other-tenant-reader", tenantId: "tenant-b", status: "active" }
  ])
  const deps = {
    documentGroupStore,
    folderPolicyStore,
    userGroupStore,
    groupMembershipStore,
    objectStore,
    resourceUserPrincipalDirectory: directory,
    securityAuditOutbox: new ObjectStoreSecurityMutationAuditOutbox(objectStore)
  } as unknown as Dependencies
  const actor: AppUser = {
    userId: "owner-1",
    email: "owner@example.com",
    cognitoGroups: ["RAG_GROUP_MANAGER"],
    accountStatus: "active",
    tenantId: "default"
  }
  await documentGroupStore.create(folder({
    visibility: "shared",
    sharedUserIds: ["legacy-reader"],
    sharedGroups: ["legacy-group"],
    managerUserIds: ["owner-1", "legacy-manager"]
  }))
  await documentGroupStore.create(folder({
    groupId: "group-admin-parent",
    adminPrincipalType: "user",
    adminPrincipalId: "reader-1",
    name: "Other Admin Parent",
    normalizedName: "other admin parent",
    canonicalPath: "/Other Admin Parent",
    normalizedCanonicalPath: "/other admin parent",
    adminPathPk: "default#user#reader-1",
    parentPathPk: "default#user#reader-1#ROOT",
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: ["owner-1"]
  }))
  const app = routeApp(actor, deps)

  const beforeRejectedCreates = await readDocumentGroupState(dataDir)
  const createPolicyBefore = await folderPolicyStore.list("default")
  const createAuditBefore = await objectStore.listKeys("security-audit/intents/")
  const prohibitedCreateFields: Array<[string, unknown]> = [
    ["adminPrincipalType", "group"],
    ["adminPrincipalId", "SYSTEM_ADMIN"],
    ["visibility", "org"],
    ["sharedUserIds", ["attacker"]],
    ["sharedGroups", ["SYSTEM_ADMIN"]],
    ["managerUserIds", ["attacker"]]
  ]
  for (const [field, value] of prohibitedCreateFields) {
    const rejectedCreate = await app.request("/document-groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: `Rejected ${field}`, [field]: value })
    })
    assert.equal(rejectedCreate.status, 400, `create must reject ${field}`)
  }
  assert.deepEqual(await readDocumentGroupState(dataDir), beforeRejectedCreates)
  assert.deepEqual(await folderPolicyStore.list("default"), createPolicyBefore)
  assert.deepEqual(await objectStore.listKeys("security-audit/intents/"), createAuditBefore)

  const safeCreateResponse = await app.request("/document-groups", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Safe Child",
      description: "共有は作成後に設定",
      parentGroupId: "group-admin-parent"
    })
  })
  assert.equal(safeCreateResponse.status, 200)
  const safeCreated = await json<DocumentGroup>(safeCreateResponse)
  assert.equal(safeCreated.parentGroupId, "group-admin-parent")
  assert.equal(safeCreated.tenantId, "default")
  assert.equal(safeCreated.adminPrincipalType, "user")
  assert.equal(safeCreated.adminPrincipalId, "owner-1")
  assert.equal(safeCreated.ownerUserId, "owner-1")
  assert.equal(safeCreated.visibility, "private")
  assert.deepEqual(safeCreated.sharedUserIds, [])
  assert.deepEqual(safeCreated.sharedGroups, [])
  assert.deepEqual(safeCreated.managerUserIds, ["owner-1"])
  assert.equal(safeCreated.hasExplicitPolicy, undefined)

  const initialResponse = await app.request("/document-groups/folder-1/share")
  assert.equal(initialResponse.status, 200)
  const initial = await json<{ policy: null; version: string }>(initialResponse)
  assert.equal(initial.policy, null)

  const replacedResponse = await app.request("/document-groups/folder-1/share", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      expectedVersion: initial.version,
      entries: [
        { principalType: "user", principalId: "owner-1", permissionLevel: "full" },
        { principalType: "user", principalId: "reader-1", permissionLevel: "readOnly" }
      ],
      reason: "閲覧レビュー"
    })
  })
  assert.equal(replacedResponse.status, 200)
  const replaced = await json<{ policy: { policyId: string; entries: Array<{ principalId: string }> }; version: string; auditIntentId: string }>(replacedResponse)
  assert.equal(replaced.policy.policyId, "folder-policy-folder-1")
  assert.deepEqual(replaced.policy.entries.map((entry) => entry.principalId), ["owner-1", "reader-1"])
  assert.notEqual(replaced.version, initial.version)
  assert.match(replaced.auditIntentId, /^security_mutation_/u)

  const staleResponse = await app.request("/document-groups/folder-1/share", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      expectedVersion: initial.version,
      entries: [{ principalType: "user", principalId: "owner-1", permissionLevel: "full" }],
      reason: "stale writer"
    })
  })
  assert.equal(staleResponse.status, 409)

  for (const principalId of ["unknown-reader", "other-tenant-reader"]) {
    const deniedResponse = await app.request("/document-groups/folder-1/share", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: replaced.version,
        entries: [
          { principalType: "user", principalId: "owner-1", permissionLevel: "full" },
          { principalType: "user", principalId, permissionLevel: "readOnly" }
        ],
        reason: "principal validation"
      })
    })
    assert.equal(deniedResponse.status, 400)
  }

  const legacyResponse = await app.request("/document-groups/folder-1/share", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Renamed Folder",
      description: "Safe metadata update"
    })
  })
  assert.equal(legacyResponse.status, 200)
  const afterLegacy = await documentGroupStore.get("default", "folder-1")
  assert.equal(afterLegacy?.name, "Renamed Folder")
  assert.equal(afterLegacy?.description, "Safe metadata update")
  assert.equal(afterLegacy?.visibility, "shared")
  assert.deepEqual(afterLegacy?.sharedUserIds, ["legacy-reader"])
  assert.deepEqual(afterLegacy?.sharedGroups, ["legacy-group"])
  assert.deepEqual(afterLegacy?.managerUserIds, ["legacy-manager", "owner-1"])

  const missingLegacy = await app.request("/document-groups/missing/share", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Hidden missing resource" })
  })
  assert.equal(missingLegacy.status, 404)
  assert.deepEqual(await missingLegacy.json(), {
    error: "Resource unavailable",
    code: "RESOURCE_UNAVAILABLE",
    responseProfileVersion: "resource-non-enumeration-v1"
  })
  assert.equal(missingLegacy.headers.get("cache-control"), "no-store")
  assert.equal(missingLegacy.headers.get("x-resource-response-profile"), "resource-non-enumeration-v1")

  const beforeRejectedLegacyUpdates = await readDocumentGroupState(dataDir)
  const legacyPolicyBefore = await folderPolicyStore.list("default")
  const legacyAuditBefore = await objectStore.listKeys("security-audit/intents/")
  const prohibitedLegacyFields: Array<[string, unknown]> = [
    ["adminPrincipalType", "group"],
    ["adminPrincipalId", "SYSTEM_ADMIN"],
    ["visibility", "org"],
    ["sharedUserIds", ["attacker"]],
    ["sharedGroups", ["SYSTEM_ADMIN"]],
    ["managerUserIds", ["attacker"]],
    ["parentGroupId", "group-admin-parent"]
  ]
  for (const [field, value] of prohibitedLegacyFields) {
    const rejectedLegacy = await app.request("/document-groups/folder-1/share", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [field]: value })
    })
    assert.equal(rejectedLegacy.status, 400, `legacy settings must reject ${field}`)
  }
  assert.deepEqual(await readDocumentGroupState(dataDir), beforeRejectedLegacyUpdates)
  assert.deepEqual(await folderPolicyStore.list("default"), legacyPolicyBefore)
  assert.deepEqual(await objectStore.listKeys("security-audit/intents/"), legacyAuditBefore)

  const currentResponse = await app.request("/document-groups/folder-1/share")
  const current = await json<{ policy: { entries: Array<{ principalId: string }> }; version: string }>(currentResponse)
  assert.equal(current.version, replaced.version)
  assert.deepEqual(current.policy.entries.map((entry) => entry.principalId), ["owner-1", "reader-1"])
  assert.equal((await objectStore.listKeys("security-audit/intents/")).length, 4)
})

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
    if (error instanceof ResourceUnavailableError) {
      const response = publicResourceUnavailable()
      for (const [name, value] of Object.entries(response.headers)) c.header(name, value)
      return c.json(response.body, response.status)
    }
    if (error instanceof HTTPException) return c.json({ error: error.message }, error.status)
    return c.json({ error: "Internal server error" }, 500)
  })
  return app
}

class MapPrincipalDirectory implements ResourceUserPrincipalDirectory {
  private readonly principals: Map<string, ResourceUserPrincipal>

  constructor(principals: readonly ResourceUserPrincipal[]) {
    this.principals = new Map(principals.map((principal) => [principal.userId, principal]))
  }

  async getUser(userId: string): Promise<ResourceUserPrincipal | undefined> {
    return this.principals.get(userId)
  }
}

function folder(overrides: Partial<DocumentGroup> = {}): DocumentGroup {
  const now = "2026-07-11T00:00:00.000Z"
  return {
    groupId: "folder-1",
    schemaVersion: 2,
    itemType: "documentGroup",
    tenantId: "default",
    adminPrincipalType: "user",
    adminPrincipalId: "owner-1",
    name: "Folder",
    normalizedName: "folder",
    canonicalPath: "/Folder",
    normalizedCanonicalPath: "/folder",
    adminPathPk: "default#user#owner-1",
    parentPathPk: "default#user#owner-1#ROOT",
    ownerUserId: "owner-1",
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: ["owner-1"],
    status: "active",
    createdBy: "owner-1",
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

async function json<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>
}

async function readDocumentGroupState(dataDir: string): Promise<unknown> {
  return JSON.parse(await readFile(
    path.join(dataDir, "document-groups", tenantPartitionId("default"), "items.json"),
    "utf8"
  )) as unknown
}
