import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { promises as fs } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import type { AppUser } from "../../../../auth.js"
import { LocalObjectStore } from "../../../../adapters/local-object-store.js"
import type { ObjectStore, VersionedText } from "../../../../adapters/object-store.js"
import type { ServerManagedIdentity, VerifiedIdentityProvider } from "../../../../adapters/verified-identity-provider.js"
import type { SecurityMutationAuditDraft, SecurityMutationAuditIntent, SecurityMutationAuditOutboxPort, SecurityMutationResult } from "../../../../security/security-mutation-audit-outbox.js"
import type { DocumentManifest, RetrievedVector, VectorRecord } from "../../../../types.js"
import type { Dependencies } from "../../../../dependencies.js"
import { ApproveSourceGovernanceRequestSchema } from "../../../../schemas.js"
import { ObjectStoreSecurityMutationAuditOutbox } from "../../../../security/security-mutation-audit-outbox.js"
import { MemoRagService } from "../../../memorag-service.js"
import { currentEligibilitySnapshotFromAuthoritativeState } from "../../../_shared/security/current-rag-eligibility.js"
import type { RegisterRevocationCleanupInput } from "../../../_shared/security/revocation-cleanup-coordinator.js"
import { createVersionedReference } from "./source-admission.js"
import {
  SOURCE_GOVERNANCE_POLICY_VERSION,
  sourceGovernanceRestrictionStateVersion,
  SourceGovernanceApprovalService,
  SourceGovernanceConflictError,
  SourceGovernanceDeniedError,
  SourceGovernanceUnavailableError,
  SourceGovernanceValidationError,
  type ApproveSourceGovernanceInput,
  type SourceGovernancePublisher,
  type StagedSourceGovernancePublication,
  type VersionedSourceGovernanceRecord
} from "./source-governance-approval-service.js"

const actorSnapshot: AppUser = {
  userId: "reviewer-1",
  email: "reviewer@example.com",
  cognitoGroups: ["RAG_GROUP_MANAGER"],
  accountStatus: "active",
  tenantId: "tenant-1"
}

test("FR-068/086 approval uses current authority, CAS, audit intent, staged validation, and approved-only commit", async () => {
  const harness = createHarness()
  const initial = await harness.service.ensureInitialRecord(harness.source)
  const result = await harness.service.approve(actorSnapshot, harness.source, approvalInput(initial.version))

  assert.equal(result.record.status, "published")
  assert.equal(result.record.activeDocumentId, "candidate-1")
  assert.equal(result.record.approval?.approvedBy, actorSnapshot.userId)
  assert.equal(result.record.approval?.classification.level, "confidential")
  assert.deepEqual(result.record.approval?.usagePolicy.allowedPurposes, ["normal_rag"])
  assert.equal(result.record.approval?.qualityProfile.updatedBy, actorSnapshot.userId)
  assert.equal(harness.identity.calls, 2, "current identity must be resolved before staging and commit")
  assert.deepEqual(harness.publisher.phases, ["stage", "commit"])
  assert.equal(harness.publisher.statusObservedAtCommit, "approved")
  assert.deepEqual(harness.audit.results, ["success"])
  assert.equal(harness.audit.drafts[0]?.policyVersion, SOURCE_GOVERNANCE_POLICY_VERSION)
  assert.equal(harness.audit.drafts[0]?.operation, "source_governance.approve_publish")
  assert.ok(harness.events.indexOf("audit.prepare") < harness.events.indexOf("resource.authorize"))
  assert.ok(harness.events.indexOf("resource.authorize") < harness.events.indexOf("publisher.stage"))
  assert.ok(harness.events.lastIndexOf("resource.authorize") < harness.events.indexOf("publisher.commit"))
})

test("FR-068 approval rejects stale expectedVersion without staging and audits conflict", async () => {
  const harness = createHarness()
  await harness.service.ensureInitialRecord(harness.source)

  await assert.rejects(
    () => harness.service.approve(actorSnapshot, harness.source, approvalInput("stale-version")),
    SourceGovernanceConflictError
  )
  assert.deepEqual(harness.publisher.phases, [])
  assert.deepEqual(harness.audit.results, ["conflict"])
  assert.equal((await harness.service.ensureInitialRecord(harness.source)).record.status, "unreviewed")
})

test("FR-068 approval fails closed when the durable audit intent cannot be prepared", async () => {
  const harness = createHarness({ failAuditPrepare: true })
  const initial = await harness.service.ensureInitialRecord(harness.source)

  await assert.rejects(
    () => harness.service.approve(actorSnapshot, harness.source, approvalInput(initial.version)),
    SourceGovernanceUnavailableError
  )
  assert.deepEqual(harness.publisher.phases, [])
  assert.equal((await harness.service.ensureInitialRecord(harness.source)).record.status, "unreviewed")
})

