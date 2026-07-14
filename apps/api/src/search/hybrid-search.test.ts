import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { RAG_QUALITY_SIGNAL_CATALOG_VERSION } from "@memorag-mvp/contract/rag-quality-control"
import type { AppUser } from "../auth.js"
import { ragRuntimePolicy } from "../chat-orchestration/runtime-policy.js"
import { LocalObjectStore } from "../adapters/local-object-store.js"
import { LocalQuestionStore } from "../adapters/local-question-store.js"
import { LocalConversationHistoryStore } from "../adapters/local-conversation-history-store.js"
import { LocalFavoriteStore } from "../adapters/local-favorite-store.js"
import { LocalBenchmarkRunStore } from "../adapters/local-benchmark-run-store.js"
import { LocalChatRunStore } from "../adapters/local-chat-run-store.js"
import { LocalChatRunEventStore } from "../adapters/local-chat-run-event-store.js"
import { LocalDocumentIngestRunStore } from "../adapters/local-document-ingest-run-store.js"
import { LocalDocumentIngestRunEventStore } from "../adapters/local-document-ingest-run-event-store.js"
import { LocalDocumentGroupStore } from "../adapters/local-document-group-store.js"
import { LocalFolderPolicyStore } from "../adapters/local-folder-policy-store.js"
import { LocalUserGroupStore } from "../adapters/local-user-group-store.js"
import { LocalGroupMembershipStore } from "../adapters/local-group-membership-store.js"
import { LocalVectorStore } from "../adapters/local-vector-store.js"
import { MockBedrockTextModel } from "../adapters/mock-bedrock.js"
import type { Dependencies } from "../dependencies.js"
import { DocumentPermissionService } from "../documents/document-permission-service.js"
import { FolderPermissionService } from "../folders/folder-permission-service.js"
import { MemoRagService } from "../rag/memorag-service.js"
import { tenantPartitionId } from "../security/tenant-partition.js"
import { ACTIVE_RAG_QUALITY_POLICY_KEY, RAG_SAFETY_STATE_KEY, type RagSafetyState } from "../rag/quality-control/production-rag-monitor.js"
import { adaptiveEffectiveMinScore, bm25Score, bm25Search, buildLexicalIndex, getLexicalIndex, rrfFuse, searchRag, tokenizeQuery } from "./hybrid-search.js"
import type { DocumentGroup, DocumentManifest, FolderPolicy, GroupMembership, JsonValue, UserGroup } from "../types.js"

test("FR-093 direct search rejects a runtime that monitoring rolled back before retrieval reads", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(tmpdir(), "rag-search-failure-observation-")))
  const safetyState: RagSafetyState = {
    schemaVersion: 1,
    stateVersion: 1,
    policyId: "production-rag",
    policyVersion: "approved-1",
    activeRuntimeProfileVersion: `${ragRuntimePolicy.profile.version}-last-known-safe`,
    quarantinedRuntimeProfileVersions: [],
    promotionFrozen: false,
    documentQuarantineRequired: false,
    responseMode: "normal",
    updatedAt: "2026-07-11T00:00:00.000Z",
    validUntil: "2099-01-01T00:00:00.000Z"
  }
  await store.putText(RAG_SAFETY_STATE_KEY, JSON.stringify(safetyState))
  await store.putText(ACTIVE_RAG_QUALITY_POLICY_KEY, JSON.stringify({
    signalCatalogVersion: RAG_QUALITY_SIGNAL_CATALOG_VERSION,
    profileId: "production-rag",
    version: "approved-1",
    workloadProfileVersion: "workload-v1",
    runtimeProfileVersion: ragRuntimePolicy.profile.version,
    priceCatalogVersion: "price-v1",
    evidenceVersions: {
      dataset: "dataset-v1", model: "model-v1", index: "index-v1", prompt: "prompt-v1",
      pipeline: "pipeline-v1", parser: "parser-v1", chunker: "chunker-v1"
    },
    workloadDimensions: {},
    requiredCaseSlices: {},
    changeControl: {},
    responsePolicy: { allowedActions: [] }
  }))
  const deps = { objectStore: store } as unknown as Dependencies
  const user: AppUser = {
    userId: "search-user",
    tenantId: "tenant-search",
    accountStatus: "active",
    cognitoGroups: ["CHAT_USER"]
  }

  await assert.rejects(
    () => searchRag(deps, { query: "must not read indexes" }, user),
    /not the active monitored runtime/
  )
  const samples = await Promise.all((await store.listKeys("quality-control/source-samples/")).map(async (key) => (
    JSON.parse(await store.getText(key)) as {
      sourceType: string
      slice: string
      measurements: Record<string, { value: number | null }>
    }
  )))
  const failureSamples = samples.filter((sample) => sample.sourceType === "search_runtime")
  assert.ok(failureSamples.some((sample) => sample.slice === "outcome=failure"))
  assert.ok(failureSamples.some((sample) => sample.slice === "failure=safety_interlock"))
  assert.ok(failureSamples.every((sample) => sample.measurements["reliability.error_rate"]?.value === 1))
  const [failureTraceKey] = await store.listKeys(`debug-runs/${tenantPartitionId("tenant-search")}/`)
  assert.ok(failureTraceKey)
  const failureTrace = JSON.parse(await store.getText(failureTraceKey!)) as {
    status?: string
    tenantPartitionId?: string
    question?: string
    replayVersionManifest?: {
      decisions?: { responseStatus?: string; decisionCode?: string; reasonCodes?: string[] }
      missingVersions?: string[]
    }
  }
  assert.equal(failureTrace.status, "error")
  assert.equal(failureTrace.tenantPartitionId, tenantPartitionId("tenant-search"))
  assert.match(failureTrace.question ?? "", /^sha256:[a-f0-9]{64}$/)
  assert.equal(failureTrace.replayVersionManifest?.decisions?.responseStatus, "error")
  assert.equal(failureTrace.replayVersionManifest?.decisions?.decisionCode, "failed")
  assert.deepEqual(failureTrace.replayVersionManifest?.decisions?.reasonCodes, ["safety_interlock"])
  assert.ok(failureTrace.replayVersionManifest?.missingVersions?.includes("sourceSnapshots"))
})

test("FR-074 rejected cross-tenant search persists only an actor-tenant redacted trace", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(tmpdir(), "rag-search-denied-trace-")))
  const user: AppUser = {
    userId: "search-user",
    tenantId: "tenant-search",
    accountStatus: "active",
    cognitoGroups: ["CHAT_USER"]
  }
  await assert.rejects(
    () => searchRag(
      { objectStore: store } as unknown as Dependencies,
      { query: "cross tenant secret", filters: { tenantId: "tenant-other" } },
      user
    ),
    /Forbidden/
  )

  const ownKeys = await store.listKeys(`debug-runs/${tenantPartitionId("tenant-search")}/`)
  assert.equal(ownKeys.length, 1)
  assert.deepEqual(await store.listKeys(`debug-runs/${tenantPartitionId("tenant-other")}/`), [])
  const trace = JSON.parse(await store.getText(ownKeys[0]!)) as {
    status?: string
    question?: string
    steps?: Array<{ summary?: string }>
  }
  assert.equal(trace.status, "error")
  assert.match(trace.question ?? "", /^sha256:[a-f0-9]{64}$/)
  assert.doesNotMatch(JSON.stringify(trace), /cross tenant secret|tenant-other/)
})

