# フォルダ操作 audit log

状態: todo
タスク種別: 機能追加

## 背景

仕様では folder rename / move / delete / sharing などの管理操作や危険操作に audit が求められる。現行 UI には recent operation 表示があるが、フォルダ操作を durable audit として保存・参照する仕組みは不足している。

## 目的

フォルダ作成、rename、move、share、manager 更新、delete / archive を audit log に記録し、運用者が誰がいつ何を変更したか追跡できるようにする。

## 対象範囲

- API service の folder mutation
- audit log store / schema
- Web operation history または admin view
- OpenAPI docs
- API / Web tests

## 含まない

- 全システム操作の audit 統合。
- 外部 SIEM 連携。

## 昇華メタ情報

- 優先度: P1。delete / move / sharing などの危険操作に先行または同時実装したい。
- 依存関係: actor / tenant context、folder mutation service、audit storage 方針。
- 推奨 PR 分割:
  - PR 1: audit event schema と store。
  - PR 2: folder mutation への audit emit。
  - PR 3: admin / operation UI または API read model。
- 成功指標: folder mutation の before / after summary を権限内で追跡できる。

## 実装設計メモ

- audit event には actor、tenantId、operation、target groupId、canonical path before / after、result を入れる。
- raw request、credentials、内部 reasoning、unauthorized document data は保存しない。
- audit write failure の扱いは operation ごとに fail closed / fail open を決める。
- delete / move は denied / failed event も記録対象にする。

## 追加確認観点

- audit log read API は system admin または適切な audit permission に限定される。
- audit event が cross-tenant に見えない。
- operation success と audit write の整合性がテストされている。

## 未確定点

- audit store を既存 store に統合するか、専用 table / object にするか。
- 保持期間と redaction policy。

## 実行計画

1. 既存の recent operations / audit 風実装を確認する。
2. folder audit event schema を設計する。
3. mutation ごとに actor、target、before / after summary、request id、timestamp、tenant を記録する。
4. 機微情報を audit に保存しすぎない redaction 方針を決める。
5. API または admin UI で参照できる範囲を決める。
6. delete / move など危険操作の確認 dialog と audit を連動させる。

## ドキュメント保守計画

- OpenAPI docs を更新する。
- 運用 docs に audit event の用途、保持期間、機微情報方針を記載する。
- Web inventory を更新する。

## 受け入れ条件

- folder create / rename / move / share / manager update / delete または archive が audit event を残す。
- audit event は actor user ID、tenantId、target group ID、operation、timestamp を持つ。
- before / after は運用確認に必要な範囲に限定され、機微情報を過剰に含まない。
- 権限のない利用者は audit log を閲覧できない。
- 失敗した危険操作も必要に応じて denied / failed event として追跡できる。
- audit の追加により既存 mutation の成功条件が不必要に脆くならない。

## 検証計画

- `npm run test -w @memorag-mvp/api -- audit document-group`
- `npm run test -w @memorag-mvp/web -- DocumentWorkspace`
- `npm run typecheck --workspaces --if-present`
- `npm run docs:openapi:check`
- `git diff --check`

## PR レビュー観点

- audit event が認可境界をまたいで閲覧できないこと。
- raw request や credentials などの機微情報を保存していないこと。
- mutation 成功と audit write 失敗時の扱いが明確であること。

## リスク

- audit を強整合で必須にすると folder mutation の可用性に影響するため、失敗時の fail open / fail closed 方針を決める必要がある。
