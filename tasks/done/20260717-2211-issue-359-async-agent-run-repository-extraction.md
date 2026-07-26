# Issue #359 Phase 4l: async-agent run repository 抽出

- 状態: done
- タスク種別: リファクタリング
- Issue: #359
- stacked base: PR #431 / `codex/issue-359-benchmark-run-creation-extraction`
- exact base: `65d10e588618e60fb2e45230879c94e2b5b87b63`

## 背景

Issue #359 Phase 4a〜4k は `MemoRagService` の bounded responsibility を段階抽出した。次の候補である async-agent 全実行 orchestration は認可、外部 provider 実行、artifact writeback、補償を横断して大きい。一方、tenant partition された run metadata の list/get/save は object-store port だけで閉じる独立 responsibility であり、安全に先行抽出できる。

## 目的

公開 method、route/RBAC、async-agent execution/auth/writeback の順序を変えず、`loadAsyncAgentRuns`、`loadAsyncAgentRun`、`saveAsyncAgentRun` と key/normalize/integrity/legacy migration 判定を narrow `AsyncAgentRunRepository` へ抽出する。

## スコープ

- `AsyncAgentRunRepository` と narrow object-store port の追加
- tenant prefix/list allowlist、get/save、normalize、integrity、legacy migration の production-quality test
- `MemoRagService` constructor composition と private persistence call の repository delegate 化
- facade source-backed dependency evidence、Phase 4 詳細設計、canonical API-code docs の同期

対象外:

- async-agent public signatures、routes、schemas、RBAC、non-enumeration behavior
- create/execute/cancel、worker boundary authorization、provider invocation、artifact writeback/cleanup
- object-store adapter、tenant partition algorithm、AWS/IAM/Step Functions
- RAG retrieval/refusal/citation/trust、Web UI
- merge/deploy/release、actual AWS/manual UI verification

## なぜなぜ分析

### 問題文

`MemoRagService` が async-agent run の domain orchestration に加えて object key、tenant-scoped list allowlist、legacy key migration detection、deserialize defaults、tenant storage integrity assertion、JSON persistence を直接所有するため、storage fail-closed contract を狭い unit として検証・rollbackできない。

### confirmed

- current scoped key は `agent-runs/${tenantPartitionId(tenantId)}/runs/${encodeURIComponent(agentRunId)}.json` である。
- list は tenant prefix を使い、`^agent-runs/tenant:[a-f0-9]{24}/runs/[^/]+\.json$` に一致する key だけを読む。
- deserialize は missing `runId` を `agentRunId`、missing `workspaceMounts` / `artifactIds` / `artifacts` を空配列で補う。
- decoded run の `tenantId` が requested tenant と異なる場合は storage integrity error として fail closed にする。
- scoped object が missing の場合だけ legacy unscoped key `agent-runs/${encodeURIComponent(agentRunId)}.json` を probe し、存在すれば migration-required error、双方 missing なら `undefined`、非 missing error は伝播する。
- save は scoped key へ pretty JSON を `application/json; charset=utf-8` で書く。
- existing facade tests は same/cross-tenant visibility、missing variants、non-missing error を characterization している。
- repository は `listKeys`、`getText`、`putText` と `AsyncAgentRun` / `tenantPartitionId` だけで実装でき、broad `Dependencies`、facade、auth provider、global config は不要である。

### inferred

- async-agent metadata 機能追加時に storage mapping が facade private helper として実装され、execution responsibility と同じ class に残った。
- facade integration tests は public authorization behavior を広く覆うが、malformed list key、same raw ID tenant isolation、normalization、legacy detection の storage contract を狭い production unit で直接固定していない。

### conflict / open_question

- legacy unscoped object の自動 migration/delete は tenant ownership を安全に決定できず、owner/operations policy と破壊的 mutation が必要なため行わない。現行どおり migration-required error で fail closed にする。
- malformed JSON/schema validation の強化は product behavior 変更となるため本 unit では行わず、JSON parse error と tenant integrity error をそのまま伝播する。
- list の個別 missing/read failure を skip する recovery は現行 behavior を変えるため導入しない。
- actual S3/AWS、legacy migration tooling、manual UI はこの local/GitHub lifecycle では検証しない。

### 根本原因

async-agent run persistence に明示的な repository/port 境界がなく、storage namespace、compatibility、integrity contract が broad facade の private helper に埋め込まれている。そのため、tenant fail-closed behavior と legacy handling が async-agent execution 変更から独立して検証・変更できない。

### 是正方針