test("tokenizeQuery normalizes Japanese and ASCII terms with n-grams", () => {
  const tokens = tokenizeQuery("  申請承認 Workflow  ")

  assert.ok(tokens.includes("申請承認"))
  assert.ok(tokens.includes("申請"))
  assert.ok(tokens.includes("請承"))
  assert.ok(tokens.includes("workflow"))
})

test("BM25 search covers exact, Japanese n-gram, prefix, and ASCII fuzzy matches", () => {
  const index = buildLexicalIndex(
    [
      lexicalDoc("doc-request-chunk-0000", "doc-request", "申請承認ワークフロー.md", "申請承認ワークフローの確認条件は責任者承認です。approval policy applies."),
      lexicalDoc("doc-pipeline-chunk-0000", "doc-pipeline", "pipeline-guide.md", "Pipeline settings are managed by sales ops."),
      lexicalDoc("doc-inventory-chunk-0000", "doc-inventory", "在庫.md", "在庫数の修正は在庫管理システムから申請します。")
    ],
    "test-index"
  )

  assert.equal(bm25Search(index, tokenizeQuery("申請 承認"), 3)[0]?.id, "doc-request-chunk-0000")
  assert.equal(bm25Search(index, tokenizeQuery("承認ワ"), 3)[0]?.id, "doc-request-chunk-0000")
  assert.equal(bm25Search(index, tokenizeQuery("pipe"), 3)[0]?.id, "doc-pipeline-chunk-0000")
  assert.equal(bm25Search(index, tokenizeQuery("aproval"), 3)[0]?.id, "doc-request-chunk-0000")
})

test("BM25 search expands short CJK abbreviation-like terms from the corpus dictionary", () => {
  const index = buildLexicalIndex(
    [
      lexicalDoc("doc-parental-leave-chunk-0000", "doc-parental-leave", "handbook.md", "育児休業の申請期限は開始日の1か月前です。"),
      lexicalDoc("doc-vacation-chunk-0000", "doc-vacation", "handbook.md", "有給休暇の取得申請は取得日の前営業日までに提出します。")
    ],
    "test-index"
  )

  const hits = bm25Search(index, tokenizeQuery("8/1から育休を取る場合、いつまでに申請する必要がある?"), 3)

  assert.equal(hits[0]?.id, "doc-parental-leave-chunk-0000")
})

test("BM25 alias expansion uses caller-provided alias maps only", () => {
  const docs = [
    lexicalDoc("doc-vacation-chunk-0000", "doc-vacation", "vacation-guide.md", "Vacation requests require manager approval.")
  ]
  const noAliases = buildLexicalIndex(docs, "no-aliases")
  const withAliases = buildLexicalIndex(docs, "with-aliases", { pto: ["vacation"] })

  assert.equal(noAliases.aliasVersion, "none")
  assert.match(withAliases.aliasVersion, /^alias:[a-f0-9]{8}$/)
  assert.equal(bm25Search(noAliases, tokenizeQuery("pto"), 3).length, 0)
  assert.equal(bm25Search(withAliases, tokenizeQuery("pto"), 3)[0]?.id, "doc-vacation-chunk-0000")
})

test("RRF fusion rewards overlap while keeping independent lexical hits", () => {
  const fused = rrfFuse(
    [
      [{ id: "lexical-only" }, { id: "shared" }],
      [{ id: "shared" }, { id: "semantic-only" }]
    ],
    { k: 60, weights: [1, 0.9] }
  )

  assert.equal(fused[0]?.id, "shared")
  assert.ok(fused.some((hit) => hit.id === "lexical-only"))
  assert.ok(fused.some((hit) => hit.id === "semantic-only"))
})

test("adaptive score floor does not reuse MIN_RETRIEVAL_SCORE for fused scores", () => {
  const lowSemanticOnlyScores = [0.0159, 0.0142, 0.011]

  assert.equal(adaptiveEffectiveMinScore(lowSemanticOnlyScores, 0, 0.25), 0.011)
  assert.equal(adaptiveEffectiveMinScore([0.0159], 0, 0.25), 0.0159)
  assert.equal(adaptiveEffectiveMinScore([], 0.25, 0.5), 0.25)
  assert.equal(bm25Score({ tf: 2, df: 1, docLen: 10, avgDocLen: 5, nDocs: 3 }) > 0, true)
})

