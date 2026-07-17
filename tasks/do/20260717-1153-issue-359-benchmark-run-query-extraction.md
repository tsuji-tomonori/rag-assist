# Issue #359 Phase 4e: BenchmarkRunQueryService の narrow-port 抽出

- 状態: do
- タスク種別: 修正
- Issue: #359
- 対象 branch: `codex/issue-359-benchmark-run-query-extraction`
- stacked base: `codex/issue-359-agent-provider-catalog-extraction`（PR #403 final head `486c3428`）

## 背景

Issue #359 Phase 4a / PR #390 は `MemoRagService` の 101 public method と 31 dependency key を characterization し、Phase 4b / #393 は favorite、Phase 4c / #397 は human question、Phase 4d / #403 は provider catalog を narrow-port service へ分離した。current stacked baseline では benchmark run の一覧・単件取得・CodeBuild log 取得が facade 内で `benchmarkRunStore` と `codeBuildLogReader` を直接参照している。

## 着手前 overlap 監査と選定理由

- current stack は #390 → #393 → #397 → #403。本タスクは #403 final head を base とし、既抽出 domain を変更しない。
- open PR #387 は conversation history / chat / RAG、#339 は usage / cost / admin、#76 は alias、security/resource-group 系 PR は認可・管理 API を変更するため、これらの boundary を避ける。
- #370 は repository-level benchmark 正本パス、#373/#378/#385 は benchmark UI を変更し、API benchmark run query 実装とは重複しない。
- #380/#387/#393/#397/#403 は source line 由来の benchmark generated docs を機械更新するが、benchmark run query service の semantic code path は変更しない。stacked base 順の再生成が必要な機械的競合として PR に明記する。
- `listBenchmarkRuns` / `getBenchmarkRun` / `getBenchmarkCodeBuildLogText` は tenant-scoped read-only query と log projection に閉じる。cancel、download URL、artifact cleanup、execution、authorization mutationを対象外にすることで次の最小 extraction unit とする。

## なぜなぜ分析（軽量 RCA）

### 問題文

current stacked baseline の `MemoRagService` は benchmark run の read-only query と CodeBuild log response projection を直接保持し、optional `codeBuildLogReader` を facade から読む。公開 facade API、tenant non-enumeration、log reference、filename/content disposition、authorization/RAG 境界は変えてはならない。

### confirmed

- public method は `listBenchmarkRuns`、`getBenchmarkRun`、`getBenchmarkCodeBuildLogText` の 3 件で、Phase 4a signature snapshot に固定されている。
- list/get は `authoritativeActorTenantId(actor)` を store partition に渡し、他 tenant の run を列挙・取得しない。
- log 取得は tenant-scoped run がない場合 reader を呼ばず `undefined`、reader 未設定または text 未取得でも `undefined` を返す。
- log reader に渡す値は run の build ID / log group / log stream で、download filename は run ID の非許可文字を `_` に置換する。
- 最小 capability は `BenchmarkRunStore` の `list` / `get`、`CodeBuildLogReader` の `getText`、authoritative tenant resolver だけである。

### inferred

- benchmark read model と log projection の boundary が明示されず、composition facade が adapter を直接操作していることが `codeBuildLogReader` direct dependency 残存の原因である。
- cancel/download/artifact cleanup/execution を同時に抽出すると AWS/config/mutation/auth を含み、最小 service-boundary unit を超える。

### open_question

- benchmark create/cancel/reauthorize/artifact download/cleanup/execution をどの mutation service に分離するかは後続 unit で決定する。
- benchmark query の pagination/list limit は現 public API に存在しないため本タスクでは追加しない。

### root cause と対策対応

- 根本原因: tenant-scoped benchmark read と log projection の capability が domain boundary として表現されず、facade が store/reader を直接操作している。
- 対策: `BenchmarkRunQueryService` に `list` / `get` / `getText` と tenant resolver の narrow port だけを注入し、public 3 method を委譲する。
- 効果指標: 101 public method/signature snapshot 不変、facade の `codeBuildLogReader` direct read 0、direct dependency key は 25 から 24、`memorag-service.ts` は 6,259 行未満になる。

## Scope

### In scope

- `BenchmarkRunQueryService` と read-only narrow port の追加
- benchmark run list/get/log public 3 method の委譲
- tenant partition、non-enumeration、reader call/reference、filename/content disposition の characterization test
- Phase 4a dependency guard と `DES_DLD_012.md` の同期
- canonical source-backed API docs の同期

### Out of scope

