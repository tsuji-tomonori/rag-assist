# 作業完了レポート

- 保存先: `reports/working/20260711-1921-folder-create-legacy-hardening.md`
- 対象: folder create authority 固定と legacy settings bypass の strict rejection

## 受けた指示

- `POST /document-groups` から初期 ACL と requested administrative principal fields を除去し、unknown field を 400 にする。
- 新規 folder を常に actor tenant / actor user administrator / private / unshared で作成する。
- legacy `POST /document-groups/{groupId}/share` は名前と説明だけを許可し、ACL fields と `parentGroupId` を 400 にする。
- 拒否時に state、path、policy、audit を一切変更しないことを route test で証明する。
- Web、OpenAPI、static policy、既存 folder tests を同期する。

## 実施内容

- create schema を `{ name, description?, parentGroupId? }.strict()`、legacy settings schema を `{ name?, description? }.strict()` に変更した。
- `MemoRagService.createDocumentGroup` を actor の authoritative tenant/user だけから administrative principal を構成する実装へ変更し、parent principal 継承、`SYSTEM_ADMIN`、Cognito group、request payload による administrator 選択を削除した。
- create 結果を `private`、`sharedUserIds: []`、`sharedGroups: []`、`managerUserIds: [actor.userId]` に固定した。
- legacy service から parent move と ACL 入力を除去し、rename 時の子孫 path 再計算でも各 folder の administrative principal を変更しないようにした。
- in-process route test で各 prohibited field の 400、safe create、safe rename、state/path-lock/policy/audit 無残留を確認した。
- Web create form から公開範囲、初期共有、管理者入力を削除し、非公開作成と作成後の versioned sharing を明示した。統合後の folder editor は name/parent mutation を専用 move API、description mutation だけを legacy settings API へ送る。
- OpenAPI operation descriptions、400 response、static access-control test、MemoRag service fixtures、HTTP contract fixturesを新しい境界へ更新した。

## 成果物

- `apps/api/src/schemas.ts`
- `apps/api/src/rag/memorag-service.ts`
- `apps/api/src/rag/memorag-service.test.ts`
- `apps/api/src/routes/document-routes.ts`
- `apps/api/src/folder-share-routes.test.ts`
- `apps/api/src/security/access-control-policy.test.ts`
- `apps/api/src/openapi-doc-quality.ts`
- `apps/api/src/contract/api-contract.test.ts`
- `apps/api/src/document-share-routes.test.ts`
- `apps/api/src/document-reader-routes.test.ts`
- `apps/web/src/features/documents/api/documentsApi.ts`
- `apps/web/src/features/documents/hooks/useDocuments.ts`
- `apps/web/src/features/documents/hooks/useDocuments.test.ts`
- `apps/web/src/features/documents/components/DocumentWorkspace.tsx`
- `apps/web/src/features/documents/components/DocumentWorkspace.test.tsx`
- `apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx`

## 検証

- folder share in-process route test: pass
- folder permission service test: pass
- MemoRagService full test（66 tests を含む file）: pass
- API typecheck: pass
- Web targeted tests: 3 files / 86 tests pass（専用 move Web 配線の並行変更前）
- Web typecheck: pass（専用 move Web 配線の並行変更前）
- OpenAPI document quality unit test: pass

## fit 評価

- create / legacy route の production authority bypass は schema、service、Web の各層で閉じた。
- prohibited request の無残留と actor-user/private invariant を executable test で確認した。
- parent placement は create で維持し、parent mutation は dedicated move workflow だけへ分離した。

## 未対応・制約・リスク

- subprocess HTTP route tests は sandbox の socket bind 制限（`listen EPERM`）で実行できていない。unsandboxed 実行には都度ユーザー承認が必要。
- generated OpenAPI Markdown は並行 route 変更が収束した後に統合担当が再生成する。runtime source は更新済み。
- full static/OpenAPI runtime suite の担当外 failure は各担当へ共有済みであり、本レポートでは pass と扱っていない。
