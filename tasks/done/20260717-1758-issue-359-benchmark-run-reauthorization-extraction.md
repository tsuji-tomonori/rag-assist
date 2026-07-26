# Issue #359 Phase 4i: benchmark run reauthorization 抽出

- 状態: done
- タスク種別: 修正
- Issue: #359
- stacked base: PR #421 / `codex/issue-359-benchmark-execution-starter-extraction`

## 背景

Phase 4 の benchmark query は PR #407、cancellation は PR #414、artifact download は PR #418、execution start mapping は PR #421 で narrow service / adapter へ抽出された。一方、worker が各 execution boundary で呼ぶ `reauthorizeBenchmarkRunExecution` は、run lookup、active-state guard、current authorization、permission-revoked state transition、artifact cleanup trigger を facade 内で直接束ねている。

## 目的

worker-facing public contract、current authorization policy、tenant/non-enumeration、revocation cleanup semantics を変えず、benchmark run reauthorization の状態遷移だけを narrow service へ分離する。

## スコープ

- `BenchmarkRunReauthorizationService` と narrow ports の追加
- missing/cross-tenant、active state、success、permission revoke、non-permission failure の characterization test
- `MemoRagService` constructor composition と public method の delegate 化
- facade source-backed contract と Phase 4 詳細設計、canonical API-code docs の同期

対象外:

- benchmark create orchestration / validation / run construction
- `authorizeBenchmarkRunBoundary` の current identity / permission / suite policy
- `reconcileRevokedBenchmarkArtifacts` と partition-fenced cleanup driver の実装
- query / cancel / artifact download / execution start adapter
- worker event schema、API route、RBAC、永続化形式、Web UI
- merge / deploy / release

## なぜなぜ分析

### 問題文

`MemoRagService.reauthorizeBenchmarkRunExecution` が、worker reauthorization の domain state transition と facade private authorization / cleanup composition を同じ method 内で所有している。Phase 4a の「facade 直下の bounded responsibility を narrow port service へ段階分割する」期待に対し、reauthorization の正常・拒否・inactive・missing semantics を facade から独立して production-quality unit test できる境界がない。

### 影響範囲

- benchmark authorization worker の4境界: `start`、`protected_read`、`external_side_effect`、`durable_commit`
- `BenchmarkRunStore.get/update` による tenant-partitioned run lookup と revoked state transition
- permission revoke 後の artifact cleanup trigger
- worker へ返る authorized response / error

### confirmed

- PR #407 / #414 / #418 / #421 は query / cancel / artifact download / execution start を対象とし、reauthorization state transition は対象外である。
- worker public contract は `reauthorizeBenchmarkRunExecution(tenantId, runId, boundary)` を呼び、成功時は run identity / status / boundary を返す。
- run lookup は caller event の `tenantId` と `runId` をそのまま tenant-scoped store `get` に渡す。
- missing run と cross-tenant run は同じ `PermissionRevokedError("benchmark_run_unavailable")` を生成し、外部 message は `permission_revoked` に正規化される。
- already permission-revoked run は `PermissionRevokedError("benchmark_run_authorization_already_revoked")`、start は queued、それ以外は running のみ active とする。
- current authorization が `PermissionRevokedError` の場合だけ、同一 clock 値を `completedAt` / `updatedAt` に使用して failed state を永続化し、その更新済み run で cleanup を起動した後、元の revoke error を再送出する。
- authorization policy と artifact cleanup driver は facade private method にあり、本 unit では concrete policy / cleanup implementation を移す必要がない。

### inferred

- worker 再認可が facade に最初から実装され、store state machine と authorization / cleanup wiring を分離する service boundary が作られなかった。
- query/cancel で確立した narrow port pattern を適用すれば、security policy と cleanup driver を動かさず最小単位で分離できる。

### conflict / open_question

- service は raw `tenantId` を worker event から受ける。actor-facing route ではなく machine worker contract なので actor tenant resolver を新設せず、tenant-scoped store miss を permission revoke として非列挙化する既存 behavior を維持する。
- actual Step Functions worker / IAM / DynamoDB / S3 cleanup は external state と credential を伴うため local では未検証とする。production ports の exact call order と既存 integration test を根拠にし、actual AWS 成功を代替した扱いにはしない。

### 根本原因

benchmark worker reauthorization に、run state transition と facade-owned authorization / cleanup composition の間の明示的な service port 境界がなく、facade が store lookup/update と error branching を直接実行できる構造だった。

### 是正方針

