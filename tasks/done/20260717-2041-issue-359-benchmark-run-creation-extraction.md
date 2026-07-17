# Issue #359 Phase 4k: benchmark run create orchestration 抽出

- 状態: done
- タスク種別: 修正
- Issue: #359
- stacked base: PR #428 / `codex/issue-359-benchmark-artifact-cleanup-driver-extraction`
- exact base: `b95d8abc33e5a7fa232e9f47a7bc4da6373ceca1`

## 背景

Issue #359 Phase 4a〜4j / PR #390、#393、#397、#403、#407、#414、#418、#421、#425、#428 は `MemoRagService` の characterization と favorite、question、provider catalog、benchmark query/cancel/download/execution adapter/reauthorization/cleanup driver を段階抽出した。残る Phase 4 responsibility は `createBenchmarkRun` の suite/input validation、authoritative run construction、queued persistence、4 authorization boundaries、external execution start、execution ARN commit、failure compensation である。

## 目的

公開 method、route/RBAC、suite/policy default、tenant partition、worker authorization contract を変えず、残存 benchmark create command 全体を narrow-port `BenchmarkRunCreationService` へ抽出する。部分的な run factory 抽出で side-effect/compensation debt を残さず、既存の4境界と fail-closed outcome を1つの independently rollbackable unit として直接 characterization する。

## スコープ

- `BenchmarkRunCreationService` と create input / narrow ports の追加
- validation、run construction、queued create、4-boundary start/commit、failure compensation の production-quality test
- `MemoRagService` constructor composition と public delegate 置換
- facade source-backed dependency evidence、Phase 4 詳細設計、canonical API-code docs の同期

対象外:

- benchmark suite catalog の内容、dataset、label、preset、default concurrency の変更
- benchmark route/OpenAPI/RBAC、query/cancel/download/reauthorization/cleanup/starter adapter
- worker payload、Step Functions definition、IAM、DynamoDB/S3 schema、manifest schema
- RAG retrieval/refusal/citation/trust、Web UI
- actual AWS execution、manual UI、merge/deploy/release

## なぜなぜ分析

### 問題文

`MemoRagService.createBenchmarkRun` が、domain validation/run construction と durable store mutation、current worker authorization、external execution start、success/failure commit を facade method 内で直接連結している。Phase 4a の「公開 facade を維持しつつ bounded responsibility を narrow service へ段階分割する」期待に対し、4境界の固定順、boundary failure 後の非実行、external start 後の durable denial、permission/non-permission compensation を create command 単位で直接 test できる境界がない。

### 影響範囲

- `createBenchmarkRun(actor, input)` 1 public method
- `BenchmarkRunStore.create/update`
- current worker authorization の `start`、`protected_read`、`external_side_effect`、`durable_commit`
- `BenchmarkExecutionStarter.start`
- authoritative actor tenant、security resource references、tenant-partitioned artifact keys
- suite/runtime/config defaults と input normalization

### confirmed

- PR #407/#414/#418/#421/#425/#428 は query/cancel/download/starter mapping/reauthorization/cleanup driver を対象とし、create orchestration は変更していない。
- create method は validation 後に authoritative actor tenant と server-side suite/config/runtime policy から queued run を構築し、store `create` を最初の durable mutationとして行う。
- state machine ARN がない場合は queued run を返し、boundary authorization、external start、execution ARN update を実行しない。
- execution enabled 時の順序は `create → start auth → protected_read auth → external_side_effect auth → execution start → durable_commit auth → executionArn update` である。
- catch は permission-revoked を `failed/errorCode=permission_revoked` として永続化して failed run を返す。その他 boundary/start error は `failed/errorCode=execution_error` を永続化後、元 error を再 throw する。
- success `benchmarkRunStore.update(..., { executionArn })` は現行 facade で `return` されるが `await` されないため、その Promise rejection は同じ `try/catch` を迂回する。external execution 開始後も queued durable state のままとなり、意図された failed compensation が commit failure に適用されない。
- initial create failure は catch 範囲外であり、authorization/start/update を行わない。
- compensation update failure は false success に変換されず reject する。
- suite catalog、normalizer、authoritative tenant resolver、security ref resolver、boundary authorizer、starter、store、clock/id を port/config として与えれば、既存 behavior は actual AWS や owner judgment なしに unit test できる。
- route は既に `benchmark:run` を要求し、本抽出は route/auth policy を変更しない。

