# Admin real-data surfaces

- 状態: done
- タスク種別: 機能追加
- 対象: Worker C / Web admin feature only

## 背景

Admin UI の quality / action-card / group / export surface は、API が実データを提供する場合だけ表示し、固定の group、count、cost、export URL や非機能コントロールを本番 UI に出さない必要がある。

## 目的

`apps/web/src/features/admin/**` の範囲で、API 由来データが欠落する場合に正直な unavailable / empty state を表示し、実装済みでない操作を表示しない。

## スコープ

- `apps/web/src/features/admin/**`
- 同配下の focused web tests

## スコープ外

- `apps/api`
- schemas / authorization
- docs / generated docs
- package files
- commit / push / PR 作成

## 受け入れ条件

- [x] API fields が存在しない場合、fake groups、counts、costs、export URLs を表示しない。
- [x] API fields が存在しない場合、非機能の action controls や export controls を表示しない。
- [x] API fields が存在する場合は、既存の admin UI で実データを表示できる。
- [x] focused web tests を追加または更新し、対象挙動を検証する。
- [x] `git diff --check` と関連 web test を実行し、結果を記録する。

## 実施内容

- Admin API wrapper で、list response の該当 field が欠落している場合は `[]` ではなく `null` を返すようにした。
- Admin workspace / panels で `null` を未提供、`[]` を提供された空状態として分けて表示した。
- Role/group が未提供の場合は `CHAT_USER` を既定 group として作成・付与しないようにした。
- Alias publish は承認済み alias が存在する場合だけ表示するようにした。
- 欠落 field と非機能 control 非表示の focused tests を追加した。

## 検証結果

- `npm run test -w @memorag-mvp/web -- apps/web/src/features/admin`: fail。workspace 相対 path のため test file が見つからなかった。
- `npm run test -w @memorag-mvp/web -- src/features/admin`: pass。
- `npm run typecheck -w @memorag-mvp/web`: pass。
- `git diff --check`: pass。

## PR / commit

ユーザー指示が `Do not commit` のため、commit、push、PR 作成、PR コメントは実施していない。

## ドキュメント保守

ユーザー指定により docs / generated docs は編集していない。挙動変更の要点はこの task md と post-task report に記録する。
