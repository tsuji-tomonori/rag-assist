# Issue #358 FR-086 document delete 監査 resolver

- 状態: done
- タスク種別: 修正
- 対象: Issue #358 P1-A / FR-086 / exact `document/revoke.delete`
- stacked base: PR #419 `codex/issue-358-fr086-document-move-resolver`

## 背景

共通 security mutation audit outbox は document delete を `document/revoke.delete` intent として保存し、document lifecycle coordinator は deny-first tombstone、durable delete state、cleanup repair/ledger を保持する。一方、PR #419 final head の production reconciliation worker には exact resolver がなく、cleanup と audit requested completion の間または final event publish 前の crash では、authoritative evidence が残っていても audit を収束できない。

## 目的

exact `document/revoke.delete` audit intent を tenant-scoped delete lifecycle、current manifest、cleanup repair、cleanup ledger から read-only に解決する。tombstone、manifest/vector/object cleanup、permission mutation、cleanup registrationを再実行せず、success、preflight/CAS conflict、部分・不正・tenant越境を fail closed に扱う。

## スコープ

- document delete authoritative resolver と production worker 登録
- lifecycle / audit / source/tombstone / requested completion の canonical 照合
- cleanup repair/ledger と source checkpoint の exact evidence 照合
- crash/retry、duplicate worker、preflight/CAS conflict、partial/corrupt/cross-tenant contract test
- delete lifecycle に限定した read-only S3 IAM と static/infra guard
- FR-086 production coverage、requirements coverage の同期

## 対象外

- document delete producer/API/UI の挙動変更
- current permission の再評価（監査 actor と認可 actor が異なる producer contract のため）
- tombstone、cleanup、permission、repair/ledger mutation の再実行
- administrative principal transfer resolver
- actual AWS S3/EventBridge/Lambda 実行
- merge、deploy、release

## なぜなぜ分析（RCA）

### 問題文

2026-07-17 の PR #419 final head では `DocumentLifecycleMutationCoordinator` が common audit intent、durable delete state、deny-first tombstone、cleanup repair/ledger を作成できる一方、worker registry に exact `document/revoke.delete` resolver がなく、audit completion crash intent は resolver selection failure として bounded retry 後に quarantine される。

### confirmed

- producer は exact target `document`、operation `revoke.delete`、policy version `document-revocation-policy-v1` を使う。
- durable lifecycle key は `document-mutations/delete/<tenant>/<document>.json` で、schemaVersion、operationId、status、actorId、auditIntentId、source/tombstone manifest を保存する。
- tombstone は `superseded` と `metadata.documentRevocation` に operationId、監査 actor、reason、tombstonedAt を保存する。
- producer は audit prepare 前に exact cleanup repair を保存し、deny commit後に cleanup ledgerを登録してから immediate cleanup を行う。
- requested success は immediate cleanup 成功後にだけ保存され、pending audit の lifecycle `completed` は requested completion 保存後にだけ成立する。
- cleanup worker は manifest missing を source scope の discovery/cleanup checkpoint がある場合だけ authoritative deny 維持として認める。
- producer の manifest CAS conflict は lifecycle `prepared`、repair `abandoned`、durable conflict completion、current third manifest を残す。
- marker-free preflight failure は既存 manifest を before/proposed/requested に保存し、domain markerを作らない。完全な missing document は audit prepare前に失敗するため resolver対象 intentを残さない。
- benchmark cleanupでは認可 actorと監査 actorを意図的に分離でき、lifecycle/tombstoneには監査 actorが保存される。

### inferred

