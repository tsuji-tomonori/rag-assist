import assert from "node:assert/strict"
import test from "node:test"
import type { AppUser } from "../../auth.js"
import type { Dependencies } from "../../dependencies.js"
import type { DocumentGroup, DocumentManifest, RetrievedVector } from "../../types.js"
import { ChatOrchestrationStateSchema } from "../state.js"
import { createRetrieveMemoryNode } from "./retrieve-memory.js"

const createdAt = "2026-05-19T00:00:00.000Z"

test("retrieve memory excludes group scoped owner document when user lacks folder read permission", async () => {
  const uploader: AppUser = {
    userId: "uploader",
    email: "uploader@example.com",
    cognitoGroups: ["CHAT_USER"]
  }
  const privateGroup = documentGroup({
    groupId: "private-group",
    name: "Private group",
    ownerUserId: "group-admin",
    visibility: "private",
    managerUserIds: ["group-admin"]
  })
  const manifest = documentManifest({
    documentId: "doc-owner-bypass-memory",
    fileName: "secret.md",
    groupId: privateGroup.groupId,
    ownerUserId: uploader.userId
  })
  const hit = memoryHit({
    key: "memory-owner-bypass",
    manifest,
    text: "revoked owner secret pear memory"
  })

  const update = await createRetrieveMemoryNode(depsFor([privateGroup], manifest, hit), uploader)(memoryState())

  assert.deepEqual(update.memoryCards, [])
})

test("retrieve memory allows parent shared inherited child memory card", async () => {
  const reader: AppUser = {
    userId: "reader",
    email: "reader@example.com",
    cognitoGroups: ["CHAT_USER"]
  }
  const parent = documentGroup({
    groupId: "shared-parent",
    name: "Shared parent",
    ownerUserId: "group-admin",
    visibility: "shared",
    sharedUserIds: [reader.userId],
    managerUserIds: ["group-admin"],
    hasExplicitPolicy: true
  })
  const child = documentGroup({
    groupId: "inherited-child",
    name: "Inherited child",
    parentGroupId: parent.groupId,
    ownerUserId: "group-admin",
    visibility: "private",
    managerUserIds: ["group-admin"],
    hasExplicitPolicy: undefined
  })
  const manifest = documentManifest({
    documentId: "doc-inherited-child-memory",
    fileName: "inherited.md",
    groupId: child.groupId,
    ownerUserId: "group-admin"
  })
  const hit = memoryHit({ key: "memory-inherited-child", manifest, text: "parent shared inherited memory" })

  const update = await createRetrieveMemoryNode(depsFor([parent, child], manifest, hit), reader)(memoryState())

  assert.deepEqual(update.memoryCards?.map((card) => card.key), [hit.key])
})

test("retrieve memory excludes explicit private child memory card even when parent is shared", async () => {
  const reader: AppUser = {
    userId: "reader",
    email: "reader@example.com",
    cognitoGroups: ["CHAT_USER"]
  }
  const parent = documentGroup({
    groupId: "shared-parent",
    name: "Shared parent",
    ownerUserId: "group-admin",
    visibility: "shared",
    sharedUserIds: [reader.userId],
    managerUserIds: ["group-admin"],
    hasExplicitPolicy: true
  })
  const child = documentGroup({
    groupId: "explicit-private-child",
    name: "Explicit private child",
    parentGroupId: parent.groupId,
    ownerUserId: "group-admin",
    visibility: "private",
    managerUserIds: ["group-admin"],
    hasExplicitPolicy: true
  })
  const manifest = documentManifest({
    documentId: "doc-explicit-private-child-memory",
    fileName: "private-child.md",
    groupId: child.groupId,
    ownerUserId: "group-admin"
  })
  const hit = memoryHit({ key: "memory-explicit-private-child", manifest, text: "explicit private child memory" })

  const update = await createRetrieveMemoryNode(depsFor([parent, child], manifest, hit), reader)(memoryState())

  assert.deepEqual(update.memoryCards, [])
})

function documentGroup(input: Partial<DocumentGroup> & Pick<DocumentGroup, "groupId" | "name" | "ownerUserId">): DocumentGroup {
  return {
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: [],
    createdAt,
    updatedAt: createdAt,
    ...input
  }
}

function documentManifest(input: {
  documentId: string
  fileName: string
  groupId: string
  ownerUserId: string
}): DocumentManifest {
  return {
    documentId: input.documentId,
    fileName: input.fileName,
    sourceObjectKey: `documents/${input.documentId}.md`,
    manifestObjectKey: `manifests/${input.documentId}.json`,
    vectorKeys: [],
    memoryVectorKeys: [`memory-${input.documentId}`],
    chunkCount: 1,
    memoryCardCount: 1,
    lifecycleStatus: "active",
    createdAt,
    metadata: {
      scopeType: "group",
      groupIds: [input.groupId],
      ownerUserId: input.ownerUserId,
      lifecycleStatus: "active",
      ragEligibility: "eligible"
    }
  }
}

function memoryHit(input: {
  key: string
  manifest: DocumentManifest
  text: string
}): RetrievedVector {
  const groupIds = input.manifest.metadata?.groupIds
  const ownerUserId = input.manifest.metadata?.ownerUserId
  return {
    key: input.key,
    score: 0.99,
    metadata: {
      kind: "memory",
      documentId: input.manifest.documentId,
      fileName: input.manifest.fileName,
      memoryId: input.key,
      text: input.text,
      scopeType: "group",
      groupIds: Array.isArray(groupIds) ? groupIds.filter((groupId): groupId is string => typeof groupId === "string") : undefined,
      ownerUserId: typeof ownerUserId === "string" ? ownerUserId : undefined,
      lifecycleStatus: "active",
      ragEligibility: "eligible",
      createdAt
    }
  }
}

function depsFor(groups: DocumentGroup[], manifest: DocumentManifest, hit: RetrievedVector): Dependencies {
  return {
    textModel: { embed: async () => [0.1, 0.2, 0.3] },
    memoryVectorStore: {
      query: async () => [hit],
      put: async () => undefined,
      delete: async () => undefined
    },
    objectStore: {
      getText: async (key: string) => {
        assert.equal(key, manifest.manifestObjectKey)
        return JSON.stringify(manifest)
      },
      putText: async () => undefined,
      deleteObject: async () => undefined,
      listKeys: async () => []
    },
    documentGroupStore: {
      list: async () => groups
    }
  } as unknown as Dependencies
}

function memoryState() {
  return ChatOrchestrationStateSchema.parse({
    runId: "run-1",
    question: "owner secret pear",
    modelId: "test-model",
    embeddingModelId: "test-embedding",
    clueModelId: "test-clue",
    useMemory: true,
    memoryTopK: 5,
    searchScope: { mode: "all" }
  })
}
