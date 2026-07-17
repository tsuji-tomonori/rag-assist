# Issue #358 document share tenant fallback fail-closed 作業完了レポート

## 受けた指示

- Issue #358 を停止せず継続し、既存open PRと重複しないowner-freeなbounded unitを選ぶ。
- 専用worktreeとtask mdで実装、検証、文書同期、Draft stacked PR、2段階remote CI、Issue進捗まで完遂する。
- actual AWS操作、manual operation、merge、deploy、releaseは行わない。

## 要件整理

- FR-060に従い、document share grant partitionはcallerや暗黙の`default`ではなくresource manifest由来のtenant evidenceで決める。
- FR-062に従い、document shareのresource/principalを同一tenantへ限定する既存境界を維持する。
- `metadata.tenantId`と`admission.tenantId`の両方が存在する場合はcanonicalかつ一致を必須にし、片方だけが存在する場合はcanonical値を採用する。
- tenant欠損、非string、非canonical、metadata/admission競合はgrant store、audit、principal directoryへ触れる前にfail closedにする。

## 検討・判断

- RCAの根本原因は、authorization decisionとgrant helperが別のtenant resolverを持ち、後者だけがlegacyな`default` fallbackを残したことである。
- admission-only manifestは有効なresource evidenceを持つため互換維持し、metadata欠損だけを理由には拒否しない。
- actor tenantでresource tenantを補完するとresource partitionをcaller contextへ依存させるため採用しなかった。
- tenant-less legacy dataのmigration/backfill、`MemoRagService`等に残る別fallbackはowner・移行判断を要するため本unit外とした。

## 実施作業

- `DocumentPermissionService`のshare info、versioned policy read/replace、legacy replace、principal validationを共通のvalidated manifest tenant resolverへ統一した。
- metadata/admissionのcanonicality、一致、片側fallbackを検証し、欠損・invalid・conflictを`DocumentShareValidationError`で拒否した。
- admission-only manifestが`tenant-a` ledgerだけを読み`default` rowを無視するtestを追加した。
- missing、trim不一致、非string、metadata/admission conflictでdirectory readとobject store touchが0のtestを追加した。
- FR-060/FR-062の実装適合と変更履歴、requirements coverageを同期した。
- `task docs:api-code`でsource-backed API docsを再生成し、`DocumentPermissionService`のcall graph/line freshnessに依存する65 filesを機械更新した。

## 検証

- `npm ci`: 成功。新worktreeが親worktreeの古い`node_modules`を参照した初回test失敗（`ERR_PACKAGE_PATH_NOT_EXPORTED`）を依存関係再構築で解消した。既存のnpm audit結果は8 vulnerabilities（low 2、moderate 1、high 5）。
- API targeted: `node --import tsx --test --test-concurrency=1 src/documents/document-permission-service.test.ts src/rag/requirements-coverage.test.ts src/security/access-control-policy.test.ts`: 3/3 suites成功。
- API typecheck: 初回はtest tableの型推論が`DocumentManifest`に適合せず失敗。明示型を付けて再実行し成功。
- API full coverage: `npm run test:coverage -w @memorag-mvp/api`: 904 tests成功。statements/lines 90.75%（58124/64047）、branches 80.26%（13669/17030）、functions 93.5%（3022/3232）。sandbox内のtargeted HTTP testはlocal server listenで終了したため、影響を明示して承認を得た権限委譲実行でroute testを含むfull suiteを確認した。
- `task docs:check`: canonical docs、OpenAPI、98 APIs/588 docs source freshness、web trace/inventory、infra inventory、hidden unicodeを含め成功。
- `task verify`: lint、全workspace typecheck/build成功。既存のVite 500 kB超chunk warningとLambda bundle size warningのみ。
- `npm run rag:release:source-audit`: 成功。audit ID `sha256:2c749783d2e3d17dffdc3ab33ea18dcd7a4471d0292c20813e11a9bc67c2041d`、dataset-specific branch 0、artifact manifest mismatch 0。
- `npm run ci`: lint、typecheck、contract 4、API 904、Web 442、Infra 38、Benchmark 102、全buildを含め成功。既存size warningのみ。
- `git diff --check`: 成功。
- `pre-commit run`: git-secrets、hidden Unicode、whitespace、large files、merge conflict等を含め成功。
- remote implementation/final-head CIはcommit/PR lifecycleで実施し、本レポートを追記する。

## 成果物

- implementation/test: `apps/api/src/documents/document-permission-service.ts`、同test。
- requirement trace: `apps/api/src/rag/requirements-coverage.test.ts`、FR-060、FR-062。
- generated source-backed API docs: `docs/generated/api-code/`の依存ファイル。
- task: `tasks/done/20260717-2126-issue-358-document-share-tenant-fail-closed.md`。
- report: `reports/working/20260717-2149-issue-358-document-share-tenant-fail-closed.md`。

## 指示へのfit評価

- Issue #358本文のP1-Cにあるgrant helperの暗黙`default`補完除去へ限定し、open PRと重複しないbounded fixとして実装した。
- production route、公開schema、OpenAPI response、UI、infra、運用手順は変更していない。README/OpenAPI/UI/infra/operationsの追加更新は不要と判断した。
- docsと実装を同期し、benchmark固有値・QA sample固有値・dataset固有分岐、production mock fallbackを追加していない。

## 未対応・制約・リスク

- actual AWS上のlegacy object分布、tenant-less manifest件数、manual E2Eは未検証である。
- tenant-less legacy manifestはshare helperで拒否される。必要なmigration/backfillと廃止期限はowner未確定の残課題である。
- GitHub AppsのPR操作toolは利用できないため、規定のfallbackとして`gh`を使用する。
- stacked base PR #430が未mergeのため、本unitはそのfinal headを前提とする。
- merge、deploy、release、production/external state変更は実施していない。

## PR・remote evidence

- implementation commit: `f3396a9223116b609ec76dfe4a5707f53d35f597`
- Draft stacked PR: #432（base: `codex/issue-358-fr086-folder-archive-cleanup`）
- label: `semver:patch`
- implementation-head GitHub Actions: run `29581813956` success（6m39s）
- 日本語受け入れ条件コメント: `issuecomment-5003479077`
- 日本語セルフレビューコメント: `issuecomment-5003479074`
- final-head GitHub Actions、Issue #358進捗、clean/upstream/remote一致はfinal evidence commit後に確認し、PR/Issue commentと最終報告へ記録する。
