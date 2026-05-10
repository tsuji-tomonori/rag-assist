# ドキュメント一覧モバイルカード表示

## 状態

in_progress

## タスク種別

機能追加

## 背景

ドキュメント管理の文書一覧は PC 向け table 表示として整理されている。一方、狭い画面では列幅が詰まり、長いファイル名や操作ボタンの視認性が落ちやすい。ロードマップの P2 改善として、狭い画面では文書行をカード状に見せる必要がある。

## 目的

- PC では既存の table 表示を維持する。
- 狭い画面では文書一覧の各行をカード表示に切り替える。
- カード上でもファイル名、種別、状態、更新日、所属フォルダ、主要操作を確認できるようにする。

## スコープ

- 対象: `DocumentWorkspace`、関連 CSS / tests / generated Web UI inventory。
- API route / backend store の追加は行わない。
- 本番 UI に架空の文書、フォルダ、件数、操作を追加しない。

## 実装計画

1. 既存の文書一覧 table DOM と CSS を確認する。
2. 文書行の cell に mobile 表示用 metadata label と所属フォルダ cell を追加する。
3. 長いファイル名に `title` を付与し、狭い画面でも省略表示できるようにする。
4. CSS media query で狭い画面のみ card layout に切り替える。
5. テストで所属フォルダ cell と mobile label 用属性、既存操作導線を確認する。
6. generated Web UI inventory を更新する。
7. 検証、レポート、commit、PR、PR コメントまで完了する。

## ドキュメント保守計画

- UI 変更に伴い `npm --prefix memorag-bedrock-mvp run docs:web-inventory` を実行する。
- API / 運用手順変更はないため、README / 運用 docs は必要性を確認し、不要なら作業レポートに理由を記録する。

## 受け入れ条件

- [x] PC 向けの文書一覧 table 表示が維持される。
- [x] 狭い画面では文書行がカード表示になる CSS が追加される。
- [x] カード表示でファイル名、種別、状態、更新日、所属フォルダ、操作が確認できる。
- [x] 長いファイル名の全文確認用に `title` が付く。
- [x] 既存の行クリック詳細 drawer、削除、再インデックス操作が破綻しない。
- [x] 本番 UI に架空の文書、フォルダ、件数、操作を表示しない。
- [x] 対象テスト、web typecheck、web lint、web inventory check、`git diff --check` が通る。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- DocumentWorkspace useDocuments`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`: pass
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`: pass
- `npm --prefix memorag-bedrock-mvp run test:coverage -w @memorag-mvp/web`: pass
- `git diff --check`: pass

## PR レビュー観点

- DOM 変更が table role / row / cell の既存アクセシビリティを壊していないこと。
- mobile card 表示が CSS のみで既存操作 handler を変えていないこと。
- 所属フォルダは実際の `documentGroups` / metadata に由来し、架空値を表示しないこと。
- generated docs が実装と同期していること。

## リスク

- CSS media query の見た目はローカル unit test では完全には検証できない。
- role table 構造を維持しながら card 風に見せるため、CSS の責務がやや増える。
