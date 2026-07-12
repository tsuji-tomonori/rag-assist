import assert from "node:assert/strict"
import { spawn, type ChildProcess } from "node:child_process"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalFolderPolicyStore } from "./adapters/local-folder-policy-store.js"
import { RESOURCE_NON_ENUMERATION_MINIMUM_DELAY_MS, RESOURCE_UNAVAILABLE_BODY } from "./security/public-resource-response.js"

type LocalServer = { port: number; process: ChildProcess }
type CollectionPage<T, K extends string> = {
  count: number
  nextCursor?: string
  responseProfileVersion: string
} & Record<K, T[]>

test("FR-064/091 reader summaries, authorized-only pagination, extracted download, and non-enumeration are enforced by HTTP routes", async () => {
  const basePort = 18800 + Math.floor(Math.random() * 300)
  const dataDir = await mkdtemp(path.join(tmpdir(), "document-reader-routes-"))
  const setupOwner = await startLocalServer(dataDir, "RAG_GROUP_MANAGER", "owner-1", basePort)
  let owner: LocalServer | undefined
  const outsiderManager = await startLocalServer(dataDir, "RAG_GROUP_MANAGER", "outsider-1", basePort + 2)
  let reader: LocalServer | undefined

  try {
    const visibleGroup1 = await postJson<{ groupId: string }>(setupOwner, "/document-groups", {
      name: "A Shared Policies"
    })
    const visibleGroup2 = await postJson<{ groupId: string }>(setupOwner, "/document-groups", {
      name: "B Shared Policies"
    })
    await seedFolderReaderPolicy(dataDir, visibleGroup1.groupId, "owner-1", "reader-1")
    await seedFolderReaderPolicy(dataDir, visibleGroup2.groupId, "owner-1", "reader-1")
    const hiddenGroup = await postJson<{ groupId: string }>(setupOwner, "/document-groups", { name: "C Private Policies" })
    const outsiderDestination = await postJson<{ groupId: string }>(outsiderManager, "/document-groups", { name: "Outsider Destination" })

    const visibleText1 = "Reader-downloadable extracted policy text one."
    const visibleDocument1 = await postJson<{ documentId: string }>(setupOwner, "/documents", {
      fileName: "visible-one.md",
      text: visibleText1,
      scope: { scopeType: "group", groupIds: [visibleGroup1.groupId] }
    })
    const visibleDocument2 = await postJson<{ documentId: string }>(setupOwner, "/documents", {
      fileName: "visible-two.md",
      text: "Reader-downloadable extracted policy text two.",
      scope: { scopeType: "group", groupIds: [visibleGroup2.groupId] }
    })
    const hiddenDocument = await postJson<{ documentId: string }>(setupOwner, "/documents", {
      fileName: "hidden-owner-policy.md",
      text: "This body must never be disclosed to outsider-1.",
      scope: { scopeType: "group", groupIds: [hiddenGroup.groupId] }
    })
    stopLocalServer(setupOwner)
    owner = await startLocalServer(dataDir, "RAG_GROUP_MANAGER", "owner-1", basePort + 3)
    reader = await startLocalServer(dataDir, "CHAT_USER,READERS", "reader-1", basePort + 1)

    const firstGroupPage = await getJson<CollectionPage<Record<string, unknown>, "groups">>(reader, "/document-groups?limit=1")
    assert.equal(firstGroupPage.count, 1)
    assert.equal(firstGroupPage.groups.length, 1)
    assert.ok(firstGroupPage.nextCursor)
    const secondGroupPage = await getJson<CollectionPage<Record<string, unknown>, "groups">>(reader, `/document-groups?limit=1&cursor=${encodeURIComponent(firstGroupPage.nextCursor)}`)
    assert.equal(secondGroupPage.count, 1)
    assert.equal(secondGroupPage.nextCursor, undefined, "hidden group must not create a third reader cursor")
    const readerGroups = [...firstGroupPage.groups, ...secondGroupPage.groups]
    assert.deepEqual(new Set(readerGroups.map((group) => group.groupId)), new Set([visibleGroup1.groupId, visibleGroup2.groupId]))
    for (const group of readerGroups) assertReaderGroupSummary(group)

    const firstDocumentPage = await getJson<CollectionPage<Record<string, unknown>, "documents">>(reader, "/documents?limit=1")
    assert.equal(firstDocumentPage.count, 1)
    assert.equal(firstDocumentPage.documents.length, 1)
    assert.ok(firstDocumentPage.nextCursor)
    const secondDocumentPage = await getJson<CollectionPage<Record<string, unknown>, "documents">>(reader, `/documents?limit=1&cursor=${encodeURIComponent(firstDocumentPage.nextCursor)}`)
    assert.equal(secondDocumentPage.count, 1)
    assert.equal(secondDocumentPage.nextCursor, undefined, "hidden document must not create a third reader cursor")
    const readerDocuments = [...firstDocumentPage.documents, ...secondDocumentPage.documents]
    assert.deepEqual(new Set(readerDocuments.map((document) => document.documentId)), new Set([visibleDocument1.documentId, visibleDocument2.documentId]))
    for (const document of readerDocuments) assertReaderDocumentSummary(document)

    const managerGroups = await getJson<CollectionPage<Record<string, unknown>, "groups">>(owner, "/document-groups")
    const managerGroup = managerGroups.groups.find((group) => group.groupId === visibleGroup1.groupId)
    assert.ok(managerGroup)
    assert.equal(managerGroup.detailLevel, "manager")
    for (const key of ["tenantId", "adminPrincipalType", "adminPrincipalId", "ownerUserId", "sharedGroups", "managerUserIds", "normalizedCanonicalPath", "adminPathPk", "parentPathPk", "policySource"]) {
      assert.ok(key in managerGroup, `manager folder detail should retain ${key}`)
    }

    const managerDocuments = await getJson<CollectionPage<Record<string, unknown>, "documents">>(owner, "/documents")
    const managerDocument = managerDocuments.documents.find((document) => document.documentId === visibleDocument1.documentId)
    assert.ok(managerDocument)
    assert.equal(managerDocument.detailLevel, "manager")
    assert.equal(typeof managerDocument.chunkCount, "number")
    assert.ok("lifecycleStatus" in managerDocument)
    assert.equal((managerDocument.metadata as Record<string, unknown>).ownerUserId, "owner-1")

    const download = await fetch(url(reader, `/documents/${encodeURIComponent(visibleDocument1.documentId)}/extracted-text`))
    assert.equal(download.status, 200)
    assert.match(download.headers.get("content-type") ?? "", /^text\/plain;\s*charset=utf-8/i)
    assert.match(download.headers.get("content-disposition") ?? "", /visible-one\.txt/)
    assert.equal(download.headers.get("cache-control"), "no-store")
    assert.equal(await download.text(), visibleText1)

    const probes: Array<{ name: string; path: (documentId: string) => string; init?: RequestInit }> = [
      { name: "extracted download", path: (documentId) => `/documents/${encodeURIComponent(documentId)}/extracted-text` },
      { name: "parsed preview", path: (documentId) => `/documents/${encodeURIComponent(documentId)}/parsed-preview` },
      { name: "share read", path: (documentId) => `/documents/${encodeURIComponent(documentId)}/share` },
      {
        name: "share update",
        path: (documentId) => `/documents/${encodeURIComponent(documentId)}/share`,
        init: {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ grants: [], expectedVersion: "non-enumeration-probe-version", reason: "non-enumeration probe" })
        }
      },
      {
        name: "move",
        path: (documentId) => `/documents/${encodeURIComponent(documentId)}/move`,
        init: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ destinationFolderId: outsiderDestination.groupId, reason: "non-enumeration probe" })
        }
      },
      {
        name: "delete",
        path: (documentId) => `/documents/${encodeURIComponent(documentId)}`,
        init: {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ expectedUpdatedAt: "2026-07-11T00:00:00.000Z", reason: "non-enumeration probe" })
        }
      }
    ]
    for (const probe of probes) {
      const existing = await timedFetch(outsiderManager, probe.path(hiddenDocument.documentId), probe.init)
      const absent = await timedFetch(outsiderManager, probe.path("absent-document-id"), probe.init)
      assertGeneralizedPair(probe.name, existing, absent)
    }

    const invalidCursor = await fetch(url(reader, "/documents?cursor=not-a-canonical-cursor"))
    assert.equal(invalidCursor.status, 400)
    assert.doesNotMatch(await invalidCursor.text(), /hidden-owner-policy|owner-1|tenant|policy/i)
  } finally {
    stopLocalServer(setupOwner)
    if (owner) stopLocalServer(owner)
    if (reader) stopLocalServer(reader)
    stopLocalServer(outsiderManager)
  }
})