test("lexical index and search handle empty inputs, scoped manifests, artifact misses, and semantic metadata fallback", async () => {
  assert.deepEqual(bm25Search(buildLexicalIndex([], "empty"), tokenizeQuery("申請"), 3), [])
  assert.deepEqual(bm25Search(buildLexicalIndex([lexicalDoc("doc-1-chunk-0000", "doc-1", "a.md", "本文")], "one"), [], 3), [])
  assert.deepEqual(rrfFuse([[{ id: "a" }]], { k: 10, weights: [] }), [{ id: "a", score: 1 / 11 }])

  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-hybrid-branches-"))
  const deps = createLocalDeps(dataDir)
  const objectStore = deps.objectStore as LocalObjectStore
  await objectStore.putText("lexical-index/latest.json", JSON.stringify({ signature: "stale", objectKey: "lexical-index/stale.json" }))
  await objectStore.putText("documents/active/source.txt", "休暇申請は3日前までです。")
  await objectStore.putText("documents/expired/source.txt", "期限切れ資料です。")
  await objectStore.putText("documents/excluded/source.txt", "品質除外資料です。")
  await objectStore.putText("manifests/active.json", JSON.stringify({
    documentId: "active",
    fileName: "active.md",
    sourceObjectKey: "documents/active/source.txt",
    manifestObjectKey: "manifests/active.json",
    vectorKeys: ["active-chunk-0000"],
    evidenceVectorKeys: ["active-chunk-0000"],
    memoryVectorKeys: [],
    chunkCount: 1,
    memoryCardCount: 0,
    createdAt: "2026-05-01T00:00:00.000Z",
    lifecycleStatus: "active",
    metadata: {
      tenantId: "tenant-a",
      scopeType: "chat",
      temporaryScopeId: "tmp-1",
      expiresAt: "2999-01-01T00:00:00.000Z",
      allowedUsers: ["user-1"],
      aliases: { PTO: ["休暇"] }
    },
    chunks: [{ id: "chunk-0000", text: "休暇申請は3日前までです。" }]
  }))
  await objectStore.putText("manifests/expired.json", JSON.stringify({
    documentId: "expired",
    fileName: "expired.md",
    sourceObjectKey: "documents/expired/source.txt",
    manifestObjectKey: "manifests/expired.json",
    vectorKeys: ["expired-chunk-0000"],
    chunkCount: 1,
    memoryCardCount: 0,
    createdAt: "2026-05-01T00:00:00.000Z",
    lifecycleStatus: "active",
    metadata: { expiresAt: "2000-01-01T00:00:00.000Z" },
    chunks: [{ id: "chunk-0000", text: "期限切れ資料です。" }]
  }))
  await objectStore.putText("manifests/excluded.json", JSON.stringify({
    documentId: "excluded",
    fileName: "excluded.md",
    sourceObjectKey: "documents/excluded/source.txt",
    manifestObjectKey: "manifests/excluded.json",
    vectorKeys: ["excluded-chunk-0000"],
    chunkCount: 1,
    memoryCardCount: 0,
    createdAt: "2026-05-01T00:00:00.000Z",
    lifecycleStatus: "active",
    metadata: {
      tenantId: "tenant-a",
      scopeType: "chat",
      temporaryScopeId: "tmp-1",
      allowedUsers: ["user-1"]
    },
    qualityProfile: { ragEligibility: "excluded", verificationStatus: "verified" },
    chunks: [{ id: "chunk-0000", text: "品質除外資料です。" }]
  }))

  const originalGetText = objectStore.getText.bind(objectStore)
  objectStore.getText = async (key: string) => {
    if (key.endsWith("lexical-index/latest.json")) throw new Error("cache timeout")
    return originalGetText(key)
  }
  await assert.rejects(() => getLexicalIndex(
    deps,
    { userId: "user-1", email: "user@example.com", tenantId: "tenant-a", accountStatus: "active", cognitoGroups: ["CHAT_USER"] },
    { tenantId: "tenant-a" },
    { mode: "temporary", temporaryScopeId: "tmp-1", includeTemporary: true }
  ), /mandatory guard outcomes were not observed/)
  objectStore.getText = originalGetText
  const index = await getLexicalIndex(
    deps,
    { userId: "user-1", email: "user@example.com", tenantId: "tenant-a", accountStatus: "active", cognitoGroups: ["CHAT_USER"] },
    { tenantId: "tenant-a" },
    { mode: "temporary", temporaryScopeId: "tmp-1", includeTemporary: true }
  )
  assert.equal(index.docs.length, 1)
  assert.equal(index.docs[0]?.documentId, "active")
  assert.equal(index.diagnostics?.cache, "built")
  assert.equal(index.diagnostics?.degradationDecision, undefined)
  assert.match(index.aliasVersion, /^alias:/)

  const memoryIndex = await getLexicalIndex(
    deps,
    { userId: "user-1", email: "user@example.com", tenantId: "tenant-a", accountStatus: "active", cognitoGroups: ["CHAT_USER"] },
    { tenantId: "tenant-a" },
    { mode: "temporary", temporaryScopeId: "tmp-1", includeTemporary: true }
  )
  assert.equal(memoryIndex.diagnostics?.cache, "memory")
  assert.equal(memoryIndex.diagnostics?.degradationDecision, undefined)

  const wrongConversationIndex = await getLexicalIndex(
    deps,
    { userId: "user-1", email: "user@example.com", tenantId: "tenant-a", accountStatus: "active", cognitoGroups: ["CHAT_USER"] },
    { tenantId: "tenant-a" },
    { mode: "temporary", temporaryScopeId: "tmp-other-conversation", includeTemporary: true }
  )
  assert.equal(wrongConversationIndex.docs.length, 0)

  const wrongOwnerIndex = await getLexicalIndex(
    deps,
    { userId: "user-2", email: "other@example.com", tenantId: "tenant-a", accountStatus: "active", cognitoGroups: ["CHAT_USER"] },
    { tenantId: "tenant-a" },
    { mode: "temporary", temporaryScopeId: "tmp-1", includeTemporary: true }
  )
  assert.equal(wrongOwnerIndex.docs.length, 0)

  const semanticDeps = {
    ...deps,
    evidenceVectorStore: {
      put: async () => undefined,
      delete: async () => undefined,
      query: async () => [
        {
          key: "excluded-semantic",
          score: 0.95,
          metadata: {
            kind: "chunk",
            documentId: "excluded",
            fileName: "excluded.md",
            chunkId: "chunk-0000",
            text: "quality excluded should be hidden",
            createdAt: "2026-05-01T00:00:00.000Z",
            lifecycleStatus: "active",
            ragEligibility: "excluded",
            scopeType: "chat",
            allowedUsers: ["user@example.com"],
            tenantId: "tenant-a"
          }
        },
        {
          key: "semantic-only",
          score: 0.8,
          metadata: {
            kind: "chunk",
            documentId: "active",
            fileName: "active.md",
            chunkId: "chunk-0000",
            text: "休暇申請は3日前までです。",
            createdAt: "2026-05-01T00:00:00.000Z",
            lifecycleStatus: "active",
            scopeType: "chat",
            allowedUsers: ["user@example.com"],
            tenantId: "tenant-a",
            internalSecret: "hidden"
          }
        },
        {
          key: "staging",
          score: 0.9,
          metadata: {
            kind: "chunk",
            documentId: "active",
            fileName: "active.md",
            chunkId: "chunk-0001",
            text: "staging should be hidden",
            createdAt: "2026-05-01T00:00:00.000Z",
            lifecycleStatus: "staging"
          }
        },
        {
          key: "missing-manifest",
          score: 0.7,
          metadata: {
            kind: "chunk",
            documentId: "missing",
            fileName: "missing.md",
            chunkId: "chunk-0000",
            text: "missing manifest should be hidden",
            createdAt: "2026-05-01T00:00:00.000Z"
          }
        }
      ]
    }
  } as unknown as Dependencies
  const semanticOnly = await searchRag(
    semanticDeps,
    { query: "休暇", topK: 5, lexicalTopK: 0, semanticTopK: 5, semanticVector: [1, 0], filters: { tenantId: "tenant-a" }, scope: { mode: "temporary", temporaryScopeId: "tmp-1", includeTemporary: true } },
    { userId: "user-1", email: "user@example.com", tenantId: "tenant-a", accountStatus: "active", cognitoGroups: ["CHAT_USER"] }
  )
  assert.equal(semanticOnly.results.length, 1)
  assert.equal(semanticOnly.results[0]?.id, "semantic-only")
  assert.deepEqual(semanticOnly.results[0]?.sources, ["semantic"])
  assert.equal(semanticOnly.results[0]?.metadata, undefined)
})