- reauthorization service は run store `get/update`、`authorizeBoundary`、`reconcileRevokedArtifacts`、`now` だけを受ける。
- service は missing / active / already-revoked guard と permission-revoked transition / rethrow のみを所有する。
- facade は private authorization / cleanup method を callback port として compose し、public method は service へ delegate する。
- unit test で exact tenant/run lookup、boundary status matrix、call order、single clock、update payload、original error identity、non-permission failure no-write を固定する。
- existing worker integration test と full API CI で current identity、tenant partition、cleanup manifest / residual behavior を維持する。

## 実施計画

1. reauthorization state transition と facade source boundary を characterization test で固定する。
2. narrow service / ports を追加し、facade constructor で compose する。
3. public method を delegate 化し、direct dependency evidence を更新する。
4. `DES_DLD_012.md` と canonical generated docs を同期する。
5. targeted/full validation、source audit、pre-commit を実行する。
6. commit/push、Draft stacked PR、semver、AC/self-review、report/task done、final-head CI、Issue #359 進捗を完遂する。

## ドキュメント保守計画

- `DES_DLD_012.md` の Phase 4 boundary に reauthorization service の責務、保持する tenant/non-enumeration contract、残存 create/cleanup を追記する。
- source line/call graph が変わるため canonical API-code generator を実行する。
- worker event schema、public HTTP/OpenAPI、README、API examples、Web UI、運用設定は不変のため内容更新せず、docs freshness check で非影響を確認する。

## 受け入れ条件

- [x] run store lookup は入力 `tenantId` / `runId` の exact pair を使い、missing / cross-tenant を同一 permission-revoked contract に保つ。
- [x] already-revoked / inactive status guard と start=queued、その他=running の boundary matrix を維持する。
- [x] authorization 成功時は run をそのまま返し、clock / update / cleanup を呼ばない。
- [x] `PermissionRevokedError` 時だけ single clock で failed state を更新し、更新済み run を cleanup へ渡した後、元 error identity を再送出する。
- [x] non-permission authorization failure は update / cleanup せずそのまま伝播する。
- [x] service source は `Dependencies`、config、object store、identity provider、facade class に依存せず、facade public method は narrow delegate のみになる。
- [x] current authorization policy、artifact cleanup driver、worker event/output、tenant/non-enumeration、route/RBAC、RAG trust を変更しない。
- [x] targeted API test、API full test、root `npm run ci`、docs freshness、source audit、`git diff --check`、pre-commit が成功する。
- [x] Draft stacked PR に `semver:patch` を設定し、日本語 AC / self-review、report/task done を記録する。lifecycle commit の final-head CI と Issue #359 進捗は commit 後の外部証跡で確認する。

## 検証計画

- targeted reauthorization service / worker integration / facade contract tests
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

- tenant-scoped missing / cross-tenant non-enumeration と error identity
- boundary ごとの active status guard
- revoke update → cleanup → original error rethrow の順序
- current authorization policy / cleanup driver を port の外へ漏らしていないこと
- docs / generated docs / source guard の同期
- benchmark expected phrase、QA sample 固有値、dataset 固有分岐がないこと

## リスク

- security-sensitive worker path のため、unit test だけでなく既存 actual composition integration test と API full suite が必要である。
- cleanup implementation を残すため facade の object store / benchmark artifact store dependency は残る。
- canonical API-code generation は source line/call graph 由来で多数ファイルを機械更新する。
- actual AWS Step Functions worker / IAM / DynamoDB / S3 cleanup は未検証となる。
- stacked PR は #407 → #414 → #418 → #421 → Phase 4i の順序が必要である。

## 完了結果

- Draft PR: https://github.com/tsuji-tomonori/rag-assist/pull/425
- stacked base: PR #421 / `codex/issue-359-benchmark-execution-starter-extraction`
- 実装 head: `407a0d23e5e5bf3b7ac926da32018d0956929bd0`
- semver: `semver:patch`
- AC comment: https://github.com/tsuji-tomonori/rag-assist/pull/425#issuecomment-5002052194
- self-review comment: https://github.com/tsuji-tomonori/rag-assist/pull/425#issuecomment-5002053583
- implementation-head CI: SUCCESS（MemoRAG CI run `29573219498`）
- final-head CI / Issue #359 progress: lifecycle commit push 後に外部証跡として確認・投稿する。先取りして成功とは記録しない。
- GitHub Apps: callable connector が提供されなかったため `gh` fallback を使用した。
- actual Step Functions worker / IAM / DynamoDB / S3 cleanup / manual UI: 未実施。credential と external state を伴い、local test を実環境成功の代替とはしない。
- merge / deploy / release: 未実施。