### inferred

- benchmark create 機能追加時に orchestration と infrastructure boundary が facade 内へ実装され、その後 starter/reauthorization/cleanup は抽出されたが create command の state machine 自体が最後まで残った。
- facade integration tests は state machine disabled の run construction を主に覆い、4境界と error compensation の分岐は worker/adapter tests へ分散しているため create command 全体の順序回帰を直接検出しにくい。

### conflict / open_question

- external start 後の durable-commit denialでは、既存 contract は run を failed にして worker の後続 authorizationを fail closed にするが、同じ catch 内で Step Functions stop を新規実行しない。stop compensation 追加は新しい外部副作用・owner policy判断を要するため本 unit では導入せず、現行 behavior と残余 risk を test/docs/PR に明記する。
- execution ARN commit rejection の catch 迂回は owner policyではなく JavaScript async control-flow の局所欠陥であり、`return await` により既存 catch へ接続して failed compensation と original error rethrow を成立させる。これは明示された fail-closed compensation の範囲内で修正する。
- state machine disabled 時に4境界を実行しない behavior は現行 local path として維持する。route-level `benchmark:run` permission は不変であり、worker boundary semantics を local pathへ拡張しない。
- `concurrency` / `thresholds` の追加 validation は product behavior 変更なので行わず、schema と既存 service forwarding を維持する。
- actual AWS Step Functions / IAM / DynamoDB / S3 の成功は local/GitHub CI から推定しない。

### 根本原因

benchmark create command の input/policy/run construction と side-effect state machine の間に明示的な narrow service/port 境界がなく、facade が domain command、current authorization、external start、durable compensation を一括所有していた。そのため、4境界と compensation を1つの production unit として検証・rollback できず、success update の un-awaited rejection が compensation catch を迂回する欠陥も検出されなかった。

### 是正方針

- create command 全体を `BenchmarkRunCreationService` へ移し、部分 factory だけを抽出しない。
- constructor は store `create/update`、tenant/security resolver、boundary authorizer、execution starter、suite catalog、execution-enabled/config defaults、clock/id だけを受ける。
- server-side suite catalog、authoritative actor tenant、security refs、runtime normalizersから run を構築し、caller supplied tenant/owner/artifact key を受け取らない。
- unit test で validation-before-write、canonical run、disabled path、4境界 order、各 boundary denial、starter/commit/compensation failure、permission/non-permission outcome を固定する。
- execution ARN update は `await` して同じ catch に接続し、commit failure でも failed state を試行してから original error を rethrowする。
- existing facade/route/worker/full tests を二重実行し、tenant/non-enumeration/RBAC/RAG trust/public contract の非変更を確認する。

### 対策の担当・効果確認

- 実施担当: Codex（本 Phase 4k）
- 完了期限: 本 task lifecycle 内
- 効果指標: facade の direct `benchmarkRunStore` read 3→0、create service source が broad `Dependencies`/config/AWS/facade に非依存、4 boundary/order/compensation tests と full CI が success
- follow-up: PR review と Issue #359 progress で actual AWS gap、external-start後 stop非追加、Phase 4 完了境界を再確認する

## 実施計画

1. create command と facade delegate の characterization test を先に追加する。
2. narrow service/input/ports を実装し、facade constructor で既存 dependencies/policies を composition する。
3. facade contract と existing integration expectations を同期する。
4. `DES_DLD_012.md` と canonical API-code docs を更新する。
5. targeted/full validation、source audit、pre-commit を実行し、失敗時は修復して再実行する。
6. commit/push、Draft stacked PR、semver、AC/self-review、report/task done、final-head CI、Issue #359 進捗を完遂する。

## ドキュメント保守計画