test("service search applies ACL and metadata filters across lexical and vector results", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-hybrid-search-"))
  const service = new MemoRagService(createLocalDeps(dataDir))

  await service.ingest({
    fileName: "group-a-policy.md",
    text: "申請承認ワークフローの確認条件は責任者承認です。approval policy.",
    skipMemory: true,
    metadata: {
      tenantId: "tenant-a",
      source: "notion",
      docType: "policy",
      department: "hr",
      aclGroup: "GROUP_A",
      aclGroups: ["GROUP_A"],
      allowedUsers: ["user-1"],
      privateToUserId: "user-1",
      internalProjectCode: "confidential-project-x",
      searchAliases: {
        pto: ["approval"]
      }
    }
  })
  await service.ingest({
    fileName: "group-b-policy.md",
    text: "利用申請の修正条件は担当者の確認です。correction policy.",
    skipMemory: true,
    metadata: {
      tenantId: "tenant-a",
      source: "confluence",
      docType: "policy",
      aclGroup: "GROUP_B",
      allowedUsers: ["user-2"]
    }
  })
  const groupAUser = user(["CHAT_USER", "GROUP_A"])
  const groupASearch = await service.search({ query: "policy approval", topK: 10, filters: { tenantId: "tenant-a", source: "notion" } }, groupAUser)
  assert.equal(groupASearch.results.length, 1)
  assert.equal(groupASearch.results[0]?.fileName, "group-a-policy.md")
  assert.deepEqual(groupASearch.results[0]?.sources.sort(), ["lexical", "semantic"])
  assert.equal(groupASearch.diagnostics.profileVersion, "1")
  assert.equal(typeof groupASearch.diagnostics.lexicalSemanticOverlap, "number")
  assert.ok(groupASearch.diagnostics.scoreDistribution.top !== null)
  assert.deepEqual(groupASearch.results[0]?.metadata, {
    source: "notion",
    docType: "policy",
    department: "hr"
  })

  const aliasSearch = await service.search({ query: "pto", topK: 10, filters: { tenantId: "tenant-a", source: "notion" } }, groupAUser)
  assert.equal(aliasSearch.results[0]?.fileName, "group-a-policy.md")
  assert.match(aliasSearch.diagnostics.indexVersion, /^lexical:[a-f0-9]{8}$/)
  assert.match(aliasSearch.diagnostics.aliasVersion, /^alias:[a-f0-9]{8}$/)
  const aliasPayload = JSON.stringify({ results: aliasSearch.results, diagnostics: aliasSearch.diagnostics })
  assert.equal(aliasPayload.includes("pto"), false)
  assert.equal(aliasPayload.includes("confidential-project-x"), false)
  assert.equal(aliasPayload.includes("allowedUsers"), false)

  const semanticOnlySearch = await service.search({ query: "policy approval", topK: 10, lexicalTopK: 0, filters: { tenantId: "tenant-a", source: "notion" } }, groupAUser)
  assert.equal(semanticOnlySearch.results[0]?.fileName, "group-a-policy.md")
  assert.equal(semanticOnlySearch.diagnostics.lexicalCount, 0)
  assert.ok(semanticOnlySearch.diagnostics.semanticCount > 0)

  const lexicalOnlySearch = await service.search({ query: "policy approval", topK: 10, semanticTopK: 0, filters: { tenantId: "tenant-a", source: "notion" } }, groupAUser)
  assert.equal(lexicalOnlySearch.results[0]?.fileName, "group-a-policy.md")
  assert.ok(lexicalOnlySearch.diagnostics.lexicalCount > 0)
  assert.equal(lexicalOnlySearch.diagnostics.semanticCount, 0)

  const groupBOnlySearch = await service.search({ query: "申請承認", topK: 10 }, {
    userId: "user-2",
    email: "user-2@example.com",
    tenantId: "tenant-a",
    accountStatus: "active",
    cognitoGroups: ["CHAT_USER", "GROUP_B"]
  })
  assert.equal(groupBOnlySearch.results.some((result) => result.fileName === "group-a-policy.md"), false)
})

test("service search denies group-scoped manifests to non-members without legacy ACLs", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-group-scope-search-"))
  const deps = createLocalDeps(dataDir)
  const service = new MemoRagService(deps)
  const owner: AppUser = { userId: "owner-1", email: "owner@example.com", tenantId: "tenant-a", accountStatus: "active", cognitoGroups: ["RAG_GROUP_MANAGER"] }
  const member: AppUser = { userId: "member-1", email: "member@example.com", tenantId: "tenant-a", accountStatus: "active", cognitoGroups: ["CHAT_USER"] }
  const outsider: AppUser = { userId: "outsider-1", email: "outsider@example.com", tenantId: "tenant-a", accountStatus: "active", cognitoGroups: ["CHAT_USER"] }
  const group = await service.createDocumentGroup(owner, {
    name: "Private search group"
  })
  const policyId = `policy-${group.groupId}`
  await deps.documentGroupStore.update(group.tenantId, group.groupId, { hasExplicitPolicy: true, policyId })
  await deps.folderPolicyStore.save(policy(policyId, group.groupId, [
    { principalType: "user", principalId: owner.userId, permissionLevel: "full" },
    { principalType: "user", principalId: member.userId, permissionLevel: "readOnly" }
  ]))
  const folderPermissions = new FolderPermissionService(deps)
  assert.equal(await folderPermissions.resolveEffectiveFolderPermission(owner, group.groupId), "full")
  assert.equal(await folderPermissions.resolveEffectiveFolderPermission(member, group.groupId), "readOnly")
  assert.equal(await folderPermissions.resolveEffectiveFolderPermission(outsider, group.groupId), "none")
  const manifest = await service.ingest({
    fileName: "group-secret.md",
    text: "TOPSECRET dragonfruit launch plan is restricted to the private group.",
    skipMemory: true,
    metadata: {
      scopeType: "group",
      ownerUserId: owner.userId,
      groupIds: [group.groupId]
    }
  })
  assert.equal(manifest.metadata?.tenantId, "tenant-a")
  assert.deepEqual(manifest.metadata?.groupIds, [group.groupId])

  const outsiderSearch = await service.search({ query: "dragonfruit launch", topK: 10 }, outsider)
  assert.equal(outsiderSearch.results.some((result) => result.fileName === "group-secret.md"), false)

  const memberSearch = await service.search({ query: "dragonfruit launch", topK: 10 }, member)
  assert.equal(memberSearch.results[0]?.fileName, "group-secret.md")
})