test("FR-068 approval rechecks current role, tenant, and full resource permission", async (t) => {
  const cases: Array<{
    name: string
    identity?: Partial<ServerManagedIdentity>
    denyResource?: boolean
  }> = [
    { name: "role revoked", identity: { cognitoGroups: ["CHAT_USER"] } },
    { name: "account suspended", identity: { accountStatus: "suspended" } },
    { name: "cross tenant", identity: { tenantId: "tenant-2" } },
    { name: "target full permission revoked", denyResource: true }
  ]
  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      const harness = createHarness({ identities: [identity(scenario.identity)], denyResource: scenario.denyResource })
      const initial = await harness.service.ensureInitialRecord(harness.source)
      await assert.rejects(
        () => harness.service.approve(actorSnapshot, harness.source, approvalInput(initial.version)),
        SourceGovernanceDeniedError
      )
      assert.deepEqual(harness.publisher.phases, [])
      assert.deepEqual(harness.audit.results, ["denied"])
      assert.equal((await harness.service.ensureInitialRecord(harness.source)).record.status, "unreviewed")
    })
  }
})

test("FR-068 rejects incomplete or inconsistent explicit governance profiles before staging", async () => {
  const harness = createHarness()
  const initial = await harness.service.ensureInitialRecord(harness.source)
  const invalid = approvalInput(initial.version)
  invalid.usagePolicy.externalModelAllowed = true

  await assert.rejects(
    () => harness.service.approve(actorSnapshot, harness.source, invalid),
    SourceGovernanceValidationError
  )
  assert.deepEqual(harness.publisher.phases, [])
  assert.deepEqual(harness.audit.results, ["denied"])
})

test("FR-068 governance approval rejects every non-clean or unversioned malware verdict before staging", async (t) => {
  for (const malwareStatus of ["unknown", "pending", "infected", "failed", "timeout"] as const) {
    await t.test(malwareStatus, async () => {
      const harness = createHarness()
      const initial = await harness.service.ensureInitialRecord(harness.source)
      const valid = approvalInput(initial.version)
      const invalid = {
        ...valid,
        inspection: { ...valid.inspection, malwareStatus }
      } as unknown as ApproveSourceGovernanceInput

      await assert.rejects(
        () => harness.service.approve(actorSnapshot, harness.source, invalid),
        SourceGovernanceValidationError
      )
      assert.deepEqual(harness.publisher.phases, [])
      assert.deepEqual(harness.audit.results, ["denied"])
    })
  }

  const harness = createHarness()
  const initial = await harness.service.ensureInitialRecord(harness.source)
  const valid = approvalInput(initial.version)
  await assert.rejects(
    () => harness.service.approve(actorSnapshot, harness.source, {
      ...valid,
      inspection: { ...valid.inspection, malwareProfileVersion: "" }
    }),
    SourceGovernanceValidationError
  )
  assert.deepEqual(harness.publisher.phases, [])
  assert.deepEqual(harness.audit.results, ["denied"])
})

test("FR-068 approval API schema requires the canonical clean malware verdict and profile", () => {
  const valid = approvalInput("version-1")
  assert.equal(ApproveSourceGovernanceRequestSchema.safeParse(valid).success, true)

  assert.equal(ApproveSourceGovernanceRequestSchema.safeParse({
    ...valid,
    inspection: {
      status: valid.inspection.status,
      profileVersion: valid.inspection.profileVersion,
      malwareProfileVersion: valid.inspection.malwareProfileVersion
    }
  }).success, false)
  assert.equal(ApproveSourceGovernanceRequestSchema.safeParse({
    ...valid,
    inspection: { ...valid.inspection, malwareStatus: "pending" }
  }).success, false)
  assert.equal(ApproveSourceGovernanceRequestSchema.safeParse({
    ...valid,
    inspection: { ...valid.inspection, malwareProfileVersion: "" }
  }).success, false)
})

test("FR-068 staged publication failure leaves a non-active reconciliation record and failed audit", async () => {
  const harness = createHarness({ failStage: true })
  const initial = await harness.service.ensureInitialRecord(harness.source)

  await assert.rejects(
    () => harness.service.approve(actorSnapshot, harness.source, approvalInput(initial.version)),
    /stage fault/
  )
  const state = await loadState(harness.store)
  assert.equal(state.record.status, "reconciliation_required")
  assert.equal(state.record.lastFailureCode, "publication_failed")
  assert.deepEqual(harness.publisher.phases, ["stage"])
  assert.deepEqual(harness.audit.results, ["failed"])
})