- benchmark create/reauthorize/cancel/download URL/artifact cleanup/execution
- Step Functions、S3、CodeBuild/CloudWatch adapter 実装、config
- route、HTTP schema、permission、auth policy、RAG/chat/history/usage/admin/favorite/question/provider catalog
- real AWS、実 benchmark、manual UI、merge / deploy / release

## 実施計画

1. query/log contract を domain test に固定する。
2. read-only narrow-port service を追加し、tenant query と log projection を移す。
3. facade public signature を変えず service へ委譲する。
4. Phase 4a contract、targeted/full API、docs freshness、source audit、root CI で回帰を検証する。
5. report、commit、draft stacked PR、semver、AC/self-review、task done、final-head CI、Issue コメントまで完遂する。

## ドキュメント保守計画

- `DES_DLD_012.md` に Phase 4e query boundary、保持 contract、残余 benchmark mutation debt を追記する。
- HTTP/UI/運用/config は不変のため README、OpenAPI 本文、API example の手動更新は不要とし、freshness/docs check で確認する。
- source-backed API docs は canonical generator の正規差分だけを同一 PR で同期する。

## 受け入れ条件

- [ ] AC1: `BenchmarkRunQueryService` が whole `Dependencies` / AWS client / global config / authorization service ではなく、`BenchmarkRunStore` の `list` / `get`、optional `CodeBuildLogReader.getText`、authoritative tenant resolver だけを受ける。
- [ ] AC2: `MemoRagService` の benchmark public 3 method name/signature、route/consumer compile contract、PR #390 の 101 public method snapshot が不変である。
- [ ] AC3: tenant-scoped list/get、cross-tenant non-enumeration、missing run 時 reader 非呼び出し、reader/reference/filename/content disposition を新規 domain test と既存 route/service test で維持する。
- [ ] AC4: benchmark mutation/execution/artifact、auth/RBAC/tenant policy、RAG/chat/history/usage/admin、既抽出 favorite/question/provider catalog に挙動変更がない。
- [ ] AC5: facade の `codeBuildLogReader` direct read が 0、direct dependency key が 25 から 24、`memorag-service.ts` が 6,259 行未満になり、契約 guard がその値を固定する。
- [ ] AC6: targeted/full API、API typecheck/build、root `npm run ci`、OpenAPI/API-code docs freshness、source audit、`task docs:check`、`git diff --check`、pre-commit が成功する。
- [ ] AC7: `DES_DLD_012.md`、task、作業レポートが実装・検証・generated docs 競合・real AWS/benchmark/manual 未実施リスクと同期する。
- [ ] AC8: 日本語 draft stacked PR、`semver:patch`、AC/self-review/final-head CI/Issue progress、task done lifecycle、clean/upstream を完了する。

## 検証計画

- `node --import tsx apps/api/src/benchmark/benchmark-run-query-service.test.ts`
- `node --import tsx apps/api/src/rag/memorag-service-contract.test.ts`
- `node --import tsx apps/api/src/routes/benchmark-tenant-boundary.test.ts`
- `npm run typecheck -w @memorag-mvp/api`
- `npm test -w @memorag-mvp/api`
- `npm run build -w @memorag-mvp/api`
- `npm run docs:openapi:check`
- `npm run docs:api-code:check`
- `task docs:check`
- `npm run rag:release:source-audit`
- `npm run ci`
- `git diff --check`
- `pre-commit run`

## PR セルフレビュー観点

- public signatures、tenant partition、non-enumeration、log reference/filename/content disposition が不変か。
- subservice に whole `Dependencies`、AWS client、config、mutation、authorization を渡していないか。
- missing run/reader/log を mock success や他 tenant data に変換していないか。
- open Draft 群と semantic code scope を重複させていないか。
- docs と実装、変更範囲に見合う test が同期しているか。
- RAG 根拠性・認可境界を弱めず、benchmark期待語句、QA sample固有値、dataset固有分岐を実装へ混入していないか。

## リスク

- source line/call graph の変更で `docs/generated/api-code/` が広範に機械更新され、stacked PR と path conflict が発生し得る。semantic code overlap と区別し、base 順に generator を再実行する。
- `benchmarkRunStore` は mutation/cleanup path に残るため direct dependency key 自体は残る。`codeBuildLogReader` 1 key の除去と facade 行数減少を本 unit の完了指標にする。
- real AWS、実 benchmark、manual UI は外部状態・credential・費用を伴うか本変更に非該当のため未実施とし、fake ports、full CI、GitHub Actions で境界回帰を検証する。
