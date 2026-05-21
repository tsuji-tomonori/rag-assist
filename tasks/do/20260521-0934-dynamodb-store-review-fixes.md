# DynamoDB-backed store PR レビュー指摘対応

状態: do
タスク種別: 修正

## 背景

PR #332 のレビューで、runtime LocalStore fallback、suspended SYSTEM_ADMIN の権限迂回、未割当 ticket、favorite targetType の権限再確認、favorite backfill 上書き、DynamoDB Query pagination の不整合が指摘された。

## 受け入れ条件

- production では `MEMORAG_ALLOW_LEGACY_LOCAL_STORE_FOR_TESTS=true` を指定しても LocalStore へ切り替わらない、または明示的に失敗する。
- `canReadAllTickets()` は `support:ticket:read:all` permission のみで判定し、`SYSTEM_ADMIN` 文字列直判定で active account check を迂回しない。
- `POST /questions` で assignee 未指定の場合、設定済み default support group を `assigneeGroupId` に保存でき、通常担当者が fresh ticket を一覧取得できる。
- favorite targetType は resolver 実装済み target のみ `accessible=true` にし、未実装 target は保存時・一覧時に安全側へ倒す。
- favorite backfill は conditional put を使い、既存 favorite の label/note/createdAt を上書きしない。
- DynamoDB question/favorite/conversation-history list は `LastEvaluatedKey` を追って全ページを取得する。
- 追加・修正した挙動を単体テストで固定する。

## 検証計画

- `npm run typecheck -w @memorag-mvp/api`
- `npm test -w @memorag-mvp/api`
- `npm run docs:openapi:check -w @memorag-mvp/api`
- `git diff --check`

## 完了条件

実装、テスト、検証、作業レポート、commit/push、PR コメント、セルフレビューコメントまで完了したら `tasks/done/` へ移動する。
