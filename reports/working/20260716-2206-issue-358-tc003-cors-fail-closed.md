# Issue #358 TC-003 design record / CORS fail-closed 作業レポート

- 作成日時: 2026-07-16 22:06 JST
- branch: `codex/issue-358-tc003-cors-fail-closed`
- stacked base: `codex/issue-358-guard-profile-validation` final head `a1291e23`
- merge順 blocker: PR #365 → PR #369 → 本PR

## 受けた指示

`TC-003` の目標構成と安全な移行順を正規 design / ADR に記録し、現在の API / IaC の wildcard CORS を共有 contract による fail-closed 設定へ統一する。CloudFront `/api/*`、Hosted UI + PKCE、WebSocket ticket、SPA direct origin除去、signupは後続とし、公開endpoint、認証・認可、tenant/resource境界、RAG safetyを弱めない。benchmark、release-audit、Web UI、PR #338領域は変更しない。

## 要件整理と判断

- production stage はCloudFront単一入口を根拠に、明示したHTTPS exact origin 1件だけを許可する。
- deployed dev / preview / staging もAPI Gatewayのstatic responseとLambda runtimeを一致させるため、明示 exact origin 1件を要求する。HTTP localhostはdev stageだけ許可する。
- standalone local/testだけは、明示 exact origin複数件または単独の明示 wildcardを許可し、unset/blankをheaderなしとして扱う。
- `NODE_ENV=production` と `DEPLOYMENT_ENVIRONMENT=dev` のCDK Lambdaはdev origin規則を使いつつ、exact 1件・wildcard禁止を維持する。`DEPLOYMENT_ENVIRONMENT=prod` は `NODE_ENV` に関係なくHTTPS exact 1件を要求する。
- CDK context `corsAllowedOrigins` をdeployed stackの唯一設定源とし、Lambda env、API Gateway preflight、default 4xx/5xxへ同じ値を配布する。
- CloudFront distribution tokenをLambda envへ自動注入すると後続 `/api/*` behaviorでCloudFormation dependency cycleを作り得るため、確定済みpublic originをcontextへ明示する。

## 実施作業

- `packages/contract/src/cors.ts` に副作用のないdeployment environment / CORS origin parserを追加し、NodeNext subpath exportへ公開した。
- productionのunset、blank、wildcard、HTTP、malformed、path/query/credential、duplicate、multiple、localhost、IPv4/IPv6 loopbackを拒否するunit testを追加した。
- API configをshared parserへ移行し、暗黙wildcardを廃止した。production stageとproduction runtimeの組合せをsubprocess testで固定した。
- CDK synth前にdeployed CORSを検証し、Lambda、preflight、default 4xx/5xxへ同じexact originを設定した。`DEPLOYMENT_ENVIRONMENT` も型付きruntime envへ追加した。
- Taskfile local APIと`infra/cdk.json`のdev設定へ `http://localhost:5173` を明示した。repository defaultがprodへ漏れないnegative synth testを追加した。
- `DES_HLD_002` と `ARC_ADR_005` にtarget topology、責務、migration order、rollback/blocker、後続PR境界を記録し、要求/API設計の参照を同期した。
- CDK snapshot、generated infra inventory、source-backed generated API docsをgeneratorで同期した。

## 成果物

- shared contract: `packages/contract/src/cors.ts`, `packages/contract/src/cors.test.ts`
- API runtime / security tests: `apps/api/src/config.ts`, `apps/api/src/contract/api-hardening.test.ts`, `apps/api/src/security/access-control-policy.test.ts`
- IaC / tests: `infra/lib/memorag-mvp-stack.ts`, `infra/test/memorag-mvp-stack.test.ts`, CDK snapshot, `infra/cdk.json`
- canonical design: `docs/3_設計_DES/01_高レベル設計_HLD/DES_HLD_002.md`, `docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_005.md`
- trace / generated docs: TC-003要求・変更管理・API設計、generated API / infra inventory
- task: `tasks/do/20260716-2104-issue-358-tc003-cors-fail-closed.md`

README、UI docs、API exampleは公開API shapeとWeb UI behaviorを変更しないため更新不要と判断した。

## 検証結果

- `node --import tsx --test packages/contract/src/cors.test.ts`: pass
- contract / API / infra typecheck: pass
- targeted API hardening + security policy: 30 / 30 pass
- `npm test -w @memorag-mvp/infra`: 5 test files pass
- `task docs:check`: pass（canonical、OpenAPI、API code 97 APIs / 582 docs、Web trace/inventory、infra inventory、hidden Unicode）
- `git diff --check`: pass
- root `npm run ci`: 再実行でpass
  - lint: pass
  - all workspace typecheck: pass
  - contract: 4 / 4 pass
  - API: 809 / 809 pass
  - Web: 442 / 442 pass
  - infra: 40 / 40 pass
  - benchmark: 102 / 102 pass
  - all workspace build: pass

初回root CIでは、3 worktreeのAPI suite並行実行中に `document-reader-routes.test.ts` が固定範囲 `18800 + random(300)` のlocal server port衝突と整合するcanonical path重複で1件失敗した。同testの単独再実行はpassし、その後のroot CI再実行でも同testを含むAPI 809 / 809がpassした。CORS差分外のproduction code変更では隠していない。

## 指示へのfit評価

- TC-003の目標と移行順を正規文書へ固定し、本PRの実装をCORS fail-closedだけに限定した。
- production stageの不安全な設定をAPI起動前またはCDK synth前に拒否し、deployed devとの自己矛盾も組合せtestで防止した。
- 公開endpoint、route permission、ownership、tenant、RAG実装は変更していない。
- benchmark、release-audit、Web UI、PR #338領域のproduct fileは変更していない。root CIによる既存test/buildだけを実施した。

## 未対応・制約・リスク

- CloudFront `/api/*` / `/ws/*` behavior、SPA direct origin除去、Hosted UI + PKCE、WebSocket ticket、signupは後続PRであり、TC-003全体は未達のまま。
- 本PRはPR #365とPR #369にstackしている。前段merge前のmergeは禁止する。
- `npm ci` は成功したが、既存dependency vulnerability 8件（low 2、moderate 1、high 5）を報告した。本タスクでは自動fixしていない。
- PR作成、受け入れ条件コメント、セルフレビュー、task done、final-head GitHub CI確認は初回commit/push後に追記する。
- merge、deploy、releaseは実施しない。
