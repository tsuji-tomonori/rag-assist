# Issue #358 FR-086 application role 監査 resolver

- 状態: do
- タスク種別: 修正
- 対象: Issue #358 P1-A / FR-086 / `applicationRole.replace`
- stacked base: PR #399 `codex/issue-358-fr086-retry-quarantine`

## 背景

共通 security mutation audit outbox は application role 変更を durable intent として受理するが、production reconciliation worker の resolver は source governance と resource-group 4 operation に限られる。role mutation 中の crash や audit completion failure では、Cognito/current IdP state を再確認して監査だけを収束させる経路がない。

## 目的

`applicationRolePrincipal / applicationRole.replace` を tenant-scoped current identity から authoritative に解決し、mutation 自体を再実行せず、成功・durable non-success・曖昧/不正 state を fail closed に扱う。

## スコープ

- application role authoritative resolver と production worker 登録
- current IdP identity、before/proposedAfter/requestedCompletion の照合
- duplicate worker、early failure、cross-tenant/corrupt/ambiguous/unknown principal test
- FR-086 production reconciliation coverage と requirements coverage の同期

## 対象外

- role mutation の再実行、Cognito group の書き換え
- expired application-role mutation lock の recovery 方式変更
- folder/document/principal resolver
- 実 AWS Cognito/EventBridge/Lambda worker 実行
- quarantine 手動解除、管理 UI、alarm
- merge / deploy / release

## なぜなぜ分析（RCA）

### 問題文

2026-07-17 の PR #399 stacked head では `applicationRole.replace` の producer が pending/finalization_pending intent を作成できる一方、worker resolver registry に同 target/operation がなく、crash 後の intent は resolver selection failure として最大3回後に quarantine される。

### confirmed

- `ApplicationRoleMutationService` は targetType `applicationRolePrincipal`、operation `applicationRole.replace`、before/proposed roles を outbox に保存する。
- service は verified identity provider を authoritative role source として mutation 前後を照合する。
- PR #386/#389/#391/#394 は resource-group resolver、#399 は bounded retry/quarantine を実装し、application role は FR-086 文書で open。
- 指定 open PR #384/#386/#388/#389/#391/#392/#394/#395/#398/#399 に application-role resolver file はない。

### inferred

- reconciliation は current verified identity の tenant/user/account/roles と durable audit state の一致だけを検証し、Cognito mutation や managed-state callback を再実行しないのが安全である。
- requestedCompletion がない current=before は、失敗 result の durable 根拠がなく success/failed のいずれにも確定できないため retry/quarantine 対象にすべきである。

### open_question

- 実 AWS Cognito での stale read、EventBridge duplicate delivery、managed-state callback と audit worker の実タイミングは未検証。
- lock の `managed_commit` crash recovery は domain service の別 contract であり、本 resolver は current IdP state 以上を推測しない。

### 根本原因

producer 追加時に target/operation ごとの authoritative resolver coverage を必須化する contract test がなく、generic outbox と worker registry の対応が部分的なまま残った。

### 全影響範囲を覆う是正

- exact target/operation resolver を追加し、identity/tenant/role schema を再検証する。
- normal、durable non-success、early failure、duplicate、missing/cross-tenant/corrupt/ambiguous を自動 test で固定する。
- worker registry、FR-086 正本文書、requirements coverage を同時に更新する。

## 採用する期待動作

- current roles が proposedAfter と一致する pending intent のみ success として確定する。
- durable requestedCompletion は current state が requested after と一致するときだけ元 result を維持する。
- before=null/after=null の durable early non-success は IdP read なしに確定できる。
- current roles が before のままで requestedCompletion がない場合は推測せず resolution failure とする。
- missing/cross-tenant/inactive/corrupt/第三状態は fail closed とし、#399 の bounded retry/quarantine に委譲する。
- mutation、session revoke、Cognito group write は再実行しない。

## 実施計画

