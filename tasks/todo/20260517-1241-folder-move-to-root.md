# フォルダを root へ移動する API / UI

状態: todo
タスク種別: 機能追加

## 背景

PR #321 後の update schema は `parentGroupId` を optional string として扱っているため、親フォルダを外して root に戻す操作を表現しにくい。フォルダ階層の運用では、誤って深い階層に作成したフォルダを root に戻す操作が必要になる。

## 目的

既存フォルダの `parentGroupId` を clear し、同一 admin namespace の root folder として移動できる API / UI を追加する。

## 対象範囲

- `apps/api/src/schemas.ts`
- `apps/api/src/routes/document-routes.ts`
- `apps/api/src/rag/memorag-service.ts`
- Local / DynamoDB document group store
- `apps/web/src/features/documents/`
- API / Web tests、OpenAPI docs、Web inventory

## 含まない

- 一般的な rename / move UI 全体。これは `20260517-1241-folder-rename-move-ui.md` で扱う。
- cross-admin move。これは必要なら別 task に分離する。

## 実行計画

1. update request の `parentGroupId` 表現を確認する。
2. `parentGroupId: null` または明示的な move-to-root endpoint のどちらを採用するか決める。
3. service 層で root path `/${name}` と `parentPathPk` root 表現を再計算する。
4. path lock の old / new lock 更新が root move でも整合することをテストする。
5. UI で移動先に root を選べるようにする。
6. OpenAPI / Web type / docs を同期する。

## ドキュメント保守計画

- API schema 変更が入るため OpenAPI docs を更新する。
- UI 操作追加に伴い Web inventory を更新する。

## 受け入れ条件

- API request で「親フォルダなし」を明示できる。
- root へ移動した folder の `parentGroupId` が未設定になり、`ancestorGroupIds` が空になる。
- root へ移動した folder と子孫の `canonicalPath` / `normalizedCanonicalPath` が再計算される。
- root path の重複は同一 `tenantId + adminPrincipalType + adminPrincipalId` で拒否される。
- old path lock が削除され、新 root path lock が作成される。
- Web UI から root を移動先として選べる。

## 検証計画

- `npm run test -w @memorag-mvp/api -- document-group`
- `npm run test -w @memorag-mvp/web -- DocumentWorkspace useDocuments`
- `npm run typecheck --workspaces --if-present`
- `npm run docs:openapi:check`
- `npm run docs:web-inventory:check`
- `git diff --check`

## PR レビュー観点

- optional と null の意味が曖昧になっていないこと。
- parent unchanged と move to root を API が区別できること。
- root move により document ACL / RAG scope が意図せず広がらないこと。

## リスク

- 既存 client が `parentGroupId` omitted を「変更なし」として使うため、root move 表現を追加する際に後方互換を壊さない注意が必要。
