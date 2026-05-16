# 文書グループ resource-level 認可と階層表示 修正レポート

## 指示

ユーザーから「権限共有とディレクトリ周りが適切に実装されていますか?」との確認を受け、不足点として task 化し、そのまま修正を進めるよう指示された。

## 要件整理

- 文書 delete / reindex / stage / cutover / rollback が route-level permission だけでなく、対象文書の group full 権限を確認すること。
- フォルダツリーが `parentGroupId` / `ancestorGroupIds` に基づく階層を UI に反映すること。
- API と Web の回帰テストで境界を固定すること。
- 既存の legacy 文書操作を不必要に壊さないこと。

## 検討・判断

- 文書操作の認可は route handler ではなく `MemoRagService` の manifest 単位 helper に集約した。
- group scoped 文書は `groupIds` の全 group を管理できる場合だけ full 操作を許可する方針にした。
- `ownerUserId` が一致する文書と `SYSTEM_ADMIN` は引き続き管理可能とした。
- group metadata が無い legacy 文書は従来互換を優先し、route permission 保持者の操作を維持した。
- フォルダ UI は実データの parent relation から階層順に並べ、aria-label と title にフルパスを含めた。

## 実施作業

- `MemoRagService` に `assertDocumentWritable()` と manifest full 権限判定を追加。
- `authorizeDocumentDelete()` で `rag:doc:delete:group` 保持者にも対象文書の full 権限確認を追加。
- reindex / stage / cutover / rollback に actor を渡し、対象文書または migration 元文書の full 権限を確認。
- route authorization metadata と静的 policy test に `documentGroupFull` を反映。
- `buildWorkspaceFolders()` を追加し、DocumentWorkspace のフォルダ表示を階層順に変更。
- Web UI inventory 生成物を更新。

## 成果物

- API 修正: `apps/api/src/rag/memorag-service.ts`, `apps/api/src/routes/benchmark-seed.ts`, `apps/api/src/routes/document-routes.ts`
- API テスト: `apps/api/src/rag/memorag-service.test.ts`, `apps/api/src/security/access-control-policy.test.ts`
- Web 修正: `apps/web/src/features/documents/components/DocumentWorkspace.tsx`, `apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx`, `apps/web/src/features/documents/components/workspace/documentWorkspaceUtils.ts`
- Web テスト: `apps/web/src/features/documents/components/DocumentWorkspace.test.tsx`
- 生成 docs: `docs/generated/web-accessibility.md`, `docs/generated/web-features/documents.md`, `docs/generated/web-ui-inventory.json`
- task: `tasks/do/20260516-1719-document-group-resource-auth.md`

## 検証

- `npm run test -w @memorag-mvp/api -- memorag-service.test.ts`: pass
- `npm run test -w @memorag-mvp/web -- DocumentWorkspace.test.tsx`: pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run test -w @memorag-mvp/api -- memorag-service.test.ts access-control-policy.test.ts`: pass
- `npm run docs:openapi:check`: pass
- `npm run docs:web-inventory:check`: pass
- `npm run lint`: pass
- `git diff --check`: pass

## Fit 評価

総合fit: 4.7 / 5.0

主要な権限境界と階層 UI は修正し、関連テストも追加した。legacy 文書の厳格な所有者境界は互換性維持のため現状維持としており、将来仕様が固まったら追加 hardening の余地がある。

## 未対応・リスク

- group metadata が存在しない legacy 文書は route permission ベースの従来動作を維持している。
- reindex migration 一覧は既存どおり `rag:index:rebuild:group` 保持者に一覧返却する。個別 cutover / rollback は full 権限を再確認する。