test("FR-068 commit failure never reports published and records reconciliation", async () => {
  const harness = createHarness({ failCommit: true })
  const initial = await harness.service.ensureInitialRecord(harness.source)

  await assert.rejects(
    () => harness.service.approve(actorSnapshot, harness.source, approvalInput(initial.version)),
    /commit fault/
  )
  const state = await loadState(harness.store)
  assert.equal(state.record.status, "reconciliation_required")
  assert.equal(state.record.activeDocumentId, undefined)
  assert.deepEqual(harness.publisher.phases, ["stage", "commit"])
  assert.deepEqual(harness.audit.results, ["failed"])
})

test("FR-068 a staged candidate that does not preserve approved admission is never committed", async () => {
  const harness = createHarness({ tamperCandidate: true })
  const initial = await harness.service.ensureInitialRecord(harness.source)

  await assert.rejects(
    () => harness.service.approve(actorSnapshot, harness.source, approvalInput(initial.version)),
    SourceGovernanceUnavailableError
  )
  assert.equal((await loadState(harness.store)).record.status, "reconciliation_required")
  assert.deepEqual(harness.publisher.phases, ["stage"])
  assert.deepEqual(harness.audit.results, ["failed"])
})

test("FR-086 a committed mutation remains correlated by its durable pending intent when audit completion is transiently unavailable", async () => {
  const harness = createHarness({ failAuditComplete: true })
  const initial = await harness.service.ensureInitialRecord(harness.source)
  await assert.rejects(
    () => harness.service.approve(actorSnapshot, harness.source, approvalInput(initial.version)),
    SourceGovernanceUnavailableError
  )

  const state = await loadState(harness.store)
  assert.equal(state.record.status, "reconciliation_required")
  assert.equal(state.record.activeDocumentId, "candidate-1")
  assert.ok(state.record.auditIntentId)
  assert.equal(state.record.auditReconciliation?.intentId, state.record.auditIntentId)
  assert.equal(state.record.auditReconciliation?.result, "success")
  assert.equal(state.record.auditReconciliation?.resumeStatus, "published")
  assert.equal(harness.audit.completionAttempts, 1)
  assert.deepEqual(harness.audit.results, [])
  await assert.rejects(
    () => harness.service.approve(actorSnapshot, harness.source, approvalInput(state.version)),
    /previous source governance audit is still reconciling/i
  )
  assert.equal(harness.audit.drafts.length, 1, "a newer mutation must not overtake pending audit finalization")
})

test("FR-086 a non-success result is held in reconciliation when audit completion is unavailable", async () => {
  const harness = createHarness({ failAuditComplete: true })
  await harness.service.ensureInitialRecord(harness.source)

  await assert.rejects(
    () => harness.service.approve(actorSnapshot, harness.source, approvalInput("stale-version")),
    SourceGovernanceUnavailableError
  )

  const state = await loadState(harness.store)
  assert.equal(state.record.status, "reconciliation_required")
  assert.equal(state.record.auditReconciliation?.result, "conflict")
  assert.equal(state.record.auditReconciliation?.resumeStatus, "unreviewed")
  assert.equal(state.record.auditIntentId, state.record.auditReconciliation?.intentId)
  assert.deepEqual(state.record.auditReconciliation?.after, harness.audit.drafts[0]?.before)
  assert.deepEqual(harness.publisher.phases, [])
})

test("FR-090 current role revoke after staging prevents commit and records authorization reconciliation", async () => {
  const harness = createHarness({ identities: [identity(), identity({ cognitoGroups: ["CHAT_USER"] })] })
  const initial = await harness.service.ensureInitialRecord(harness.source)

  await assert.rejects(
    () => harness.service.approve(actorSnapshot, harness.source, approvalInput(initial.version)),
    SourceGovernanceDeniedError
  )
  const state = await loadState(harness.store)
  assert.equal(state.record.status, "reconciliation_required")
  assert.equal(state.record.lastFailureCode, "authorization_revoked")
  assert.deepEqual(harness.publisher.phases, ["stage"])
  assert.deepEqual(harness.audit.results, ["denied"])
})

