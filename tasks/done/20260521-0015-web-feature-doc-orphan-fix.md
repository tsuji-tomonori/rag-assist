# PR329 web feature 生成doc孤立修正

状態: done

タスク種別: 修正

## 背景

PR #329 の再レビューで、`apps/web/src/features/rag/**` の placeholder を削除したにもかかわらず、`docs/generated/web-features/rag.md` が残り、存在しない RAG Web コンポーネントを列挙していると指摘された。

## 目的

生成済み Web feature detail file と `docs/generated/web-features.md` の一覧を整合させ、削除済み feature の詳細 Markdown が孤立して残らないようにする。

## なぜなぜ分析サマリ

- confirmed: `docs/generated/web-features.md` の feature 一覧から `rag` は消えている。
- confirmed: `docs/generated/web-features/rag.md` は残っており、削除済みの `apps/web/src/features/rag/**` コンポーネントを列挙している。
- inferred: web inventory 再生成時に詳細ファイル出力先を clean せず、前回生成物が stale artifact として残った。
- root cause: web inventory check が overview と detail file のリンク整合性を検証しておらず、孤立した detail file を検出できなかった。
- remediation: docs check に孤立 feature detail file の検出を追加し、web inventory 生成物を再生成して stale `rag.md` を削除する。

## スコープ

- web inventory 生成 / check 周辺のテストまたは検証ロジック
- `docs/generated/web-features/*.md` の stale generated file 削除
- 作業レポート、PR コメント、commit / push

## スコープ外

- `MemoRagService` の memory card 生成や lifecycle vector 再投入ロジックの追加分割。今回のレビューでは修正推奨であり、blocking ではないため後続課題として記録する。

## 実装計画

- web inventory 関連の scripts / tests を確認する。
- `docs/generated/web-features/*.md` が `docs/generated/web-features.md` からリンクされていることを検証するテストまたは check を追加する。
- `npm run docs:web-inventory` で generated docs を再生成し、孤立 `rag.md` を削除する。
- 指定検証を実行する。

## ドキュメント保守計画

- 生成 docs の不整合修正なので、`docs/generated/` を実態に合わせて更新する。
- README / API docs の仕様変更はないため、追加更新は不要。

## 受け入れ条件

- `docs/generated/web-features/rag.md` が削除される、または `web-features.md` に正しくリンクされる。
- 孤立した `docs/generated/web-features/*.md` を検出する単体テストまたは docs check が追加される。
- `npm run docs:web-inventory:check` が pass する。
- `npm test -w @memorag-mvp/web` が pass する。

## 検証計画

- `npm run docs:web-inventory:check`
- `npm test -w @memorag-mvp/web`
- `git diff --check`

## PR レビュー観点

- generated docs が現存する Web feature だけを示しているか。
- stale generated file が将来残ったときに check で検出できるか。
- 修正推奨事項を blocking と混同せず、未実施を実施済みとしていないか。

## リスク

- web inventory generator の出力仕様に合わせず test だけを追加すると、正規の detail file まで誤検出する可能性がある。
- stale file 削除だけだと再発防止にならないため、check で固定する必要がある。

## 完了結果

- `tools/web-inventory/generate-web-inventory.mjs` に孤立 feature detail file 検出を追加した。
- `--check` 実行時に期待外の `docs/generated/web-features/*.md` を stale として検出するようにした。
- 通常生成時に孤立した `docs/generated/web-features/*.md` を削除するようにした。
- `docs/generated/web-features/rag.md` を削除した。
- PR #329 に受け入れ条件確認コメントとセルフレビューコメントを投稿した。

## 実行した検証

- `npm run docs:web-inventory:check`: fail。理由: `docs/generated/web-features/rag.md` を stale file として検出。
- `npm run docs:web-inventory`: pass。`docs/generated/web-features/rag.md` を削除。
- `npm run docs:web-inventory:check`: pass
- `npm test -w @memorag-mvp/web`: pass。34 files / 259 tests pass。
- `git diff --check`: pass
- `test ! -e docs/generated/web-features/rag.md`: pass
