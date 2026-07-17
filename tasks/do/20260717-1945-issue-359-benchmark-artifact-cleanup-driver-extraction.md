# Issue #359 Phase 4j: benchmark artifact revocation cleanup driver 抽出

- 状態: do
- タスク種別: 修正
- Issue: #359
- stacked base: PR #425 / `codex/issue-359-benchmark-run-reauthorization-extraction`

## 背景

Phase 4 の benchmark query は PR #407、cancellation は #414、artifact download は #418、execution start mapping は #421、worker reauthorization state transition は #425 で narrow service / adapter へ抽出された。残る benchmark create orchestration と revocation cleanup driver のうち、private `benchmarkArtifactCleanupDriver` は authoritative deny の再確認、evaluation artifact scope、tenant-partition fence、delete、residual verification を facade closure 内で所有している。

## 目的

durable deny manifest の registration/reconciliation 順序、worker-facing reauthorization contract、tenant/non-enumeration、RBAC、RAG trust を変えず、benchmark artifact cleanup driver と canonical known-target mapping だけを narrow factory へ分離する。

## スコープ

- `BenchmarkArtifactRevocationCleanupDriverFactory` と narrow ports の追加
- authoritative deny probe、scope discovery、partition-fenced cleanup、residual verification の characterization test
- `MemoRagService` constructor composition と cleanup driver delegate の置換
- facade source-backed dependency evidence、Phase 4 詳細設計、canonical API-code docs の同期

対象外:

- benchmark create orchestration / validation / run construction / execution compensation
- worker reauthorization state transition と current identity / permission / suite policy
- durable cleanup coordinator の register/reconcile/persist algorithm
- revocation manifest schema、repair worker、tenant registry
- query / cancel / artifact download / execution starter
- API route、worker event/output、RBAC、永続化形式、Web UI
- merge / deploy / release

## なぜなぜ分析

### 問題文

`MemoRagService` の private `benchmarkArtifactCleanupDriver` が、benchmark run の authoritative deny 判定と artifact store の destructive delete/list mapping を facade closure 内で直接所有している。Phase 4a の「外部副作用と domain orchestration を narrow port で段階分割する」期待に対し、partition escape、missing adapter、deny supersede、store failure を driver 単位で直接 characterization する境界がない。

### 影響範囲

- permission-revoked benchmark run の evaluation artifacts
- `BenchmarkRunStore.get` による authoritative deny current probe
- optional benchmark artifact store の `deleteObject` / `listKeys`
- `ObjectStoreRevocationCleanupCoordinator` が driver callback failure を durable `reconciliation_required` として保持する経路
- tenant-partitioned `runs/<tenantPartition>/<runId>/` prefix

### confirmed

- PR #407 / #414 / #418 / #421 / #425 は query / cancellation / download / execution start / reauthorization state transition を対象とし、cleanup driver implementation は対象外である。
- create orchestration は suite/input validation、run construction、store create、4 authorization boundaries、external start、durable commit、failure compensation を含み、cleanup driver より広い rollback unit である。
- cleanup driver は run store `get`、optional artifact store `deleteObject/listKeys`、run、known targets のみで動作する。
- authoritative deny は exact run tenant/id の current rowが `failed`、`errorCode=permission_revoked`、`updatedAt=manifest.authoritativeDeny.version` のすべてを満たす場合だけ current とする。
- missing/mismatched row は false、run store error は reject となり、coordinator は cleanup を進めず durable reconciliation intent を残す。
- discover は `evaluation_artifact` scope だけに known targets を返す。
- cleanup は artifact store 不在、scope mismatch、known target 外 reference のすべてを reject し、partition 外 delete を行わない。
- residual verification は exact run prefix だけを list し、known targets の存在だけを返す。他 tenant / unexpected key を cleanup target に昇格させない。
- facade orchestration は durable manifest を `register` してから `reconcile` し、reconcile failure は握りつぶして登録済み retry intent を残す。registration failure は伝播し、untracked destructive cleanup を始めない。

### inferred

- benchmark revocation 対応を facade に追加した時点で coordinator callback が private closure として実装され、driver port 自体の security boundary test が形成されなかった。
- worker integration test は success/delete failure の end-to-end behavior を覆うが、wrong scope/reference、missing adapter、deny version mismatch、unexpected residual key を個別に固定しない。

### conflict / open_question

