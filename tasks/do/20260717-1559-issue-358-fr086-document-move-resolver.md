# Issue #358 FR-086 document move 監査 resolver

- 状態: in_progress
- タスク種別: 修正
- 対象: Issue #358 P1-A / FR-086 / exact `document/move`
- stacked base: PR #415 `codex/issue-358-fr086-folder-delete-resolver`

## 背景

共通 security mutation audit outbox は document move を `document/move` intent として保存し、document lifecycle coordinator は durable move state と manifest CAS を保持する。一方、PR #415 final head の production reconciliation worker には exact `document/move` resolver がなく、manifest/projection の収束後かつ audit completion 前の crash では、authoritative state が確定していても audit を収束できない。

## 目的

exact `document/move` audit intent を tenant-scoped durable lifecycle state、current manifest、current actor identity/permission から authoritative に解決する。manifest、projection、permission、cleanup mutation は再実行せず、success、rolled-back non-success、preflight non-success、部分・不正・第三状態を fail closed に扱う。

## スコープ

- document move authoritative resolver と production worker 登録
- lifecycle state / audit ID / before / proposedAfter / requestedCompletion / current manifest の canonical 照合
- current actor の active/same-tenant/role と source/destination permission の再評価
- crash/retry、duplicate worker、preflight failure、rolled-back failure、partial/corrupt/cross-tenant contract test
- ObjectStore の document move state / tenant manifest に限定した read-only IAM と、既存 DocumentGroups / folder policy / group membership / verified IdP read contract の static/infra guard
- FR-086 production coverage、requirements coverage の同期

## 対象外

- document move producer/API/UI の挙動変更
- manifest/projection/permission/cleanup mutation の再実行
- document delete resolver
- administrative principal transfer resolver
- actual AWS S3/DynamoDB/Cognito/EventBridge/Lambda 実行
- merge、deploy、release

## なぜなぜ分析（RCA）

### 問題文

2026-07-17 の PR #415 final head では `DocumentLifecycleMutationCoordinator` が common audit intent、durable move state、manifest/projection transition を作成できる一方、worker registry に同 target/operation の resolver がなく、audit completion crash intent は resolver selection failure として bounded retry 後に quarantine される。

### confirmed

- producer は exact target `document`、operation `move`、policy version `document-move-policy-v1` を使う。
- durable lifecycle state は tenant/document scoped keyに schemaVersion、operationId、status、actorId、auditIntentId、source/target manifest、before/after、failureResult を保存する。
- manifest CAS が authoritative commit boundary で、move metadata に `documentMoveOperationId` を保存する。projection は commit 前に staging、commit 後に active へ収束する。
- pending success は lifecycle `completed` と current manifest の exact target move stateへ収束する。durable requested completionはprojection/rollback処理後にだけproducerから保存されるため、許可statusとcurrent/requested stateの一致が追加の収束証跡になる。
- producer の preflight failure は lifecycle markerを作らず、durable requested completion と current before stateを残す。
- common outbox `complete` は final event の前に result/after を `requestedCompletion` へ CAS 保存する。
- worker は authorized tenant event、DocumentGroups/folder policy/group membershipのread、verified IdP readを既に利用できるが、document move state / tenant manifest のS3 read patternは未付与である。
- FR-086 は document move/delete と administrative principal transfer を production resolver未登録として open にしている。

### inferred

- lifecycle markerがある場合、auditIntentId と target/tenant/document/actor、source/target audit state、current manifestを同時照合しなければ別mutationのstateを誤採用し得る。
- pending successは current manifestがexact targetで、lifecycleがmanifest commit後の最終収束状態である場合だけ確定できる。
- durable non-successは lifecycleのrollback/conflict許可status、failureResultとrequested resultが一致し、current manifestがexact requested stateの場合だけ維持できる。CAS競合ではrequested stateがsource以外の第三authoritative stateになり得る。
- marker-free durable preflight non-successは current manifestがbeforeと一致する場合だけ確定できる。
- current actor identity/role/source/destination permissionを再評価し、失効・tenant越境・権限喪失時は推測せずretry/quarantineへ送る。
- resolverはprojectionやmanifestを書き戻さず、必要なdocument move state / tenant manifestのGetObjectだけを追加してread-only evidenceで確定する。

### open_question

- actual AWS S3 read visibility、DynamoDB policy read、Cognito identity freshness、EventBridge duplicate delivery、Lambda retry timing は未検証。
- valid move後に正当な後続 mutation が current manifest を変更した場合、exact current-state照合は過去successを推測せずretry/quarantineへ進む。
- projection metadataは複数vector storeに分散しており、production workerにread-by-key contractがないため、本単位では durable lifecycleの収束statusをprojection mutation完了 evidenceとして扱い、projection実体を再読込しない。

### 根本原因

document move producer追加時に target/operation ごとの production resolver coverage を同時に要求する contract がなく、generic outbox、durable lifecycle state、current manifest、worker registry の対応が部分的なまま残った。

### 全影響範囲を覆う是正

- exact resolverで lifecycle/current/requested completion/current authorization のidentity、transition、resultを同時検証する。
- success crash window、durable/preflight non-success、partial/third/corrupt/cross-tenant/permission loss/duplicate workerを自動testで固定する。
- worker registry、static no-mutation guard、FR-086、requirements coverageを同時更新する。
- document delete、administrative principal transfer、actual AWSは別 rollback unitとして open に保つ。