test("search removes folder policy documents immediately after group membership revocation", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-folder-policy-search-"))
  const deps = createLocalDeps(dataDir)
  const objectStore = deps.objectStore as LocalObjectStore
  const member: AppUser = { userId: "member-1", email: "member@example.com", tenantId: "tenant-a", accountStatus: "active", cognitoGroups: ["CHAT_USER"] }

  await deps.userGroupStore.save(userGroup("team-a"))
  await deps.groupMembershipStore.save(membership("team-a", "user", member.userId, "full"))
  await deps.documentGroupStore.create(folder("folder-secret", "/secret", { hasExplicitPolicy: true, policyId: "policy-secret" }))
  await deps.folderPolicyStore.save(policy("policy-secret", "folder-secret", [
    { principalType: "user", principalId: "owner-1", permissionLevel: "full" },
    { principalType: "group", principalId: "team-a", permissionLevel: "readOnly" }
  ]))
  await objectStore.putText("documents/folder-policy-secret/source.txt", "kiwifruit launch approval requires folder policy access.")
  await objectStore.putText("manifests/folder-policy-secret.json", JSON.stringify({
    documentId: "folder-policy-secret",
    fileName: "folder-policy-secret.md",
    sourceObjectKey: "documents/folder-policy-secret/source.txt",
    manifestObjectKey: "manifests/folder-policy-secret.json",
    vectorKeys: ["folder-policy-secret-chunk-0000"],
    evidenceVectorKeys: ["folder-policy-secret-chunk-0000"],
    memoryVectorKeys: [],
    chunkCount: 1,
    memoryCardCount: 0,
    createdAt: "2026-05-17T00:00:00.000Z",
    lifecycleStatus: "active",
    metadata: {
      scopeType: "group",
      ownerUserId: "owner-1",
      groupIds: ["folder-secret"],
      tenantId: "tenant-a"
    }
  }))

  const allowed = await searchRag(deps, { query: "kiwifruit launch", topK: 10, lexicalTopK: 10, semanticTopK: 0 }, member)
  assert.equal(allowed.results[0]?.fileName, "folder-policy-secret.md")

  await deps.groupMembershipStore.delete("tenant-a", "team-a", "user", member.userId)
  const revoked = await searchRag(deps, { query: "kiwifruit launch", topK: 10, lexicalTopK: 10, semanticTopK: 0 }, member)
  assert.equal(revoked.results.some((result) => result.fileName === "folder-policy-secret.md"), false)
  assert.equal(revoked.diagnostics.index?.visibleManifestCount, 0)

  const semanticDeps = {
    ...deps,
    evidenceVectorStore: {
      ...deps.evidenceVectorStore,
      query: async () => [
        {
          key: "folder-policy-secret-chunk-0000",
          score: 0.99,
          metadata: {
            kind: "chunk",
            documentId: "folder-policy-secret",
            fileName: "folder-policy-secret.md",
            chunkId: "chunk-0000",
            text: "kiwifruit launch approval requires folder policy access.",
            createdAt: "2026-05-17T00:00:00.000Z",
            lifecycleStatus: "active",
            scopeType: "group",
            groupIds: ["folder-secret"],
            ownerUserId: member.userId,
            tenantId: "tenant-a"
          }
        }
      ]
    }
  } as unknown as Dependencies
  const semanticRevoked = await searchRag(semanticDeps, {
    query: "kiwifruit launch",
    topK: 10,
    lexicalTopK: 0,
    semanticTopK: 5,
    semanticVector: [1, 0]
  }, member)
  assert.equal(semanticRevoked.results.some((result) => result.fileName === "folder-policy-secret.md"), false)
  assert.equal(semanticRevoked.diagnostics.semanticCount, 0)
})

test("direct grants require folder scope permission and an ordinary deny overrides both search allow paths", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-direct-share-scope-"))
  const deps = createLocalDeps(dataDir)
  const objectStore = deps.objectStore as LocalObjectStore
  const reader: AppUser = { userId: "reader-1", email: "reader@example.com", tenantId: "tenant-a", accountStatus: "active", cognitoGroups: ["CHAT_USER"] }
  const manager: AppUser = { userId: "manager-1", email: "manager@example.com", tenantId: "tenant-a", accountStatus: "active", cognitoGroups: ["RAG_GROUP_MANAGER"] }

  await deps.documentGroupStore.create(folder("folder-a", "/folder-a", { hasExplicitPolicy: true, policyId: "policy-folder-a" }))
  await deps.folderPolicyStore.save(policy("policy-folder-a", "folder-a", [
    { principalType: "user", principalId: "owner-1", permissionLevel: "full" }
  ]))
  await putFolderPolicySearchManifest(objectStore, {
    documentId: "direct-shared-doc",
    fileName: "direct-shared-doc.md",
    text: "nectarine direct shared scope boundary content.",
    metadata: {
      scopeType: "folder",
      folderId: "folder-a",
      tenantId: "tenant-a"
    }
  })
  const manifest = JSON.parse(await objectStore.getText("manifests/direct-shared-doc.json"))
  await new DocumentPermissionService(deps).replaceDocumentShareGrants(manager, manifest, [
    { principalType: "user", principalId: reader.userId, permissionLevel: "readOnly" }
  ], "direct read for all and document scopes")

  const allScope = await searchRag(deps, {
    query: "nectarine direct",
    topK: 10,
    lexicalTopK: 10,
    semanticTopK: 0
  }, reader)
  assert.equal(allScope.results[0]?.fileName, "direct-shared-doc.md")

  const folderScopeWithoutFolderPermission = await searchRag(deps, {
    query: "nectarine direct",
    topK: 10,
    lexicalTopK: 10,
    semanticTopK: 0,
    scope: { mode: "groups", groupIds: ["folder-a"] }
  }, reader)
  assert.equal(folderScopeWithoutFolderPermission.results.some((result) => result.fileName === "direct-shared-doc.md"), false)
  assert.equal(folderScopeWithoutFolderPermission.diagnostics.index?.visibleManifestCount, 0)

  const documentScope = await searchRag(deps, {
    query: "nectarine direct",
    topK: 10,
    lexicalTopK: 10,
    semanticTopK: 0,
    scope: { mode: "documents", documentIds: ["direct-shared-doc"] }
  }, reader)
  assert.equal(documentScope.results[0]?.fileName, "direct-shared-doc.md")

  await new DocumentPermissionService(deps).replaceDocumentShareGrants(manager, manifest, [
    { principalType: "user", principalId: reader.userId, permissionLevel: "deny" }
  ], "ordinary deny overrides direct and folder allow paths")
  const explicitlyDenied = await searchRag(deps, {
    query: "nectarine direct",
    topK: 10,
    lexicalTopK: 10,
    semanticTopK: 0
  }, reader)
  assert.equal(explicitlyDenied.results.some((result) => result.fileName === "direct-shared-doc.md"), false)

  await deps.folderPolicyStore.save(policy("policy-folder-a", "folder-a", [
    { principalType: "user", principalId: "owner-1", permissionLevel: "full" },
    { principalType: "user", principalId: reader.userId, permissionLevel: "readOnly" }
  ]))
  const folderScopeWithFolderPermission = await searchRag(deps, {
    query: "nectarine direct",
    topK: 10,
    lexicalTopK: 10,
    semanticTopK: 0,
    scope: { mode: "groups", groupIds: ["folder-a"] }
  }, reader)
  assert.equal(folderScopeWithFolderPermission.results.some((result) => result.fileName === "direct-shared-doc.md"), false)
})