async function seedFolderReaderPolicy(dataDir: string, folderId: string, ownerUserId: string, readerUserId: string): Promise<void> {
  const now = "2026-07-11T00:00:00.000Z"
  await new LocalFolderPolicyStore(dataDir).save({
    policyId: `reader-policy-${folderId}`,
    itemType: "folderPolicy",
    tenantId: "default",
    folderId,
    entries: [
      { principalType: "user", principalId: ownerUserId, permissionLevel: "full" },
      { principalType: "user", principalId: readerUserId, permissionLevel: "readOnly" }
    ],
    createdBy: ownerUserId,
    createdAt: now,
    updatedAt: now
  })
}

function assertReaderGroupSummary(group: Record<string, unknown>) {
  assert.equal(group.detailLevel, "reader")
  assert.equal(group.effectivePermission, "readOnly")
  assert.deepEqual(group.capabilities, { canRead: true, canManage: false })
  for (const key of [
    "tenantId", "adminPrincipalType", "adminPrincipalId", "ownerUserId", "visibility", "sharedUserIds", "sharedGroups",
    "managerUserIds", "policyId", "policySource", "inheritedFromFolderId", "normalizedName", "normalizedCanonicalPath",
    "adminPathPk", "parentPathPk", "status", "schemaVersion", "itemType", "createdBy", "createdAt", "updatedAt"
  ]) assert.equal(key in group, false, `reader folder summary must omit ${key}`)
}

