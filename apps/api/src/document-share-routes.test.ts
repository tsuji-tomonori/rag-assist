import assert from "node:assert/strict"
import { spawn, type ChildProcess } from "node:child_process"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

type LocalServer = {
  port: number
  process: ChildProcess
}

test("document direct share routes do not leak share metadata to direct readOnly users and allow direct full operations", async () => {
  const basePort = 18400 + Math.floor(Math.random() * 400)
  const dataDir = await mkdtemp(path.join(tmpdir(), "document-share-routes-"))
  const owner = await startLocalServer(dataDir, "RAG_GROUP_MANAGER", "user-a", basePort)
  const directUser = await startLocalServer(dataDir, "RAG_GROUP_MANAGER", "user-b", basePort + 1)

  try {
    const sourceGroup = await postJson<{ groupId: string }>(owner, "/document-groups", { name: "Source Folder", visibility: "private" })
    const uploaded = await postJson<{ documentId: string; fileName: string }>(owner, "/documents", {
      fileName: "direct-share.txt",
      text: "Direct document share route contract.",
      scope: { scopeType: "group", groupIds: [sourceGroup.groupId] }
    })

    await putJson(owner, `/documents/${encodeURIComponent(uploaded.documentId)}/share`, {
      grants: [{ principalType: "user", principalId: "user-b", permissionLevel: "readOnly" }],
      reason: "read only review"
    })

    const forbiddenShareInfo = await fetch(url(directUser, `/documents/${encodeURIComponent(uploaded.documentId)}/share`))
    assert.equal(forbiddenShareInfo.status, 403)
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
    assert.equal(visible.metadata?.folderLabel, "共有文書")

    const ownerShareInfo = await getJson<{ directDocumentGrants: Array<{ principalId: string; permissionLevel: string; tenantId?: string }> }>(owner, `/documents/${encodeURIComponent(uploaded.documentId)}/share`)
    assert.deepEqual(ownerShareInfo.directDocumentGrants.map((grant) => [grant.principalId, grant.permissionLevel, grant.tenantId]), [["user-b", "readOnly", "default"]])

    await putJson(owner, `/documents/${encodeURIComponent(uploaded.documentId)}/share`, {
      grants: [{ principalType: "user", principalId: "user-b", permissionLevel: "full" }],
      reason: "delegate document administration"
    })
    const directUserShareUpdate = await putJson<{ directDocumentGrants: Array<{ principalId: string; permissionLevel: string }> }>(directUser, `/documents/${encodeURIComponent(uploaded.documentId)}/share`, {
      grants: [
        { principalType: "user", principalId: "user-b", permissionLevel: "full" },
        { principalType: "user", principalId: "user-c", permissionLevel: "readOnly" }
      ],
      reason: "route level document effective full"
    })
    assert.deepEqual(directUserShareUpdate.directDocumentGrants.map((grant) => [grant.principalId, grant.permissionLevel]), [["user-b", "full"], ["user-c", "readOnly"]])

    const destination = await postJson<{ groupId: string }>(directUser, "/document-groups", { name: "Destination Folder", visibility: "private" })
    await postJson(directUser, "/documents", {
      fileName: uploaded.fileName,
      text: "Destination conflict document.",
      scope: { scopeType: "group", groupIds: [destination.groupId] }
    })
    await postJson(directUser, `/documents/${encodeURIComponent(uploaded.documentId)}/move`, {
      destinationFolderId: destination.groupId,
      reason: "same name conflict"
    }, { expectedStatus: 409 })

    const moveOk = await postJson<{ document: { documentId: string; fileName: string; metadata?: Record<string, unknown> }; directDocumentGrantsPreserved: boolean }>(directUser, `/documents/${encodeURIComponent(uploaded.documentId)}/move`, {
      destinationFolderId: destination.groupId,
      newTitle: "direct-share-moved.txt",
      reason: "direct full move route"
    })
    assert.equal(moveOk.document.documentId, uploaded.documentId)
    assert.equal(moveOk.document.fileName, "direct-share-moved.txt")
    assert.equal(moveOk.document.metadata?.folderId, destination.groupId)
    assert.equal(moveOk.directDocumentGrantsPreserved, true)
  } finally {
    stopLocalServer(owner)
    stopLocalServer(directUser)
  }
})

async function startLocalServer(dataDir: string, groups: string, userId: string, port: number): Promise<LocalServer> {
  const tsxBin = path.resolve(process.cwd(), "../../node_modules/.bin/tsx")
  const child = spawn(tsxBin, ["src/local.ts"], {
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
      LOCAL_AUTH_USER_ID: userId
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

async function postJson<T>(server: LocalServer, route: string, body: unknown, options: { expectedStatus?: number } = {}): Promise<T> {
  const response = await fetch(url(server, route), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
  assert.equal(response.status, options.expectedStatus ?? 200)
  if (options.expectedStatus && options.expectedStatus !== 200) return undefined as T
  return response.json() as Promise<T>
}

async function putJson<T>(server: LocalServer, route: string, body: unknown): Promise<T> {
  const response = await fetch(url(server, route), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
  assert.equal(response.status, 200)
  return response.json() as Promise<T>
}