test("folder-scoped search includes manifests that use folderId metadata", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-folder-id-scope-include-"))
  const deps = createLocalDeps(dataDir)
  const objectStore = deps.objectStore as LocalObjectStore
  const member: AppUser = { userId: "member-1", email: "member@example.com", tenantId: "tenant-a", accountStatus: "active", cognitoGroups: ["CHAT_USER"] }

  await deps.documentGroupStore.create(folder("folder-secret", "/secret", { hasExplicitPolicy: true, policyId: "policy-secret" }))
  await deps.folderPolicyStore.save(policy("policy-secret", "folder-secret", [
    { principalType: "user", principalId: member.userId, permissionLevel: "readOnly" }
  ]))
  await putFolderPolicySearchManifest(objectStore, {
    documentId: "folder-policy-secret-folder-id",
    text: "kiwifruit launch approval requires folder policy access.",
    metadata: {
      scopeType: "folder",
      folderId: "folder-secret",
      tenantId: "tenant-a"
    }
  })

  const result = await searchRag(deps, {
    query: "kiwifruit launch",
    topK: 10,
    lexicalTopK: 10,
    semanticTopK: 0,
    scope: { mode: "groups", groupIds: ["folder-secret"] }
  }, member)

  assert.equal(result.results[0]?.fileName, "folder-policy-secret.md")
})

test("folder-scoped search includes manifests that use folderIds metadata", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-folder-ids-scope-include-"))
  const deps = createLocalDeps(dataDir)
  const objectStore = deps.objectStore as LocalObjectStore
  const member: AppUser = { userId: "member-1", email: "member@example.com", tenantId: "tenant-a", accountStatus: "active", cognitoGroups: ["CHAT_USER"] }

  await deps.documentGroupStore.create(folder("folder-secret", "/secret", { hasExplicitPolicy: true, policyId: "policy-secret" }))
  await deps.folderPolicyStore.save(policy("policy-secret", "folder-secret", [
    { principalType: "user", principalId: member.userId, permissionLevel: "full" }
  ]))
  await putFolderPolicySearchManifest(objectStore, {
    documentId: "folder-policy-secret-folder-ids",
    text: "kiwifruit launch approval requires folder policy access.",
    metadata: {
      scopeType: "folder",
      folderIds: ["folder-secret"],
      tenantId: "tenant-a"
    }
  })

  const result = await searchRag(deps, {
    query: "kiwifruit launch",
    topK: 10,
    lexicalTopK: 10,
    semanticTopK: 0,
    scope: { mode: "groups", groupIds: ["folder-secret"] }
  }, member)

  assert.equal(result.results[0]?.fileName, "folder-policy-secret.md")
})

test("folder-scoped search excludes folderId manifests outside requested scope", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-folder-id-scope-exclude-"))
  const deps = createLocalDeps(dataDir)
  const objectStore = deps.objectStore as LocalObjectStore
  const member: AppUser = { userId: "member-1", email: "member@example.com", tenantId: "tenant-a", accountStatus: "active", cognitoGroups: ["CHAT_USER"] }

  await deps.documentGroupStore.create(folder("folder-secret", "/secret", { hasExplicitPolicy: true, policyId: "policy-secret" }))
  await deps.folderPolicyStore.save(policy("policy-secret", "folder-secret", [
    { principalType: "user", principalId: member.userId, permissionLevel: "readOnly" }
  ]))
  await putFolderPolicySearchManifest(objectStore, {
    documentId: "folder-policy-secret-folder-id-outside",
    text: "kiwifruit launch approval requires folder policy access.",
    metadata: {
      scopeType: "folder",
      folderId: "folder-secret",
      tenantId: "tenant-a"
    }
  })

  const result = await searchRag(deps, {
    query: "kiwifruit launch",
    topK: 10,
    lexicalTopK: 10,
    semanticTopK: 0,
    scope: { mode: "groups", groupIds: ["other-folder"] }
  }, member)

  assert.equal(result.results.some((searchResult) => searchResult.fileName === "folder-policy-secret.md"), false)
  assert.equal(result.diagnostics.index?.visibleManifestCount, 0)
})

test("semantic-only search includes folderId metadata when requested folder scope matches", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-folder-id-semantic-scope-"))
  const deps = createLocalDeps(dataDir)
  const objectStore = deps.objectStore as LocalObjectStore
  const member: AppUser = { userId: "member-1", email: "member@example.com", tenantId: "tenant-a", accountStatus: "active", cognitoGroups: ["CHAT_USER"] }

  await deps.documentGroupStore.create(folder("folder-secret", "/secret", { hasExplicitPolicy: true, policyId: "policy-secret" }))
  await deps.folderPolicyStore.save(policy("policy-secret", "folder-secret", [
    { principalType: "user", principalId: member.userId, permissionLevel: "readOnly" }
  ]))
  await putFolderPolicySearchManifest(objectStore, {
    documentId: "folder-policy-secret-folder-id-semantic",
    text: "kiwifruit launch approval requires folder policy access.",
    metadata: {
      scopeType: "folder",
      folderId: "folder-secret",
      tenantId: "tenant-a"
    }
  })

  const semanticDeps = {
    ...deps,
    evidenceVectorStore: {
      ...deps.evidenceVectorStore,
      query: async () => [
        {
          key: "folder-policy-secret-folder-id-semantic-chunk-0000",
          score: 0.99,
          metadata: {
            kind: "chunk",
            documentId: "folder-policy-secret-folder-id-semantic",
            fileName: "folder-policy-secret.md",
            chunkId: "chunk-0000",
            text: "kiwifruit launch approval requires folder policy access.",
            createdAt: "2026-05-20T00:00:00.000Z",
            lifecycleStatus: "active",
            tenantId: "tenant-a"
          }
        }
      ]
    }
  } as unknown as Dependencies

  const result = await searchRag(semanticDeps, {
    query: "kiwifruit launch",
    topK: 10,
    lexicalTopK: 0,
    semanticTopK: 5,
    semanticVector: [1, 0],
    scope: { mode: "groups", groupIds: ["folder-secret"] }
  }, member)

  assert.ok(result.diagnostics.semanticCount > 0)
  assert.equal(result.results[0]?.fileName, "folder-policy-secret.md")
})

test("search does not expose child legacy explicit private folder under parent FolderPolicy", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-legacy-explicit-child-search-"))
  const deps = createLocalDeps(dataDir)
  const objectStore = deps.objectStore as LocalObjectStore
  const reader: AppUser = { userId: "reader-1", email: "reader-1@example.com", tenantId: "tenant-a", accountStatus: "active", cognitoGroups: ["CHAT_USER"] }

  await deps.documentGroupStore.create(folder("parent", "/parent", { hasExplicitPolicy: true, policyId: "policy-parent" }))
  await deps.folderPolicyStore.save(policy("policy-parent", "parent", [
    { principalType: "user", principalId: "owner-1", permissionLevel: "full" },
    { principalType: "user", principalId: "reader-1", permissionLevel: "readOnly" }
  ]))
  await deps.documentGroupStore.create(folder("child-private", "/parent/child-private", {
    parentGroupId: "parent",
    hasExplicitPolicy: false,
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: ["owner-1"]
  }))
  await putFolderPolicySearchManifest(objectStore, {
    documentId: "child-private-doc",
    fileName: "child-private.md",
    text: "papaya private child policy must not inherit parent folder policy.",
    metadata: {
      scopeType: "folder",
      folderId: "child-private",
      tenantId: "tenant-a"
    }
  })

  const result = await searchRag(deps, {
    query: "papaya private child",
    topK: 10,
    lexicalTopK: 10,
    semanticTopK: 0
  }, reader)

  assert.equal(result.results.some((searchResult) => searchResult.fileName === "child-private.md"), false)
  assert.equal(result.diagnostics.index?.visibleManifestCount, 0)
})

