# 追加要件完全実装 実行計画（2026-07）

- 文書種別: 実装・検証計画
- 状態: repository_implementation_verified_delivery_merge_ready_operational_acceptance_pending
- 対象: `FR-056`–`FR-093`, `SQ-005`–`SQ-015`
- 実装 task: `tasks/done/20260711-1518-full-requirements-implementation.md`
- 基準文書: `docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md`、同ディレクトリ配下の原子要求、`reports/working/20260712-2207-full-requirements-implementation.md`

## 1. 目的

今回追加した 49 要件を runtime・API・Web・worker・infra・運用へ実装し、要件ごとの production path、direct validation、制約を追跡する。code acceptance と、未承認 threshold/live evidence/PR-CI による operational acceptance を分離する。

## 2. 完了条件

次をすべて満たした場合だけ完了とする。

1. `FR-056`–`FR-093`, `SQ-005`–`SQ-015` の各行に、実装 evidence と直接検証 evidence がある。
2. authentication、tenant、resource permission、classification/usage、quality/lifecycle の unknown・不一致は fail closed になる。
3. ingest、retrieval、memory、context expansion、prompt、citation、cache、trace、worker の全経路で current eligibility を維持する。
4. share、membership、role、owner/adminPrincipal、move、delete、quality approval の mutation は version/CAS、integrity guard、不可分な監査 event を持つ。
5. staged publication と長時間 worker は retry、concurrency、失効 race で stale/partial success を公開しない。
6. promotion gate と production monitoring は未承認 threshold を補完せず、欠損 signal を fail closed に扱う。
7. 選定した lint、typecheck、unit/integration/security/fault test、build、OpenAPI/docs check、infra synth、CI がすべて成功する。
8. 日本語 PR 本文、受け入れ判定コメント、セルフレビューコメント、作業完了レポート、task done 更新が同一 branch に残る。

## 3. 実行順序と判定 gate

| Milestone | 実装範囲 | 必須検証 | Gate | Status |
| --- | --- | --- | --- | --- |
| M1 | canonical identity/role/resource-operation contract (`FR-056`–`FR-060`, `FR-076`, `FR-079`) | token/current account/current role、3×7 operation matrix、two-tenant negative | 未定義・stale・cross-tenant が全拒否 | code/direct tests complete |
| M2 | folder/document share、admin principal、membership、role/account mutation (`FR-061`–`FR-066`, `FR-077`–`FR-081`, `FR-085`–`FR-087`) | composition/CAS/outbox/transfer/move/delete fault & race | state と audit が片方だけ成功しない | code/direct tests complete |
| M3 | source admission、loss-aware extraction、chunk/security envelope、staged publication (`FR-068`, `FR-069`, `FR-072`, `FR-082`, `FR-083`, `FR-092`) | protected metadata、missing refs、determinism、partial put、fencing/concurrency/rollback | 完全検証済み winner だけ active | code/direct tests complete |
| M4 | current retrieval/evidence/prompt/citation/degradation (`FR-067`, `FR-070`, `FR-071`, `FR-073`, `FR-074`, `FR-088`, `FR-089`) | unauthorized high-score、revoke race、injection corpus、conflict corpus、replay completeness、fallback guard matrix | 権限外本文・未根拠回答・raw trace が 0 | code/direct tests complete |
| M5 | isolated benchmark、response minimization、worker reauthorization (`FR-084`, `FR-090`, `FR-091`) | simulated subject/cross-suite、existing-vs-absent、authorized-only page、worker boundary race | 実利用者権限拡張・resource enumeration・stale commit が 0 | code/direct tests complete |
| M6 | quality promotion/continuous monitoring (`FR-075`, `FR-093`, `SQ-005`–`SQ-015`) | profile論理積、missing signal、critical drift、rollback/notification | 未承認値・欠損値を pass/green にしない | contract complete; live profile/drill open |
| M7 | Web/infra/docs/全回帰/PR | reader UX、full repository checks、CI | blocking 失敗・未検証を残さない | local validation complete; Draft PR/CI pending |

## 4. 検証戦略

- security matrix: active/suspended、same/cross tenant、exact permission、owner/adminPrincipal、direct/inherited/nested membership、unknown/read failure。
- lifecycle race: retrieval 後 revoke、prompt 前 revoke、citation 前 revoke、worker start/read/side-effect/commit 前 revoke。
- fault injection: partial vector put、manifest write failure、audit write failure、concurrent expected-version、stale fencing token、rollback/reconcile retry。
- RAG safety: unauthorized high-similarity、prompt injection、同格矛盾、欠損 locator/version、dependency timeout/overload/cost/circuit open。
- quality: required signal 全件、stage/slice/profile/version/sample/confidence、zero-tolerance event、artifact/dataset mismatch。
- product surface: read-only discovery/view/chat scope、管理操作非表示、権限失効後の capability/debug/worker result 最小化。

## 5. 未確定値の扱い

`SQ-006`–`SQ-015` の production threshold、observation window、alert owner、price catalog は stakeholder 承認対象である。実装では versioned policy への明示入力を要求し、値の欠損を既定値や観測値で補完しない。未承認状態は promotion/monitoring を fail closed にし、承認後の policy artifact として運用投入する。

## 6. 成果物

- runtime/API/Web/worker/infra 実装と直接テスト
- `reports/working/20260712-2207-full-requirements-implementation-evidence.csv`（要件別実装・検証・判定台帳）
- 更新済み正規要求文書、運用ランブック、OpenAPI/infra 文書と requirement coverage test
- `reports/working/` の作業完了レポート
- main 向け Draft PR、受け入れ判定コメント、セルフレビューコメント

## 7. 現在の受け入れ状態

- `implemented_verified`: production path と direct test が確認済み。repository 全体 gate の最終再実行は別に必要。
- `implementation_verified_operational_acceptance_pending`: 制御実装は検証済みだが、approved profile と live/representative observation による運用受け入れは未完了。
- `control_verified_live_acceptance_pending`: fail-closed な測定・判定 contract は検証済みだが、正式 threshold、window、owner、price version と live evidence が未承認または未取得。
- `reports/working/20260712-2207-full-requirements-implementation-evidence.csv`: 36 件が `implemented_verified`、2 件が `implementation_verified_operational_acceptance_pending`、11 件が `control_verified_live_acceptance_pending`。
- 最終 package suite は contract 1/1、API 658/658、Web 307/307、infra 38/38、benchmark 102/102 が pass。E2E smoke は 4/4 pass。workspace 一括で検出した Web 1件の待機競合は修復し、対象 41/41 と Web 全体を再実行した。
- lint、全 workspace build、OpenAPI quality/freshness、Web/infra inventory freshness、当時の spec recovery validator、hidden Unicode check が pass。#342 統合後は `python3 scripts/validate_docs.py` を正規 validator とする。
- release source audit は dataset-specific branch 0、artifact manifest mismatch 0。
- 最終 production-path 再監査は blocker 0。benchmark seed の認可 subject／verified runner audit attribution／共有 corpus mapping／mismatched owner 拒否を再確認した。FR-067 は temporary attachment の永続一覧非混入と同一会話回答/citation を実 API/Web E2E で確認した。
- 未完了: live AWS/representative workload/chaos/notification/rollback、stakeholder threshold/price approval、commit/PR/comment/CI。これらは repository 実装検証と分離して pending とする。

したがって repository implementation と local acceptance は verified、delivery は Draft PR/CI 待ち、operational acceptance は pending とする。
