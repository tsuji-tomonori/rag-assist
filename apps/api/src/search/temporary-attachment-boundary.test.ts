import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { LocalBenchmarkRunStore } from "../adapters/local-benchmark-run-store.js"
import { LocalChatRunEventStore } from "../adapters/local-chat-run-event-store.js"
import { LocalChatRunStore } from "../adapters/local-chat-run-store.js"
import { LocalConversationHistoryStore } from "../adapters/local-conversation-history-store.js"
import { LocalDocumentGroupStore } from "../adapters/local-document-group-store.js"
import { LocalDocumentIngestRunEventStore } from "../adapters/local-document-ingest-run-event-store.js"
import { LocalDocumentIngestRunStore } from "../adapters/local-document-ingest-run-store.js"
import { LocalFavoriteStore } from "../adapters/local-favorite-store.js"
import { LocalFolderPolicyStore } from "../adapters/local-folder-policy-store.js"
import { LocalGroupMembershipStore } from "../adapters/local-group-membership-store.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalQuestionStore } from "../adapters/local-question-store.js"
import { LocalUserGroupStore } from "../adapters/local-user-group-store.js"
import { LocalVectorStore } from "../adapters/local-vector-store.js"
import { MockBedrockTextModel } from "../adapters/mock-bedrock.js"
import type { Dependencies } from "../dependencies.js"
import type { DocumentManifest } from "../types.js"
import { getLexicalIndex } from "./hybrid-search.js"

test("FR-067 temporary attachments require current tenant, owner, conversation scope, and expiry", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "temporary-attachment-boundary-"))
  const deps = localDependencies(dataDir)
  const store = deps.objectStore
  await store.putText("documents/active/source.txt", "会話専用の添付資料です。")
  await store.putText("documents/expired/source.txt", "期限切れ添付資料です。")
  await store.putText("manifests/active.json", JSON.stringify(temporaryManifest({
    documentId: "active",
    temporaryScopeId: "conversation-1",
    expiresAt: "2999-01-01T00:00:00.000Z"
  })))
  await store.putText("manifests/expired.json", JSON.stringify(temporaryManifest({
    documentId: "expired",
    temporaryScopeId: "conversation-1",
    expiresAt: "2000-01-01T00:00:00.000Z"
  })))

  const owner = { userId: "owner-1", email: "owner@example.com", tenantId: "tenant-a", accountStatus: "active" as const, cognitoGroups: ["CHAT_USER"] }
  const correct = await getLexicalIndex(deps, owner, { tenantId: "tenant-a" }, {
    mode: "temporary",
    temporaryScopeId: "conversation-1",
    includeTemporary: true
  })
  assert.deepEqual(correct.docs.map((document) => document.documentId), ["active"])
  assert.equal((await store.listKeys("security/revocation-cleanup/")).length, 1, "expired attachment is durably queued for cleanup even before cache reuse")

  const wrongConversation = await getLexicalIndex(deps, owner, { tenantId: "tenant-a" }, {
    mode: "temporary",
    temporaryScopeId: "conversation-2",
    includeTemporary: true
  })
  assert.equal(wrongConversation.docs.length, 0)
  assert.equal((await store.listKeys("security/revocation-cleanup/")).length, 2, "stale conversation cache/run scope is tracked without exposing the attachment")

  const wrongOwner = await getLexicalIndex(deps, {
    ...owner,
    userId: "owner-2",
    email: "other@example.com"
  }, { tenantId: "tenant-a" }, {
    mode: "temporary",
    temporaryScopeId: "conversation-1",
    includeTemporary: true
  })
  assert.equal(wrongOwner.docs.length, 0)
  assert.equal((await store.listKeys("security/revocation-cleanup/")).length, 2, "another owner cannot enqueue cleanup for a valid attachment")

  await assert.rejects(() => getLexicalIndex(deps, { ...owner, tenantId: "tenant-b" }, { tenantId: "tenant-a" }, {
    mode: "temporary",
    temporaryScopeId: "conversation-1",
    includeTemporary: true
  }), /Forbidden/)
})

function temporaryManifest(input: { documentId: string; temporaryScopeId: string; expiresAt: string }): DocumentManifest {
  return {
    documentId: input.documentId,
    fileName: `${input.documentId}.txt`,
    sourceObjectKey: `documents/${input.documentId}/source.txt`,
    manifestObjectKey: `manifests/${input.documentId}.json`,
    vectorKeys: [],
    evidenceVectorKeys: [],
    memoryVectorKeys: [],
    chunkCount: 1,
    memoryCardCount: 0,
    createdAt: "2026-07-11T00:00:00.000Z",
    lifecycleStatus: "active",
    metadata: {
      tenantId: "tenant-a",
      ownerUserId: "owner-1",
      allowedUsers: ["owner-1"],
      scopeType: "chat",
      temporaryScopeId: input.temporaryScopeId,
      expiresAt: input.expiresAt
    },
    chunks: [{ id: "chunk-0000", text: input.documentId === "active" ? "会話専用の添付資料です。" : "期限切れ添付資料です。" }]
  } as unknown as DocumentManifest
}

function localDependencies(dataDir: string): Dependencies {
  return { ragGuardProfile: { id: "test-safe-rag", version: "test-safe-rag-v1", guards: { authentication: true, authorization: true, classification_usage: true, prompt_injection: true, tool_policy: true, grounding: true, citation: true, output_secret: true, trace_redaction: true } },
    objectStore: new LocalObjectStore(dataDir),
    evidenceVectorStore: new LocalVectorStore(dataDir, "evidence-vectors.json"),
    memoryVectorStore: new LocalVectorStore(dataDir, "memory-vectors.json"),
    textModel: new MockBedrockTextModel(),
    questionStore: new LocalQuestionStore(dataDir),
    conversationHistoryStore: new LocalConversationHistoryStore(dataDir),
    favoriteStore: new LocalFavoriteStore(dataDir),
    benchmarkRunStore: new LocalBenchmarkRunStore(dataDir),
    chatRunStore: new LocalChatRunStore(dataDir),
    chatRunEventStore: new LocalChatRunEventStore(dataDir),
    documentIngestRunStore: new LocalDocumentIngestRunStore(dataDir),
    documentIngestRunEventStore: new LocalDocumentIngestRunEventStore(dataDir),
    documentGroupStore: new LocalDocumentGroupStore(dataDir),
    folderPolicyStore: new LocalFolderPolicyStore(dataDir),
    userGroupStore: new LocalUserGroupStore(dataDir),
    groupMembershipStore: new LocalGroupMembershipStore(dataDir),
    localTestIngestAdmissionContext: { mode: "local_test_fixture", fixtureId: "temporary-attachment-boundary" }
  }
}
