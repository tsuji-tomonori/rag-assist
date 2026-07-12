# 作業完了レポート

- 保存先: `reports/working/20260711-1837-folder-share-route-wiring.md`
- 対象: `FR-062` / `FR-085` / `FR-086` の folder share production wiring

## 受けた指示

- `FolderPermissionService.getVersionedFolderPolicy` / `replaceVersionedFolderPolicy` を production API へ接続する。
- `expectedVersion`、complete entries、canonical reason、active same-tenant principal 検証、security mutation audit を必須化する。
- legacy `POST /document-groups/{groupId}/share` が `visibility`、`sharedUserIds`、`sharedGroups`、`managerUserIds` を更新する unversioned bypass を閉じる。
- folder rename、description と reader/minimal response を維持する。追加監査で parent move は legacy route から除外し、専用 move endpoint へ分離する。
- schemas、access-control、OpenAPI、Web API/UI/tests を同期する。

## 実施内容と判断

- `GET` / `PUT /document-groups/{groupId}/share` を追加し、`folder.share` feature permission と対象 folder の実効 `full` を route/service の双方で確認するようにした。
- 初回 versioned policy が未作成の production folder でも、versioned store を正本として deterministic policy ID を生成し、CAS 置換できるようにした。
- versioned policy の探索を folder metadata の `policyId` だけに依存させず、folder ID に対応する versioned store state を優先するようにした。legacy parent inheritance は `legacyFolder` を明示して維持した。
- legacy POST request schema は `{ name?, description? }` の strict schema とし、共有 ACL fields、administrative principal fields、`parentGroupId` を 400 で拒否する。service 側も名前・説明以外を処理せず、parent move は専用 endpoint へ分離した。
- folder create request schema は `{ name, description?, parentGroupId? }` の strict schema とした。作成結果は常に actor tenant、actor user administrative principal、`private`、空の共有先、actor だけの manager であり、`SYSTEM_ADMIN` や actor の Cognito group を使った requested admin group bypass は存在しない。
- strict validation が失敗した create / legacy update について、folder state、path lock、versioned policy、security audit intent がすべて無変更であることを in-process route test で確認した。
- Web は versioned GET で取得した version を PUT の `expectedVersion` に使用し、管理 principal の full entry、既存の user/full/deny entries、編集対象の readOnly resource-group entries を complete state として送る。理由未入力、未取得、loading、対象 folder が full でない場合は送信しない。create form から初期 ACL/admin 入力を除去し、path/name mutation は専用 move API、description mutation だけを legacy settings API へ送るよう分離した。
- UI の共有 principal 表記を Cognito application role ではなく resource group ID に変更し、API の active/same-tenant directory validation と整合させた。

## 成果物

### API

- `apps/api/src/folders/folder-permission-service.ts`
- `apps/api/src/folders/folder-permission-service.test.ts`
- `apps/api/src/folder-share-routes.test.ts`
- `apps/api/src/rag/memorag-service.ts`
- `apps/api/src/rag/memorag-service.test.ts`
- `apps/api/src/routes/document-routes.ts`
- `apps/api/src/schemas.ts`
- `apps/api/src/security/access-control-policy.test.ts`
- `apps/api/src/openapi-doc-quality.ts`

### Web

- `apps/web/src/features/documents/api/documentsApi.ts`
- `apps/web/src/features/documents/api/documentsApi.test.ts`
- `apps/web/src/features/documents/hooks/useDocuments.ts`
- `apps/web/src/features/documents/hooks/useDocuments.test.ts`
- `apps/web/src/features/documents/components/DocumentWorkspace.tsx`
- `apps/web/src/features/documents/components/DocumentWorkspace.test.tsx`
- `apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx`
- `apps/web/src/app/hooks/useAppShellState.ts`
- `apps/web/src/app/hooks/usePermissions.ts`
- `apps/web/src/app/hooks/usePermissions.test.ts`

## 実行した検証

- `node --import tsx --test src/folders/folder-permission-service.test.ts src/folder-share-routes.test.ts`: pass
- `env NODE_ENV=test ... BENCHMARK_EVALUATION_TENANT_ID=benchmark-test node --import tsx --test src/rag/memorag-service.test.ts`: pass
- `npm run test --workspace apps/web -- --run src/features/documents/api/documentsApi.test.ts src/features/documents/hooks/useDocuments.test.ts src/features/documents/components/DocumentWorkspace.test.tsx`: pass（3 files / 86 tests、専用 move Web 配線の並行変更前）
- `npm run typecheck -w @memorag-mvp/api`: pass。並行中の tenant patch が未反映だった初回だけ undefined helper で fail したが、同 patch 反映後の再実行で pass。
- `npm run typecheck -w @memorag-mvp/web`: pass
- 担当ファイルに対する `git diff --check`: pass

## 指示への fit

**実装fit: 5.0 / 5.0（validation は sandbox 制約を別記）**

- versioned production API、CAS、complete state、principal validation、audit、access-control/OpenAPI source、Web UI/API、bypass regression test を実装した。
- legacy rename/description と folder inheritance、reader/minimal list contract を維持し、parent move は dedicated workflow だけへ分離した。
- 担当 in-process test、full MemoRag service test、API/Web typecheck は pass した。

## 未対応・制約・リスク

- production deploy と既存 legacy ACL の一括 migration は本タスク対象外。
- `docs/generated/openapi/` の生成は同一統合 worktree の別並行タスクが実行中であり、本担当では同時生成を避けた。runtime OpenAPI source と operation quality metadata は更新済み。
- subprocess HTTP route tests は sandbox の `listen EPERM` により未実施。unsandboxed 再実行には repository policy に従うユーザー承認が必要。
- full `access-control-policy.test.ts` には並行中の document delete coordinator に対する旧 static assertion が 1 件残り、`openapi-runtime-source.test.ts` には resource-group membership の英語 503 description が 2 件残る。いずれも担当 folder test 自体ではなく、各並行担当へ連携済み。