test("service search publishes and reuses immutable lexical index artifacts", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-lexical-artifact-"))
  const objectStore = new LocalObjectStore(dataDir)
  const service = new MemoRagService({ ...createLocalDeps(dataDir), objectStore })

  const manifest = await service.ingest({
    fileName: "policy.md",
    text: "申請承認ワークフローの確認条件は責任者承認です。approval policy.",
    skipMemory: true,
    metadata: { tenantId: "tenant-a", ownerUserId: "user-1", aclGroup: "GROUP_A", allowedUsers: ["user-1"] }
  })
  assert.equal(manifest.traceId, `ingest:${manifest.documentId}:${manifest.documentVersion}`)
  assert.equal(manifest.replayVersionManifest?.sourceSnapshots[0]?.documentVersion, manifest.documentVersion)
  assert.ok(manifest.replayVersionManifest?.missingVersions.includes("modelVersions.answer"))

  const first = await service.search({ query: "approval", topK: 10 }, user(["GROUP_A"]))
  assert.ok(first.results.length >= 1)
  assert.match(first.diagnostics.indexVersion, /^lexical:[a-f0-9]{8}$/)
  assert.match(first.diagnostics.traceId, /^search_/)
  assert.equal(first.results[0]?.documentVersion, manifest.documentVersion)
  assert.equal(first.diagnostics.replayVersionManifest.sourceSnapshots[0]?.documentVersion, manifest.documentVersion)
  assert.equal(first.diagnostics.replayVersionManifest.parserVersion, manifest.sourceExtractorVersion)
  assert.equal(first.diagnostics.replayVersionManifest.ocrVersion, null)
  assert.ok(first.diagnostics.replayVersionManifest.missingVersions.includes("ocrVersion"))
  assert.equal(first.diagnostics.replayVersionManifest.chunkerVersion, manifest.chunkerVersion)
  assert.equal(first.diagnostics.replayVersionManifest.chunkingPolicyVersion, manifest.chunkingPolicy?.version)
  assert.equal(first.diagnostics.replayVersionManifest.promptVersion, manifest.pipelineVersions?.promptVersion)
  assert.equal(first.diagnostics.replayVersionManifest.pipelineVersion, manifest.pipelineVersions?.chatOrchestrationWorkflowVersion)
  assert.equal(first.diagnostics.replayVersionManifest.sourceSnapshots[0]?.ingestTraceId, manifest.traceId)
  assert.ok(first.diagnostics.replayVersionManifest.missingVersions.includes("modelVersions.answer"))

  const traceKeys = await objectStore.listKeys("debug-runs/")
  const traceKey = traceKeys.find((key) => key.endsWith(`/${first.diagnostics.traceId}.json`))
  assert.ok(traceKey)
  const trace = JSON.parse(await objectStore.getText(traceKey)) as {
    runId?: string
    tenantPartitionId?: string
    actorPartitionId?: string
    requestTraceId?: string
    parentTraceIds?: string[]
    question?: string
    replayVersionManifest?: { indexVersion?: string; missingVersions?: string[] }
  }
  assert.equal(trace.runId, first.diagnostics.traceId)
  assert.equal(trace.requestTraceId, first.diagnostics.traceId)
  assert.deepEqual(trace.parentTraceIds, [manifest.traceId])
  assert.match(trace.tenantPartitionId ?? "", /^tenant:[a-f0-9]{24}$/)
  assert.match(trace.actorPartitionId ?? "", /^tenant:[a-f0-9]{24}$/)
  assert.match(trace.question ?? "", /^sha256:[a-f0-9]{64}$/)
  assert.equal(trace.replayVersionManifest?.indexVersion, first.diagnostics.indexVersion)

  const keys = await objectStore.listKeys("lexical-index/")
  assert.ok(keys.includes("lexical-index/latest.json"))
  assert.ok(keys.some((key) => /^lexical-index\/lexical_[a-f0-9]{8}\.json$/.test(key)))
  const latest = JSON.parse(await objectStore.getText("lexical-index/latest.json")) as { indexVersion?: string }
  assert.equal(latest.indexVersion, first.diagnostics.indexVersion)

  const second = await service.search({ query: "申請承認", topK: 10 }, user(["GROUP_A"]))
  assert.equal(second.diagnostics.indexVersion, first.diagnostics.indexVersion)
})

test("lexical index cache rebuilds from the active manifest when a folder move projection version changes", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-folder-move-lexical-index-"))
  const deps = createLocalDeps(dataDir)
  const service = new MemoRagService(deps)
  const manifest = await service.ingest({
    fileName: "folder-move.md",
    text: "Folder move lexical index reconciliation evidence.",
    skipMemory: true,
    metadata: {
      tenantId: "tenant-a",
      allowedUsers: ["user-1"],
      folderCanonicalPaths: ["/Old/Source"],
      folderPolicyRefs: ["old-policy"],
      folderProjectionVersion: "before-move"
    }
  })
  const before = await getLexicalIndex(deps, user([]))
  assert.deepEqual(before.docs[0]?.metadata?.folderCanonicalPaths, ["/Old/Source"])

  const stored = JSON.parse(await deps.objectStore.getText(manifest.manifestObjectKey)) as DocumentManifest
  await deps.objectStore.putText(manifest.manifestObjectKey, JSON.stringify({
    ...stored,
    metadata: {
      ...(stored.metadata ?? {}),
      folderCanonicalPaths: ["/Destination/Source"],
      folderPolicyRefs: ["destination-policy"],
      folderProjectionVersion: "folder-move-operation-1"
    }
  }, null, 2), "application/json")

  const after = await getLexicalIndex(deps, user([]))
  assert.notEqual(after.version, before.version)
  assert.deepEqual(after.docs[0]?.metadata?.folderCanonicalPaths, ["/Destination/Source"])
  assert.deepEqual(after.docs[0]?.metadata?.folderPolicyRefs, ["destination-policy"])
})

