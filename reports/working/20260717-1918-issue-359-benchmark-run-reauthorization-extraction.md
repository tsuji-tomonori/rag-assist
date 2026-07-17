# Issue #359 Phase 4i: benchmark run reauthorization 抽出 作業レポート

- 作業日時: 2026-07-17 17:58–19:18 JST
- Issue: #359
- stacked base: PR #421 / `codex/issue-359-benchmark-execution-starter-extraction`
- 作業ブランチ: `codex/issue-359-benchmark-run-reauthorization-extraction`
- 状態: PR lifecycle 実施中

## 受けた指示

PR #421 final head を起点に、既存 PR #406–#421 と重複しない Phase 4 残存責務から最小 bounded unit を RCA し、worktree/task/受け入れ条件、実装、production-quality test、docs、local/full CI、日本語 gitmoji commit、stacked Draft PR、semver、AC/self-review、task/report、final-head CI、Issue 進捗、clean/upstream 一致まで完遂する。merge / deploy / release は行わず、actual AWS / manual UI の未検証を明示する。

## 要件整理と判断

PR #407 の query、#414 の cancellation、#418 の artifact download、#421 の execution start mapping を確認し、未抽出の `reauthorizeBenchmarkRunExecution` を Phase 4i の最小単位に選定した。create orchestration は入力検証・run construction・実行開始を含み広く、revocation cleanup driver は object store / manifest / durable reconciliation を含むため、今回の rollback unit から除外した。

根本原因は、worker reauthorization の run state transition と facade-owned current authorization / cleanup composition の間に明示的な service port 境界がなく、facade が tenant-scoped lookup、status guard、revoked update、cleanup trigger を直接実行していたことである。是正として store `get/update`、authorization callback、cleanup callback、clock だけを受ける service を追加した。

## 実施作業

- `BenchmarkRunReauthorizationService` と narrow ports を追加した。
- missing / cross-tenant non-enumeration、boundary/status matrix、success no-write、single-clock revoke transition、update→cleanup→original error rethrow、non-permission failure、update failure を8 test で固定した。
- `MemoRagService` constructor で facade-owned authorization / cleanup を callback port として compose し、public method を one-line delegate にした。
- facade source contract の direct dependency evidence を Phase 4i に同期した。
- `DES_DLD_012.md` に責務境界、保持 contract、残存 create / cleanup、actual AWS gap を追記した。
- canonical API-code docs を再生成し、97 APIs / 582 documents の freshness を確認した。

## 成果物

- `apps/api/src/benchmark/benchmark-run-reauthorization-service.ts`
- `apps/api/src/benchmark/benchmark-run-reauthorization-service.test.ts`
- `apps/api/src/rag/memorag-service.ts`
- `apps/api/src/rag/memorag-service-contract.test.ts`
- `docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_012.md`
- `docs/generated/api-code/`
- `tasks/do/20260717-1758-issue-359-benchmark-run-reauthorization-extraction.md`

README、public HTTP/OpenAPI、API examples、Web UI、運用設定は public contract と操作を変更していないため内容更新不要と判断し、OpenAPI / docs freshness check で非影響を確認した。

## 検証結果

- `npm ci`: 成功。504 packages を導入。既存 audit は 8 vulnerabilities（low 2 / moderate 1 / high 5）を報告し、lockfile 変更なし。
- targeted service / worker / facade contract tests: 初回は新 import の source inventory expectation が不足して contract test のみ失敗。expectation を同期後、全対象成功。
- targeted ESLint: 成功。
- API typecheck: 成功。
- `task docs:api-code`: 成功（97 APIs / 582 API documents）。
- API full test: sandbox 内の初回は 118 files 中 113 pass、5 files が `tsx` Unix socket の `listen EPERM` で失敗。実装 failure ではなく sandbox 制約と確認し、同一コマンドを承認済み権限で再実行して 853 / 853 tests 成功。
- root `npm run ci`: 成功。lint、全 workspace typecheck、Contract 1 / API 853 / Web 442 / Infra 38 / Benchmark 102 tests、全 workspace build を完走。
- `task docs:check`: 成功。docs validation、OpenAPI quality、API-code freshness、Web trace / inventory、Infra inventory、hidden Unicode check を完走。
- `npm run rag:release:source-audit`: 成功。audit `sha256:151719916db1e342554afa7cdd14141d32d66b1e42ae0d32b130d7a715b27959`、dataset-specific branch 0、artifact mismatch 0。
- `git diff --check`: 成功。
- staged pre-commit / GitHub Actions: PR lifecycle で実施予定。

## 指示への fit 評価

実装・test・docs・ローカル全量検証は要求に適合する。policy / cleanup driver、worker event/output、route/RBAC、tenant/non-enumeration、RAG trust は変更していない。stacked Draft PR、semver、AC/self-review、task done、final-head CI、Issue 進捗、clean/upstream 一致は後続 lifecycle で記録するため、現時点は partially complete である。

## 未対応・制約・リスク

- actual Step Functions worker、IAM、DynamoDB、S3 cleanup は credential、課金、外部状態を伴うため未検証であり、local/GitHub CI を actual AWS 成功の代替とは扱わない。
- UI 変更がないため manual UI は未実施。
- GitHub Apps の callable connector が利用できないため、GitHub 操作は `gh` fallback を使用し、その理由を PR / Issue に明記する。
- merge / deploy / release は実施しない。
- Phase 4 の残存は benchmark create orchestration と revocation cleanup driver である。