test("FR-066 commits current purpose and quality deny state before cleanup and rejects stale mutation", async () => {
  const harness = createHarness({ recordCleanup: true })
  const initial = await harness.service.ensureInitialRecord(harness.source)
  const approval = approvalInput(initial.version)
  approval.usagePolicy.allowedPurposes.push("evaluation")
  approval.usagePolicy.evaluationAllowed = true
  const published = await harness.service.approve(actorSnapshot, harness.source, approval)
  const active = { ...harness.publisher.candidate!, lifecycleStatus: "active" as const }

  const evaluationRestricted = await harness.service.restrict(actorSnapshot, active, {
    expectedVersion: published.version,
    reason: "評価利用の承認を取り消す",
    deniedPurposes: ["evaluation"]
  })
  assert.equal(evaluationRestricted.record.status, "restricted")
  assert.deepEqual(evaluationRestricted.record.restriction?.deniedPurposes, ["evaluation"])
  assert.equal(evaluationRestricted.record.activeDocumentId, active.documentId)
  assert.equal(harness.audit.drafts.at(-1)?.operation, "source_governance.restrict")
  assert.equal(harness.audit.results.at(-1), "success")
  assert.equal(harness.cleanupRegistrations.length, 1)
  assert.equal(
    harness.cleanupRegistrations[0]?.authoritativeDenyVersion,
    sourceGovernanceRestrictionStateVersion(evaluationRestricted.record)
  )
  assert.deepEqual(harness.cleanupRegistrations[0]?.deniedPurposes, ["evaluation"])
  assert.deepEqual(
    harness.cleanupRegistrations[0]?.knownTargets?.map((target) => target.scope),
    ["evaluation_artifact"],
    "purpose-only revocation must preserve source and retrieval artifacts"
  )
  assert.ok(harness.events.indexOf("audit.prepare") < harness.events.indexOf("cleanup.register"))
  assert.ok(harness.events.indexOf("cleanup.register") < harness.events.lastIndexOf("audit.complete"))

  const normal = await currentEligibilitySnapshotFromAuthoritativeState({
    objectStore: harness.store,
    manifest: active,
    authorizationAllowed: true,
    qualityAllowed: true,
    purpose: "normal_answer"
  })
  const evaluation = await currentEligibilitySnapshotFromAuthoritativeState({
    objectStore: harness.store,
    manifest: active,
    authorizationAllowed: true,
    qualityAllowed: true,
    purpose: "benchmark_evaluation"
  })
  assert.equal(normal.usageAllowed, true, "an unrelated use purpose remains eligible")
  assert.equal(evaluation.usageAllowed, false, "the revoked purpose is denied from current state")

  const qualityRestricted = await harness.service.restrict(actorSnapshot, active, {
    expectedVersion: evaluationRestricted.version,
    reason: "品質承認を取り消す",
    dimensions: ["quality"]
  })
  const afterQualityRevoke = await currentEligibilitySnapshotFromAuthoritativeState({
    objectStore: harness.store,
    manifest: active,
    authorizationAllowed: true,
    qualityAllowed: true,
    purpose: "normal_answer"
  })
  assert.equal(afterQualityRevoke.qualityAllowed, false)
  assert.deepEqual(qualityRestricted.record.restriction?.deniedPurposes, ["evaluation"])
  assert.deepEqual(qualityRestricted.record.restriction?.dimensions, ["quality"])
  assert.equal(harness.cleanupRegistrations.length, 2)
  assert.equal(harness.cleanupRegistrations[1]?.trigger, "quality_restricted")
  assert.deepEqual(
    harness.cleanupRegistrations[1]?.knownTargets?.map((target) => target.scope),
    ["evaluation_artifact"],
    "quality-only revocation must retain the source for possible re-approval"
  )

  await assert.rejects(
    () => harness.service.restrict(actorSnapshot, active, {
      expectedVersion: published.version,
      reason: "stale writer",
      dimensions: ["classification"]
    }),
    SourceGovernanceConflictError
  )
  const current = await currentEligibilitySnapshotFromAuthoritativeState({
    objectStore: harness.store,
    manifest: active,
    authorizationAllowed: true,
    qualityAllowed: true,
    purpose: "normal_answer"
  })
  assert.equal(current.qualityAllowed, false, "a stale mutation cannot restore or replace the deny")
})

test("FR-066 mutable governance is fail closed when its authoritative registry is absent", async () => {
  const store = new VersionedMemoryObjectStore()
  const manifest = { ...sourceManifest(), lifecycleStatus: "active" as const }
  const denied = await currentEligibilitySnapshotFromAuthoritativeState({
    objectStore: store,
    manifest,
    authorizationAllowed: true,
    qualityAllowed: true,
    purpose: "normal_answer"
  })
  assert.equal(denied.classificationAllowed, false)
  assert.equal(denied.usageAllowed, false)
  assert.equal(denied.qualityAllowed, false)
  assert.equal(denied.lifecycleActive, false)

  const localFixture = await currentEligibilitySnapshotFromAuthoritativeState({
    objectStore: store,
    manifest,
    authorizationAllowed: true,
    qualityAllowed: true,
    purpose: "normal_answer",
    allowLocalTestFixture: true
  })
  assert.equal(localFixture.classificationAllowed, true)
  assert.equal(localFixture.usageAllowed, true)
})