1. #399 stacked base と open PR overlap を固定する。
2. resolver と contract test を追加する。
3. worker registry、FR-086、coverage/static policy の必要箇所を同期する。
4. targeted から API full/docs/source audit/verify へ検証し、失敗を修復する。
5. report、commit、draft stacked PR、AC/self-review、task done、final-head CI、Issue進捗を完遂する。

## ドキュメント保守計画

- `REQ_FUNCTIONAL_086.md` の production coverage に application role を confirmed として原子的に追記する。
- requirements coverage に resolver/test を追加する。
- route/OpenAPI/infra/README/運用手順は変更しないため、generated freshness check で追加更新不要を確認する。

## 受け入れ条件

- [x] AC1: exact `applicationRolePrincipal/applicationRole.replace` だけを support する。
- [x] AC2: current verified identity が proposed roles と一致する pending intent を success へ確定する。
- [x] AC3: durable non-success は requested after と current identity が一致する場合だけ元 result を維持する。
- [x] AC4: early non-success before/after null は identity read なしで確定する。
- [x] AC5: duplicate workers が一つの completed event へ収束する。
- [x] AC6: missing、cross-tenant、inactive、corrupt roles、before/third state、unsupported intent を fail closed にする。
- [x] AC7: resolver は role mutation/session revoke を再実行せず、worker registry/docs/coverage と同期する。
- [x] AC8: selected targeted/full API、typecheck/build/lint/docs/source audit/pre-commit が成功する。
- [ ] AC9: draft stacked PR に base #399、semver、未検証 AWS、rollback、後続 resolver を記載し、日本語 AC/self-review/final-head CI evidence を残す。

## 検証計画

- resolver/worker/outbox targeted test
- requirements coverage と static access-control policy test
- API full coverage、API typecheck/build、root lint
- `task docs:check`、source audit、`git diff --check`、pre-commit
- final-head GitHub Actions / semver validation

## PR レビュー観点

- actor/caller input でなく verified identity を authoritative source にしているか
- tenant/user boundary と exact target/operation selection が fail closed か
- current=before を勝手に failed/success へ変換しないか
- requestedCompletion の result/after と current state を両方再確認するか
- secret/token/email/username を audit after に追加していないか
- role mutation/session revoke を worker が再実行しないか
- #399 の retry/quarantine、並行 PR の generated docs と競合しないか
- RAG 根拠性・dataset 固有分岐・production UI を変更していないか

## リスク

- 実 Cognito の read consistency と worker delivery は未検証。
- managed-state callback の状態は identity provider だけでは判定できないため、current=before の pending intent は自動確定せず quarantine し得る。
- stacked chain #386→#389→#391→#394→#399 の順序が必要。base が変わった場合は contract/full tests と docs generator を再実行する。

## 検証結果（PR 作成前）

- `npm ci`: 成功（既存の audit 指摘 8 件: low 2 / moderate 1 / high 5、依存関係変更なし）。
- API full test: 成功（836/836、失敗 0）。非 canonical な有効 role 順を service と同じ catalog 順へ正規化する境界 test を含む。
- `npm run typecheck -w @memorag-mvp/api`: 成功。
- infra test / bundle: 成功（5 test files、38 tests）。Cognito read-only IAM と mutation/session action 非付与を確認。
- `task docs:infra-inventory`: 成功。generated IAM / resource inventory を更新。
- `task docs:check`: 成功（OpenAPI、API-code 97 API / 582 docs、UI trace、inventory、hidden Unicode を含む）。
- source audit: 成功（dataset-specific branch 0、artifact manifest mismatch 0、audit ID `sha256:86700b07bb7563478b50f827cc6cbda4c535504059c088b0dd938e4cf0e28ef4`）。
- `task verify`: 成功（lint、全 workspace typecheck/build）。Web chunk size warning は失敗ではなく既存の警告。
- `git diff --check` / `pre-commit run`: 成功。
- 初回 API typecheck の optional provider / readonly JSON 型エラーと、infra snapshot stale は実装修正・snapshot/inventory 再生成後に再検証して解消した。
- 実 AWS Cognito / EventBridge / Lambda worker は未検証であり、AC9 の PR に制約として記録する。
