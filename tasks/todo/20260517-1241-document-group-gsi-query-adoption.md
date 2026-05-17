# DocumentGroup の GSI query 活用

状態: todo
タスク種別: 機能追加

## 背景

PR #321 で `AdminCanonicalPathIndex` と `listByAdminPath` / `findByCanonicalPath` が追加された。ただし service 層の conflict check や folder listing は、まだ全件 list に寄った箇所が残っている。正しさは path lock transaction で担保されるが、スケール面では GSI query を hot path に使う必要がある。

## 目的

DocumentGroup の canonical path lookup、admin namespace listing、duplicate precheck を `AdminCanonicalPathIndex` ベースへ寄せ、全件 scan / list 依存を減らす。

## 対象範囲

- `apps/api/src/rag/memorag-service.ts`
- `DocumentGroupStore` interface
- Local / DynamoDB document group store
- API tests
- 必要に応じた performance / pagination tests

## 含まない

- ParentFolderIndex の追加。これは `20260517-1241-parent-folder-index.md` で扱う。
- path lock transaction の削除。

## 実行計画

1. service 層で全件 list を使っている document group 処理を棚卸しする。
2. duplicate precheck を `findByCanonicalPath` へ置き換える。
3. admin namespace folder listing を `listByAdminPath` へ寄せる。
4. pagination / sorting / legacy fallback の扱いを設計する。
5. Local store と DynamoDB store の query behavior をテストで固定する。
6. path lock transaction は最終一意性保証として維持する。

## ドキュメント保守計画

- API response 形式が変わらない場合、OpenAPI docs 更新は不要。
- pagination を追加する場合は OpenAPI docs を更新する。
- PR 本文に GSI は lookup / scale 用であり、一意性保証は lock item であることを明記する。

## 受け入れ条件

- duplicate precheck が `findByCanonicalPath` を利用する。
- admin namespace folder listing が `listByAdminPath` を利用する。
- path lock transaction による最終一意性保証は維持される。
- legacy group 補完が GSI query adoption 後も機能する。
- 既存 API response と Web 表示が退行しない。
- 大量 group fixture で全件 scan に依存しない path lookup を検証できる。

## 検証計画

- `npm run test -w @memorag-mvp/api -- document-group`
- `npm run typecheck -w @memorag-mvp/api`
- `npm run docs:openapi:check`
- `git diff --check`

## PR レビュー観点

- GSI query adoption により legacy data が見えなくならないこと。
- precheck を GSI に寄せても transaction lock の condition check を外していないこと。
- tenant / admin principal namespace の partition key が正しく使われていること。

## リスク

- GSI backfill 未完了の環境では query 結果が期待より少ない可能性があるため、migration status と rollout 手順を考慮する必要がある。