test("FR-066 cleanup registration failure preserves the deny and marks durable reconciliation", async () => {
  const harness = createHarness({ recordCleanup: true, failCleanupRegistration: true })
  const initial = await harness.service.ensureInitialRecord(harness.source)
  const published = await harness.service.approve(actorSnapshot, harness.source, approvalInput(initial.version))
  const active = { ...harness.publisher.candidate!, lifecycleStatus: "active" as const }

  await assert.rejects(() => harness.service.restrict(actorSnapshot, active, {
    expectedVersion: published.version,
    reason: "分類上の利用停止",
    dimensions: ["classification"]
  }), SourceGovernanceUnavailableError)

  const state = await loadState(harness.store)
  assert.equal(state.record.status, "reconciliation_required")
  assert.equal(state.record.lastFailureCode, "revocation_cleanup_manifest_unavailable")
  assert.deepEqual(state.record.restriction?.dimensions, ["classification"])
  assert.equal(harness.audit.results.at(-1), "failed")
  const eligibility = await currentEligibilitySnapshotFromAuthoritativeState({
    objectStore: harness.store,
    manifest: active,
    authorizationAllowed: true,
    qualityAllowed: true,
    purpose: "normal_answer"
  })
  assert.equal(eligibility.classificationAllowed, false)
  assert.equal(eligibility.usageAllowed, false)
})

test("FR-068 production path re-ingests quarantine into a fenced candidate and publishes only the approved artifact", async (t) => {
  const root = await fs.mkdtemp(path.join(tmpdir(), "memorag-source-governance-"))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const objectStore = new LocalObjectStore(root)
  const evidence = new MemoryVectorStore()
  const memory = new MemoryVectorStore()
  const currentIdentity = identity({ cognitoGroups: ["SYSTEM_ADMIN"] })
  const deps = {
    objectStore,
    evidenceVectorStore: evidence,
    memoryVectorStore: memory,
    textModel: {
      embed: async (text: string) => [text.length, 1],
      generate: async () => "{}"
    },
    documentGroupStore: {
      list: async () => [{
        groupId: "folder-1",
        schemaVersion: 2,
        itemType: "documentGroup",
        tenantId: "tenant-1",
        adminPrincipalType: "user",
        adminPrincipalId: actorSnapshot.userId,
        name: "Reviewed sources",
        ownerUserId: actorSnapshot.userId,
        visibility: "private",
        sharedUserIds: [],
        sharedGroups: [],
        managerUserIds: [actorSnapshot.userId],
        status: "active",
        createdAt: "2026-07-11T00:00:00.000Z",
        updatedAt: "2026-07-11T00:00:00.000Z"
      }]
    },
    verifiedIdentityProvider: {
      getCurrentIdentity: async () => currentIdentity,
      getCurrentIdentityBySubject: async () => currentIdentity
    },
    securityAuditOutbox: new ObjectStoreSecurityMutationAuditOutbox(objectStore, sequenceClock())
  } as unknown as Dependencies
  const service = new MemoRagService(deps)
  const source = await service.ingest({
    fileName: "quarantined-source.md",
    text: "# Reviewed source\n\nOnly a reviewed candidate may become normal RAG evidence.",
    admissionContext: {
      mode: "authoritative",
      tenantId: "tenant-1",
      ownerUserId: "owner-1",
      authorizationRef: reference("authorization"),
      classificationRef: reference("unreviewed-classification"),
      usagePolicyRef: reference("unreviewed-usage"),
      qualityRef: reference("unreviewed-quality"),
      lifecycleRef: reference("lifecycle"),
      provenanceRef: reference("provenance"),
      inspectionStatus: "unknown",
      lifecycleStatus: "active",
      scope: { scopeType: "group", groupIds: ["folder-1"] }
    },
    skipMemory: true
  })
  assert.equal(source.admission?.status, "quarantined")
  assert.equal(source.lifecycleStatus, "staging")
  assert.deepEqual(source.vectorKeys, [])

  const initial = await service.registerSourceGovernance(source)
  const systemActor: AppUser = { ...actorSnapshot, cognitoGroups: ["SYSTEM_ADMIN"] }
  const published = await service.approveSourceGovernance(systemActor, source.documentId, approvalInput(initial.version))
  assert.equal(published.record.status, "published")
  assert.notEqual(published.record.activeDocumentId, source.documentId)

  const active = await service.getDocumentManifest(published.record.activeDocumentId!, systemActor)
  assert.equal(active.admission?.status, "approved")
  assert.equal(active.lifecycleStatus, "active")
  assert.equal(active.publicationEligible, true)
  assert.equal(active.admission?.classificationRef?.hash, published.record.approval?.classificationRef.hash)
  assert.equal(active.admission?.usagePolicyRef?.hash, published.record.approval?.usagePolicyRef.hash)
  assert.equal(active.admission?.qualityRef?.hash, published.record.approval?.qualityRef.hash)
  assert.ok(active.vectorKeys.length > 0)
  assert.equal((await evidence.getByKeys(active.evidenceVectorKeys ?? [])).length, active.evidenceVectorKeys?.length)
  const auditKeys = await objectStore.listKeys("security-audit/intents/tenant-1/")
  assert.equal(auditKeys.length, 1)
  const durableAudit = JSON.parse(await objectStore.getText(auditKeys[0]!)) as SecurityMutationAuditIntent
  assert.equal(durableAudit.status, "completed")
  assert.equal(durableAudit.result, "success")
  assert.equal((durableAudit.after as { status?: string }).status, "published")

  const beforeRestriction = await service.search({
    query: "reviewed candidate normal RAG evidence",
    topK: 5,
    lexicalTopK: 5,
    semanticTopK: 5
  }, systemActor)
  assert.ok(beforeRestriction.results.some((result) => result.documentId === active.documentId))

  const restricted = await service.restrictSourceGovernance(systemActor, active.documentId, {
    expectedVersion: published.version,
    reason: "公開後の品質承認失効",
    dimensions: ["quality"]
  })
  assert.equal(restricted.record.status, "restricted")
  const afterRestriction = await service.search({
    query: "reviewed candidate normal RAG evidence",
    topK: 5,
    lexicalTopK: 5,
    semanticTopK: 5
  }, systemActor)
  assert.equal(afterRestriction.results.some((result) => result.documentId === active.documentId), false)
  assert.equal((await objectStore.listKeys("security-audit/intents/tenant-1/")).length, 2)
})

