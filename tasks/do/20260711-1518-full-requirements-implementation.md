# 認可・文書共有・RAG 再定義要件の完全実装

- 保存先: `tasks/do/20260711-1518-full-requirements-implementation.md`
- 状態: do
- タスク種別: 機能追加

## 背景

Draft PR #340 で `FR-056`–`FR-093` と `SQ-005`–`SQ-015` を target requirements として再定義したが、現行 runtime には critical/high を含む未実装・部分実装 gap が残っている。文書だけを完成扱いにせず、認可・共有・RAG lifecycle・品質・運用を実装し、要件ごとの受け入れ条件を直接検証できる状態にする必要がある。

## 目的

今回追加した全 49 要件を production path に実装し、各要件の受け入れ条件へコード、テスト、運用 evidence を双方向に対応付ける。全自動検証と受け入れ判定を通過し、未実装・部分実装・未検証を残さない。

## 対象範囲

- 正本要求: `FR-056`–`FR-093`、`SQ-005`–`SQ-015`
- API: identity/authentication、authorization、document/folder/resource-group、sharing、membership、audit、schemas/routes/stores
- RAG: admission、extraction/OCR、chunking、ingest、index、retrieval、generation、citation、verification、degradation、monitoring
- Web: 実データに基づく共有・権限・状態・エラー・empty/loading/permission UI
- Benchmark/operations: versioned policy profile、promotion gate、quality/security/latency/cost evaluation、drift/alert/recovery
- Infra: 必要な永続化、IAM、queue/index/monitoring、rollback/cutover support
- Tests/docs: unit、integration、contract、static policy、browser E2E、benchmark、chaos/fault injection、OpenAPI、設計・運用・trace

### 対象外

- production deploy、既存データの本番 migration 実行、PR merge/close
- benchmark 固有期待語句、QA sample 固有値、dataset 固有分岐による見かけ上の品質改善
- stakeholder が未承認の SLO/品質値を実測値または正式目標として捏造すること

## 方針

- 要件正本を実装の source of truth とし、現行コードは current-state evidence として扱う。
- deny-first、current eligibility、tenant/owner/resource scope、response minimization を全経路で共通 policy kernel に集約する。
- state mutation と security audit は同一 commit boundary または transactional outbox で不可分に確定する。
- RAG 派生物は source version と authorization/classification/usage/quality/lifecycle/provenance を immutable reference として継承する。
- ingest/index は versioned manifest、staging、fencing、atomic cutover、rollback/reconciliation を採用する。
- 品質・SLO・cost threshold は versioned policy profile から読み込み、未設定時は promotion を fail closed にする。
- production UI/API は persisted/API/config input または明示的な empty/loading/error/permission state のみを表示し、mock fallback を置かない。
- 受け入れ判定は requirement ID ごとの直接 evidence に基づき、狭い test の成功を広い要件の証明に流用しない。

## 必要情報

- 要件 baseline: `docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md`
- 認可・共有行列: `docs/spec-recovery/14_authorization_sharing_matrix_202607.md`
- RAG lifecycle: `docs/spec-recovery/15_rag_lifecycle_matrix_202607.md`
- current gap: `docs/spec-recovery/16_current_state_gap_analysis_202607.md`
- trace: `docs/spec-recovery/17_traceability_matrix_202607.csv`
- 要件定義 PR: `https://github.com/tsuji-tomonori/rag-assist/pull/340`
- 実装 branch base: `codex/redefine-rag-requirements` (`28054c7f`)
- stakeholder decision が必要な閾値・責任者は versioned config と open question の双方で追跡する。

## 実行計画

