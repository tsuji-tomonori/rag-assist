# ドキュメントフォルダ作成 UI 設定拡張 作業レポート

## 受けた指示

- ドキュメント管理 UI/UX 改善ロードマップの次の改善へ進む。
- リポジトリの Worktree Task PR Flow に従い、実装、検証、PR 作成まで進める。

## 要件整理

- 新規フォルダ作成を名前のみから設定込みに拡張する。
- 作成時に説明、親フォルダ、公開範囲、shared groups、manager user IDs を指定できるようにする。
- 作成前に設定 preview と validation を表示する。
- 作成後に新規フォルダへ移動し、アップロード先にも設定できるようにする。
- Cognito group / user の候補 API はないため、架空候補や demo fallback は表示しない。

## 実施作業

- `DocumentWorkspace` の新規フォルダフォームに説明、親フォルダ、公開範囲、初期 shared groups、管理者 user IDs、作成後移動の入力を追加した。
- shared groups / manager user IDs の空 token と重複 validation、および公開範囲・親フォルダ・共有先・管理者・作成後移動の preview を追加した。
- `useDocuments` の create group 入力型を API に合わせて拡張し、作成された `DocumentGroup` を返して UI が作成後移動に使えるようにした。
- 関連 CSS、`DocumentWorkspace` / `useDocuments` のテスト、Web UI inventory generated docs を更新した。

## 成果物

- `memorag-bedrock-mvp/apps/web/src/features/documents/components/DocumentWorkspace.tsx`
- `memorag-bedrock-mvp/apps/web/src/features/documents/hooks/useDocuments.ts`
- `memorag-bedrock-mvp/apps/web/src/styles/features/documents.css`
- `memorag-bedrock-mvp/apps/web/src/features/documents/components/DocumentWorkspace.test.tsx`
- `memorag-bedrock-mvp/docs/generated/*`
- `tasks/do/20260510-1425-document-folder-create-settings.md`

## 検証

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- DocumentWorkspace useDocuments`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`: pass
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`: pass
- `npm --prefix memorag-bedrock-mvp run test:coverage -w @memorag-mvp/web`: pass, 198 tests
- `git diff --check`: pass

## fit 評価

- 受け入れ条件は実装とテストで満たした。
- 本番 UI に架空の group / user / manager 候補は追加していない。
- README や運用 docs は、既存の generated Web UI inventory が画面構成の同期対象であり、恒久的な手順変更はないため更新不要と判断した。

## 未対応・制約・リスク

- Cognito group / manager user ID の実在確認は、現状どおり API 側 validation に依存する。
- `npm ci` 実行時に `3 vulnerabilities (1 moderate, 2 high)` が報告されたが、今回の UI 変更範囲外のため修正していない。