function createHarness(options: {
  identities?: ServerManagedIdentity[]
  denyResource?: boolean
  failAuditPrepare?: boolean
  failAuditComplete?: boolean
  failStage?: boolean
  failCommit?: boolean
  tamperCandidate?: boolean
  recordCleanup?: boolean
  failCleanupRegistration?: boolean
} = {}) {
  const events: string[] = []
  const store = new VersionedMemoryObjectStore()
  const source = sourceManifest()
  const identityProvider = new SequencedIdentityProvider(options.identities ?? [identity(), identity()])
  const audit = new RecordingAuditOutbox(events, options.failAuditPrepare, options.failAuditComplete)
  const publisher = new RecordingPublisher(store, events, source, options.failStage, options.failCommit, options.tamperCandidate)
  const cleanupRegistrations: RegisterRevocationCleanupInput[] = []
  const service = new SourceGovernanceApprovalService({
    objectStore: store,
    auditOutbox: audit,
    identityProvider,
    authorizeFullResource: async () => {
      events.push("resource.authorize")
      if (options.denyResource) throw new Error("full permission revoked")
    },
    publisher,
    cleanupCoordinator: options.recordCleanup ? {
      register: async (input) => {
        events.push("cleanup.register")
        if (options.failCleanupRegistration) throw new Error("cleanup registry unavailable")
        cleanupRegistrations.push(input)
        return {} as never
      }
    } : undefined,
    now: sequenceClock()
  })
  return { service, store, source, identity: identityProvider, audit, publisher, events, cleanupRegistrations }
}

function approvalInput(expectedVersion: string): ApproveSourceGovernanceInput & {
  usagePolicy: {
    allowedPurposes: Array<"normal_rag" | "external_model" | "logging" | "evaluation">
    externalModelAllowed: boolean
    loggingAllowed: boolean
    evaluationAllowed: boolean
    policyVersion: string
  }
} {
  return {
    expectedVersion,
    reason: "法務・品質レビュー完了",
    classification: { level: "confidential", policyVersion: "classification-v7" },
    usagePolicy: {
      allowedPurposes: ["normal_rag"],
      externalModelAllowed: false,
      loggingAllowed: false,
      evaluationAllowed: false,
      policyVersion: "usage-v4"
    },
    qualityProfile: {
      knowledgeQualityStatus: "approved",
      verificationStatus: "verified",
      freshnessStatus: "current",
      supersessionStatus: "current",
      extractionQualityStatus: "high",
      ragEligibility: "eligible",
      confidence: 0.98,
      flags: []
    },
    qualityPolicyVersion: "quality-v9",
    inspection: {
      status: "passed",
      profileVersion: "inspection-v3",
      malwareStatus: "clean",
      malwareProfileVersion: "malware-scan-v3"
    }
  }
}

