# Issue #359 Phase 4n 作業完了レポート

## 指示・要件

Phase4m final headから残存debtを再監査し、安全な非重複unitを継続する。async-agent runのread-only list/get/artifact projectionだけをnarrow serviceへ抽出し、tenant/RBAC/non-enumerationとrepository failureを不変にする。merge/deploy/releaseは行わない。

## 判断

- create/cancel/execute/selection authorization/provider/artifact persistence/writebackを避け、read-only queryだけをcomplete responsibilityとして選定した。
- listはrequester一致またはmanaged permission、getはtenant/self/managed permissionという既存式の差を検出し、`canListRun`と`canGetRun`を別portとして維持した。
- repository lookupをauthorizationより先に保ち、cross-tenant/missingを同じ`undefined`として非列挙を維持した。
- open PR #432/#434のproduction sourceとは非重複。#339は同じ巨大facadeを含む旧PRのため、機械的競合余地をPRへ明記した。

## 成果物

- `apps/api/src/async-agent/async-agent-run-query-service.ts`
- `apps/api/src/async-agent/async-agent-run-query-service.test.ts`（5 tests）
- facade composition/delegate、DES Phase4n、canonical API-code docs（97 APIs / 582 documents）
- task `tasks/done/20260718-0007-issue-359-async-agent-run-query-service-extraction.md`
- Draft stacked PR #436（base #435 exact `a988f8e7`、`semver:patch`）

## 検証

- `npm ci`: success、既存8 vulnerabilities、dependency変更なし
- targeted query/repository/facade contract: 3/3 success
- targeted ESLint / API typecheck: success
- API full: 890/890 success
- root `npm run ci`: success（API 890、Web 442、Benchmark 102を含む全workspace lint/typecheck/test/build）
- docs generation/check: success（97 APIs / 582 documents）
- source audit: dataset-specific branch 0 / artifact manifest mismatch 0
- `git diff --check`: success
- staged pre-commit: success
- implementation-head GitHub CI: success（7分24秒、run `29592276195`、promotion gate skipped）
- initial AC `issuecomment-5004837037`、self-review `issuecomment-5004837237`
- final-head CIはPRの最終検証コメント、Issue progressはIssue #359の進捗コメントへfinal-head監査後に記録する

## fit・制約

authoritative tenant、list/get固有の認可式、sort/limit、missing-before-auth、403、error propagation、authorized artifact projectionをtest固定した。route/schema/RAG/no-mock/UIは非変更。actual S3/AWS、manual UIは未実施で、local/GitHub CIをactual AWS成功の代替とは扱わない。既存Vite chunk warningとGitHub Actions Node.js 20 deprecated annotationは残る。