- success は lifecycle/tombstoneだけでなく、exact repairとcleanup ledgerのidentity/deny/registered targetが一致しなければ確定できない。
- current manifest missing は cleanup ledgerのsource checkpointがある場合に限り、production cleanup workerと同じ境界で受理できる。
- current permission再評価は監査 actorを認可 actorと誤同一視し、正当なbenchmark cleanupを拒否し得るため、削除後のdeny/cleanup durable evidenceを権威とする。
- marker-free non-successは current manifestがbeforeと一致する場合だけ確定できる。markerあり non-successはproducerが保存するCAS conflictだけを、prepared lifecycle、abandoned repair、ledger不存在と合わせて受理する。
- resolverはObjectStore readだけで必要証拠を取得でき、追加IAMはdelete lifecycle GetObjectだけで足りる。既存のrepair/ledger/manifest readを再利用する。

### open_question

- actual AWS S3 read visibility、EventBridge duplicate delivery、Lambda retry timing は未検証。
- valid delete後に後続処理が同じdocument IDを再利用した場合、exact current-state照合は過去successを推測せずretry/quarantineへ進む。
- immediate cleanup実体はObjectStore/vector store横断であり、resolverは各物理データを再読込せずdurable requested completionとcleanup ledgerを証拠にする。

### 根本原因

document delete producer追加時に target/operation ごとの production resolver coverage を同時に要求する contract がなく、generic outbox、durable delete lifecycle、cleanup evidence、worker registry の対応が部分的なまま残った。

### 全影響範囲を覆う是正

- exact resolverで lifecycle/current/requested completion/repair/ledger identityとtransitionを同時検証する。
- success crash window、marker-free/CAS conflict、partial/missing/corrupt/cross-tenant/duplicate workerを自動testで固定する。
- worker registry、static no-mutation/IAM guard、FR-086、requirements coverageを同時更新する。
- administrative principal transfer、actual AWSは別 rollback unitとして open に保つ。

## 採用する期待動作

- exact `document/revoke.delete` と `document-revocation-policy-v1` だけを support する。
- markerありでは auditIntentId、operationId、tenant/document/actor、source/tombstone、before/proposedAfterをcanonical照合する。
- pendingは lifecycle `completed`、exact cleanup success evidence、current=tombstoneまたはsource checkpoint付きmissingの場合だけsuccessを確定する。
- durable successは producer許可status、requested=tombstone、exact cleanup success evidence、current=tombstoneまたはsource checkpoint付きmissingの場合だけ確定する。
- markerなしでは durable preflight non-success、current=beforeの場合だけ確定する。
- markerあり non-successは `prepared` + requested conflict + current=requested + repair abandoned + ledger不存在の場合だけ確定する。
- partial status、marker/audit mismatch、cleanup不整合、checkpointなしmissing、corrupt/cross-tenantはfail closedにする。
- tombstone/cleanup/permission/repair/ledger mutationは再実行しない。

## 実施計画

1. #419 final head、producer/delete lifecycle/cleanup evidence/worker IAM contractを固定する。
2. document delete resolver と contract testsを追加する。
3. worker registry、static security policy、FR-086、requirements coverageを同期する。
4. targetedからAPI/infra full、docs、source audit、verifyへ検証し、失敗を修復する。
5. report、commit、Draft stacked PR、AC/self-review、task done、final-head CI、Issue進捗を完遂する。

## ドキュメント保守計画

- `REQ_FUNCTIONAL_086.md` の production coverageに exact document deleteをconfirmedとして原子的に追記する。
- requirements coverageを同期する。
- route/OpenAPI/UI/README/operationsは変更不要。IAMは既存workerのread-only delete lifecycle patternだけを同期し、actual AWS未検証をPR/reportへ明記する。

## 受け入れ条件

