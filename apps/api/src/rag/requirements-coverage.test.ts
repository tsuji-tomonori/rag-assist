import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const traceByRequirement: Record<string, string[]> = {
  "FR-001": ["text-processing.test.ts", "memorag-service.test.ts", "App.test.tsx"],
  "FR-002": ["memorag-service.test.ts", "text-processing.test.ts"],
  "FR-003": ["graph.test.ts", "memorag-service.test.ts"],
  "FR-004": ["graph.test.ts", "prompts.test.ts"],
  "FR-005": ["graph.test.ts", "prompts.test.ts"],
  "FR-006": ["graph.test.ts", "api.test.ts", "App.test.tsx"],
  "FR-007": ["memorag-service.test.ts", "App.test.tsx"],
  "FR-008": ["memorag-service.test.ts", "local-stores.test.ts"],
  "FR-009": ["App.test.tsx"],
  "FR-010": ["App.test.tsx"],
  "FR-011": ["memorag-service.test.ts", "App.test.tsx"],
  "FR-012": ["benchmark/run.ts", "benchmark/dataset.sample.jsonl"],
  "FR-013": ["api-contract.test.ts", "api.test.ts"],
  "FR-014": ["node-units.test.ts", "graph.test.ts"],
  "FR-015": ["node-units.test.ts", "graph.test.ts"],
  "FR-016": ["node-units.test.ts", "graph.test.ts"],
  "FR-017": ["graph.test.ts", "node-units.test.ts"],
  "FR-018": ["hybrid-search.test.ts", "node-units.test.ts"],
  "FR-019": ["benchmark/run.ts", "node-units.test.ts"],
  "FR-020": ["memorag-service.test.ts", "local-stores.test.ts"],
  "FR-021": ["questions-access.test.ts", "App.test.tsx"],
  "FR-022": ["useConversationHistory.test.ts", "conversationHistorySearch.test.ts"],
  "FR-023": ["hybrid-search.test.ts", "useAdminData.test.ts"],
  "FR-024": ["authorization.test.ts", "access-control-policy.test.ts"],
  "FR-025": ["LoginPage.test.tsx", "authClient.test.ts"],
  "FR-026": ["hybrid-search.test.ts", "profiles.test.ts"],
  "FR-027": ["authorization.test.ts", "useAdminData.test.ts"],
  "FR-028": ["useConversationHistory.test.ts", "conversationHistorySearch.test.ts"],
  "FR-029": ["graph.test.ts", "useChatSession.test.ts"],
  "FR-030": ["conversationHistorySearch.test.ts"],
  "FR-031": ["App.test.tsx", "AssigneeWorkspace.tsx"],
  "FR-032": ["App.test.tsx", "AssigneeWorkspace.tsx"],
  "FR-033": ["questions-access.test.ts", "App.test.tsx"],
  "FR-034": ["questions-access.test.ts", "useChatSession.test.ts"],
  "FR-035": ["App.test.tsx", "useConversationHistory.test.ts"],
  "FR-036": ["questions-access.test.ts"],
  "FR-037": ["tasks/todo/20260507-2000-hitl-review-feedback-loop.md"],
  "FR-038": ["api-contract.test.ts", "document-ingest-runs tests", "documentsApi tests"],
  "FR-039": ["benchmark/corpus.test.ts", "benchmark/run.test.ts"],
  "FR-040": ["hybrid-search.test.ts", "benchmark/run.test.ts", "search-run.test.ts"],
  "FR-041": ["hybrid-search.test.ts", "access-control-policy.test.ts", "useChatSession.test.ts", "DocumentWorkspace.test.tsx"],
  "FR-042": ["ChatComposer.test.tsx", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md"],
  "FR-043": ["AssistantAnswer.test.tsx", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md"],
  "FR-044": ["conversationHistorySearch.test.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md"],
  "FR-045": ["node-units.test.ts", "hybrid-search.test.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md"],
  "FR-046": ["DebugPanel.test.tsx", "debugApi.test.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md"],
  "FR-047": ["benchmark/run.test.ts", "benchmark/corpus.test.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md"],
  "FR-048": ["benchmarkApi.test.ts", "useBenchmarkRuns.test.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md"],
  "FR-049": ["tasks/todo/20260713-2259-chat-orchestration-completion.md"],
  "FR-050": ["tasks/todo/20260713-2300-async-agent-execution.md"],
  "FR-051": ["tasks/todo/20260713-2301-user-preferences.md"],
  "FR-052": ["docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md"],
  "FR-053": ["tasks/todo/20260713-2302-api-lifecycle-common-middleware.md"],
  "FR-054": ["tasks/todo/20260522-2120-cloudfront-single-entry-implementation.md"],
  "FR-055": ["tasks/todo/20260713-2302-api-lifecycle-common-middleware.md"],
  "FR-056": ["apps/api/src/auth.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md"],
  "FR-057": ["apps/api/src/authorization.test.ts", "apps/api/src/security/access-control-policy.test.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md"],
  "FR-058": ["apps/api/src/adapters/user-directory.ts", "apps/api/src/rag/memorag-service.test.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md"],
  "FR-059": ["apps/api/src/folders/folder-permission-service.ts", "apps/api/src/folders/document-group-permissions.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md"],
  "FR-060": ["apps/api/src/auth.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: two-tenant negative matrix"],
  "FR-061": ["apps/api/src/folders/folder-permission-service.ts", "apps/api/src/folders/folder-permission-service.test.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md"],
  "FR-062": ["apps/api/src/documents/document-permission-service.ts", "apps/api/src/documents/document-permission-service.test.ts", "validation target: actor permission and same-tenant principal matrix"],
  "FR-063": ["apps/api/src/documents/document-permission-service.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: grant composition matrix"],
  "FR-064": ["apps/web/src/app/hooks/usePermissions.test.ts", "apps/web/src/features/documents/components/DocumentWorkspace.test.tsx", "validation target: read-only shared-user E2E"],
  "FR-065": ["apps/api/src/documents/document-permission-service.test.ts", "apps/api/src/rag/memorag-service.test.ts", "validation target: source/destination move matrix"],
  "FR-066": ["apps/api/src/rag/memorag-service.test.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: revoke/delete race"],
  "FR-067": ["apps/api/src/search/hybrid-search.test.ts", "apps/web/src/features/chat/hooks/useChatSession.test.ts", "validation target: owner/chat/expiry matrix"],
  "FR-068": ["apps/api/src/rag/_shared/policies/quality-policy.ts", "validation target: document-ingest admission and quarantine suite"],
  "FR-069": ["apps/api/src/rag/offline/pre-retrieval/ingestion/ingest-run.service.ts", "apps/api/src/search/hybrid-search.test.ts", "validation target: mandatory authorization classification usage quality lifecycle provenance references"],
  "FR-070": ["apps/api/src/search/hybrid-search.test.ts", "apps/api/src/chat-orchestration/nodes/retrieve-memory.test.ts", "validation target: unauthorized or ineligible top-hit and current-policy expansion race"],
  "FR-071": ["apps/api/src/rag/prompts.test.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: prompt-injection corpus"],
  "FR-072": ["apps/api/src/rag/memorag-service.test.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: cutover/rollback fault injection"],
  "FR-073": ["docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: claim-to-source support tests", "validation target: version/time/conflict corpus"],
  "FR-074": ["apps/api/src/rag/orchestration/chat-rag-orchestrator.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: source parser OCR chunker embedding and runtime version-complete replay manifest"],
  "FR-075": ["benchmark/run.test.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: executable promotion gate"],
  "FR-076": ["apps/api/src/authorization.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: protected-resource operation matrix"],
  "FR-077": ["apps/api/src/folders/folder-permission-service.ts", "apps/api/src/documents/document-permission-service.ts", "validation target: owner and adminPrincipal invariant"],
  "FR-078": ["docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: administrative-principal transfer fault injection"],
  "FR-079": ["apps/api/src/authorization.ts", "infra/lib/memorag-mvp-stack.ts", "validation target: identity API Web infra worker role-catalog parity"],
  "FR-080": ["apps/api/src/routes/admin-routes.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: role grant revoke self last-admin and session matrix"],
  "FR-081": ["apps/api/src/folders/folder-permission-service.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: membership feature target-group authority retained-edge integrity stale cleanup and nested-cycle matrix"],
  "FR-082": ["apps/api/src/rag/offline/pre-retrieval/ingestion/ingest-run.service.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: source-span and no-silent-truncation corpus"],
  "FR-083": ["apps/api/src/rag/offline/pre-retrieval/ingestion/ingest-run.service.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: staged ingest single and concurrent retry fencing and reconciliation fault injection"],
  "FR-084": ["apps/api/src/security/access-control-policy.test.ts", "apps/api/src/routes/benchmark-seed.ts", "validation target: runner-only simulated-subject isolation"],
  "FR-085": ["apps/api/src/documents/document-permission-service.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: expected-version atomic share update"],
  "FR-086": ["apps/api/src/documents/document-permission-service.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: all security eligibility mutation results and state-audit dual-write failure"],
  "FR-087": ["apps/api/src/rag/memorag-service.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: move metadata fault injection and reconciliation"],
  "FR-088": ["apps/api/src/rag/orchestration/chat-rag-orchestrator.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: save view and download field-level redaction"],
  "FR-089": ["docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: dependency degradation without authorization classification usage injection tool grounding citation secret or redaction bypass"],
  "FR-090": ["apps/api/src/rag/memorag-service.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: worker start read side-effect and commit reauthorization race matrix"],
  "FR-091": ["apps/api/src/schemas.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: unauthorized existing/absent differential authorized-only pagination Web debug and worker-result minimization"],
  "FR-092": ["apps/api/src/rag/offline/pre-retrieval/ingestion/ingest-run.service.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: structured chunk boundary and repeat-run determinism corpus"],
  "FR-093": ["apps/api/src/rag/orchestration/chat-rag-orchestrator.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: production drift alert action and rollback drill"],
  "NFR-001": ["graph.test.ts", "local-stores.test.ts", "text-processing.test.ts"],
  "NFR-002": ["infra/test/memorag-mvp-stack.test.ts", "docs/4_運用_OPS/21_監視_MONITORING/OPS_MONITORING_001.md"],
  "NFR-003": ["infra/test/memorag-mvp-stack.test.ts"],
  "NFR-004": ["memorag-service.test.ts", "local-stores.test.ts"],
  "NFR-005": ["memorag-service.test.ts", "graph.test.ts"],
  "NFR-006": ["infra/test/memorag-mvp-stack.test.ts"],
  "NFR-007": ["package scripts", "verification command"],
  "NFR-008": ["package scripts", "verification command"],
  "NFR-009": ["docs/1_要求_REQ/README.md", "docs/4_運用_OPS/21_監視_MONITORING/OPS_MONITORING_001.md"],
  "NFR-010": ["authorization.test.ts", "access-control-policy.test.ts"],
  "NFR-011": ["authorization.test.ts", "questions-access.test.ts"],
  "NFR-012": ["hybrid-search.test.ts", "access-control-policy.test.ts"],
  "NFR-013": ["chat-run-events-stream.test.ts", "access-control-policy.test.ts"],
  "NFR-014": ["document-ingest-runs tests", "benchmark/corpus.test.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md"],
  "NFR-015": ["debugApi.test.ts", "access-control-policy.test.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md"],
  "SQ-001": ["benchmark/run.test.ts", "apps/api/src/search/hybrid-search.test.ts"],
  "SQ-002": ["benchmark/run.test.ts", "benchmark/corpus.test.ts"],
  "SQ-003": ["docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md"],
  "SQ-004": ["apps/web/src/features/chat/components/ChatComposer.tsx", "apps/web/src/features/chat/components/ChatView.tsx", "validation target: responsive visual/layout no-overlap test"],
  "SQ-005": ["docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: must-not-access candidate/prompt/cache/trace suite"],
  "SQ-006": ["docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: all authoritative eligibility-loss triggers propagation max/p95/p99"],
  "SQ-007": ["benchmark/run.test.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: approved stage and slice thresholds"],
  "SQ-008": ["docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: production-profile stage latency percentiles"],
  "SQ-009": ["benchmark/run.test.ts", "apps/api/src/search/hybrid-search.test.ts", "validation target: authorized recall and false-denial by grant path"],
  "SQ-010": ["apps/api/src/rag/online/generation/verification/answer-support-verifier.ts", "benchmark/run.test.ts", "validation target: claim faithfulness and unsupported-claim severity"],
  "SQ-011": ["apps/api/src/rag/online/generation/citation/citation-validator.ts", "benchmark/run.test.ts", "validation target: citation precision completeness and locator validity"],
  "SQ-012": ["apps/api/src/chat-orchestration/nodes/node-units.test.ts", "benchmark/run.test.ts", "validation target: answerability confusion matrix"],
  "SQ-013": ["benchmark/run.test.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: business task completion and handoff scenarios"],
  "SQ-014": ["docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: availability backlog and recovery chaos suite"],
  "SQ-015": ["benchmark/run.test.ts", "docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md", "validation target: price-versioned unit cost with quality gates"]
}

const redefinedRequirementIds = new Set([
  ...Array.from({ length: 38 }, (_, index) => `FR-${String(index + 56).padStart(3, "0")}`),
  ...Array.from({ length: 11 }, (_, index) => `SQ-${String(index + 5).padStart(3, "0")}`)
])

test("product requirement documents have non-empty trace references", async () => {
  const docsRoot = path.resolve(process.cwd(), "../../docs/1_要求_REQ/11_製品要求_PRODUCT")
  const requirements = await Promise.all((await listRequirementFiles(docsRoot)).map(readRequirement))
  const requirementIds = requirements.map((requirement) => requirement.id).sort()
  const tracedRequirementIds = Object.keys(traceByRequirement).sort()

  assert.deepEqual(
    tracedRequirementIds.filter((id) => !requirementIds.includes(id)),
    []
  )
  assert.deepEqual(
    requirementIds.filter((id) => !tracedRequirementIds.includes(id)),
    []
  )
  assert.ok(Object.values(traceByRequirement).every((links) => links.length > 0))
  assert.ok(requirements.every((requirement) => requirement.text.length > 0))

  const repoRoot = path.resolve(process.cwd(), "../..")
  const repoPathPattern = /^(?:apps|benchmark|docs|infra|reports|scripts|tasks)\//
  for (const [requirementId, references] of Object.entries(traceByRequirement)) {
    for (const reference of references.filter((item) => repoPathPattern.test(item))) {
      const content = await readFile(path.resolve(repoRoot, reference))
      assert.ok(content.length > 0, `${requirementId} trace path must exist and not be empty: ${reference}`)
    }
  }

  for (const requirementId of redefinedRequirementIds) {
    const references = traceByRequirement[requirementId] ?? []
    const evidenceReferences = references.filter((reference) => !reference.startsWith("validation target:"))
    assert.ok(evidenceReferences.length > 0, `${requirementId} must have current evidence or a trace artifact`)
    for (const reference of evidenceReferences) {
      const content = await readFile(path.resolve(repoRoot, reference))
      assert.ok(content.length > 0, `${requirementId} trace reference must not be empty: ${reference}`)
    }
  }
})

async function listRequirementFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name)
      if (entry.isDirectory()) return listRequirementFiles(entryPath)
      if (entry.isFile() && /^REQ_(FUNCTIONAL|NON_FUNCTIONAL|SERVICE_QUALITY)_\d+\.md$/.test(entry.name)) return [entryPath]
      return []
    })
  )
  return nested.flat().sort()
}

async function readRequirement(filePath: string): Promise<{ id: string; text: string }> {
  const markdown = await readFile(filePath, "utf-8")
  const match = markdown.match(/^- ((?:FR|NFR|SQ)-\d+): (.+)$/m)
  assert.ok(match, `${filePath} must contain a requirement bullet`)
  return { id: match[1]!, text: match[2]! }
}
