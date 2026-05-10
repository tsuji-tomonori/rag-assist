# ドキュメント一覧 pagination

状態: doing
タスク種別: 機能追加
作成日: 2026-05-10

## 背景

ドキュメント管理 UI は検索、絞り込み、詳細 drawer、最近の操作、URL 状態同期まで整備された。一方で文書数が増えた場合は一覧を全件描画するため、管理者が特定文書を探す際の視認性と操作位置の把握が弱い。

## 目的

- 文書一覧に page size と pagination 操作を追加する。
- 検索・フィルタ・ソート後の件数に対して、現在ページと表示範囲を明示する。
- フィルタ変更時に範囲外ページへ残らないようにする。
- 本番 UI に架空件数や未実装操作を表示しない。

## スコープ

- 対象: `DocumentWorkspace`、`DocumentFilePanel`、関連 CSS / tests / generated web inventory。
- API 変更は行わず、既に取得済みの `DocumentManifest[]` に対する client-side pagination とする。
- 大規模 virtual scroll は今回の対象外とし、固定 page size の切替で一覧性を改善する。

## 実装計画

1. 現在の文書一覧 props とテストを確認する。
2. `DocumentWorkspace` で page size / current page を管理し、検索・フィルタ・ソート・フォルダ変更時に page を補正する。
3. `DocumentFilePanel` に表示範囲、page size select、前後移動ボタンを追加する。
4. 表示対象を `visibleDocuments` から paged documents へ切り替える。
5. 対象テストを追加し、generated web inventory を更新する。
6. 最小十分な検証を実行し、PR 作成、受け入れ条件コメント、セルフレビューまで進める。

## ドキュメント保守計画

- UI の interactive controls が増えるため、`npm --prefix memorag-bedrock-mvp run docs:web-inventory` を実行する。
- API / 運用 docs は挙動変更が Web UI 内に閉じるため、恒久 docs 更新は不要と判断する場合は作業レポートに記録する。

## 受け入れ条件

- [ ] 文書一覧が page size ごとに分割表示される。
- [ ] 現在ページ、総ページ、表示範囲、フィルタ後総件数が表示される。
- [ ] 前へ / 次へボタンが境界で disabled になる。
- [ ] page size 変更時は 1 ページ目へ戻る。
- [ ] 検索・フィルタ・ソート・フォルダ変更時に 1 ページ目へ戻り、範囲外ページが残らない。
- [ ] 文書がない場合・条件一致なしの場合の empty state が従来どおり表示される。
- [ ] 本番 UI に架空件数や fake row を表示しない。
- [ ] 対象テスト、web typecheck、web inventory check、`git diff --check` が通る。

## 検証計画

- `npm --prefix memorag-bedrock-mvp/apps/web test -- DocumentWorkspace`
- `npm --prefix memorag-bedrock-mvp/apps/web run typecheck`
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`
- `git diff --check`

## 完了時の検証

- `npm ci`: pass
- `npm --prefix memorag-bedrock-mvp/apps/web test -- DocumentWorkspace`: fail（依存未展開で `vitest` が見つからず） -> `npm ci` 後 pass
- `npm --prefix memorag-bedrock-mvp/apps/web run typecheck`: fail（依存未展開で `tsc` が見つからず） -> `npm ci` 後 pass
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`: pass
- `npm exec --prefix memorag-bedrock-mvp -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`: pass
- `git diff --check`: pass

## PR レビュー観点

- pagination が検索・フィルタ済み件数に対して適用されること。
- 行操作、詳細 drawer、削除 / reindex の対象が paged documents でも正しく維持されること。
- page size / page controls が accessible name を持ち、モバイルカード表示を壊さないこと。

## リスク

- client-side pagination のため、API レベルの大量件数最適化ではない。
- URL 状態同期には今回 page を含めない。ページは一時的な閲覧位置であり、検索・フォルダ・文書詳細の共有性を優先する。
