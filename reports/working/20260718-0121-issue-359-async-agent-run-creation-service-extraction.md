# Issue #359 Phase 4o 作業完了レポート

## 指示・要件

Phase4n final headから残存debtを再監査し、owner/security policy境界を越えないsafe unitを継続する。async-agent run createだけをnarrow serviceへ抽出し、selection authorization、provider execution、cancel/execute/writebackを不変にする。merge/deploy/releaseは行わない。

## 判断

- cancelはexternal provider stop policy、execute/writebackはstate/security policyを含むため見送り、createだけを選定した。
- selection authorizationはfacade callback、providerはdefinition lookupだけをportとして注入し、document/folder permissionやadapter executionを移動しなかった。
- 既存`uniqueStrings`のsortを差分監査で検出し、逆順input testでtrim/dedupe/sortを固定した。
- #432/#434 production sourceとは非重複。#339は同じ巨大facadeを含む旧PRのため機械的競合余地を明記した。

## 成果物

- `apps/api/src/async-agent/async-agent-run-creation-service.ts`
- `apps/api/src/async-agent/async-agent-run-creation-service.test.ts`（5 tests）
- facade composition/delegate、DES Phase4o、canonical API-code docs（97 APIs / 582 documents）
- task `tasks/done/20260718-0051-issue-359-async-agent-run-creation-service-extraction.md`
- Draft stacked PR #437（base #436 exact `30f98a7c`、`semver:patch`）

## 検証

- `npm ci`: success、既存8 vulnerabilities、dependency変更なし
- targeted creation/query/facade contract: 3/3 success
- targeted ESLint / API typecheck: success
- API full: 895/895 success
- root `npm run ci`: success（API 895、Web 442、Benchmark 102を含む全workspace lint/typecheck/test/build）
- docs generation/check: success（97 APIs / 582 documents）
- source audit: dataset-specific branch 0 / artifact manifest mismatch 0
- `git diff --check` / staged pre-commit: success
- implementation-head GitHub CI: success（9分01秒、run `29595155560`、promotion gate skipped）
- initial AC `issuecomment-5005179866`、self-review `issuecomment-5005180107`
- final-head CIはPR最終検証コメント、Issue progressはIssue #359進捗コメントへfinal-head監査後に記録する

## fit・制約

authorization-before-effects、queued/blocked no-mock、actor snapshot、canonical selection/mount、save failureをtest固定した。route/schema/RAG/UIは非変更。actual S3/AWS/manual UIは未実施で、local/GitHub CIを代替とは扱わない。既存Vite chunk warning、GitHub Actions Node.js 20 deprecated annotationは残る。
