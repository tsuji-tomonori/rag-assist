# Issue #358 document owner downgrade rejection 作業完了レポート

## 受けた指示

- Issue #358を停止せず継続し、PR #432後のopen PR ownershipと残gapを再監査する。
- owner判断不要・非重複のbounded unitを専用worktree/taskで実装し、local/full/remote validation、Draft stacked PR、Issue進捗まで完遂する。
- actual AWS/manual operation、merge、deploy、releaseは行わない。

## 要件整理

- FR-077に従い、active same-tenant document administrative principalの`full`をordinary policyで`readOnly`/`deny`へ降格できないようにする。
- FR-085に従い、complete-state versioned replaceはadministrative-principal invariantをCAS commit前に検証する。
- legacy mutationもversioned mutationと同じpost-state invariantを適用する。
- owner `full`、non-owner grant、既存CAS/audit/cleanup/effective permission contractは維持する。

## 検討・判断

- folder policyはadministrative principalの`permissionLevel !== "full"`を拒否する一方、documentは`deny`だけを拒否していたことをroot causeとした。
- effective permissionがmandatory `full`でも、owner `readOnly` entryを保存するとpolicy/audit/reconciliation evidenceが矛盾するため保存時に拒否する。
- callerの`readOnly`を黙って`full`へ変換せず、明示validation errorでfail closedにした。
- owner entryを全面禁止せず、既存互換としてexplicit `full`は許可した。

## 実施作業

- document administrative principalへのordinary user grantが`full`以外かを検証するcommon helperを追加した。
- versioned `validateSharePrincipals`とlegacy `replaceDocumentShareGrants`を同じhelperへ統一した。
- legacy mutationでowner `readOnly`/`deny`を拒否し、grant ledgerとlegacy auditを変更しないtestを追加した。
- versioned mutationでowner `readOnly`/`deny`をdenied auditとして拒否し、grant/cleanupを作らないtestとowner `full` success testを追加した。
- FR-077/FR-085の変更履歴・実装適合を同期した。requirements coverageは両要件が既にservice/testを参照しており変更不要だった。
- `task docs:api-code`で共有serviceのcall graph/line/hashに依存するsource-backed API docsを再生成した。

## 検証

- `npm ci`: 成功。新worktree初回direct testは親worktreeの古い`node_modules`を参照して`ERR_PACKAGE_PATH_NOT_EXPORTED`となり、504 packagesを再構築して解消した。既存npm audit結果は8 vulnerabilities（low 2、moderate 1、high 5）。
- document permission direct suite: 成功。
- broader targeted: document permission/requirements coverage成功。static access policyのdirect初回は必須`RAG_GUARD_PROFILE_JSON`未設定をfail-closed検出し、repository package scriptと同じstandard-safe profileを明示して再実行成功。
- API typecheck: 成功。
- API full coverage: `npm run test:coverage -w @memorag-mvp/api`で905 tests成功。statements/lines 90.75%（58134/64054）、branches 80.26%（13669/17029）、functions 93.5%（3023/3233）。HTTP document share routeも成功。
- `task docs:check`: 初回はsource-backed generated docs staleを検出。`task docs:api-code`で98 APIs/588 docsを生成後、canonical docs、OpenAPI、source freshness、web trace/inventory、infra inventory、hidden Unicodeを含め再実行成功。
- `task verify`: lint、全workspace typecheck/build成功。出力sessionを取り損ねた初回を成功扱いにせず、明示的に再実行してexit 0を確認。既存Vite 500 kB超chunk warningとLambda bundle size warningのみ。
- `npm run rag:release:source-audit`: 成功。audit ID `sha256:0a87c20d06ef7c68974e7363931c7aac05311f53c72f74f2af3d64a9f5569cd5`、dataset-specific branch 0、artifact manifest mismatch 0。
- `npm run ci`: Contract 4、API 905、Web 442、Infra 38、Benchmark 102、lint/typecheck/buildを含め成功。既存size warningのみ。
- `git diff --check`: 成功。
- `pre-commit run`: 全hook成功。
- remote implementation-head CI: run `29585166471`、head `bffb8a924afad9a43e8e4d2237bb2aaf52f2178a`で成功。主要job `Lint, type-check, test, build, and synth`は成功し、本PRで対象外の`Explicit RAG candidate promotion gate`はworkflow条件によりskip。
- remote final-head CIはtask lifecycle commit後に実施し、PRの最終external evidenceへ記録する。

## 成果物

- implementation/test: `apps/api/src/documents/document-permission-service.ts`、同test。
- canonical requirements: FR-077、FR-085。
- generated docs: `docs/generated/api-code/`の依存ファイル。
- task: `tasks/done/20260717-2211-issue-358-document-owner-downgrade-rejection.md`。
- report: `reports/working/20260717-2239-issue-358-document-owner-downgrade-rejection.md`。
- implementation commit: `bffb8a924afad9a43e8e4d2237bb2aaf52f2178a`。
- Draft PR: #434 `https://github.com/tsuji-tomonori/rag-assist/pull/434`。baseはPR #432 branch、labelは`semver:patch`、状態はDraft/open/CLEAN。
- 初回受け入れ条件コメント: `https://github.com/tsuji-tomonori/rag-assist/pull/434#issuecomment-5003921493`。
- 初回セルフレビューコメント: `https://github.com/tsuji-tomonori/rag-assist/pull/434#issuecomment-5003921791`。

## 指示へのfit評価

- Issue #358 P1-Cの明示gapに限定し、folder integrity順序やownership transferへ拡張しなかった。
- public API schema、OpenAPI response、UI、infra、運用手順は変更していない。README/OpenAPI/UI/infra/operationsの追加更新は不要と判断した。
- RAG根拠性・tenant/auth boundaryを弱めず、benchmark期待値・QA sample固有値・dataset固有分岐、production mock fallbackを追加していない。

## 未対応・制約・リスク

- actual legacy ledgerにowner `readOnly` entryが存在するか、migration/repair ownerは未確認。
- read pathで既存owner downgrade entryをunavailable扱いにする判断はdata migration/可用性判断を伴うため本unit外。
- 親folder integrityとadministrative invariantの評価順はIssue #358の別gapとして残る。
- GitHub AppsのPR操作toolは利用できないため、規定fallbackとして`gh`を使用する。
- stacked base PR #432が未mergeのため、本unitはそのfinal headを前提とする。
- actual AWS/manual E2E、merge、deploy、release、production/external state変更は実施していない。
