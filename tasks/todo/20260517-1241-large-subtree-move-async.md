# 大規模 subtree move の非同期化

状態: todo
タスク種別: 機能追加

## 背景

PR #321 の同期 move は DynamoDB transaction 制限を考慮して、更新対象 subtree のサイズに上限を設けている。大きな folder tree を移動するには、canonical path、ancestorGroupIds、path lock を複数 batch で安全に更新する非同期 migration / job が必要になる。

## 目的

大規模 subtree move を非同期 run として実行できる仕組みを追加し、進捗、失敗復旧、整合性検証、UI 表示を提供する。

## 対象範囲

- document group move service
- async run store または migration job store
- DynamoDB batch / transaction orchestration
- path lock update
- Web progress / blocked state 表示
- API / Web tests、OpenAPI docs

## 含まない

- 小規模 subtree の同期 move 再実装。
- フォルダ削除の非同期化。

## 実行計画

1. 現在の subtree move 上限と transaction item 数を確認する。
2. 非同期 move run の状態 machine を設計する。
3. 移動対象 subtree の snapshot と new path plan を作成する。
4. lock acquisition、group update、old lock cleanup を段階実行する。
5. 途中失敗時の retry / cancel / repair 方針を設計する。
6. UI に大規模 move の受付、進捗、失敗状態を表示する。
7. 整合性検証コマンドを追加する。

## ドキュメント保守計画

- OpenAPI docs を更新する。
- 運用 docs に failed move の recovery / verification 手順を追加する。
- Web inventory を更新する。

## 受け入れ条件

- 同期 move 上限を超える subtree move を非同期 run として受付できる。
- run は対象 group、old path、new path、対象件数、進捗、失敗理由を記録する。
- path lock と group item の更新が途中失敗時にも検証可能である。
- 同一 subtree に対する並行 move が拒否または serialized される。
- UI で非同期 move の進捗と完了 / 失敗を確認できる。
- 小規模同期 move の既存挙動が退行しない。

## 検証計画

- `npm run test -w @memorag-mvp/api -- document-group`
- async move fixture test
- `npm run test -w @memorag-mvp/web -- DocumentWorkspace`
- `npm run typecheck --workspaces --if-present`
- `npm run docs:openapi:check`
- `git diff --check`

## PR レビュー観点

- lock item が group item より先に不整合な状態で残らないこと。
- retry 時に二重 lock / 二重更新が起きないこと。
- UI が完了前の移動を成功済みとして表示しないこと。

## リスク

- DynamoDB transaction 25 item 制限だけでなく、batch write の部分失敗、GSI lag、並行操作 lock を考慮する必要がある。