1. 全 49 要件と AC をコード/test/ops evidence に割り付け、実装状態と依存関係を監査する。
2. verified identity、tenant/account/role、operation/resource scope、owner/adminPrincipal precedence、response minimization の共通 policy kernel を実装する。
3. document/folder/resource-group の 3×7 操作、sharing/membership concurrency、move/delete/revoke、state-audit atomicity を実装する。
4. admission、loss-aware extraction/OCR、versioned deterministic structure-aware chunking、derived security metadata、fenced ingest と index cutover/rollback を実装する。
5. retrieval/prompt/cache/evaluation/worker の current eligibility、prompt injection defense、evidence/citation/refusal、replay manifest、safe degradation を実装する。
6. versioned quality policy、stage/slice evaluator、promotion gate、production drift/security monitoring、latency/cost/availability/recovery control loop を実装する。
7. API/Web/OpenAPI/infra/operations docs を同期し、real-data UI と permission/error state を実装する。
8. requirement ID ごとの unit/integration/E2E/benchmark/fault-injection evidence を実行し、失敗を修正して再実行する。
9. 全 49 要件の受け入れ判定、作業レポート、commit/push、main 向け Draft PR、日本語コメント、task done 化まで完遂する。

## ドキュメントメンテナンス計画

- 要件本文は意味を変えず、実装 evidence、validation、status、trace のみ必要に応じて同期する。
- authorization、data、RAG workflow、API、monitoring、deployment/rollback の ARC/DES/OPS 文書を実装と同時に更新する。
- request/response、error、permission、environment variable が変わる場合は OpenAPI、`docs/API_EXAMPLES.md`、`docs/LOCAL_VERIFICATION.md`、`docs/OPERATIONS.md` を更新する。
- reindex/migration/cutover/rollback が必要な変更は運用手順と compatibility risk を明記する。
- README/AGENTS.md が不変の場合も、作業レポートと PR 本文に非影響理由を記載する。
- `docs/spec-recovery/16`、`17` と implementation evidence matrix を、実装状態の変化に合わせて更新する。

## 受け入れ条件

- [ ] 全 `FR-056`–`FR-093`、`SQ-005`–`SQ-015` に implementation evidence と直接対応する検証 evidence があり、missing/partial/unverified が残っていない。
- [x] verified identity、account/tenant/role、operation/resource scope、owner/adminPrincipal、ordinary deny/hard deny の優先順位が全 route/service/store/worker で一貫し、cross-tenant と unauthorized resource enumeration が拒否・最小化される。
- [x] document/folder/resource-group の 3×7 操作行列について、supported operation の allow/deny と unsupported operation の deny が API/service/store/Web で一致する。
- [x] sharing/membership/transfer/move/delete/revoke は expected version、post-state integrity、current reauthorization、state-audit atomicity、retry/reconciliation を満たす。
- [x] document/folder move と revoke/delete は subtree/path/policy/index/cache/chat/citation へ deny-first で伝播し、失効後の取得・回答・worker commit を許可しない。
- [x] ingest は admission、loss-aware extraction/OCR、versioned deterministic structure-aware chunking、security metadata inheritance、idempotency/fencing、staging/cutover/rollback/reconciliation を満たす。
- [x] retrieval、prompt construction、cache、evaluation、debug、queued worker の全経路で current authorization/classification/usage/quality/lifecycle eligibility が再評価される。
- [x] prompt injection、system prompt/secret leakage、unsupported claim、invalid citation、no-evidence、conflicting evidence、dependency degradation が安全に処理される。
- [x] versioned evaluation/promotion policy が ingest/retrieval/generation/citation/refusal/security/latency/cost を stage/slice 別に評価し、未設定・regression・threshold failure を fail closed にする。
- [ ] production monitoring が quality/security drift、eligibility propagation、latency/cost、availability/backlog/recovery を集計し、versioned threshold に基づく alert/escalation/degradation/rollback evidence を残す。
- [x] production UI/API に mock fallback、fake count/user/group/date/capacity、未実装 control がなく、real data または honest state のみを返す・表示する。
- [x] API route/policy 変更は `apps/api/src/security/access-control-policy.test.ts` と OpenAPI を同期し、機微 response/debug/benchmark artifact は最小 permission と field-level filtering を持つ。
- [x] migration/reindex/cutover/rollback/compatibility/operations docs が実装と同期し、production deploy を行わずに検証可能な local/CI acceptance procedure がある。
- [ ] 選定した unit/integration/contract/static/browser E2E/benchmark/fault-injection/build/docs checks と最終 CI が pass し、未実施の必須検証がない。
- [ ] main 向け Draft PR、`semver:*` label、日本語の受け入れ条件確認、セルフレビュー、作業レポート、task done 移動が完了している。