function assertReaderDocumentSummary(document: Record<string, unknown>) {
  assert.equal(document.detailLevel, "reader")
  assert.equal(document.currentUserEffectivePermission, "readOnly")
  assert.deepEqual(document.capabilities, { canRead: true, canShare: false, canMove: false, canDelete: false, canReindex: false })
  for (const key of [
    "chunkCount", "memoryCardCount", "lifecycleStatus", "activeDocumentId", "stagedFromDocumentId", "reindexMigrationId",
    "chunkerVersion", "sourceExtractorVersion", "embeddingModelId", "embeddingDimensions", "documentVersion", "sourceObjectKey",
    "manifestObjectKey", "vectorKeys", "parsedDocument", "qualityProfile"
  ]) assert.equal(key in document, false, `reader document summary must omit ${key}`)
  const serializedMetadata = JSON.stringify(document.metadata ?? {})
  assert.doesNotMatch(serializedMetadata, /tenant|owner|principal|policy|objectKey|lifecycle|version|acl/i)
}

type TimedResult = { status: number; body: string; headers: Record<string, string | null>; elapsedMs: number }

async function timedFetch(server: LocalServer, route: string, init?: RequestInit): Promise<TimedResult> {
  const startedAt = Date.now()
  const response = await fetch(url(server, route), init)
  const body = await response.text()
  return {
    status: response.status,
    body,
    elapsedMs: Date.now() - startedAt,
    headers: {
      "cache-control": response.headers.get("cache-control"),
      "content-type": response.headers.get("content-type"),
      "content-length": response.headers.get("content-length"),
      "x-resource-response-profile": response.headers.get("x-resource-response-profile")
    }
  }
}

function assertGeneralizedPair(name: string, existing: TimedResult, absent: TimedResult) {
  assert.equal(existing.status, 404, `${name} existing unauthorized status`)
  assert.equal(absent.status, 404, `${name} absent status`)
  assert.equal(existing.body, absent.body, `${name} body class`)
  assert.deepEqual(JSON.parse(existing.body), RESOURCE_UNAVAILABLE_BODY, `${name} generalized body`)
  assert.deepEqual(existing.headers, absent.headers, `${name} header and size class`)
  assert.equal(existing.headers["cache-control"], "no-store")
  assert.equal(existing.headers["x-resource-response-profile"], "resource-non-enumeration-v1")
  assert.ok(existing.elapsedMs >= RESOURCE_NON_ENUMERATION_MINIMUM_DELAY_MS - 5, `${name} unauthorized timing lower bound`)
  assert.ok(absent.elapsedMs >= RESOURCE_NON_ENUMERATION_MINIMUM_DELAY_MS - 5, `${name} absent timing lower bound`)
}

async function startLocalServer(dataDir: string, groups: string, userId: string, port: number): Promise<LocalServer> {
  const child = spawn(process.execPath, ["--import", "tsx", "src/local.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      MOCK_BEDROCK: "true",
      USE_LOCAL_VECTOR_STORE: "true",
      USE_LOCAL_QUESTION_STORE: "true",
      LOCAL_DATA_DIR: dataDir,
      AUTH_ENABLED: "false",
      LOCAL_AUTH_GROUPS: groups,
      LOCAL_AUTH_USER_ID: userId,
      LOCAL_AUTH_TENANT_ID: "default"
    },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"]
  })
  await waitUntilReady(port, child)
  return { port, process: child }
}

function stopLocalServer(server: LocalServer) {
  if (!server.process.pid) return
  try {
    process.kill(-server.process.pid, "SIGTERM")
  } catch {
    server.process.kill("SIGTERM")
  }
}

async function waitUntilReady(port: number, child: ChildProcess) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < 8_000) {
    if (child.exitCode !== null) throw new Error(`server exited with ${child.exitCode}`)
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`)
      if (response.ok) return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  throw new Error(`server on ${port} did not become ready`)
}

function url(server: LocalServer, route: string) {
  return `http://127.0.0.1:${server.port}${route}`
}

async function getJson<T>(server: LocalServer, route: string): Promise<T> {
  const response = await fetch(url(server, route))
  if (response.status !== 200) assert.fail(`GET ${route}: ${response.status} ${await response.text()}`)
  return response.json() as Promise<T>
}

async function postJson<T>(server: LocalServer, route: string, body: unknown): Promise<T> {
  const response = await fetch(url(server, route), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
  if (response.status !== 200) assert.fail(`POST ${route}: ${response.status} ${await response.text()}`)
  return response.json() as Promise<T>
}
