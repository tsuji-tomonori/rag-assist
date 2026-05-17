# 既存文書のフォルダ移動

状態: todo
タスク種別: 機能追加

## 背景

文書 upload scope は folder / group を指定できるが、アップロード後の既存文書を別 folder へ移動する API / UI は不足している。仕様には `document:move` があり、フォルダ運用では誤投入や分類変更に対応する移動操作が必要になる。

## 目的

既存 document の所属 document group を変更できる API / UI を追加し、ACL、RAG 検索範囲、manifest / vector metadata の整合を保つ。

## 対象範囲

- Document metadata / manifest の group assignment
- `apps/api/src/routes/document-routes.ts`
- `apps/api/src/rag/memorag-service.ts`
- Local / DynamoDB stores
- Vector metadata / search scope の更新要否
- `apps/web/src/features/documents/`
- API / Web tests、OpenAPI docs、Web inventory

## 含まない

- フォルダ自体の移動。
- 文書 content 再 ingest。必要な場合のみ metadata update / reindex を設計する。

## 実行計画

1. Document が持つ `groupId` / scope / manifest / vector metadata を棚卸しする。
2. document move に必要な権限を定義する。source と destination の manage 権限が必要かを決める。
3. API request / response schema を追加する。
4. metadata / manifest / vector store の整合更新方式を決める。
5. Web UI に移動先 folder 選択と確認 dialog を追加する。
6. RAG 検索範囲と upload scope の回帰テストを追加する。

## ドキュメント保守計画

- OpenAPI docs を更新する。
- Web inventory を更新する。
- 移動時に reindex が必要か不要かを docs または PR 本文に明記する。

## 受け入れ条件

- 既存 document を別 folder へ移動できる。
- source folder と destination folder の権限境界が検証される。
- 移動後、文書一覧と folder filter が新しい所属を反映する。
- RAG 検索範囲が移動後の folder / ACL に従う。
- upload scope や document delete / reindex の既存導線が退行しない。
- API / Web の error state が権限不足、存在しない folder、移動不可状態を区別できる。

## 検証計画

- `npm run test -w @memorag-mvp/api -- document`
- `npm run test -w @memorag-mvp/web -- DocumentWorkspace useDocuments`
- `npm run typecheck --workspaces --if-present`
- `npm run docs:openapi:check`
- `npm run docs:web-inventory:check`
- `git diff --check`

## PR レビュー観点

- 移動後の文書が旧 folder の ACL で検索でき続けないこと。
- metadata 更新だけで十分か、vector metadata の更新または reindex が必要かを根拠付きで判断していること。
- source / destination 両方の権限チェックが不足していないこと。

## リスク

- vector metadata に group scope が埋まっている場合、単純な document metadata 更新だけでは RAG scope が stale になる可能性がある。