## 2026-07-12 ローカル受け入れ判定

- repository implementation: verified。`19_implementation_evidence_202607.csv` は 36 件 `implemented_verified`、2 件 `implementation_verified_operational_acceptance_pending`、11 件 `control_verified_live_acceptance_pending`。
- validation: contract 1、API 658、Web 307、infra 38、benchmark 102、E2E smoke 4、lint、全 typecheck/build、OpenAPI/inventory/spec/docs/source audit が pass。最終 workspace 一括で Web 1件の待機競合を検出・修復し、Web 対象 41/41 と全体 307/307 を再実行した。
- release source audit: dataset-specific branch 0、artifact manifest mismatch 0。
- independent final review: benchmark seed の認可 subject／verified runner audit attribution／共有 corpus mapping を含め production-path blocker 0。
- operational acceptance pending: AWS registry backfill/convergence、live notification/drift/rollback drill、approved threshold/window/owner/price catalog、representative workload/load/chaos/cost/billing evidence。
- delivery pending: commit/push、Draft PR、日本語コメント、CI。外部運用 evidence が未取得のため task は `do` のまま維持する。

## 検証計画

- requirement/evidence validator と `apps/api/src/rag/requirements-coverage.test.ts`
- API: targeted tests → `npm run test -w @memorag-mvp/api`、lint、typecheck、build
- Web: targeted tests/browser scenarios → `npm run test -w @memorag-mvp/web`、lint、typecheck、build
- Infra: targeted CDK tests、synth、cdk-nag、migration/GSI guard
- Benchmark: stage/slice evaluator tests、sample corpus、promotion/non-regression gates
- Security: 2 tenant × multiple role/owner/share/membership negative matrix、response differential/non-enumeration、worker race/fault injection
- RAG: extraction/chunk determinism、eligibility race、injection/secret corpus、citation/support/refusal、cutover/rollback/recovery、drift/degradation
- repository: relevant Taskfile targets after resolved command inspection、OpenAPI/docs freshness、hidden Unicode、pre-commit、`git diff --check`
- GitHub: main-targeted PR checks/CI completion

## PRレビュー観点

- docs と runtime/test/ops evidence が requirement ID 単位で同期し、実装済みの過大申告がないこと。
- authMiddleware、route permission、tenant/owner/resource scope、store query scope、worker commit reauthorization、response minimization が多層で維持されること。
- RAG の authorization/classification/usage/quality/lifecycle、grounding、citation、refusal、injection、secret/redaction boundary が degradation 時も弱まらないこと。
- benchmark 期待語句、QA row、dataset/domain 固有 shortcut が production path に混入していないこと。
- state/audit、ingest/index、cutover/rollback の commit boundary と failure recovery がテストされていること。
- UI は real inputs と honest states のみを使い、API 未実装値を架空表示しないこと。
- test scope が変更範囲と各 AC に十分で、未実施・flaky・environment dependency を pass 扱いしていないこと。

## 未決事項・リスク

### 決定事項

- すべての品質・運用閾値は versioned policy profile に外部化し、未設定時は release/promotion を fail closed にする。
- 新規 schema field は可能な限り optional 追加から開始し、required 化・migration・reindex は明示的な compatibility gate を通す。
- production behavior の demo fallback は禁止し、依存機能が未設定なら unavailable/error state を返す。
- production deploy、既存データ migration 実行、PR merge/close は本タスクでは行わない。

### 実装時確認

- `OQ-RD-001`–`OQ-RD-012` と `Q-001`–`Q-009` のうち、runtime default を必要とする項目の stakeholder 決定。
- `SQ-006`–`SQ-015` の production threshold、measurement window、alert owner、cost price version。
- 実 AWS service の consistency、IAM、Bedrock/vector index failure behavior を検証するための non-production environment availability。

### リスク

- 認可/共有/data/index の schema 変更は migration と rollback を誤ると漏えいまたは検索不整合につながる。
- 全 workspace と infra を横断するため、milestone ごとに narrow validation を通してから broad CI へ進む必要がある。
- 未承認 threshold をコード定数として確定すると要件違反になるため、configurable implementation と正式 acceptance decision を分離する。