function sourceManifest(): DocumentManifest {
  return {
    documentId: "source-1",
    documentVersion: "source-version-1",
    fileName: "source.md",
    metadata: {
      tenantId: "tenant-1",
      ownerUserId: "owner-1",
      scopeType: "group",
      groupIds: ["folder-1"],
      lifecycleStatus: "staging"
    },
    admission: {
      schemaVersion: 1,
      status: "quarantined",
      tenantId: "tenant-1",
      ownerUserId: "owner-1",
      authorizationRef: reference("authorization"),
      classificationRef: reference("unreviewed-classification"),
      usagePolicyRef: reference("unreviewed-usage"),
      qualityRef: reference("unreviewed-quality"),
      lifecycleRef: reference("lifecycle"),
      provenanceRef: reference("provenance"),
      inspectionStatus: "unknown",
      reasons: ["source_inspection_unknown", "quality_profile_missing"],
      rejectedProtectedMetadataKeys: [],
      admittedAt: "2026-07-11T00:00:00.000Z"
    },
    derivedIntegrity: {
      schemaVersion: 1,
      expectedChunkCount: 1,
      expectedMemoryCardCount: 0,
      evidenceRecordCount: 0,
      memoryRecordCount: 0,
      manifestHash: "a".repeat(64),
      recordSetHash: "b".repeat(64),
      verified: false,
      reasons: ["complete_approved_admission_missing"]
    },
    publicationEligible: false,
    processingStatus: "quarantined",
    sourceObjectKey: "documents/source-1/source.txt",
    manifestObjectKey: "manifests/source-1.json",
    vectorKeys: [],
    lifecycleStatus: "staging",
    chunkCount: 1,
    memoryCardCount: 0,
    createdAt: "2026-07-11T00:00:00.000Z"
  }
}

function stagedCandidate(source: DocumentManifest, input: Parameters<SourceGovernancePublisher["stage"]>[0]): DocumentManifest {
  const fence = {
    schemaVersion: 1 as const,
    runId: "publication-run-1",
    artifactId: "candidate-1",
    idempotencyKey: "publication-idempotency-1",
    sourceId: source.documentId,
    purpose: "ingest" as const,
    stageNamespace: "staging/publications/publication-run-1/generation-1",
    generation: 1,
    fencingToken: "fence-1"
  }
  return {
    ...source,
    documentId: "candidate-1",
    documentVersion: input.sourceVersion,
    admission: {
      ...source.admission!,
      status: "approved",
      classificationRef: input.approval.classificationRef,
      usagePolicyRef: input.approval.usagePolicyRef,
      qualityRef: input.approval.qualityRef,
      inspectionStatus: "passed",
      malwareScan: {
        status: "clean",
        profileVersion: input.approval.inspection.malwareProfileVersion
      },
      reasons: []
    },
    qualityProfile: input.approval.qualityProfile,
    derivedIntegrity: {
      ...source.derivedIntegrity!,
      evidenceRecordCount: 1,
      manifestHash: "c".repeat(64),
      recordSetHash: "d".repeat(64),
      verified: true,
      reasons: []
    },
    publicationEligible: true,
    processingStatus: "complete",
    publicationFence: fence,
    publicationControl: {
      schemaVersion: 1,
      sourceId: source.documentId,
      purpose: "ingest",
      activePointerKey: "publication/active/test/source-1.json",
      artifactId: "candidate-1",
      runId: fence.runId,
      generation: fence.generation,
      fencingToken: fence.fencingToken
    },
    manifestObjectKey: `${fence.stageNamespace}/manifests/candidate-1.json`,
    lifecycleStatus: "staging",
    evidenceVectorKeys: ["candidate-vector-1"],
    vectorKeys: ["candidate-vector-1"]
  }
}

class RecordingPublisher implements SourceGovernancePublisher {
  readonly phases: string[] = []
  statusObservedAtCommit?: string
  candidate?: DocumentManifest

  constructor(
    private readonly store: VersionedMemoryObjectStore,
    private readonly events: string[],
    private readonly source: DocumentManifest,
    private readonly failStage = false,
    private readonly failCommit = false,
    private readonly tamperCandidate = false
  ) {}

  async stage(input: Parameters<SourceGovernancePublisher["stage"]>[0]): Promise<StagedSourceGovernancePublication> {
    this.phases.push("stage")
    this.events.push("publisher.stage")
    if (this.failStage) throw new Error("stage fault")
    const candidate = stagedCandidate(this.source, input)
    const resultCandidate: DocumentManifest = this.tamperCandidate
      ? { ...candidate, admission: { ...candidate.admission!, status: "quarantined" } }
      : candidate
    this.candidate = resultCandidate
    return {
      runId: "publication-run-1",
      candidate: resultCandidate
    }
  }

  async commit(input: Parameters<SourceGovernancePublisher["commit"]>[0]) {
    this.phases.push("commit")
    this.events.push("publisher.commit")
    this.statusObservedAtCommit = (await loadState(this.store)).record.status
    assert.equal(input.staged.candidate.lifecycleStatus, "staging")
    if (this.failCommit) throw new Error("commit fault")
    return { activeDocumentId: input.staged.candidate.documentId, committedAt: "2026-07-11T00:00:09.000Z" }
  }
}

class SequencedIdentityProvider implements VerifiedIdentityProvider {
  calls = 0

