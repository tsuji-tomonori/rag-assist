# Issue #359 Phase 4e BenchmarkRunQueryService 抽出 作業完了レポート

- 作成日時: 2026-07-17 13:19 JST
- Issue: #359
- branch: `codex/issue-359-benchmark-run-query-extraction`
- stacked base: PR #403 final head `486c3428`
- 状態: 実装・local validation 完了、draft PR lifecycle 実施中

## 受けた指示

PR #403 完遂後の Issue #359 残件と既存 Draft stacked PR 群を再確認し、重複しない次の最小 service-boundary extraction unit を選ぶ。専用 worktree/task から実装・検証、日本語 Draft PR、semver、AC/self-review、report/task done、final-head CI、Issue 進捗、clean/upstream まで完遂し、公開 facade API/署名互換、dependency/line-count 改善、auth/RAG 境界不変を明示する。merge、deploy、release は行わない。

## 要件整理と判断

- current stack #390 → #393 → #397 → #403 と全 open PR の変更ファイルを監査した。
- #387 の conversation history/chat/RAG、#339 の usage/cost/admin、#76 の alias、security/resource-group、schema/auth の open scope と重ならない benchmark read-only query/log projection を選んだ。
- `listBenchmarkRuns` / `getBenchmarkRun` / `getBenchmarkCodeBuildLogText` は store `list` / `get`、optional log reader `getText`、authoritative tenant resolver だけで閉じる。
- cancel、download URL、artifact cleanup、create/reauthorize/execution、AWS/config/mutation/auth policy は facade に残す。
- 公開 101 method/signature、tenant non-enumeration、missing run 時 reader 非呼び出し、log reference、filename/content disposition を不変条件とした。

## 実施作業

- `BenchmarkRunQueryService` と read-only narrow port を追加した。
- `MemoRagService` の benchmark public 3 method を同 service へ委譲した。
- narrow-port source guard、authoritative tenant list/get、cross-tenant non-enumeration、optional reader、missing log、reference/attachment metadata の 5 domain test を追加した。
- Phase 4a dependency characterization から facade direct `codeBuildLogReader` read を除き、direct dependency key を 25 から 24 へ更新した。`Dependencies` 31 key の composition contract は不変である。
- `memorag-service.ts` を 6,259 行から 6,251 行へ削減した。
- `DES_DLD_012.md` に Phase 4e boundary、保持 contract、残余 benchmark mutation/execution/artifact debt を追記した。
- canonical generator で 97 API / 582 文書を再生成し、298 API-code file の source location/call graph 差分を同期した。OpenAPI 差分はない。

## 成果物

- `apps/api/src/benchmark/benchmark-run-query-service.ts`
- `apps/api/src/benchmark/benchmark-run-query-service.test.ts`
- `apps/api/src/rag/memorag-service.ts`
- `apps/api/src/rag/memorag-service-contract.test.ts`
- `docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_012.md`
- `docs/generated/api-code/` canonical 差分
- `tasks/do/20260717-1153-issue-359-benchmark-run-query-extraction.md`
- 本レポート

## 検証

成功:

- `node --import tsx apps/api/src/benchmark/benchmark-run-query-service.test.ts`（5 tests）
- `node --import tsx apps/api/src/rag/memorag-service-contract.test.ts`（4 tests）
- `node --import tsx apps/api/src/routes/benchmark-tenant-boundary.test.ts`（2 tests）
- `npm run typecheck -w @memorag-mvp/api`
- `npm test -w @memorag-mvp/api`（826 tests）
- `npm run build -w @memorag-mvp/api`
- `npm run docs:openapi`
- `npm run docs:api-code`（97 API / 582 文書）
- `task docs:check`
- `npm run rag:release:source-audit`（dataset-specific branch 0、artifact mismatch 0）
- `npm run ci`（API 826、Web 442、Infra 38、Benchmark 102 を含む全 workspace）
- `git diff --check`

修復履歴:

- fresh worktree の初回 contract/route test は local `node_modules` がなく、親 worktree の古い workspace package を解決して `@memorag-mvp/contract` exports 不一致となった。lockfile 固定の `npm ci` 後に targeted test/typecheck/API full/root CI を再実行して成功した。
- OpenAPI generator は sandbox 内で `tsx` Unix socket 作成が `EPERM` となった。repository 手順どおり同じ固定 generator と、解決コマンド確認済み `task docs:check` を権限委譲し、両方成功した。

## 指示への fit 評価

- benchmark read-only query/log projection だけの独立 seam とし、既存 Draft 群の conversation history/chat/RAG/usage/admin/alias/security code を変更していない。
- whole `Dependencies`、AWS client、global config、authorization、mutation capability を新 service へ渡していない。
- 公開 101 method/signature と route consumer contract は snapshot で不変、tenant/RBAC は既存 authoritative resolver を注入して fail-closed/non-enumeration を維持した。
- RAG retrieval/refusal/citation code、benchmark create/cancel/download/execution/artifact cleanup を変更していない。
- production 実装へ benchmark 期待語句、QA sample 固有値、dataset 固有分岐を追加していない。
- HTTP schema/UI/運用/config は不変のため README/API example/OpenAPI 手動更新は不要。詳細設計と canonical API-code docs は同期した。

## 未対応・制約・リスク

- real CodeBuild/CloudWatch/AWS、実 benchmark、manual UI は未実施。credential、費用、外部状態を伴うか、本変更の port seam に非該当である。
- `npm ci` は既存 dependency graph に 8 vulnerability（low 2、moderate 1、high 5）を報告した。本タスクは lockfile を変更せず、依存更新は別途判断が必要である。
- generated docs は 298 file の機械更新を含み stacked PR 間で path conflict になり得る。base 順に merge/rebase し、最終 base で canonical generator を再実行する必要がある。
- `benchmarkRunStore` は create/cancel/reauthorize/cleanup path のため facade direct dependency に残る。mutation/execution/artifact boundary は後続の独立 unit で扱う。
- merge、deploy、release は指示どおり行わない。

## PR lifecycle

- draft stacked PR: 未作成
- base: `codex/issue-359-agent-provider-catalog-extraction`（PR #403）
- label: `semver:patch` 予定
- 日本語 AC コメント / セルフレビュー / final-head CI / Issue #359 進捗: PR 作成後に実施
- task: PR コメント後に `tasks/done/` へ移動予定
