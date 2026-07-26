# Issue #358 FR-086 folder delete 監査 resolver

- 状態: done
- タスク種別: 修正
- 対象: Issue #358 P1-A / FR-086 / exact `folder/delete`
- stacked base: PR #412 `codex/issue-358-fr086-folder-move-resolver`

## 背景

共通 security mutation audit outbox は empty-only folder archive を `folder/delete` intent として保存する。一方、PR #412 final head の production reconciliation worker には exact `folder/delete` resolver がなく、DocumentGroups の CAS archive 後かつ audit completion 前の crash では、authoritative folder state が確定していても audit を収束できない。

## 目的

exact `folder/delete` audit intent を tenant-scoped current DocumentGroup と durable requested completion から authoritative に解決する。folder/archive、path lock、cleanup、permission mutation は再実行せず、成功、durable non-success、部分・不正・第三状態を fail closed に扱う。

## スコープ

- folder delete authoritative resolver と production worker 登録
- before/proposedAfter/requestedCompletion/current folder の canonical 照合
- crash/retry、duplicate worker、early non-success、durable non-success、before/third/corrupt/cross-tenant contract test
- existing DocumentGroups read-only IAM で十分であることの static/infra guard
- FR-086 production coverage、requirements coverage の同期

## 対象外

- folder archive producer/API/UI の挙動変更
- folder/path lock/cleanup/permission mutation の再実行
- document move/delete resolver
- administrative principal transfer resolver
- actual AWS S3/DynamoDB/EventBridge/Lambda 実行
- merge、deploy、release

## なぜなぜ分析（RCA）

### 問題文

2026-07-17 の PR #412 final head では `FolderArchiveService` が common audit intent と DocumentGroups の CAS archive を作成できる一方、worker registry に同 target/operation の resolver がなく、audit completion crash intent は resolver selection failure として bounded retry 後に quarantine される。

### confirmed

- producer は exact target `folder`、operation `delete`、policy version `folder-archive-policy-v1` を使う。
- authoritative mutation は `DocumentGroup.status` を `active` から `archived` へ CAS 更新し、`groupId`、`tenantId`、`parentGroupId`、`canonicalPath` を audit before/after に保持する。
- producer は子孫 folder と active document がないこと、current full permission、expectedVersion を archive 前に確認する。
- common outbox `complete` は final event の前に result/after を `requestedCompletion` へ CAS 保存する。
- audit complete の初回 CAS が失敗した pending intent でも、current folder が exact proposed archive と一致すれば mutation success は観測できる。
- non-success では protected state は before のままで、durable `requestedCompletion` がある場合だけ result class を確定できる。
- early missing/invalid target failure は `before=null` / `after=null` の durable completion として保存される。
- worker は authorized tenant event と DocumentGroups table read 権限を既に持つ。folder delete 専用 S3 marker は存在しない。
- producer は archive に相関する revocation cleanup repair/ledger を登録しない。

### inferred

- pending で current canonical audit state=proposed archive の場合だけ success を確定できる。
- pending で current=before の場合、denied/conflict/failed の区別証拠がないため推測せず retry/quarantine とする。
- durable requested completion は current authoritative state と exact 一致し、success なら proposed、non-success なら before と一致する場合だけ維持できる。
- before/proposed は exact active→archived transition、identity/path invariant、単調な updatedAt を必須とする。
- resolver は producer に存在しない cleanup/marker を証拠として要求せず、その欠落を別の residual risk として扱う。

### open_question

- actual AWS DynamoDB read consistency、EventBridge duplicate delivery、Lambda retry timing は未検証。
- audit completion 前に正当な後続 mutation で folder state が変化した場合、exact current-state 照合は推測せず retry/quarantine へ進む。
- folder archive 後の cached/session/queued authorization cleanup repair は producer 側で未登録であり、本 resolver だけでは解消しない。

### 根本原因

folder archive producer 追加時に target/operation ごとの production resolver coverage を同時に要求する contract がなく、generic outbox、DocumentGroups authoritative state、worker registry の対応が部分的なまま残った。

### 全影響範囲を覆う是正

- exact resolver で draft/current/requested completion の identity、transition、result を同時検証する。
- success crash window、durable non-success、early failure、before/third/corrupt/cross-tenant/duplicate worker を自動 test で固定する。
- worker registry、static no-mutation guard、FR-086、requirements coverage を同時更新する。
- archive cleanup registration、document move/delete、principal transferは別 rollback unit として open に保つ。

## 採用する期待動作

- exact `folder/delete` のみ support する。
- canonical before/proposed が active→archived の同一 folder identity/path transition であることを要求する。
- pending current=proposed のみ success とし、current=before と第三状態は推測しない。
- durable success は requested/current/proposed、durable non-success は requested/current/before の exact 一致を要求する。
- `before=null` / non-success / `after=null` の early failure は target read なしで確定する。
- folder/archive、path lock、cleanup、permission mutation は再実行しない。

## 実施計画