  constructor(private readonly identities: ServerManagedIdentity[]) {}

  async getCurrentIdentity(): Promise<ServerManagedIdentity | undefined> {
    return this.identities[0]
  }

  async getCurrentIdentityBySubject(): Promise<ServerManagedIdentity | undefined> {
    const value = this.identities[Math.min(this.calls, this.identities.length - 1)]
    this.calls += 1
    return value
  }
}

class RecordingAuditOutbox implements SecurityMutationAuditOutboxPort {
  readonly drafts: SecurityMutationAuditDraft[] = []
  readonly results: SecurityMutationResult[] = []
  private intents = new Map<string, SecurityMutationAuditIntent>()
  completionAttempts = 0

  constructor(
    private readonly events: string[],
    private readonly failPrepare = false,
    private readonly failComplete = false
  ) {}

  async prepare(draft: SecurityMutationAuditDraft): Promise<SecurityMutationAuditIntent> {
    this.events.push("audit.prepare")
    if (this.failPrepare) throw new Error("audit prepare fault")
    this.drafts.push(draft)
    const intent: SecurityMutationAuditIntent = {
      schemaVersion: 1,
      intentId: `intent-${this.drafts.length}`,
      status: "pending",
      draft,
      createdAt: "2026-07-11T00:00:00.000Z"
    }
    this.intents.set(intent.intentId, intent)
    return intent
  }

  async complete(intentId: string, _tenantId: string, result: SecurityMutationResult, after: never) {
    this.events.push("audit.complete")
    this.completionAttempts += 1
    if (this.failComplete) throw new Error("audit complete fault")
    this.results.push(result)
    const intent = this.intents.get(intentId)!
    const completed: SecurityMutationAuditIntent = {
      ...intent,
      status: "completed",
      result,
      after,
      completedAt: "2026-07-11T00:00:10.000Z"
    }
    this.intents.set(intentId, completed)
    return completed
  }
}

class VersionedMemoryObjectStore implements ObjectStore {
  private readonly values = new Map<string, string>()

  async putText(key: string, text: string): Promise<void> {
    this.values.set(key, text)
  }

  async putTextIfVersion(key: string, text: string, expectedVersion: string | undefined): Promise<void> {
    const current = this.values.get(key)
    const currentVersion = current === undefined ? undefined : version(current)
    if (currentVersion !== expectedVersion) {
      throw Object.assign(new Error(`Conditional write failed for ${key}`), { code: "PRECONDITION_FAILED" })
    }
    this.values.set(key, text)
  }

  async getText(key: string): Promise<string> {
    const value = this.values.get(key)
    if (value === undefined) throw Object.assign(new Error(`No such key: ${key}`), { code: "ENOENT" })
    return value
  }

  async getTextWithVersion(key: string): Promise<VersionedText> {
    const text = await this.getText(key)
    return { text, version: version(text) }
  }

  async putBytes(): Promise<void> { throw new Error("not implemented") }
  async getBytes(): Promise<Buffer> { throw new Error("not implemented") }
  async getObjectSize(): Promise<number> { throw new Error("not implemented") }
  async deleteObject(): Promise<void> { throw new Error("not implemented") }
  async listKeys(): Promise<string[]> { return [] }
}

class MemoryVectorStore {
  private readonly records = new Map<string, VectorRecord>()

  async put(records: VectorRecord[]): Promise<void> {
    for (const record of records) this.records.set(record.key, structuredClone(record))
  }

  async getByKeys(keys: string[]): Promise<VectorRecord[]> {
    return keys
      .map((key) => this.records.get(key))
      .filter((record): record is VectorRecord => record !== undefined)
      .map((record) => structuredClone(record))
  }

  async query(): Promise<RetrievedVector[]> {
    return []
  }

  async delete(keys: string[]): Promise<void> {
    for (const key of keys) this.records.delete(key)
  }
}

async function loadState(store: VersionedMemoryObjectStore): Promise<VersionedSourceGovernanceRecord> {
  const stored = await store.getTextWithVersion("source-governance/tenant-1/source-1.json")
  return { record: JSON.parse(stored.text), version: stored.version } as VersionedSourceGovernanceRecord
}

function identity(overrides: Partial<ServerManagedIdentity> = {}): ServerManagedIdentity {
  return {
    username: "reviewer",
    userId: actorSnapshot.userId,
    email: actorSnapshot.email,
    accountStatus: "active",
    cognitoGroups: ["RAG_GROUP_MANAGER"],
    tenantId: "tenant-1",
    ...overrides
  }
}

function reference(id: string) {
  return createVersionedReference(id, "v1", id)
}

function version(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

function sequenceClock(): () => Date {
  let tick = 0
  return () => new Date(Date.parse("2026-07-11T00:00:00.000Z") + tick++ * 1000)
}