- [x] AC1: exact `document/revoke.delete` と `document-revocation-policy-v1` だけを support する。
- [x] AC2: lifecycleのauditIntentId、operationId、tenant/document/actor、source/tombstone、before/proposedAfterをcanonicalに検証する。
- [x] AC3: pending/durable successはproducer許可status、requested state、exact repair/ledger、current tombstoneまたはsource checkpoint付きmissingだけで確定する。
- [x] AC4: marker-free preflight non-successはcurrent=beforeの場合だけ確定する。
- [x] AC5: markerありCAS conflictはprepared lifecycle、current=requested、abandoned repair、ledger不存在の場合だけ確定する。
- [x] AC6: partial status、marker/audit/cleanup mismatch、checkpointなしmissing、corrupt/cross-tenant/第三状態をfail closedにする。
- [x] AC7: duplicate workersが一つのimmutable completed eventへ収束する。
- [x] AC8: resolverはtombstone/cleanup/permission/repair/ledger mutationを行わず、delete lifecycleに限定した追加read-only IAMだけを付与する。
- [x] AC9: worker registry、static security policy、FR-086 docs、requirements coverageを同期する。
- [x] AC10: selected targeted/API/infra/typecheck/lint/build/docs/source audit/pre-commit/diff checkが成功する。
- [x] AC11: Draft stacked PRにbase #419、semver、actual AWS未検証、物理cleanup readback制約、rollback、後続resolverを記載し、日本語AC/self-review/implementation head CI evidenceを残した。final-head CI evidenceはtask done lifecycle commit後にheadを変えないPR commentで記録する。

## 検証計画

- resolver、worker registry、requirements coverage、static security policy targeted tests
- infra existing read-only IAM targeted/full test
- API full test、API/infra typecheck、root lint/build
- `task docs:check`、source audit、`task verify`
- `git diff --check`、pre-commit、implementation/final-head GitHub Actions

## リスク

- actual AWS S3/EventBridge/Lambdaは未検証。
- 物理cleanup実体はresolverからreadbackせず、producer requested completionとdurable cleanup evidenceを収束証跡とする。
- valid delete後のdocument ID再利用時はexact resolverが過去結果を推測せずquarantineし得る。

## 実施済み検証（PR作成前）

- API full test: 成功（885 tests）。sandbox内のlocalhost `listen EPERM` はsandbox外の固定script再実行で解消。
- Web full test: 成功（442 tests）。
- infra typecheck/full test: 成功（38 tests）。IAM変更のsnapshotを同期後に再実行。
- benchmark full test: 成功（102 tests）。
- `task docs:check`: 成功。sandbox内のtsx IPC `listen EPERM` はsandbox外の同一Taskfile command再実行で解消。
- `npm run rag:release:source-audit`: 成功（audit ID `sha256:eb7701f8c651f35673cac2e6de9f2ffef641e2982b88d3fef503e72c8645e4e6`、dataset-specific branch 0、artifact mismatch 0）。
- `task verify`: 初回lintで未使用type importを検出・修正し、再実行成功。
- `npm run ci`: 成功（全workspace lint/typecheck/test/build）。
- pre-commit、`git diff --check`: 成功。
- 既存のWeb 500 kB超chunkとLambda bundle size警告は出たが、検証はexit 0。

## PR lifecycle

- Draft stacked PR: [#424](https://github.com/tsuji-tomonori/rag-assist/pull/424)。baseは`codex/issue-358-fr086-document-move-resolver`、headは`codex/issue-358-fr086-document-delete-resolver`。
- semver: `semver:patch`。
- 受け入れ条件確認: [issuecomment-5001152588](https://github.com/tsuji-tomonori/rag-assist/pull/424#issuecomment-5001152588)。implementation CI前のpendingを未完了のまま記録した。
- セルフレビュー: [issuecomment-5001152551](https://github.com/tsuji-tomonori/rag-assist/pull/424#issuecomment-5001152551)。blocking指摘なし、actual AWS/物理cleanup readback制約を明記した。
- implementation head CI: [MemoRAG CI run 29568813194](https://github.com/tsuji-tomonori/rag-assist/actions/runs/29568813194) success（8分8秒）。証跡は[issuecomment-5001268264](https://github.com/tsuji-tomonori/rag-assist/pull/424#issuecomment-5001268264)に記録した。
- このtask done/report lifecycle commitによるfinal headのCI、最終セルフレビュー、AC最終判定、Issue #358進捗は、headを変えないPR/Issue commentで記録してから完了判定する。