- 既存 `docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_012.md` に Phase 4k の ports、state machine、4-boundary order、compensation、残余 actual AWS risk、Phase 4 completion boundary を追記する。
- source/call graph が変わるため canonical API-code generator を実行する。
- stacked baseline には repository-wide docs structure file が存在しないため新規 directory は作らず、既存 canonical DES を最小更新する。
- public HTTP/OpenAPI、README、API examples、Web UI、worker/infra operations は不変のため手動更新せず、docs freshness/check で非影響を確認する。

## 受け入れ条件

- [x] create service は store `create/update`、tenant/security resolver、4-boundary authorizer、execution starter、suite/config/policy input、clock/id の narrow ports だけに依存し、`Dependencies`、facade、AWS client、global config を import しない。
- [x] unknown suite、mode mismatch、non-codebuild runner は run ID/clock/security ref/store/auth/start より前に reject し、外部・durable side effect を行わない。
- [x] queued run は authoritative actor tenant/user、server suite、security refs、config/runtime defaults と normalized values から構築し、tenant-partitioned summary/report/results keys を持つ。production mock/default fallback を追加しない。
- [x] initial store create は authorization/start/update より先で、failure 時は後続 action を行わない。execution disabled は queued run をそのまま返し、4境界/start/update を行わない。
- [x] execution enabled は `create → start → protected_read → external_side_effect → starter → durable_commit → executionArn update` の順序を保ち、全成功時だけ ARN を commit する。
- [x] 4境界の各 permission denial は後続 boundary/start/success commit を行わず failed permission-revoked run を永続化して返す。durable-commit denial は starter 後でも executionArn を成功 commit しない。
- [x] non-permission boundary/starter/commit error は failed execution-error を永続化後に元 error を rethrowし、permission error と混同しない。compensation failure は false success を返さない。
- [x] facade public signature、route `benchmark:run`、tenant/non-enumeration、worker current policy、query/cancel/download/reauthorization/cleanup、RAG trust、worker/API schema を変更しない。
- [x] targeted tests、API typecheck/full、root `npm run ci`、docs generation/check、source audit、`git diff --check`、pre-commit が成功する。
- [x] Draft stacked PR #431 に `semver:patch`、日本語 AC/self-review、report/task done、implementation/final-head CI、Issue #359 Phase 4 progress を記録する。implementation-head CI は成功済み。final-head CI と Issue progress は lifecycle commit 後に PR/Issue comment へ記録する。

## 完了証跡

- implementation commit: `e55e406b7f983f813805efa3f578a8e50ceb0691`
- Draft stacked PR: #431
- stacked base: PR #428 branch / `b95d8abc33e5a7fa232e9f47a7bc4da6373ceca1`
- semver: `semver:patch`
- AC comment: `issuecomment-5003411743`
- self-review comment: `issuecomment-5003413664`
- implementation-head GitHub Actions: success（9m09s）
- final-head GitHub Actions と Issue #359 progress: lifecycle commit push 後に外部証跡として記録する。

## 検証計画

- targeted create service / execution starter / reauthorization / cleanup driver / facade contract tests
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

- caller input から tenant/owner/artifact path を作らないこと
- validation-before-side-effect と queued-create-before-execution の順序
- 4 authorization boundaries の完全性と各 denial 後の非実行
- external start と durable commit の間の denial/error compensation
- permission/non-permission/compensation failure の fail-closed outcome
- docs/generated docs/source guard の同期
- expected phrase、QA sample 固有値、dataset 固有分岐、mock production fallback がないこと

## リスク

- external start 後の durable denial/error では既存実装どおり Step Functions stop を新規実行しない。failed durable state と worker reauthorizationが fail-closed boundary であり、actual AWS停止保証は未検証である。
- state machine enabled composition を actual AWS で実行せず、injected starter unit と GitHub CI で検証する。
- canonical API-code generation は facade line/call graph 変更により多数の機械差分を生成する。
- stacked PR は #407 → #414 → #418 → #421 → #425 → #428 → Phase 4k の順序が必要である。
