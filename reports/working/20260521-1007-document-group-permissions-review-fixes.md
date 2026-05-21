# 文書管理権限分離 PR 再レビュー対応レポート

## 受けた指示

PR #330 の再レビュー指摘として、Quality Gate failure、フォルダ作成ショートカットの disabled、create-only 作成後 refresh 失敗、readOnly parent contract、stale parent state、アップロード title、`effectivePermission` 未設定時の管理操作について merge 前に修正するよう依頼された。

## 要件整理

- 作成導線ボタンと作成 submit ボタンの可否を分離する。
- create-only ユーザーでは、作成成功後の refresh 失敗を作成失敗として扱わない。
- API contract で inaccessible parent と readOnly parent を別々に固定する。
- stale parent state は submit 不可かつ理由表示できるようにする。
- アップロード shortcut の title は実保存先に合わせる。
- `effectivePermission` 欠落は full ではなく管理不可として扱う。
- coverage guard 対象の web/API coverage test を実行する。

## 検討・判断

`rag:group:create` だけで画面利用を許す前提は維持し、作成後 refresh 失敗は error state に残しつつ作成結果を返す方針にした。`effectivePermission` 欠落は API 由来データの欠落として安全側に倒し、テスト fixture 側に `full` を明示した。

## 実施作業

- `DocumentWorkspace` で `canOpenCreateFolderForm` と submit 用 `canCreateGroup` を分離した。
- `getCreateFolderDisabledReason()` に stale parent 判定を追加し、helper を export して単体確認できるようにした。
- `DocumentFilePanel` のアップロード title を `uploadDestinationLabel` に統一した。
- Web 側の `canManageDocumentGroup()` を `effectivePermission === "full"` のみにした。
- `useDocuments.onCreateDocumentGroup()` で create 成功後 refresh 失敗を作成失敗から分離した。
- API contract test に readOnly parent 403 を追加し、既存の private parent ケースは inaccessible parent として名前を直した。
- Web/App の fixture に API 返却相当の `effectivePermission` を明示した。

## 成果物

- `apps/web/src/features/documents/components/DocumentWorkspace.tsx`
- `apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx`
- `apps/web/src/features/documents/hooks/useDocuments.ts`
- `apps/web/src/features/documents/components/DocumentWorkspace.test.tsx`
- `apps/web/src/features/documents/hooks/useDocuments.test.ts`
- `apps/web/src/App.test.tsx`
- `apps/api/src/contract/api-contract.test.ts`
- `tasks/do/20260521-0935-document-group-permissions-review-fixes.md`

## fit 評価

再レビューの P1/P2/P3 指摘に対応し、coverage guard 対象コマンドも web/API とも pass した。API の forbidden body は既存 route 方針どおり generic `Forbidden` のままとし、contract test では status 403 を固定した。

## 未対応・制約・リスク

ブラウザでの手動操作確認は未実施。GitHub Actions の最終 `Quality Gate / ci` は push 後に確認が必要。

## 検証結果

- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run test -w @memorag-mvp/web -- DocumentWorkspace.test.tsx useDocuments.test.ts`: 初回 2 件失敗、修正後 pass
- `npm run test -w @memorag-mvp/api -- api-contract.test.ts`: pass
- `npm run test -w @memorag-mvp/web -- --coverage`: 初回 1 件失敗、修正後 pass
- `npm run test -w @memorag-mvp/api -- --coverage`: pass
- `git diff --check`: pass