- list/get/save の storage responsibility 全体を `AsyncAgentRunRepository` へ移し、key helper だけの部分抽出にしない。
- constructor dependency は `Pick<ObjectStore, "listKeys" | "getText" | "putText">` 相当の narrow port のみにする。
- facade は repository を既存 object store で compose し、public/private orchestration の load/save call site を repository へ委譲する。
- repository unit test で tenant namespace/allowlist/isolation、normalization、integrity、missing/legacy/nonmissing error、save mapping を固定する。
- facade/full CI/docs/source audit を実行し、公開 API、認可、execution/writeback、RAG trust の非変更を確認する。

## 実施計画

1. repository storage contract の test を先に追加する。
2. narrow repository を実装し、facade constructor composition と call site delegate を行う。
3. facade contract/source dependency evidence を更新する。
4. `DES_DLD_012.md` と canonical API-code docs を同期する。
5. targeted/full validation、source audit、pre-commit を実行し、失敗時は修復して再実行する。
6. commit/push、Draft stacked PR、semver、AC/self-review、report/task done、final-head CI、Issue #359 progress を完遂する。

## 受け入れ条件

- [x] repository は `listKeys`、`getText`、`putText` の narrow port だけに依存し、broad `Dependencies`、facade、auth/provider、AWS client、global config を import しない。
- [x] list は requested tenant の exact hashed prefix だけを使用し、strict key allowlist 外、nested path、他 tenant key を読まない。
- [x] same raw run ID を異なる tenant に保存・取得しても衝突・漏えいせず、decoded tenant mismatch は fail closed で reject する。
- [x] get/list は legacy-compatible defaultsとして missing `runId`、`workspaceMounts`、`artifactIds`、`artifacts` だけを現行どおり正規化する。
- [x] scoped/legacy の双方 missing は `undefined`、scoped missingかつ legacy present は cause 付き migration-required error、非 missing read/parse error は伝播する。
- [x] save は exact tenant-scoped encoded key、pretty JSON、`application/json; charset=utf-8` を用いる。
- [x] facade public signatures、route/RBAC/non-enumeration、create/cancel/execute authorization order、provider/artifact writeback、RAG trust、schemasを変更しない。
- [x] facade から async-agent key/normalize/integrity/private object-store persistence implementation が除去され、repository delegate だけになる。
- [x] targeted tests/lint、API typecheck/full、root `npm run ci`、docs generation/check、source audit、`git diff --check`、pre-commit が成功する。
- [x] Draft stacked PR #433 に `semver:patch`、日本語 AC/self-review、report/task done、implementation-head CI を記録した。final-head CI と Issue #359 progress は lifecycle commit push 後に外部証跡として記録する。

## 完了証跡

- implementation commit: `893456885f19a56ecd16dd1fc0802f5e7073db9e`
- Draft stacked PR: #433
- stacked base: PR #431 branch / `65d10e588618e60fb2e45230879c94e2b5b87b63`
- semver: `semver:patch`
- AC comment: `issuecomment-5003909093`
- self-review comment: `issuecomment-5003910438`
- implementation-head GitHub Actions: success（8m48s、run `29585023213`）
- final-head GitHub Actions と Issue #359 progress: lifecycle commit push 後に外部証跡として記録する。

## Done 条件

- 上記成果物、全受け入れ条件、選定検証、Draft stacked PR lifecycle がすべて完了している。
- 未解決 validation failure を残さず、actual AWS/manual/legacy migration の未検証範囲を PR・report に明記する。
- merge/deploy/release は実行しない。

## ドキュメント保守計画

- `docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_012.md` に Phase 4l repository ports、tenant key/list allowlist、normalize/integrity、legacy fail-closed contract を追記する。
- source/call graph が変わるため canonical API-code generator を実行する。
- HTTP/OpenAPI、README、Web UI、worker/infra operations は不変のため手動更新せず、docs freshness/check で確認する。

## 検証計画

- targeted repository / facade async-agent / facade contract tests
- targeted ESLint
- `npm run typecheck -w @memorag-mvp/api`
- `npm run test -w @memorag-mvp/api`
- root `npm run ci`
- `task docs:api-code`、`task docs:check`
- `npm run rag:release:source-audit`
- `git diff --check`
- staged `pre-commit run`
- GitHub Actions implementation-head / final-head MemoRAG CI

## PR レビュー観点

- caller/raw tenant ID が object key へ露出せず、hashed tenant partition と encoded run ID を維持すること
- list allowlist が nested/cross-tenant/malformed keyを読まないこと
- tenant mismatch、legacy unscoped object、nonmissing store error を false absence にしないこと
- public auth/non-enumeration、execution/writeback side-effect order が不変であること
- docs/generated docs/source guard が同期し、mock/dataset 固有分岐を追加しないこと

## リスク

- actual S3 behavior と legacy migration tooling は local/GitHub CI では検証しない。
- canonical API-code generation は facade line/call graph 変更により多数の機械差分を生成し得る。
- stacked PR は既存 Issue #359 chain と PR #431 の順序が必要である。
