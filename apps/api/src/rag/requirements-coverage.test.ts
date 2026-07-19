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
  "FR-019": ["benchmark/run.ts", "infra/scripts/update-benchmark-run-metrics.mjs", "infra/scripts/update-benchmark-run-artifacts.mjs", "apps/api/src/rag/quality-control/production-rag-observation-producer.ts", "benchmark/run.test.ts", "infra/test/update-benchmark-run-metrics.test.ts", "infra/test/update-benchmark-run-artifacts.test.ts", "apps/api/src/rag/production-rag-observation-producer.test.ts"],
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
  "FR-048": ["apps/api/src/types.ts", "apps/api/src/schemas.ts", "apps/api/src/rag/memorag-service.ts", "infra/scripts/update-benchmark-run-artifacts.mjs", "infra/lib/memorag-mvp-stack.ts", "apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx", "apps/api/src/contract/schemas.test.ts", "apps/api/src/rag/memorag-service.test.ts", "apps/api/src/rag/production-rag-observation-producer.test.ts", "infra/test/update-benchmark-run-artifacts.test.ts", "infra/test/memorag-mvp-stack.test.ts", "apps/web/src/features/benchmark/components/BenchmarkWorkspace.test.tsx"],
  "FR-049": ["tasks/todo/20260713-2259-chat-orchestration-completion.md"],
  "FR-050": ["tasks/todo/20260713-2300-async-agent-execution.md"],
  "FR-051": ["tasks/todo/20260713-2301-user-preferences.md"],
  "FR-052": ["docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md"],
  "FR-053": ["tasks/todo/20260713-2302-api-lifecycle-common-middleware.md"],
  "FR-054": ["tasks/todo/20260522-2120-cloudfront-single-entry-implementation.md"],
  "FR-055": ["tasks/todo/20260713-2302-api-lifecycle-common-middleware.md"],
  "FR-056": ["apps/api/src/auth.ts", "apps/api/src/adapters/verified-identity-provider.ts", "apps/api/src/auth.test.ts"],
  "FR-057": ["apps/api/src/security/resource-operation-authorization.ts", "apps/api/src/security/resource-operation-authorization.test.ts", "apps/api/src/security/access-control-policy.test.ts", "apps/api/src/routes/benchmark-tenant-boundary.test.ts"],
  "FR-058": ["apps/api/src/adapters/user-directory.ts", "apps/api/src/security/account-lifecycle-current-identity.test.ts", "apps/api/src/security/current-worker-authorization.test.ts"],
  "FR-059": ["apps/api/src/security/resource-permission-decision.ts", "apps/api/src/documents/document-permission-service.ts", "apps/api/src/authorization.test.ts", "apps/api/src/search/hybrid-search.test.ts"],
  "FR-060": ["apps/api/src/security/tenant-partition.ts", "apps/api/src/rag/_shared/storage/tenant-artifacts.ts", "apps/api/src/security/tenant-partition.test.ts", "apps/api/src/adapters/tenant-scoped-run-stores.test.ts", "apps/api/src/adapters/dynamodb-tenant-run-stores.test.ts", "apps/api/src/routes/benchmark-tenant-boundary.test.ts", "apps/api/src/rag/embedding-cache-tenant.test.ts", "apps/api/src/rag/tenant-artifact-partition.test.ts"],
  "FR-061": ["apps/api/src/folders/folder-permission-service.ts", "apps/api/src/folders/folder-permission-service.test.ts"],
  "FR-062": ["apps/api/src/folders/folder-permission-service.ts", "apps/api/src/documents/document-permission-service.ts", "apps/api/src/folders/folder-permission-service.test.ts", "apps/api/src/documents/document-permission-service.test.ts"],
  "FR-063": ["apps/api/src/documents/document-permission-service.ts", "apps/api/src/documents/document-permission-service.test.ts"],
  "FR-064": ["apps/web/src/app/hooks/usePermissions.ts", "apps/web/src/features/documents/components/DocumentWorkspace.tsx", "apps/web/src/features/documents/components/DocumentWorkspace.test.tsx"],
  "FR-065": ["apps/api/src/documents/document-lifecycle-mutation-coordinator.ts", "apps/api/src/documents/document-lifecycle-mutation-coordinator.test.ts"],
  "FR-066": ["apps/api/src/rag/offline/pre-retrieval/admission/source-governance-approval-service.ts", "apps/api/src/documents/document-lifecycle-mutation-coordinator.ts", "apps/api/src/rag/offline/pre-retrieval/admission/source-governance-approval-service.test.ts", "apps/api/src/documents/document-lifecycle-mutation-coordinator.test.ts"],
  "FR-067": ["apps/api/src/rag/online/retrieval/hybrid/hybrid-retriever.ts", "apps/api/src/search/temporary-attachment-boundary.test.ts"],
  "FR-068": ["apps/api/src/rag/offline/pre-retrieval/admission/source-admission.ts", "apps/api/src/rag/offline/pre-retrieval/admission/source-governance-approval-service.ts", "apps/api/src/rag/admission-lifecycle.test.ts", "apps/api/src/rag/offline/pre-retrieval/admission/source-governance-approval-service.test.ts"],
  "FR-069": ["apps/api/src/rag/_shared/security/derived-record-security.ts", "apps/api/src/rag/offline/pre-retrieval/ingestion/ingest-run.service.ts", "apps/api/src/rag/admission-lifecycle.test.ts", "apps/api/src/rag/current-rag-eligibility.test.ts"],
  "FR-070": ["apps/api/src/rag/_shared/security/current-evidence-reauthorizer.ts", "apps/api/src/rag/online/retrieval/hybrid/hybrid-retriever.ts", "apps/api/src/adapters/current-eligibility-vector-filter.test.ts", "apps/api/src/chat-orchestration/nodes/retrieve-memory.test.ts", "apps/api/src/search/hybrid-search.test.ts"],
  "FR-071": ["apps/api/src/rag/_shared/security/untrusted-content-policy.ts", "apps/api/src/rag/untrusted-content.test.ts"],
  "FR-072": ["apps/api/src/rag/_shared/publication/staged-publication-coordinator.ts", "apps/api/src/rag/staged-publication.test.ts"],
  "FR-073": ["apps/api/src/rag/online/post-retrieval/evidence/final-evidence-set.ts", "apps/api/src/rag/evidence-structure.test.ts"],
  "FR-074": ["apps/api/src/rag/_shared/replay/replay-version-manifest.ts", "apps/api/src/rag/replay-version-manifest.test.ts", "apps/api/src/chat-orchestration/graph.test.ts"],
  "FR-075": ["packages/contract/src/rag-quality-control.ts", "packages/contract/src/schemas/benchmark.ts", "benchmark/release-audit.ts", "benchmark/promotion-gate.ts", "infra/scripts/update-benchmark-run-metrics.mjs", "packages/contract/src/rag-quality-control.test.ts", "benchmark/release-audit.test.ts", "benchmark/promotion-gate.test.ts", "infra/test/update-benchmark-run-metrics.test.ts"],
  "FR-076": ["apps/api/src/security/resource-operation-authorization.ts", "apps/api/src/security/resource-operation-authorization.test.ts", "packages/contract/src/access-control.test.ts"],
  "FR-077": ["apps/api/src/folders/folder-permission-service.ts", "apps/api/src/documents/document-permission-service.ts", "apps/api/src/folders/folder-permission-service.test.ts", "apps/api/src/documents/document-permission-service.test.ts"],
  "FR-078": ["apps/api/src/security/administrative-principal-transfer-service.ts", "apps/api/src/security/administrative-principal-transfer-service.test.ts", "apps/api/src/security/account-lifecycle-current-identity.test.ts", "apps/web/src/features/admin/components/AdminWorkspace.test.tsx"],
  "FR-079": ["packages/contract/src/access-control.ts", "apps/api/src/routes/system-routes.ts", "infra/lib/memorag-mvp-stack.ts", "packages/contract/src/access-control.test.ts", "infra/test/memorag-mvp-stack.test.ts"],
  "FR-080": ["apps/api/src/security/application-role-mutation-service.ts", "apps/api/src/security/application-role-mutation-service.test.ts"],
  "FR-081": ["apps/api/src/security/resource-group-membership-service.ts", "apps/api/src/security/resource-group-membership-service.test.ts"],
  "FR-082": ["apps/api/src/rag/offline/pre-retrieval/extraction/text-extractor.ts", "apps/api/src/rag/admission-lifecycle.test.ts", "apps/api/src/rag/text-processing.test.ts"],
  "FR-083": ["apps/api/src/rag/_shared/publication/staged-publication-coordinator.ts", "apps/api/src/rag/staged-publication.test.ts"],
  "FR-084": ["apps/api/src/benchmark/evaluation-context.ts", "apps/api/src/benchmark/evaluation-context.test.ts"],
  "FR-085": ["apps/api/src/folders/folder-permission-service.ts", "apps/api/src/documents/document-permission-service.ts", "apps/api/src/folders/folder-permission-service.test.ts", "apps/api/src/documents/document-permission-service.test.ts"],
  "FR-086": ["apps/api/src/security/security-mutation-audit-outbox.ts", "apps/api/src/security/security-mutation-audit-outbox.test.ts", "apps/api/src/security/resource-group-membership-service.test.ts", "apps/api/src/rag/offline/pre-retrieval/admission/source-governance-approval-service.test.ts"],
  "FR-087": ["apps/api/src/documents/document-lifecycle-mutation-coordinator.ts", "apps/api/src/folders/folder-lifecycle-mutation-coordinator.ts", "apps/api/src/routes/document-routes.ts", "apps/api/src/rag/memorag-service.ts", "apps/api/src/documents/document-lifecycle-mutation-coordinator.test.ts", "apps/api/src/folders/folder-lifecycle-mutation-coordinator.test.ts", "apps/api/src/folder-move-routes.test.ts", "apps/api/src/rag/memorag-service.test.ts", "apps/api/src/adapters/local-document-group-store.test.ts", "apps/web/src/features/documents/api/documentsApi.ts", "apps/web/src/features/documents/hooks/useDocuments.ts", "apps/web/src/features/documents/components/DocumentWorkspace.tsx", "apps/web/src/features/documents/components/DocumentWorkspace.test.tsx"],
  "FR-088": ["apps/api/src/rag/_shared/security/trace-sanitizer.ts", "apps/api/src/rag/trace-sanitizer.test.ts", "apps/api/src/chat-orchestration/graph.test.ts"],
  "FR-089": ["apps/api/src/rag/_shared/security/safe-degradation-policy.ts", "apps/api/src/rag/safe-degradation-policy.test.ts"],
  "FR-090": ["apps/api/src/security/current-worker-authorization.ts", "apps/api/src/security/current-worker-authorization.test.ts", "apps/api/src/rag/offline/pre-retrieval/admission/source-governance-approval-service.test.ts"],
  "FR-091": ["apps/api/src/security/public-resource-response.ts", "apps/api/src/security/public-resource-response.test.ts", "apps/api/src/contract/api-contract.test.ts", "apps/api/src/routes/benchmark-tenant-boundary.test.ts", "apps/web/src/features/documents/components/DocumentWorkspace.test.tsx"],
  "FR-092": ["apps/api/src/rag/offline/pre-retrieval/chunking/chunker.service.ts", "apps/api/src/rag/admission-lifecycle.test.ts", "apps/api/src/rag/text-processing.test.ts"],
  "FR-093": ["packages/contract/src/rag-quality-control.ts", "apps/api/src/rag/quality-control/production-rag-monitor.ts", "apps/api/src/rag/quality-control/production-rag-observation-producer.ts", "packages/contract/src/rag-quality-control.test.ts", "apps/api/src/rag/production-rag-monitor.test.ts", "apps/api/src/rag/production-rag-observation-producer.test.ts", "apps/api/src/rag-quality-monitor-worker.test.ts"],
  "FR-094": ["apps/web/src/app/AppRoutes.tsx", "apps/web/src/app/components/RailNav.tsx", "apps/web/src/app/hooks/useAppShellState.ts", "apps/web/src/app/routing/appRoute.ts", "apps/web/src/app/routing/appRoute.test.ts", "apps/web/e2e/visual-regression.spec.ts", "tools/web-inventory/ui-traceability.json", "tasks/do/20260714-issue-345-mobile-navigation.md", "tasks/done/20260714-issue-345-url-history-routing.md"],
  "FR-095": ["tools/web-inventory/ui-traceability.json", "tools/web-inventory/ui-traceability.test.mjs", "tasks/done/20260714-issue-345-shared-ui-state-contract.md"],
  "FR-096": ["apps/web/src/shared/ui/operationOutcome.ts", "apps/web/src/shared/ui/OperationFeedback.tsx", "apps/web/src/features/history/components/HistoryWorkspace.tsx", "apps/web/src/features/documents/components/DocumentWorkspace.tsx", "apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx", "apps/web/src/features/admin/hooks/useAdminData.ts", "apps/web/e2e/visual-regression.spec.ts", "tools/web-inventory/ui-traceability.json", "tasks/done/20260714-issue-345-risky-operation-feedback.md"],
  "FR-097": ["apps/web/src/app/hooks/useAppShellState.ts", "apps/web/src/app/hooks/useAppShellState.test.ts", "apps/web/src/app/routing/appRoute.ts", "apps/web/src/app/routing/appRoute.test.ts", "apps/web/src/features/documents/components/DocumentWorkspace.tsx", "apps/web/src/features/documents/components/DocumentWorkspace.test.tsx", "apps/web/src/features/documents/components/workspace/documentWorkspaceState.ts", "apps/web/src/features/documents/components/workspace/documentWorkspaceState.test.ts", "apps/web/e2e/visual-regression.spec.ts", "tools/web-inventory/ui-traceability.json", "tasks/done/20260714-issue-345-url-history-routing.md", "tasks/done/20260714-issue-345-document-workspace-context.md"],
  "FR-098": ["apps/web/src/features/documents/components/DocumentWorkspace.tsx", "apps/web/src/features/documents/components/DocumentWorkspace.test.tsx", "apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx", "apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx", "apps/web/e2e/visual-regression.spec.ts", "apps/web/src/features/admin/components/AdminWorkspace.tsx", "apps/web/src/features/admin/components/AdminWorkspace.test.tsx", "tools/web-inventory/ui-traceability.json", "tasks/done/20260714-issue-345-document-workspace-context.md", "reports/working/20260715-0007-issue-345-admin-ui-governance-spec-analysis.md"],
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
  "NFR-016": ["tools/web-inventory/ui-traceability.mjs", "tools/web-inventory/ui-traceability.test.mjs", "tools/web-inventory/ui-traceability.json"],
  "NFR-017": ["tools/web-inventory/ui-traceability.json", "tasks/done/20260714-issue-345-ui-language-primitives.md"],
  "NFR-018": [".github/workflows/memorag-ci.yml", "apps/web/e2e/visual-regression.spec.ts", "tasks/todo/20260714-issue-345-ui-automated-quality-gates.md", "tasks/todo/20260714-issue-345-manual-a11y-evidence.md"],
  "SQ-001": ["benchmark/run.ts", "infra/scripts/update-benchmark-run-artifacts.mjs", "apps/api/src/rag/quality-control/production-rag-observation-producer.ts", "benchmark/run.test.ts", "infra/test/update-benchmark-run-artifacts.test.ts", "apps/api/src/rag/production-rag-observation-producer.test.ts", "apps/api/src/search/hybrid-search.test.ts"],
  "SQ-002": ["benchmark/run.test.ts", "benchmark/corpus.test.ts"],
  "SQ-003": ["docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md"],
  "SQ-004": ["apps/web/src/features/chat/components/ChatComposer.tsx", "apps/web/src/features/chat/components/ChatView.tsx", "validation target: responsive visual/layout no-overlap test"],
  "SQ-005": ["packages/contract/src/rag-quality-control.ts", "packages/contract/src/rag-quality-control.test.ts", "apps/api/src/adapters/current-eligibility-vector-filter.test.ts", "apps/api/src/rag/trace-sanitizer.test.ts"],
  "SQ-006": ["packages/contract/src/rag-quality-control.ts", "packages/contract/src/schemas/benchmark.ts", "infra/scripts/update-benchmark-run-metrics.mjs", "apps/api/src/rag/quality-control/production-rag-observation-producer.ts", "packages/contract/src/rag-quality-control.test.ts", "infra/test/update-benchmark-run-metrics.test.ts", "apps/api/src/rag/production-rag-observation-producer.test.ts"],
  "SQ-007": ["packages/contract/src/rag-quality-control.ts", "benchmark/promotion-gate.ts", "infra/scripts/update-benchmark-run-metrics.mjs", "packages/contract/src/rag-quality-control.test.ts", "benchmark/promotion-gate.test.ts", "infra/test/update-benchmark-run-metrics.test.ts"],
  "SQ-008": ["packages/contract/src/rag-quality-control.ts", "packages/contract/src/schemas/benchmark.ts", "infra/scripts/update-benchmark-run-metrics.mjs", "apps/api/src/rag/quality-control/production-rag-observation-producer.ts", "packages/contract/src/rag-quality-control.test.ts", "infra/test/update-benchmark-run-metrics.test.ts", "apps/api/src/rag/production-rag-observation-producer.test.ts"],
  "SQ-009": ["packages/contract/src/rag-quality-control.ts", "apps/api/src/rag/quality-control/production-rag-observation-producer.ts", "packages/contract/src/rag-quality-control.test.ts", "apps/api/src/search/hybrid-search.test.ts"],
  "SQ-010": ["benchmark/run.ts", "packages/contract/src/rag-quality-control.ts", "packages/contract/src/schemas/benchmark.ts", "infra/scripts/update-benchmark-run-metrics.mjs", "apps/api/src/rag/online/generation/verification/answer-support-verifier.ts", "benchmark/run.test.ts", "packages/contract/src/rag-quality-control.test.ts", "infra/test/update-benchmark-run-metrics.test.ts", "apps/api/src/rag/production-rag-observation-producer.test.ts"],
  "SQ-011": ["packages/contract/src/rag-quality-control.ts", "packages/contract/src/schemas/benchmark.ts", "infra/scripts/update-benchmark-run-metrics.mjs", "apps/api/src/rag/online/generation/citation/citation-validator.ts", "packages/contract/src/rag-quality-control.test.ts", "infra/test/update-benchmark-run-metrics.test.ts", "apps/api/src/rag/production-rag-observation-producer.test.ts"],
  "SQ-012": ["benchmark/run.ts", "infra/scripts/update-benchmark-run-metrics.mjs", "benchmark/run.test.ts", "benchmark/metrics/quality.test.ts", "infra/test/update-benchmark-run-metrics.test.ts", "apps/api/src/rag/production-rag-observation-producer.test.ts"],
  "SQ-013": ["packages/contract/src/rag-quality-control.ts", "packages/contract/src/schemas/benchmark.ts", "infra/scripts/update-benchmark-run-metrics.mjs", "apps/api/src/rag/quality-control/production-rag-observation-producer.ts", "packages/contract/src/rag-quality-control.test.ts", "infra/test/update-benchmark-run-metrics.test.ts", "apps/api/src/rag/production-rag-observation-producer.test.ts"],
  "SQ-014": ["packages/contract/src/rag-quality-control.ts", "packages/contract/src/schemas/benchmark.ts", "infra/scripts/update-benchmark-run-metrics.mjs", "apps/api/src/rag/quality-control/production-rag-monitor.ts", "packages/contract/src/rag-quality-control.test.ts", "infra/test/update-benchmark-run-metrics.test.ts", "apps/api/src/rag/production-rag-monitor.test.ts"],
  "SQ-015": ["packages/contract/src/rag-quality-control.ts", "apps/api/src/rag/quality-control/production-rag-observation-producer.ts", "packages/contract/src/rag-quality-control.test.ts", "apps/api/src/rag/production-rag-observation-producer.test.ts"],
  "SQ-016": ["apps/web/e2e/visual-regression.spec.ts", "tools/web-inventory/ui-traceability.json", "tasks/todo/20260714-issue-345-cross-screen-a11y-responsive.md", "tasks/todo/20260714-issue-345-manual-a11y-evidence.md"]
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
  const repoPathPattern = /^(?:\.github|apps|benchmark|docs|infra|reports|scripts|tasks|tools)\//
  for (const [requirementId, references] of Object.entries(traceByRequirement)) {
    for (const reference of references.filter((item) => repoPathPattern.test(item))) {
      const content = await readFile(path.resolve(repoRoot, reference))
      assert.ok(content.length > 0, `${requirementId} trace path must exist and not be empty: ${reference}`)
    }
  }

  for (const requirementId of redefinedRequirementIds) {
    const references = traceByRequirement[requirementId] ?? []
    assert.equal(
      references.some((reference) => reference.startsWith("validation target:")),
      false,
      `${requirementId} must not retain a validation placeholder`
    )
    const evidenceReferences = references.filter((reference) => !reference.startsWith("validation target:"))
    assert.ok(
      evidenceReferences.some((reference) => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(reference)),
      `${requirementId} must reference at least one direct executable test`
    )
    assert.ok(
      evidenceReferences.some((reference) => (
        /\.[cm]?[jt]sx?$/.test(reference)
        && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(reference)
      )),
      `${requirementId} must reference at least one runtime implementation`
    )
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