test("service search scopes benchmark corpus by suite metadata", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-benchmark-suite-search-"))
  const service = new MemoRagService(createLocalDeps(dataDir))
  const runner = user(["BENCHMARK_RUNNER"])

  await service.ingest({
    fileName: "handbook.md",
    text: "経費精算は申請から30日以内に行う必要があります。立替精算も同じ期限です。",
    skipMemory: true,
    metadata: {
      benchmarkSeed: true,
      benchmarkSuiteId: "standard-agent-v1",
      benchmarkSourceHash: "hash-a",
      benchmarkIngestSignature: "signature-a",
      benchmarkCorpusSkipMemory: true,
      benchmarkEmbeddingModelId: "api-default",
      aclGroups: ["BENCHMARK_RUNNER"],
      allowedUsers: [runner.userId],
      docType: "benchmark-corpus",
      lifecycleStatus: "active",
      source: "benchmark-runner",
      searchAliases: { "立替": ["経費精算"] }
    }
  })
  await service.ingest({
    fileName: "old-suite.pdf",
    text: "経費精算 期限 申請という語を大量に含むが、別 suite の古い benchmark corpus です。",
    skipMemory: true,
    metadata: {
      benchmarkSeed: true,
      benchmarkSuiteId: "allganize-rag-evaluation-ja-v1",
      benchmarkSourceHash: "hash-b",
      benchmarkIngestSignature: "signature-b",
      benchmarkCorpusSkipMemory: true,
      benchmarkEmbeddingModelId: "api-default",
      aclGroups: ["BENCHMARK_RUNNER"],
      docType: "benchmark-corpus",
      lifecycleStatus: "active",
      source: "benchmark-runner"
    }
  })

  const result = await service.search({
    query: "立替 申請",
    topK: 10,
    lexicalTopK: 80,
    semanticTopK: 0,
    filters: {
      source: "benchmark-runner",
      docType: "benchmark-corpus",
      benchmarkSuiteId: "standard-agent-v1"
    }
  }, runner)

  assert.equal(result.results[0]?.fileName, "handbook.md")
  assert.equal(result.results.some((item) => item.fileName === "old-suite.pdf"), false)
  assert.equal(result.diagnostics.index?.visibleManifestCount, 1)
  assert.equal(result.diagnostics.index?.indexedChunkCount, 1)
})

test("service search expands published reviewed aliases without returning alias details", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-published-alias-"))
  const service = new MemoRagService(createLocalDeps(dataDir))
  const manager = user(["RAG_GROUP_MANAGER"])

  await service.ingest({
    fileName: "vacation.md",
    text: "年次有給休暇の申請期限は取得日の3営業日前です。",
    skipMemory: true,
    metadata: { tenantId: "tenant-a", aclGroup: "GROUP_A", allowedUsers: ["user-1"] }
  })
  const alias = await service.createAlias(manager, {
    term: "pto",
    expansions: ["年次有給休暇"],
    scope: { tenantId: "tenant-a" }
  })
  await service.reviewAlias(manager, alias.aliasId, { decision: "approve" })
  await service.publishAliases(manager)

  const result = await service.search({ query: "pto", topK: 10, filters: { tenantId: "tenant-a" } }, user(["GROUP_A"]))
  assert.equal(result.results[0]?.fileName, "vacation.md")
  assert.match(result.diagnostics.aliasVersion, /^alias:[a-f0-9]{8}$/)
  const unfilteredResult = await service.search({ query: "pto", topK: 10 }, user(["GROUP_A"]))
  assert.equal(unfilteredResult.results[0]?.fileName, "vacation.md")
  const payload = JSON.stringify(result)
  assert.equal(payload.includes("pto"), true)
  assert.equal(payload.includes("年次有給休暇"), true)
  assert.equal(payload.includes("aliasId"), false)
  assert.equal(payload.includes("manager-1"), false)
})

function lexicalDoc(id: string, documentId: string, fileName: string, text: string) {
  return {
    id,
    documentId,
    fileName,
    chunkId: "chunk-0000",
    text,
    len: 0,
    createdAt: "2026-05-02T00:00:00.000Z"
  }
}

function createLocalDeps(dataDir: string): Dependencies {
  return {
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
    localTestIngestAdmissionContext: {
      mode: "local_test_fixture",
      fixtureId: "hybrid-search-test",
      tenantId: "tenant-a"
    }
  }
}

function user(cognitoGroups: string[]): AppUser {
  return {
    userId: "user-1",
    email: "user-1@example.com",
    tenantId: "tenant-a",
    accountStatus: "active",
    cognitoGroups: [...new Set(["CHAT_USER", ...cognitoGroups])]
  }
}

function folder(groupId: string, normalizedCanonicalPath: string, input: Partial<DocumentGroup> = {}): DocumentGroup {
  const name = normalizedCanonicalPath.split("/").filter(Boolean).at(-1) ?? groupId
  const adminPrincipalType = input.adminPrincipalType ?? "user"
  const adminPrincipalId = input.adminPrincipalId ?? "owner-1"
  const ownerUserId = input.ownerUserId ?? "owner-1"
  return {
    groupId,
    schemaVersion: 2,
    itemType: "documentGroup",
    tenantId: "tenant-a",
    adminPrincipalType,
    adminPrincipalId,
    name,
    normalizedName: name,
    canonicalPath: normalizedCanonicalPath,
    normalizedCanonicalPath,
    adminPathPk: `tenant-a#${adminPrincipalType}#${adminPrincipalId}`,
    parentPathPk: `tenant-a#${adminPrincipalType}#${adminPrincipalId}#ROOT`,
    parentGroupId: input.parentGroupId,
    ancestorGroupIds: input.ancestorGroupIds ?? [],
    ownerUserId,
    visibility: "private",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: [ownerUserId],
    hasExplicitPolicy: input.hasExplicitPolicy,
    policyId: input.policyId,
    status: input.status ?? "active",
    createdBy: input.createdBy ?? ownerUserId,
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z"
  }
}

function policy(policyId: string, folderId: string, entries: FolderPolicy["entries"]): FolderPolicy {
  return {
    policyId,
    itemType: "folderPolicy",
    tenantId: "tenant-a",
    folderId,
    entries,
    createdBy: "owner-1",
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z"
  }
}

async function putFolderPolicySearchManifest(
  objectStore: LocalObjectStore,
  input: {
    documentId: string
    fileName?: string
    text: string
    metadata: Record<string, JsonValue>
  }
): Promise<void> {
  await objectStore.putText(`documents/${input.documentId}/source.txt`, input.text)
  await objectStore.putText(`manifests/${input.documentId}.json`, JSON.stringify({
    documentId: input.documentId,
    fileName: input.fileName ?? "folder-policy-secret.md",
    sourceObjectKey: `documents/${input.documentId}/source.txt`,
    manifestObjectKey: `manifests/${input.documentId}.json`,
    vectorKeys: [`${input.documentId}-chunk-0000`],
    evidenceVectorKeys: [`${input.documentId}-chunk-0000`],
    memoryVectorKeys: [],
    chunkCount: 1,
    memoryCardCount: 0,
    createdAt: "2026-05-20T00:00:00.000Z",
    lifecycleStatus: "active",
    metadata: input.metadata
  }))
}

function userGroup(groupId: string): UserGroup {
  return {
    groupId,
    itemType: "userGroup",
    tenantId: "tenant-a",
    name: groupId,
    type: "team",
    ancestorGroupIds: [],
    status: "active",
    createdBy: "owner-1",
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z"
  }
}

function membership(groupId: string, memberType: GroupMembership["memberType"], memberId: string, permissionLevel: GroupMembership["permissionLevel"]): GroupMembership {
  return {
    groupId,
    tenantId: "tenant-a",
    memberType,
    memberId,
    permissionLevel,
    source: "manual",
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z"
  }
}
