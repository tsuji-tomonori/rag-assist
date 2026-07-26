# Issue #359 Phase 4j 作業完了レポート

- 作成日時: 2026-07-17 20:07 JST
- 対象: benchmark artifact revocation cleanup driver の narrow factory 抽出
- stacked base: PR #425 / `codex/issue-359-benchmark-run-reauthorization-extraction`
- 作業 branch: `codex/issue-359-benchmark-artifact-cleanup-driver-extraction`
- 状態: repository deliverables 完了、task-done lifecycle commit 前

## 受けた指示

Issue #359 の次の非重複 Phase 4 unit として、create orchestration と revocation cleanup driver を比較し、最小 rollback unit を RCA 付きで選ぶ。tenant/non-enumeration/RBAC/RAG trust、外部副作用順序、compensation/fail-closed を characterization し、production test、DES/generated docs、local/full CI、Draft stacked PR、semver/AC/self-review、task done、final-head CI、Issue 進捗まで完遂する。actual AWS/manual UI は未実施を成功扱いせず、merge/deploy/release は行わない。

## 要件整理と判断

- PR #407/#414/#418/#421/#425 が query/cancellation/download/execution starter/reauthorization state transition を扱い、private cleanup driver は未抽出であることを確認した。
- create orchestration は validation、run construction、store create、4 authorization boundaries、external start、durable commit、failure compensation を含む。一方 cleanup driver は run store `get` と optional artifact store `deleteObject/listKeys` の4 callback に閉じるため、後者を Phase 4j の最小 rollback unit とした。
- 根本原因は authoritative deny probe と partition-fenced destructive mapping が facade private closure に埋め込まれ、driver 単位の security boundary を直接検証できなかったことにある。
- coordinator の durable `register`→`reconcile` と reconcile failure 時の retry intent 保持は別責務なので facade に残した。
- caller supplied target list が factory の allowlist に混入しないよう、canonical target set は factory 内で生成する形へ self-review 中に強化した。

## 実施作業

- `BenchmarkArtifactRevocationCleanupDriverFactory` を追加し、次を narrow port として実装した。
  - exact tenant/run `benchmarkRunStore.get`
  - optional artifact store `deleteObject/listKeys`
  - canonical target 4件の内部生成
  - failed + `permission_revoked` + exact deny version の authoritative predicate
  - evaluation scope 限定 discovery
  - scope/allowlist/adapter fail-closed cleanup
  - exact run prefix と known target 限定 residual verification
- `MemoRagService` は constructor composition と factory delegate に置換し、durable registration と reconciliation 順序は維持した。
- production-quality test 8件で narrow source、canonical tenant partition、deny predicate、store failure、scope、partition escape、delete failure、residual isolation、facade order を固定した。
- facade dependency contract を Phase 4j に同期し、direct dependency key を 24→23、`benchmarkRunStore` occurrence を 4→3 とした。
- `DES_DLD_012.md` に ports、deny-current、partition fence、side-effect order、compensation、非影響、actual AWS gap、残存 create orchestration を追記した。
- canonical API-code docs を再生成した。97 APIs / 582 documents が freshness check と一致する。

## 検証と修復ループ

- `npm ci`: 成功。既存 audit は 8 vulnerabilities（low 2 / moderate 1 / high 5）で、本変更の lockfile 差分はない。
- targeted cleanup driver / worker integration / facade contract test:
  - 初回は test fixture の target order 想定と facade contract 期待値の更新位置に誤りがあり失敗した。
  - manifest canonical order を reference lookup に変更し、`Dependencies` key は保持したまま direct-read expectation だけを削除した。
  - source scanner が `revocation` import を対象外にする既存 regex と一致するよう、誤って追加した import expectation を戻した。
  - caller target injection を避ける hardening 後も再実行し、3 files 全成功。
- targeted ESLint: 初回 hardening 後の unused variable 1件を除去し、再実行成功。
- API typecheck: 成功。
- API full test:
  - 通常 sandbox は 119 files 中 114 pass / 5 fail。5件はすべて HTTP route test の `tsx` IPC `listen EPERM`（`/tmp/tsx-1000/*.pipe`）で、assertion failure ではなかった。
  - 解決コマンドを確認し、ユーザー承認付きの同一コマンド再実行で 861/861 tests 成功。
- root `npm run ci`: 成功。
  - Contract 1、API 861、Web 442、Infra 38、Benchmark 102 tests 全成功。
  - lint、全 workspace typecheck、全 workspace build 成功。
  - Vite の既存 chunk-size warning のみ。
- `task docs:api-code`: 成功（97 APIs / 582 documents 生成）。
- `task docs:check`: 成功（structure/OpenAPI/API-code/Web trace/Web inventory/Infra inventory/hidden Unicode）。
- `npm run rag:release:source-audit`: 成功。dataset-specific branch 0、artifact manifest mismatch 0。
- `git diff --check`: 成功。
- staged `pre-commit run`: 成功（git-secrets、hidden Unicode、trailing whitespace、EOF、large file、merge conflict、debug statement、mixed line ending）。
- GitHub Actions implementation head: success（run 29575933175 / job 87870246844）。

## 成果物

- `apps/api/src/benchmark/benchmark-artifact-revocation-cleanup-driver.ts`
- `apps/api/src/benchmark/benchmark-artifact-revocation-cleanup-driver.test.ts`
- `apps/api/src/rag/memorag-service.ts`
- `apps/api/src/rag/memorag-service-contract.test.ts`
- `docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_012.md`
- `docs/generated/api-code/` canonical generated documents
- `tasks/do/20260717-1945-issue-359-benchmark-artifact-cleanup-driver-extraction.md`
- 本レポート

## 指示への fit 評価

- cleanup driver を最小の非重複 unit として選び、RCA と scope を task に記録した。
- tenant partition と foreign/unexpected key 非昇格、non-enumeration/RBAC/RAG trust の不変、authoritative deny fail-closed、register-before-reconcile compensation を実装・test・DES で同期した。
- benchmark expected phrase、QA sample 固有値、dataset 固有分岐は実装へ追加していない。source audit も 0 を確認した。
- public API/OpenAPI、README、Web UI、worker event/output、manifest schema、infra 設定は不変なので手動更新していない。canonical docs freshness で非影響を確認した。

## 未対応・制約・リスク

- actual Step Functions worker / IAM / DynamoDB / S3 cleanup は AWS credentials と external state を伴うため未実施。local characterization、integration/full test、CI は actual AWS 成功の代替ではない。
- Web UI は変更対象外で、manual UI test は未実施。
- GitHub Apps の callable connector が利用できない場合のみ `gh` fallback を使い、その理由を PR に明記する。
- implementation commit `ac7f3429` と Draft stacked PR #428（base PR #425 branch、`semver:patch`）を作成済み。
- 初期 AC / self-review comment と implementation-head CI success を記録済み。
- task-done commit/push 後の final-head CI、最終 AC/self-review、Issue #359 progress、clean/upstream はこの後に実施する。
- 残る Phase 4 responsibility は benchmark create orchestration である。
- merge/deploy/release は行わない。
