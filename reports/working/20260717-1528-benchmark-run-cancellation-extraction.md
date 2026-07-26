# Issue #359 Phase 4f BenchmarkRunCancellationService 抽出 作業完了レポート

- 作成日時: 2026-07-17 15:28 JST
- Issue: #359
- branch: `codex/issue-359-benchmark-run-cancellation-extraction`
- stacked base: PR #407 final head `1c59125a`
- 状態: draft PR #414 作成・初回 CI 成功・task 完了

## 受けた指示

PR #407 完遂後の Issue #359 残件と最新 task/PR stack を再確認し、他 agent と重複しない次の高優先・狭い port extraction unit を選ぶ。専用 worktree/task から実装・検証、日本語 Draft stacked PR、semver、AC/self-review、report/task done、final-head CI、Issue 進捗、clean/upstream まで完遂する。merge、deploy、release は行わない。

## 要件整理と判断

- current stack #390 → #393 → #397 → #403 → #407 と全 open PR、稼働 agent scope を監査した。
- benchmark metric/evidence、security resolver、Web E2E、conversation history/chat/RAG、usage/cost/admin、alias の各 scope と重ならない `cancelBenchmarkRun` 1 method を選んだ。
- cancellation は store `get/update`、authoritative tenant resolver、execution stopper、clock だけで閉じる最小 command boundary である。
- create、reauthorize、artifact download/cleanup、execution start、query/log、route permission/status、auth/RAG 境界は変更対象外とした。
- public 101 method/signature、tenant non-enumeration、exact ARN/cause、stop-before-update、stop failure、ARN なし、terminal status の既存挙動を不変条件とした。

## 実施作業

- `BenchmarkRunCancellationService` と narrow command ports を追加した。
- Step Functions の `StopExecutionCommand` mapping を `benchmark-execution-stopper.ts` へ分離した。
- `MemoRagService.cancelBenchmarkRun` を同 service へ委譲し、facade から `StopExecutionCommand` ownership を除いた。
- authoritative tenant、missing/cross-tenant non-enumeration、stop/update ordering、exact cause、no-ARN、failure、terminal behavior、clock と adapter input の 7 test を追加した。
- Phase 4a dependency guard に facade の `benchmarkRunStore` occurrence 7 を固定した。direct dependency key 24 と `Dependencies` 31 key は不変である。
- `memorag-service.ts` を 6,251 行から 6,247 行へ削減し、`benchmarkRunStore` direct occurrence を 9 から 7 へ削減した。
- `DES_DLD_012.md` に Phase 4f boundary、保持 contract、stop 成功後 update 失敗の残余補償負債を追記した。
- canonical generator で 97 API / 582 文書を再生成し、298 API-code file の source location/call graph 差分を同期した。OpenAPI の手動契約変更はない。

## 成果物

- `apps/api/src/benchmark/benchmark-run-cancellation-service.ts`
- `apps/api/src/benchmark/benchmark-run-cancellation-service.test.ts`
- `apps/api/src/benchmark/benchmark-execution-stopper.ts`
- `apps/api/src/benchmark/benchmark-execution-stopper.test.ts`
- `apps/api/src/rag/memorag-service.ts`
- `apps/api/src/rag/memorag-service-contract.test.ts`
- `docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_012.md`
- `docs/generated/api-code/` canonical 差分
- `tasks/do/20260717-1514-issue-359-benchmark-run-cancellation-extraction.md`
- 本レポート

## 検証

成功:

- `node --import tsx apps/api/src/benchmark/benchmark-run-cancellation-service.test.ts`（6 tests）
- `node --import tsx apps/api/src/benchmark/benchmark-execution-stopper.test.ts`（1 test）
- `node --import tsx apps/api/src/rag/memorag-service-contract.test.ts`（4 tests）
- `node --import tsx apps/api/src/routes/benchmark-tenant-boundary.test.ts`（2 tests）
- `npm run typecheck -w @memorag-mvp/api`
- `npm test -w @memorag-mvp/api`（833 tests）
- `npm run docs:openapi`
- `npm run docs:api-code`（97 API / 582 文書）
- `task docs:check`
- `npm run rag:release:source-audit`（dataset-specific branch 0、artifact mismatch 0）
- `npm run ci`（API 833、Web 442、Infra 38、Benchmark 102 を含む全 workspace）
- source audit（facade 6,247 行、`benchmarkRunStore` occurrence 7、direct key 24、facade `StopExecutionCommand` 0）
- `git diff --check`
- GitHub Actions run #29560365472（実装 head `2a44c580`）: 成功（8分54秒、promotion gate は skip）

修復履歴:

- fresh worktree には local `node_modules` がなかったため、lockfile 固定の `npm ci` 後に targeted test、typecheck、API full、root CI を実行した。
- root CI 初回は新規 stopper test の type-only import 1 件を lint が検出した。`import type` へ修正し、root CI と docs freshness を先頭から再実行して成功した。

## 指示への fit 評価

- benchmark cancellation だけの独立 seam とし、他 agent/open Draft の semantic code を変更していない。
- whole `Dependencies`、AWS client、global config、authorization、unrelated mutation capability を新 service へ渡していない。
- public 101 method/signature と route consumer contract は snapshot で不変、tenant/RBAC は既存 authoritative resolver を注入して fail-closed/non-enumeration を維持した。
- RAG retrieval/refusal/citation code、benchmark create/reauthorize/download/cleanup/execution start/query を変更していない。
- production 実装へ benchmark 期待語句、QA sample 固有値、dataset 固有分岐を追加していない。
- HTTP schema/UI/運用/config は不変のため README/API example/OpenAPI 手動更新は不要。詳細設計と canonical API-code docs は同期した。

## 未対応・制約・リスク

- real Step Functions/AWS、実 benchmark、manual UI は未実施。credential、費用、外部状態を伴うか、本変更の port seam に非該当である。
- `npm ci` は既存 dependency graph に 8 vulnerability（low 2、moderate 1、high 5）を報告した。本タスクは lockfile を変更せず、依存更新は別途判断が必要である。
- generated docs は 298 file の機械更新を含み stacked PR 間で path conflict になり得る。base 順に merge/rebase し、最終 base で canonical generator を再実行する必要がある。
- stop 成功後に store update が失敗した場合の compensation/reconciliation は既存同様に存在しない。後続 reliability unit の明示的な負債として残す。
- `benchmarkRunStore` は create/reauthorize/artifact download/cleanup path のため facade direct dependency key に残る。
- merge、deploy、release は指示どおり行わない。

## PR lifecycle

- draft stacked PR: #414 `♻️ Issue #359: benchmark run cancellation を narrow port へ抽出`
- base: `codex/issue-359-benchmark-run-query-extraction`（PR #407）
- label: `semver:patch`
- 日本語 AC コメント: https://github.com/tsuji-tomonori/rag-assist/pull/414#issuecomment-4999727655
- 日本語セルフレビュー: https://github.com/tsuji-tomonori/rag-assist/pull/414#issuecomment-4999727875（blocking 指摘なし）
- GitHub Apps connector は callable でなかったため、repository 規約の fallback として `gh` を使用した。
- task: PR コメント後に `tasks/done/` へ移動済み。
- task completion commit 後の final-head CI、Issue #359 進捗コメント、clean/upstream は post-completion check で確認する。