## 採用する期待動作

- exact `document/move` と `document-move-policy-v1` だけを support する。
- markerありでは auditIntentId、operationId、tenant/document/actor、source/target manifest、before/proposedAfterをcanonical照合する。
- pendingはlifecycle `completed`、current=target、current actor/permission有効の場合だけ successを確定する。
- durable successはproducerがprojection収束後にcompletionを保存できるstatus、current=requested=target、current actor/permission有効の場合だけ確定する。
- durable non-successはproducerがrollback/conflict収束後にcompletionを保存できるstatus、failureResult/requested result一致、current=requestedの場合だけ確定する。
- markerなしでは durable preflight non-success、current=beforeの場合だけ確定する。
- partial status、marker/audit mismatch、current第三状態、missing/corrupt/cross-tenant、actor/permission失効は fail closed にする。
- manifest/projection/permission/cleanup mutation は再実行しない。

## 実施計画

1. #415 final head、producer/lifecycle/outbox/current store/worker IAM contractを固定する。
2. document move resolver と contract testsを追加する。
3. worker registry、static security policy、FR-086、requirements coverageを同期する。
4. targetedからAPI/infra full、docs、source audit、verifyへ検証し、失敗を修復する。
5. report、commit、Draft stacked PR、AC/self-review、task done、final-head CI、Issue進捗を完遂する。

## ドキュメント保守計画

- `REQ_FUNCTIONAL_086.md` の production coverageに exact document moveをconfirmedとして原子的に追記する。
- requirements coverageを同期する。
- route/OpenAPI/UI/README/operations/IAMは変更しない。新規AWS resourceやwrite権限は不要だが、通常deploy前のactual AWS検証が必要なことをPR/reportへ明記する。

## 受け入れ条件

- [ ] AC1: exact `document/move` と `document-move-policy-v1` だけを support する。
- [ ] AC2: lifecycle markerのauditIntentId、operationId、tenant/document/actor、source/target、before/proposedAfterをcanonicalに検証する。
- [ ] AC3: pendingはlifecycle `completed`、current=target、current actor/permission有効の場合だけ successを確定する。
- [ ] AC4: durable success/non-successはproducerの許可status、requested result/current state、failureResult、current actor/permissionをresult classに応じてexact照合する。
- [ ] AC5: marker-free durable preflight non-successはcurrent=beforeの場合だけ確定する。
- [ ] AC6: partial status、marker/audit mismatch、current before/third/missing/corrupt/cross-tenant、actor/permission失効をfail closedにする。
- [ ] AC7: duplicate workersが一つのimmutable completed eventへ収束する。
- [ ] AC8: resolverはmanifest/projection/permission/cleanup mutationを行わず、document move state / tenant manifestに限定したread-only IAMだけを追加する。
- [ ] AC9: worker registry、static security policy、FR-086 docs、requirements coverageを同期する。
- [ ] AC10: selected targeted/API/infra/typecheck/lint/build/docs/source audit/pre-commit/diff checkが成功する。
- [ ] AC11: Draft stacked PRにbase #415、semver、actual AWS未検証、projection readback制約、rollback、後続resolverを記載し、日本語AC/self-review/final-head CI evidenceを残す。

## 検証計画

- resolver、worker registry、requirements coverage、static security policy targeted tests
- infra existing read-only IAM targeted/full test
- API full test、API/infra typecheck、root lint/build
- `task docs:check`、source audit、`task verify`
- `git diff --check`、pre-commit、implementation/final-head GitHub Actions

## 実施済み検証（PR 作成前）

- targeted resolver / access-control / requirements coverage: 成功（3 files）
- API full test: 成功（878 tests）
- Web full test: 成功（442 tests）
- infra full test: 成功（38 tests）
- benchmark full test: 成功（102 tests）
- API / infra typecheck: 成功
- `task docs:check`: 初回は generated infra inventory の差分を検出。`npm run docs:infra-inventory` で同期して再実行し、成功
- `npm run rag:release:source-audit`: 成功（audit ID `sha256:6aae9626b53717dc6f82a063cea1cee25a22dc7fbf84c769d974718ff8847b01`、dataset-specific branch 0、artifact mismatch 0）
- `task verify`: 成功
- `npm run ci`: 成功（lint / all workspace typecheck / test / build）
- pre-commit: 成功（変更対象ファイル）
- `git diff --check`: 成功
- 既存の Web 500 kB 超 chunk と Lambda bundle size 警告は出力されたが、検証は exit 0

## PRレビュー観点

- target/operation/policy/tenant/document/audit/operation identityがexactか
- completed/rolled_back以外の部分状態を受理しないか
- current manifest、lifecycle source/target、audit before/proposed/requestedを取り違えないか
- current actor identity/role/source/destination permissionを安全側に再評価するか
- resolverがdomain/projection/permission/cleanup mutationを再実行しないか
- docs/実装/test、RAG根拠性・認可境界、dataset固有分岐が同期するか

## リスク

- actual AWS S3/DynamoDB/Cognito/EventBridge/Lambdaは未検証。
- vector projection実体のreadbackはworker contractにないため、durable lifecycle `completed`/`rolled_back`を収束証跡とする。corrupt/stale projectionの再修復は本resolverの対象外。
- valid move後の後続mutationでcurrent stateが変わるとexact resolverは過去結果を推測せずquarantineし得る。