1. #412 final head、producer/outbox/current store/IAM contract を固定する。
2. folder delete resolver と contract tests を追加する。
3. worker registry、static security policy、FR-086、requirements coverage を同期する。
4. targeted から API/infra full、docs、source audit、verify へ検証し、失敗を修復する。
5. report、commit、Draft stacked PR、AC/self-review、task done、final-head CI、Issue 進捗を完遂する。

## ドキュメント保守計画

- `REQ_FUNCTIONAL_086.md` の production coverage に exact folder delete を confirmed として原子的に追記する。
- requirements coverage を同期する。
- route/OpenAPI/UI/README/operations/IAM は変更しない。新規 AWS resource や権限は不要だが、通常 deploy 前の actual AWS 検証が必要なことは PR/report へ明記する。

## 受け入れ条件

- [x] AC1: exact `folder/delete` だけを support する。
- [x] AC2: before/proposed の tenant/folder/path identity、active→archived、timestamp transition を canonical に検証する。
- [x] AC3: pending current=proposed のときだけ success を確定し、current=before/third/missing/corrupt/cross-tenant を fail closed にする。
- [x] AC4: durable success は requested/current/proposed、durable non-success は requested/current/before の exact 一致を要求する。
- [x] AC5: durable early non-success は `before=null` / `after=null` の場合だけ target read なしで確定する。
- [x] AC6: duplicate workers が一つの immutable completed event へ収束する。
- [x] AC7: resolver は folder/path/cleanup/permission mutation を行わず、既存 DocumentGroups read-only IAM だけを使う。
- [x] AC8: worker registry、static security policy、FR-086 docs、requirements coverage を同期する。
- [x] AC9: selected targeted/API/infra/typecheck/lint/build/docs/source audit/pre-commit/diff check が成功する。
- [x] AC10: Draft stacked PR に base #412、semver、actual AWS 未検証、archive cleanup residual risk、rollback、後続 resolver を記載し、日本語 AC/self-review/final-head CI evidence を残す。

## 検証計画

- resolver、worker registry、requirements coverage、static security policy targeted tests
- infra existing read-only IAM targeted/full test
- API full test、API/infra typecheck、root lint/build
- `task docs:check`、source audit、`task verify`
- `git diff --check`、pre-commit、implementation/final-head GitHub Actions

## PRレビュー観点

- target/operation/tenant/folder identity がexactか
- active→archived 以外や identity/path 変更を受理しないか
- pending before から non-success result を推測しないか
- durable result と current/proposed/before の対応を取り違えないか
- resolver がdomain mutation、cleanup、List/Scan を再実行しないか
- docs/実装/test、RAG 根拠性・認可境界、dataset 固有分岐が同期するか

## リスク

- actual AWS DynamoDB/EventBridge/Lambda は未検証。
- folder archive producer は cached/session/queued authorization の cleanup repair/ledger を登録しない。本 resolver はその欠落を解沈せず、監査確定時にも cleanup 完了を主張しない。

## 検証結果（PR前）

- resolver direct: 6/6 pass。exact selection、pending success、durable success/non-success、early failure、duplicate worker、before/missing/third/cross-tenant/corrupt/invalid transition/policy を確認した。
- API full: 871/871 pass。
- infra full: 38/38 pass。既存 DocumentGroups `GetItem/Query` と no DynamoDB/S3 mutation IAM assertion、CDK snapshotを含む。
- API/infra typecheck: pass。
- `task docs:check`: pass。97 API / 582 generated API docs、Web/infra inventory freshnessを含む。
- `npm run rag:release:source-audit`: pass。audit ID `sha256:3c83f691c53c24b0d9717b2ea63dee18820176f87d42ffeb5a964d18d2d7e016`、dataset-specific branch 0、artifact manifest mismatch 0。
- `task verify`: lint、全workspace typecheck/build pass。既存のWeb chunk/Lambda bundle size warningのみ。
- `git diff --check`: pass。
- `pre-commit run`: 7 hooks pass、2 hooks skip（対象ファイルなし）。
- actual AWS DynamoDB/EventBridge/Lambda は未検証。

## PR lifecycle

- Draft stacked PR: [#415](https://github.com/tsuji-tomonori/rag-assist/pull/415)。base は `codex/issue-358-fr086-folder-move-resolver`、head は `codex/issue-358-fr086-folder-delete-resolver`。
- semver: `semver:patch` を付与した。
- 受け入れ条件確認: [issuecomment-4999746612](https://github.com/tsuji-tomonori/rag-assist/pull/415#issuecomment-4999746612)。implementation CI前の未完了項目を未完了のまま記録した。
- セルフレビュー: [issuecomment-4999749511](https://github.com/tsuji-tomonori/rag-assist/pull/415#issuecomment-4999749511)。blocking/should-fixなし、GitHub CI pending、actual AWS/cleanup gapを明記した。
- implementation head CI: [MemoRAG CI #1173](https://github.com/tsuji-tomonori/rag-assist/actions/runs/29560394958) success。証跡は [issuecomment-4999792719](https://github.com/tsuji-tomonori/rag-assist/pull/415#issuecomment-4999792719) に記録した。
- この task done/report lifecycle commit による final head の CI、最終セルフレビュー、AC最終判定、Issue #358進捗は、headを変えないPR/Issueコメントで記録してから完了判定する。
