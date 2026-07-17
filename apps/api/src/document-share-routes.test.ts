import assert from "node:assert/strict"
import { spawn, type ChildProcess } from "node:child_process"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalObjectStore } from "./adapters/local-object-store.js"

type LocalServer = {
  port: number
  process: ChildProcess
}

test("document direct share routes return a policy version without weakening resource-hidden responses", async () => {
  const basePort = 18400 + Math.floor(Math.random() * 400)
  const dataDir = await mkdtemp(path.join(tmpdir(), "document-share-routes-"))
  const setupOwner = await startLocalServer(dataDir, "RAG_GROUP_MANAGER", "user-a", basePort)
  let owner: LocalServer | undefined
  let directUser: LocalServer | undefined
  let fullDirectUser: LocalServer | undefined

  try {
    const sourceGroup = await postJson<{ groupId: string }>(setupOwner, "/document-groups", { name: "Source Folder" })
    const uploaded = await uploadApprovedDocument(setupOwner, {
      fileName: "direct-share.txt",
      text: "Direct document share route contract.",
      scope: { scopeType: "group", groupIds: [sourceGroup.groupId] }
    })

    stopLocalServer(setupOwner)
    owner = await startLocalServer(dataDir, "RAG_GROUP_MANAGER", "user-a", basePort + 3)
    const emptyPolicy = await getJson<{ directDocumentGrants: unknown[]; version: string }>(owner, `/documents/${encodeURIComponent(uploaded.documentId)}/share`)
    assert.deepEqual(emptyPolicy.directDocumentGrants, [])
    assert.ok(emptyPolicy.version)

    await putJson(owner, `/documents/${encodeURIComponent(uploaded.documentId)}/share`, {
      grants: [{ principalType: "user", principalId: "user-b", permissionLevel: "readOnly" }],
      reason: "read only review"
    }, { expectedStatus: 400 })
    await seedDocumentShare(dataDir, uploaded.documentId, "user-b", "readOnly")
    directUser = await startLocalServer(dataDir, "RAG_GROUP_MANAGER", "user-b", basePort + 1)

    const forbiddenShareInfo = await fetch(url(directUser, `/documents/${encodeURIComponent(uploaded.documentId)}/share`))
    assert.equal(forbiddenShareInfo.status, 404)
    const directUserDocuments = await getJson<{ documents: Array<{ documentId: string; metadata?: Record<string, unknown>; currentUserEffectivePermission?: string; capabilities?: Record<string, boolean> }> }>(directUser, "/documents")
    const visible = directUserDocuments.documents.find((document) => document.documentId === uploaded.documentId)
    assert.ok(visible)
    assert.equal(visible.currentUserEffectivePermission, "readOnly")
    assert.equal(visible.capabilities?.canShare, false)
    assert.equal(visible.capabilities?.canMove, false)
    assert.equal(visible.capabilities?.canDelete, false)
    assert.equal(visible.metadata?.groupId, undefined)
    assert.equal(visible.metadata?.folderId, undefined)
    assert.equal(visible.metadata?.groupIds, undefined)
    assert.equal(visible.metadata?.folderIds, undefined)
    assert.equal(visible.metadata?.folderLabel, undefined)

    const ownerShareInfo = await getJson<{ directDocumentGrants: Array<{ principalId: string; permissionLevel: string; tenantId?: string }>; version: string }>(owner, `/documents/${encodeURIComponent(uploaded.documentId)}/share`)
    assert.deepEqual(ownerShareInfo.directDocumentGrants.map((grant) => [grant.principalId, grant.permissionLevel, grant.tenantId]), [["user-b", "readOnly", "default"]])
    assert.ok(ownerShareInfo.version)

    await seedDocumentShare(dataDir, uploaded.documentId, "user-b", "full")
    fullDirectUser = await startLocalServer(dataDir, "RAG_GROUP_MANAGER", "user-b", basePort + 2)
    const directUserShareInfo = await getJson<{ currentUserEffectivePermission: string; version: string }>(fullDirectUser, `/documents/${encodeURIComponent(uploaded.documentId)}/share`)
    assert.equal(directUserShareInfo.currentUserEffectivePermission, "full")
    assert.ok(directUserShareInfo.version)

    const destination = await postJson<{ groupId: string }>(fullDirectUser, "/document-groups", { name: "Destination Folder" })
    await uploadApprovedDocument(fullDirectUser, {
      fileName: uploaded.fileName,
      text: "Destination conflict document.",
      scope: { scopeType: "group", groupIds: [destination.groupId] }
    })
    await postJson(fullDirectUser, `/documents/${encodeURIComponent(uploaded.documentId)}/move`, {
      destinationFolderId: destination.groupId,
      reason: "same name conflict"
    }, { expectedStatus: 404 })
  } finally {
    stopLocalServer(setupOwner)
    if (owner) stopLocalServer(owner)
    if (directUser) stopLocalServer(directUser)
    if (fullDirectUser) stopLocalServer(fullDirectUser)
  }
})

