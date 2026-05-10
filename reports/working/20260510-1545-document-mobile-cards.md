# ドキュメント一覧モバイルカード表示 作業レポート

## 受けた指示

- ドキュメント管理 UI/UX 改善ロードマップの次の改善へ進む。
- リポジトリの Worktree Task PR Flow に従い、実装、検証、PR 作成まで進める。

## 要件整理

- PC 向けの文書一覧 table 表示は維持する。
- 狭い画面では文書行をカード状に見せる。
- カード表示でもファイル名、種別、状態、更新日、所属フォルダ、操作を確認できるようにする。
- 実データにない文書、フォルダ、件数、操作を補わない。

## 実施作業

- `DocumentWorkspace` の文書一覧に所属フォルダ列を追加した。
- 文書行の各 cell に mobile card 表示用 `data-label` を追加した。
- ファイル名に `title` を付与し、長いファイル名の全文確認に対応した。
- 操作ボタンを `document-action-buttons` にまとめ、PC / mobile の両方で配置を安定させた。
- `documents.css` に `max-width: 760px` の responsive card layout を追加した。
- 関連テストと Web UI inventory generated docs を更新した。

## 成果物

- `memorag-bedrock-mvp/apps/web/src/features/documents/components/DocumentWorkspace.tsx`
- `memorag-bedrock-mvp/apps/web/src/styles/features/documents.css`
- `memorag-bedrock-mvp/apps/web/src/features/documents/components/DocumentWorkspace.test.tsx`
- `memorag-bedrock-mvp/docs/generated/*`
- `tasks/do/20260510-1541-document-mobile-cards.md`

## 検証

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- DocumentWorkspace useDocuments`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`: pass
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`: pass
- `npm --prefix memorag-bedrock-mvp run test:coverage -w @memorag-mvp/web`: pass, 205 tests
- `git diff --check`: pass

## fit 評価

- 総合 fit: 4.6 / 5.0
- 主要要件は満たした。CSS の responsive 表示は unit test では完全な見た目検証ができないため、満点ではない。
- 本番 UI に架空の文書、フォルダ、件数、操作は追加していない。
- API / 運用手順変更はなく、generated Web UI inventory で画面構成を同期したため README / 運用 docs は更新不要と判断した。

## 未対応・制約・リスク

- 実ブラウザ screenshot による mobile visual regression は未実施。
- `npm ci` 実行時に `3 vulnerabilities (1 moderate, 2 high)` が報告されたが、今回の UI 変更範囲外のため修正していない。
