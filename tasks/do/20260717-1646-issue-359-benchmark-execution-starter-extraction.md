# Issue #359 Phase 4h: benchmark execution starter 抽出

- 状態: do
- タスク種別: 修正
- Issue: #359
- stacked base: PR #418 / `codex/issue-359-benchmark-artifact-download-extraction`

## 背景

Phase 4a の characterization 後、benchmark query は PR #407、cancellation は PR #414、artifact download は PR #418 で narrow-port service / adapter へ抽出された。一方、benchmark create path の private `startBenchmarkExecution` は Step Functions client 構築、execution name、tenant storage key、S3 URI、worker payload、execution ARN 検証を facade 内で直接所有している。

## 目的

benchmark create orchestration、公開 contract、tenant/RBAC、worker payload semantics を変えずに、Step Functions start command mapping を narrow な execution starter adapter へ分離する。

## スコープ

- `BenchmarkExecutionStarter` port と AWS Step Functions adapter の追加
- exact execution name / input payload / ARN validation の characterization test
- `MemoRagService` の benchmark start 呼び出しを adapter 委譲へ変更
- Phase 4 詳細設計、source-backed contract、canonical API-code docs の同期

対象外:

- benchmark run create orchestration / validation / store create-update
- worker reauthorization / revocation cleanup
- cancellation stop adapter、artifact download、query
- API route、permission/RBAC、永続化形式、Web UI
- merge / deploy / release

## なぜなぜ分析

### 問題文

`MemoRagService` の private `startBenchmarkExecution` が、facade の domain orchestration 責務とは別の concrete AWS `SFNClient` / `StartExecutionCommand` mapping と tenant-scoped worker payload 構築を直接所有している。Phase 4a の「AWS command mapping を domain-specific gateway へ段階分割する」期待から外れ、実 AWS を使わず start request を独立検証する境界がない。

### confirmed

- PR #414 は `StopExecutionCommand` mapping のみを `benchmark-execution-stopper.ts` へ抽出している。
- PR #418 は artifact download の S3 presign mapping のみを抽出し、execution start は対象外としている。
- create path は authoritative actor tenant から構築済みの `BenchmarkRun.tenantId` を execution name、`storageRunId`、payload `tenantId`、output prefix に使用する。
- worker payload は suite/dataset/model/retrieval/concurrency/artifact key と target API URL を Step Functions input JSON に含める。
- Step Functions response に `executionArn` がなければ既存 code は error にする。
- chat / ingest execution start も同じ facade の SFN import を使用するため、本 unit だけでは facade の `@aws-sdk/client-sfn` import 自体は削除できない。

### inferred

- benchmark create orchestration と start command mapping が同じ private method 群に追加された結果、benchmark 固有 payload を固定する adapter unit test が形成されなかった。
- stop adapter と同じ command-boundary pattern を start に適用すれば、create / auth / cleanup を動かさず最小単位で分離できる。

### conflict / open_question

- 実 AWS Step Functions に対する execution start は credential・state machine・課金・外部状態を伴うため local では実行しない。fake client に対する exact command input、error propagation、missing ARN を characterization し、real AWS は未検証として明記する。
- facade の SFN import は chat / ingest 用に残る。benchmark start の concrete mapping が adapter へ移ったことを source guard で区別する。

### 根本原因

benchmark execution start に、domain run/config から AWS command へ変換する明示的な port/adapter 境界がなく、facade が concrete client と payload serialization を直接利用できる構造だった。

### 是正方針

- starter port は `BenchmarkRun` と output prefix を受けて execution ARN を返す `start` のみにする。
- adapter constructor は region、state machine ARN、bucket、target API URL と Step Functions send client だけを受ける。
- adapter は run の authoritative tenant 値から execution name / storage key / URI / payload を構築する。
- facade create path は同じ位置・authorization boundary 順序で starter を呼ぶ。
- source guard と exact payload / ARN / failure test で再発を検知する。

## 実施計画

1. 現行 start command と facade source dependency を characterization test で固定する。
2. narrow starter port と AWS adapter を追加する。
3. facade composition / 委譲、contract expectation を同期する。
4. `DES_DLD_012.md` と canonical generated docs を更新する。
5. targeted/full validation、source audit、pre-commit を実行する。
6. commit/push、Draft stacked PR、semver、AC/self-review、report/task done、final-head CI、Issue 進捗を完遂する。

## ドキュメント保守計画

- `DES_DLD_012.md` に Phase 4h の starter port、AWS mapping、非変更 contract、残存 create/auth/cleanup を追記する。
- source line/call graph が変わるため canonical API-code generator を実行する。
- public HTTP schema、README、API examples、OpenAPI、Web UI、運用設定は不変のため内容更新せず、freshness check で非影響を確認する。

## 受け入れ条件

- [ ] execution name、`storageRunId`、run tenant、dataset/output S3 URI、model/retrieval/concurrency/artifact key を既存どおり exact mapping する。
- [ ] missing `executionArn` と Step Functions client failure の既存 error behavior を維持する。
- [ ] starter source が narrow constructor values / send client のみに依存し、benchmark `StartExecutionCommand` mapping が facade から分離される。
- [ ] create path の validation、store create/update、authorization boundary 順序、permission-revoked handling を変更しない。
- [ ] run の authoritative tenant partition を使用し、actor-facing lookup / cross-tenant non-enumeration、route/RBAC、RAG trust を変更しない。
- [ ] targeted API test、API full test、`npm run ci`、docs freshness、source audit、`git diff --check`、pre-commit が成功する。
- [ ] Draft stacked PR に `semver:patch` を設定し、日本語 AC / self-review、report/task done、final-head CI、Issue #359 進捗まで記録する。

## 検証計画

- targeted starter adapter / facade contract tests
- `npm run typecheck -w @memorag-mvp/api`
- `npm run test -w @memorag-mvp/api`
- `npm run ci`
- `task docs:api-code`、`task docs:check`
- `npm run rag:release:source-audit`
- `git diff --check`
- staged pre-commit
- GitHub Actions implementation-head / final-head MemoRAG CI

## PR レビュー観点

- Step Functions command input と execution name の後方互換性
- authoritative run tenant の一貫した partition / storage key 利用
- create authorization boundary / compensation の非変更
- source guard / docs / generated docs の同期
- benchmark expected phrase、QA sample 固有値、dataset 固有分岐がないこと

## リスク

- facade は chat / ingest start のため SFN import を残すので、import count だけでは benchmark mapping 分離を証明できない。
- canonical API-code generation は source line/call graph 由来で多数ファイルを機械更新する。
- real Step Functions start は credential・外部状態・課金を伴うため未検証となる。
- stacked PR は #407 → #414 → #418 → Phase 4h の順序が必要である。