async function seedDocumentShare(
  dataDir: string,
  documentId: string,
  principalId: string,
  permissionLevel: "readOnly" | "full"
) {
  const key = `documents/share-grants/${encodeURIComponent("default")}/${encodeURIComponent(documentId)}.json`
  const now = "2026-07-11T00:00:00.000Z"
  await new LocalObjectStore(dataDir).putText(key, JSON.stringify({
    schemaVersion: 1,
    grants: [{
      documentShareGrantId: `fixture-${principalId}`,
      itemType: "documentShareGrant",
      tenantId: "default",
      documentId,
      principalType: "user",
      principalId,
      permissionLevel,
      createdBy: "user-a",
      reason: "test fixture",
      createdAt: now,
      updatedAt: now
    }]
  }, null, 2), "application/json")
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
  const started = Date.now()
  while (Date.now() - started < 5000) {
    if (child.exitCode !== null) throw new Error(`server exited with ${child.exitCode}`)
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`)
      if (res.ok) return
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
  assert.equal(response.status, 200)
  return response.json() as Promise<T>
}

async function uploadApprovedDocument(
  server: LocalServer,
  body: { fileName: string; text: string; scope: { scopeType: "group"; groupIds: string[] } }
): Promise<{ documentId: string; fileName: string }> {
  const uploaded = await postJson<{ documentId: string; fileName: string }>(server, "/documents", body)
  const governance = await getJson<{ version: string }>(server, `/documents/${encodeURIComponent(uploaded.documentId)}/source-governance`)
  const approved = await postJson<{ record: { activeDocumentId?: string } }>(
    server,
    `/documents/${encodeURIComponent(uploaded.documentId)}/source-governance/approve`,
    sourceApproval(governance.version)
  )
  assert.ok(approved.record.activeDocumentId)
  return { documentId: approved.record.activeDocumentId, fileName: uploaded.fileName }
}

function sourceApproval(expectedVersion: string) {
  return {
    expectedVersion,
    reason: "integration fixture source review",
    classification: { level: "internal", policyVersion: "classification-test-v1" },
    usagePolicy: {
      allowedPurposes: ["normal_rag"],
      externalModelAllowed: false,
      loggingAllowed: false,
      evaluationAllowed: false,
      policyVersion: "usage-test-v1"
    },
    qualityProfile: {
      knowledgeQualityStatus: "approved",
      verificationStatus: "verified",
      freshnessStatus: "current",
      supersessionStatus: "current",
      extractionQualityStatus: "high",
      ragEligibility: "eligible",
      flags: []
    },
    qualityPolicyVersion: "quality-test-v1",
    inspection: {
      status: "passed",
      profileVersion: "inspection-test-v1",
      malwareStatus: "clean",
      malwareProfileVersion: "malware-scan-test-v1"
    }
  }
}

async function postJson<T>(server: LocalServer, route: string, body: unknown, options: { expectedStatus?: number } = {}): Promise<T> {
  const response = await fetch(url(server, route), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
  assert.equal(response.status, options.expectedStatus ?? 200, await response.clone().text())
  if (options.expectedStatus && options.expectedStatus !== 200) return undefined as T
  return response.json() as Promise<T>
}

async function putJson<T>(server: LocalServer, route: string, body: unknown, options: { expectedStatus?: number } = {}): Promise<T> {
  const response = await fetch(url(server, route), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
  assert.equal(response.status, options.expectedStatus ?? 200)
  if (options.expectedStatus && options.expectedStatus !== 200) return undefined as T
  return response.json() as Promise<T>
}
