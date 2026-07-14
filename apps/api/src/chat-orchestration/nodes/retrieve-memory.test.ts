import assert from "node:assert/strict"
import test from "node:test"
import type { AppUser } from "../../auth.js"
import type { Dependencies } from "../../dependencies.js"
import type { DocumentGroup, DocumentManifest, DocumentShareGrant, RetrievedVector } from "../../types.js"
import { ChatOrchestrationStateSchema } from "../state.js"
import { createRetrieveMemoryNode } from "./retrieve-memory.js"

const createdAt = "2026-05-19T00:00:00.000Z"

test("retrieve memory allows group scoped owner document without an inherited folder allow", async () => {
  const uploader: AppUser = {
    userId: "uploader",
    email: "uploader@example.com",
    cognitoGroups: ["CHAT_USER"],
    accountStatus: "active",
    tenantId: "tenant-a"
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

  assert.deepEqual(update.memoryCards?.map((card) => card.key), [hit.key])
})

test("retrieve memory allows parent shared inherited child memory card", async () => {
  const reader: AppUser = {
    userId: "reader",
    email: "reader@example.com",
    cognitoGroups: ["CHAT_USER"],
    accountStatus: "active",
    tenantId: "tenant-a"
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

test("retrieve memory applies an ordinary direct deny before an inherited folder allow", async () => {
  const reader: AppUser = {
    userId: "reader",
    email: "reader@example.com",
    cognitoGroups: ["CHAT_USER"],
    accountStatus: "active",
    tenantId: "tenant-a"
  }
  const folder = documentGroup({
    groupId: "shared-folder",
    name: "Shared folder",
    ownerUserId: "group-admin",
    visibility: "shared",
    sharedUserIds: [reader.userId],
    managerUserIds: ["group-admin"],
    hasExplicitPolicy: true
  })
  const manifest = documentManifest({
    documentId: "doc-memory-explicit-deny",
    fileName: "deny.md",
    groupId: folder.groupId,
    ownerUserId: "group-admin"
  })
  const hit = memoryHit({ key: "memory-explicit-deny", manifest, text: "must remain hidden" })
  const denyGrant: DocumentShareGrant = {
    documentShareGrantId: "deny-reader",
    tenantId: "tenant-a",
    documentId: manifest.documentId,
    principalType: "user",
    principalId: reader.userId,
    permissionLevel: "deny",
    createdBy: "group-admin",
    reason: "ordinary policy deny",
    createdAt,
    updatedAt: createdAt
  }

  const update = await createRetrieveMemoryNode(depsFor([folder], manifest, hit, [denyGrant]), reader)(memoryState())

  assert.deepEqual(update.memoryCards, [])
})

test("retrieve memory excludes explicit private child memory card even when parent is shared", async () => {
  const reader: AppUser = {
    userId: "reader",
    email: "reader@example.com",
    cognitoGroups: ["CHAT_USER"],
    accountStatus: "active",
    tenantId: "tenant-a"
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

test("retrieve memory preserves the isolated benchmark tenant and corpus filters", async () => {
  const subject: AppUser = {
    userId: "benchmark-evaluation:standard-agent-v1",
    cognitoGroups: [],
    accountStatus: "active",
    tenantId: "benchmark-tenant"
  }
  let receivedFilter: unknown
  const benchmarkManifest: DocumentManifest = {
    documentId: "benchmark-document",
    fileName: "benchmark.md",
    sourceObjectKey: "documents/benchmark-document.md",
    manifestObjectKey: "manifests/benchmark-document.json",
    vectorKeys: ["benchmark-memory"],
    memoryVectorKeys: ["benchmark-memory"],
    chunkCount: 1,
    memoryCardCount: 1,
    lifecycleStatus: "active",
    createdAt,
    metadata: {
      tenantId: "benchmark-tenant",
      ownerUserId: subject.userId,
      scopeType: "benchmark",
      aclGroups: ["BENCHMARK_RUNNER"],
      lifecycleStatus: "active",
      ragEligibility: "eligible",
      source: "benchmark-runner",
      docType: "benchmark-corpus",
      benchmarkSuiteId: "standard-agent-v1"
    }
  }
  const benchmarkHit: RetrievedVector = {
    key: "benchmark-memory",
    score: 0.99,
    metadata: {
      kind: "memory",
      documentId: "benchmark-document",
      fileName: "benchmark.md",
      memoryId: "benchmark-memory",
      text: "isolated benchmark evidence",
      tenantId: "benchmark-tenant",
      source: "benchmark-runner",
      docType: "benchmark-corpus",
      benchmarkSuiteId: "standard-agent-v1",
      aclGroups: ["BENCHMARK_RUNNER"],
      lifecycleStatus: "active",
      ragEligibility: "eligible",
      createdAt
    }
  }
  const deps = {
    localTestIngestAdmissionContext: { mode: "local_test_fixture", fixtureId: "benchmark-memory-test" },
    textModel: { embed: async () => [0.1, 0.2, 0.3] },
    memoryVectorStore: {
      query: async (_vector: number[], _topK: number, filter: unknown) => {
        receivedFilter = filter
        return [benchmarkHit]
      },
      put: async () => undefined,
      delete: async () => undefined
    },
    objectStore: {
      listKeys: async () => [benchmarkManifest.manifestObjectKey],
      getText: async (key: string) => {
        if (key === benchmarkManifest.manifestObjectKey) return JSON.stringify(benchmarkManifest)
        throw missingObjectError()
      }
    },
    documentGroupStore: { list: async () => [] }
  } as unknown as Dependencies
  const state = ChatOrchestrationStateSchema.parse({
    runId: "benchmark-run",
    question: "benchmark question",
    modelId: "test-model",
    embeddingModelId: "test-embedding",
    clueModelId: "test-clue",
    useMemory: true,
    memoryTopK: 5,
    searchFilters: {
      tenantId: "benchmark-tenant",
      source: "benchmark-runner",
      docType: "benchmark-corpus",
      benchmarkSuiteId: "standard-agent-v1"
    }
  })

  const update = await createRetrieveMemoryNode(deps, subject)(state)

  assert.deepEqual(receivedFilter, {
    kind: "memory",
    documentId: undefined,
    tenantId: "benchmark-tenant",
    department: undefined,
    source: "benchmark-runner",
    docType: "benchmark-corpus",
    benchmarkSuiteId: "standard-agent-v1",
    documentIds: ["benchmark-document"]
  })
  assert.deepEqual(update.memoryCards?.map((item) => item.key), ["benchmark-memory"])
})

function documentGroup(input: Partial<DocumentGroup> & Pick<DocumentGroup, "groupId" | "name" | "ownerUserId">): DocumentGroup {
  return {
    tenantId: "tenant-a",
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
      tenantId: "tenant-a",
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
      tenantId: typeof input.manifest.metadata?.tenantId === "string" ? input.manifest.metadata.tenantId : undefined,
      lifecycleStatus: "active",
      ragEligibility: "eligible",
      createdAt
    }
  }
}

function depsFor(groups: DocumentGroup[], manifest: DocumentManifest, hit: RetrievedVector, directGrants: DocumentShareGrant[] = []): Dependencies {
  return {
    localTestIngestAdmissionContext: { mode: "local_test_fixture", fixtureId: "retrieve-memory-test" },
    textModel: { embed: async () => [0.1, 0.2, 0.3] },
    memoryVectorStore: {
      query: async () => [hit],
      put: async () => undefined,
      delete: async () => undefined
    },
    objectStore: {
      getText: async (key: string) => {
        if (key === manifest.manifestObjectKey) return JSON.stringify(manifest)
        if (key === `documents/share-grants/tenant-a/${manifest.documentId}.json`) {
          return JSON.stringify({ schemaVersion: 1, grants: directGrants })
        }
        throw missingObjectError()
      },
      putText: async () => undefined,
      deleteObject: async () => undefined,
      listKeys: async () => [manifest.manifestObjectKey]
    },
    documentGroupStore: {
      list: async () => groups,
      get: async (groupId: string) => groups.find((group) => group.groupId === groupId)
    },
    folderPolicyStore: { list: async () => [], get: async () => undefined, findByFolderId: async () => undefined },
    userGroupStore: { list: async () => [], get: async () => undefined },
    groupMembershipStore: { list: async () => [], listByGroupId: async () => [] }
  } as unknown as Dependencies
}

function missingObjectError(): Error & { code: string } {
  return Object.assign(new Error("ENOENT"), { code: "ENOENT" })
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
