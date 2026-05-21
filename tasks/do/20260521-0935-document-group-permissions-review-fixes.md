# 文書管理権限分離 PR 再レビュー対応

状態: doing

## 背景

PR #330 の再レビューで、フォルダ作成ショートカットの disabled 条件、create-only ユーザーの作成成功後 refresh 失敗処理、readOnly parent API contract、stale parent state、アップロード title、`effectivePermission` 未設定時の管理操作について merge 前修正が必要と指摘された。

## 受け入れ条件

- 「フォルダを作成」ショートカットはフォルダ名未入力でも有効で、新規フォルダ名入力へ focus する。
- フォルダ作成 submit 可否は作成導線可否と分離され、名前未入力時は submit のみ disabled になる。
- create-only ユーザーで作成 API 成功後の一覧 refresh が失敗しても、作成結果を失敗扱いにしない。
- `POST /document-groups` は readOnly parent 配下の作成を 403 として contract test で固定する。
- stale `parentGroupId` は「親フォルダを選択し直してください。」として submit を無効化する。
- アップロードショートカットの title は実際の保存先 `uploadGroupId` のラベルを表示する。
- `effectivePermission` 未設定のフォルダは管理操作を有効化しない。
- coverage guard 対象の web/API coverage test を実行し、結果を PR に報告する。

## 検証予定

- `npm run test -w @memorag-mvp/web -- --coverage`
- `npm run test -w @memorag-mvp/api -- --coverage`
- 必要に応じて targeted test / typecheck

## 検証結果

- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run test -w @memorag-mvp/web -- DocumentWorkspace.test.tsx useDocuments.test.ts`: 初回 2 件失敗、fixture と query を修正後 pass
- `npm run test -w @memorag-mvp/api -- api-contract.test.ts`: pass
- `npm run test -w @memorag-mvp/web -- --coverage`: 初回 1 件失敗、App test fixture を API 返却相当に修正後 pass
- `npm run test -w @memorag-mvp/api -- --coverage`: pass
- `git diff --check`: pass