- driver は coordinator persistence を所有しない。register→reconcile と failure-to-durable-intent の責務を今回移すと rollback surface が広がるため、facade orchestrationに維持し source/integration test で順序を確認する。
- unexpected key は既存 behavior どおり residual target に追加しない。known targets の canonical set だけを destructive cleanup 対象にする fail-closed boundary を優先する。
- actual Step Functions worker / IAM / DynamoDB / S3 cleanup は credential と external state を伴うため未検証とする。local object-store characterization と GitHub CI を actual AWS 成功の代替とは扱わない。

### 根本原因

benchmark cleanup driver に、facade orchestrationと destructive artifact adapter の間の明示的な narrow factory/port 境界がなく、tenant partition fence と deny-current probe を private closure の実装詳細としてしか検証できない構造だった。

### 是正方針

- factory constructor は run store `get` と optional artifact store `deleteObject/listKeys` だけを受ける。
- factory は authoritative deny probe、evaluation scope、known-target allowlist、canonical tenant/run prefix、delete/residual mapping を所有する。
- facade は durable target registration、register→reconcile order、reconcile failure の retry-intent保持を引き続き所有する。
- unit test で exact lookup、full deny predicate、error propagation、scope behavior、missing adapter、partition escape、delete/list prefix、unexpected/other-tenant key exclusion を固定する。
- existing worker integration test で failed state→manifest registration→cleanup / reconciliation-required の production composition を継続検証する。

## 実施計画

1. cleanup driver と facade source boundary を characterization test で固定する。
2. narrow driver factory / ports と canonical target mapping を追加する。
3. facade constructor composition と source-backed dependency evidence を同期する。
4. `DES_DLD_012.md` と canonical generated docs を更新する。
5. targeted/full validation、source audit、pre-commit を実行する。
6. commit/push、Draft stacked PR、semver、AC/self-review、report/task done、final-head CI、Issue #359 進捗を完遂する。

## ドキュメント保守計画

- `DES_DLD_012.md` に Phase 4j の driver ports、deny-current / partition fence、side-effect order、fail-closed contract、残存 create orchestration を追記する。
- source line/call graph が変わるため canonical API-code generator を実行する。
- public HTTP/OpenAPI、README、API examples、worker schema、Web UI、運用設定は不変のため内容更新せず、docs freshness check で非影響を確認する。

## 受け入れ条件

- [ ] driver factory は run store `get` と optional artifact store `deleteObject/listKeys` だけを port として受け、`Dependencies`、config、object store、identity provider、facade class に依存しない。
- [ ] authoritative deny probe は exact tenant/run lookup を使い、failed + permission-revoked + exact version の論理積だけを true とし、missing/mismatch を false、store error を reject に保つ。
- [ ] discover は evaluation artifact scope にだけ canonical known targets を返し、その他 scope は空にする。
- [ ] cleanup は missing adapter、wrong scope、unknown/other-partition reference を fail closed で拒否し、allowed target だけを1回 delete する。
- [ ] residual verification は exact tenant/run prefix だけを list し、existing known targets のみを返す。unexpected/other-tenant key を対象へ昇格させない。
- [ ] facade は durable manifest `register` 後に `reconcile` を呼び、registration failure では cleanup を開始せず、reconcile failure は登録済み retry intent を保持する既存 order/compensation を維持する。
- [ ] worker reauthorization/current policy、tenant/non-enumeration、route/RBAC、RAG trust、worker event/output、manifest schema を変更しない。
- [ ] targeted API test、API full test、root `npm run ci`、docs freshness、source audit、`git diff --check`、pre-commit が成功する。
- [ ] Draft stacked PR に `semver:patch` を設定し、日本語 AC / self-review、report/task done、final-head CI、Issue #359 進捗まで記録する。

## 検証計画

- targeted cleanup driver / worker integration / facade contract tests
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

- authoritative deny predicate と store failure の fail-closed
- known-target allowlist と tenant/run prefix escape 防止
- register→reconcile→durable retry intent の side-effect order
- cleanup driver から current authorization policy / coordinator persistence が漏れていないこと
- docs / generated docs / source guard の同期
- benchmark expected phrase、QA sample 固有値、dataset 固有分岐がないこと

## リスク

- destructive cleanup path のため unit test だけでなく既存 worker integration と API full suite が必要である。
- cleanup coordinator を残すため facade の docs object store dependency は残る。
- canonical API-code generation は source line/call graph 由来で多数ファイルを機械更新する。
- actual AWS Step Functions worker / IAM / DynamoDB / S3 cleanup は未検証となる。
- stacked PR は #407 → #414 → #418 → #421 → #425 → Phase 4j の順序が必要である。
