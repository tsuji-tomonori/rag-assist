import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { OpenAPIHono } from "@hono/zod-openapi"
import { HTTPException } from "hono/http-exception"
import { LocalFolderPolicyStore } from "../adapters/local-folder-policy-store.js"
import { LocalGroupMembershipStore } from "../adapters/local-group-membership-store.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalUserGroupStore } from "../adapters/local-user-group-store.js"
import type { AppEnv } from "../app-env.js"
import type { AppUser } from "../auth.js"
import type { Dependencies } from "../dependencies.js"
import { MemoRagService } from "../rag/memorag-service.js"
import type {
  ResourceUserPrincipal,
  ResourceUserPrincipalDirectory
} from "../security/resource-group-membership-service.js"
import {
  ObjectStoreSecurityMutationAuditOutbox,
  type SecurityMutationAuditIntent,
  type SecurityMutationAuditOutboxPort,
  type SecurityMutationResult
} from "../security/security-mutation-audit-outbox.js"
import type { GroupMembership, UserGroup } from "../types.js"
import { registerResourceGroupRoutes } from "./resource-group-routes.js"

test("HTTP resource-group lifecycle exposes tenant-scoped CRUD and explicit move/share denials", async () => {
  const fixture = await createFixture()
  const createResponse = await fixture.app.request("/resource-groups", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      groupId: "route-created",
      name: "Route Created",
      type: "team",
      expectedVersion: "absent",
      reason: "route CRUD verification"
    })
  })
  assert.equal(createResponse.status, 201)
  const created = await createResponse.json() as { groupId: string; name: string; type: string; status: string; version: string }
  assert.deepEqual(Object.keys(created).sort(), ["groupId", "name", "status", "type", "version"])
  assert.equal(created.groupId, "route-created")

  const readResponse = await fixture.app.request("/resource-groups/route-created")
  assert.equal(readResponse.status, 200)
  assert.deepEqual(await readResponse.json(), created)
  const listResponse = await fixture.app.request("/resource-groups")
  assert.equal(listResponse.status, 200)
  const listed = await listResponse.json() as { resourceGroups: Array<{ groupId: string }>; count: number }
  assert.ok(listed.resourceGroups.some((group) => group.groupId === "route-created"))
  assert.equal(listed.count, listed.resourceGroups.length)

  const updateResponse = await fixture.app.request("/resource-groups/route-created", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Route Updated",
      type: "project",
      expectedVersion: created.version,
      reason: "route update verification"
    })
  })
  assert.equal(updateResponse.status, 200)
  const updated = await updateResponse.json() as typeof created
  assert.equal(updated.name, "Route Updated")
  assert.equal(updated.type, "project")

  for (const operation of ["move", "share"] as const) {
    const response = await fixture.app.request(`/resource-groups/route-created/${operation}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedVersion: updated.version, reason: `${operation} explicit deny` })
    })
    assert.equal(response.status, 403)
    assert.deepEqual(await response.json(), { error: "Forbidden" })
  }

  const deleteResponse = await fixture.app.request("/resource-groups/route-created", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ expectedVersion: updated.version, reason: "route delete verification" })
  })
  assert.equal(deleteResponse.status, 200)
  const archived = await deleteResponse.json() as typeof created
  assert.equal(archived.status, "archived")
  const unavailable = await fixture.app.request("/resource-groups/route-created")
  assert.equal(unavailable.status, 404)
  assert.deepEqual(await unavailable.json(), {
    error: "Resource unavailable",
    code: "RESOURCE_UNAVAILABLE",
    responseProfileVersion: "resource-non-enumeration-v1"
  })
  assert.equal(unavailable.headers.get("cache-control"), "no-store")
  assert.equal(unavailable.headers.get("x-resource-response-profile"), "resource-non-enumeration-v1")
})

test("HTTP membership API reads and replaces only the versioned complete public state", async () => {
  const fixture = await createFixture()
  fixture.directory.set(activeUser("user-1"))

  const initialResponse = await fixture.app.request("/resource-groups/team-a/memberships")
  assert.equal(initialResponse.status, 200)
  const initial = await initialResponse.json() as MembershipResponse
  assert.equal(initial.groupId, "team-a")
  assert.match(initial.version, /^[a-f0-9]{64}$/u)
  assert.deepEqual(initial.memberships, [])

  const replaceResponse = await putMemberships(fixture, "team-a", {
    expectedVersion: initial.version,
    memberships: [{ memberType: "user", memberId: "user-1", permissionLevel: "full" }],
    reason: "担当者を追加"
  })
  assert.equal(replaceResponse.status, 200)
  const replaced = await replaceResponse.json() as MembershipResponse
  assert.notEqual(replaced.version, initial.version)
  assert.deepEqual(replaced.memberships, [{ memberType: "user", memberId: "user-1", permissionLevel: "full" }])
  assert.deepEqual(Object.keys(replaced).sort(), ["groupId", "memberships", "version"])
  assert.doesNotMatch(JSON.stringify(replaced), /tenantId|source|createdAt|updatedAt|auditIntent/u)

  const reread = await fixture.app.request("/resource-groups/team-a/memberships")
  assert.equal(reread.status, 200)
  assert.deepEqual(await reread.json(), replaced)
})

test("HTTP membership API returns minimal errors for stale versions, invalid requests, and missing authority", async () => {
  const fixture = await createFixture()
  fixture.directory.set(activeUser("user-1"))
  fixture.directory.set(activeUser("user-2"))
  const initial = await getMemberships(fixture)

  const committed = await putMemberships(fixture, "team-a", {
    expectedVersion: initial.version,
    memberships: [{ memberType: "user", memberId: "user-1", permissionLevel: "full" }],
    reason: "first writer"
  })
  assert.equal(committed.status, 200)

  const stale = await putMemberships(fixture, "team-a", {
    expectedVersion: initial.version,
    memberships: [{ memberType: "user", memberId: "user-2", permissionLevel: "full" }],
    reason: "stale writer"
  })
  assert.equal(stale.status, 409)
  assert.deepEqual(await stale.json(), { error: "Resource group membership conflict" })

  const missingRequiredFields = await putMemberships(fixture, "team-a", { memberships: [] })
  assert.equal(missingRequiredFields.status, 400)
  const validationBody = await missingRequiredFields.json() as { error?: string }
  assert.equal(validationBody.error, "Validation failed")

  const unauthorized = await createFixture({ actor: { ...manager(), userId: "other-manager" } })
  const unauthorizedRead = await unauthorized.app.request("/resource-groups/team-a/memberships")
  assert.equal(unauthorizedRead.status, 403)
  assert.deepEqual(await unauthorizedRead.json(), { error: "Forbidden" })

  const featureless = await createFixture({ actor: { ...manager(), cognitoGroups: ["CHAT_USER"] } })
  const featurelessRead = await featureless.app.request("/resource-groups/team-a/memberships")
  assert.equal(featurelessRead.status, 403)
  assert.deepEqual(await featurelessRead.json(), { error: "Forbidden" })
})

test("HTTP membership API rejects dangling, inactive, cross-tenant, and cyclic retained groups without detail disclosure", async () => {
  const cases: Array<{
    name: string
    configure: (fixture: TestFixture) => Promise<void>
  }> = [
    { name: "dangling", configure: async () => undefined },
    {
      name: "inactive",
      configure: async (fixture) => {
        await fixture.userGroupStore.save({ ...group("child-team", "manager-1"), status: "archived" })
      }
    },
    {
      name: "cross-tenant",
      configure: async (fixture) => {
        await fixture.userGroupStore.save(group("child-team", "manager-1", "tenant-b"))
      }
    },
    {
      name: "cycle",
      configure: async (fixture) => {
        await fixture.userGroupStore.save(group("child-team", "manager-1"))
        await fixture.membershipStore.save(membership("child-team", "group", "team-a", "full"))
      }
    }
  ]

  for (const item of cases) {
    const fixture = await createFixture()
    await item.configure(fixture)
    const initial = await getMemberships(fixture)
    const response = await putMemberships(fixture, "team-a", {
      expectedVersion: initial.version,
      memberships: [{ memberType: "group", memberId: "child-team", permissionLevel: "readOnly" }],
      reason: `${item.name} retained group rejection`
    })
    assert.equal(response.status, 403, item.name)
    const body = await response.json()
    assert.deepEqual(body, { error: "Forbidden" }, item.name)
    assert.doesNotMatch(JSON.stringify(body), /child-team|tenant-|inactive|cycle|dangling/u, item.name)
    assert.deepEqual((await fixture.membershipStore.getVersionedGroupState("tenant-a", "team-a")).memberships, [], item.name)
  }
})

test("HTTP membership API fails closed when audit prepare or completion is unavailable", async () => {
  const prepareFailure = await createFixture({ auditOutbox: new FailingPrepareOutbox() })
  prepareFailure.directory.set(activeUser("user-1"))
  const beforePrepareFailure = await getMemberships(prepareFailure)
  const prepareResponse = await putMemberships(prepareFailure, "team-a", {
    expectedVersion: beforePrepareFailure.version,
    memberships: [{ memberType: "user", memberId: "user-1", permissionLevel: "full" }],
    reason: "prepare failure"
  })
  assert.equal(prepareResponse.status, 503)
  assert.deepEqual(await prepareResponse.json(), { error: "Resource group membership unavailable" })
  assert.deepEqual((await prepareFailure.membershipStore.getVersionedGroupState("tenant-a", "team-a")).memberships, [])

  const pendingOutbox = new PendingOnlyOutbox()
  const completionFailure = await createFixture({ auditOutbox: pendingOutbox })
  completionFailure.directory.set(activeUser("user-1"))
  const beforeCompletionFailure = await getMemberships(completionFailure)
  const completionResponse = await putMemberships(completionFailure, "team-a", {
    expectedVersion: beforeCompletionFailure.version,
    memberships: [{ memberType: "user", memberId: "user-1", permissionLevel: "full" }],
    reason: "completion failure"
  })
  assert.equal(completionResponse.status, 503)
  assert.deepEqual(await completionResponse.json(), { error: "Resource group membership unavailable" })
  assert.equal((await completionFailure.membershipStore.getVersionedGroupState("tenant-a", "team-a")).memberships.length, 1)
  assert.equal(pendingOutbox.pending.length, 1)
})

type MembershipResponse = {
  groupId: string
  version: string
  memberships: Array<{ memberType: "user" | "group"; memberId: string; permissionLevel: "readOnly" | "full" }>
}

type TestFixture = Awaited<ReturnType<typeof createFixture>>

class MapPrincipalDirectory implements ResourceUserPrincipalDirectory {
  private readonly users = new Map<string, ResourceUserPrincipal>()

  set(user: ResourceUserPrincipal): void {
    this.users.set(user.userId, user)
  }

  async getUser(userId: string): Promise<ResourceUserPrincipal | undefined> {
    return this.users.get(userId)
  }
}

class FailingPrepareOutbox implements SecurityMutationAuditOutboxPort {
  async prepare(): Promise<SecurityMutationAuditIntent> {
    throw new Error("audit prepare unavailable")
  }

  async complete(): Promise<SecurityMutationAuditIntent> {
    throw new Error("unexpected audit completion")
  }
}

class PendingOnlyOutbox implements SecurityMutationAuditOutboxPort {
  readonly pending: SecurityMutationAuditIntent[] = []

  async prepare(draft: SecurityMutationAuditIntent["draft"]): Promise<SecurityMutationAuditIntent> {
    const intent: SecurityMutationAuditIntent = {
      schemaVersion: 1,
      intentId: `pending-${this.pending.length + 1}`,
      status: "pending",
      draft,
      createdAt: "2026-07-11T00:00:00.000Z"
    }
    this.pending.push(intent)
    return intent
  }

  async complete(_intentId: string, _tenantId: string, _result: SecurityMutationResult): Promise<SecurityMutationAuditIntent> {
    throw new Error("audit completion unavailable")
  }
}

async function createFixture(input: {
  actor?: AppUser
  auditOutbox?: SecurityMutationAuditOutboxPort
} = {}) {
  const dataDir = await mkdtemp(path.join(tmpdir(), "resource-group-routes-test-"))
  const objectStore = new LocalObjectStore(dataDir)
  const userGroupStore = new LocalUserGroupStore(dataDir)
  const membershipStore = new LocalGroupMembershipStore(dataDir)
  const directory = new MapPrincipalDirectory()
  await userGroupStore.save(group("team-a", "manager-1"))
  const deps = {
    objectStore,
    userGroupStore,
    groupMembershipStore: membershipStore,
    folderPolicyStore: new LocalFolderPolicyStore(dataDir),
    resourceUserPrincipalDirectory: directory,
    securityAuditOutbox: input.auditOutbox ?? new ObjectStoreSecurityMutationAuditOutbox(objectStore)
  } as unknown as Dependencies
  const service = new MemoRagService(deps)
  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => result.success
      ? undefined
      : c.json({ error: "Validation failed", details: result.error.flatten() }, 400)
  })
  app.use("*", async (c, next) => {
    c.set("user", input.actor ?? manager())
    await next()
  })
  registerResourceGroupRoutes({ app, deps, service })
  app.onError((error, c) => {
    if (error instanceof HTTPException) return c.json({ error: error.message || "Request failed" }, error.status)
    return c.json({ error: "Internal server error" }, 500)
  })
  return { app, directory, membershipStore, objectStore, userGroupStore }
}

async function getMemberships(fixture: TestFixture): Promise<MembershipResponse> {
  const response = await fixture.app.request("/resource-groups/team-a/memberships")
  assert.equal(response.status, 200)
  return response.json() as Promise<MembershipResponse>
}

async function putMemberships(fixture: TestFixture, groupId: string, body: unknown): Promise<Response> {
  return fixture.app.request(`/resource-groups/${encodeURIComponent(groupId)}/memberships`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
}

function manager(): AppUser {
  return {
    userId: "manager-1",
    cognitoGroups: ["RAG_GROUP_MANAGER"],
    accountStatus: "active",
    tenantId: "tenant-a"
  }
}

function activeUser(userId: string): ResourceUserPrincipal {
  return { userId, tenantId: "tenant-a", status: "active" }
}

function group(groupId: string, createdBy: string, tenantId = "tenant-a"): UserGroup {
  return {
    groupId,
    itemType: "userGroup",
    tenantId,
    name: groupId,
    type: "team",
    ancestorGroupIds: [],
    status: "active",
    createdBy,
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z"
  }
}

function membership(
  groupId: string,
  memberType: GroupMembership["memberType"],
  memberId: string,
  permissionLevel: GroupMembership["permissionLevel"]
): GroupMembership {
  return {
    tenantId: "tenant-a",
    groupId,
    memberType,
    memberId,
    permissionLevel,
    source: "manual",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z"
  }
}
