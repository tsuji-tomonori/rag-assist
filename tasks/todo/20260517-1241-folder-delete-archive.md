# フォルダ削除 / archive

状態: todo
タスク種別: 機能追加

## 背景

仕様には `folder:delete` が存在するが、現行の document group API にはフォルダ削除または archive の明確な route / service / store 実装が不足している。canonical path lock を導入したため、削除時は group item だけでなく path lock と子孫・配下文書の扱いも決める必要がある。

## 目的

安全なフォルダ削除または archive 操作を追加し、ACL、配下文書、子孫フォルダ、path lock、audit を整合させる。

## 対象範囲

- `apps/api/src/routes/document-routes.ts`
- `apps/api/src/rag/memorag-service.ts`
- Local / DynamoDB document group store
- `apps/api/src/schemas.ts`
- Web folder operation UI
- API / Web tests、OpenAPI docs、Web inventory

## 含まない

- 文書そのものの削除再実装。
- 大規模 subtree 削除の非同期 job。必要なら後続 task に分離する。

## 実行計画

1. 削除方式を「空フォルダのみ delete」「archive」「recursive delete」のどれにするか決める。
2. 初回は事故防止のため、空フォルダのみ削除または archive を優先する。
3. 削除前に子孫フォルダと配下文書の存在確認を行う。
4. DynamoDB transaction で group item と path lock item の整合を保つ。
5. API schema / route permission / access-control policy を追加する。
6. Web UI に確認 dialog と error state を追加する。
7. operation audit または recent operation への記録方針を実装する。

## ドキュメント保守計画

- OpenAPI docs を更新する。
- Web inventory を更新する。
- 削除方式と制約を docs または PR 本文に明記する。

## 受け入れ条件

- 権限のない利用者は folder delete / archive を実行できない。
- 削除対象 folder の path lock が削除または archive 状態へ同期される。
- 子孫や文書が存在する場合の挙動が仕様化され、API / UI で明示される。
- 削除後に folder tree、upload destination、RAG scope に stale folder が残らない。
- 削除操作は確認 dialog を経由し、危険操作として扱われる。
- Local store と DynamoDB store で同じ制約を再現する。

## 検証計画

- `npm run test -w @memorag-mvp/api -- document-group`
- `npm run test -w @memorag-mvp/web -- DocumentWorkspace`
- `npm run typecheck --workspaces --if-present`
- `npm run docs:openapi:check`
- `npm run docs:web-inventory:check`
- `git diff --check`

## PR レビュー観点

- delete / archive が document ACL と RAG 検索範囲を弱めないこと。
- path lock cleanup が失敗時に不整合を残さないこと。
- recursive delete を実装する場合は、配下文書と子孫 folder の扱いが明示されていること。

## リスク

- 削除は不可逆に近い操作になりやすいため、初回は archive または empty-only delete の方が安全。
