# フォルダ後続 task の実装可能化

状態: do
タスク種別: ドキュメント更新

## 背景

PR #322 でフォルダ周辺の残課題 12 件を `tasks/todo/` に task 化した。ユーザーから「各タスクを昇華して」と依頼があったため、各 task を後続実装者がそのまま PR 分割、設計、検証に使える水準へ引き上げる。

## 目的

既存のフォルダ後続 task それぞれに、優先度、依存関係、実装メモ、分割 PR 案、追加受け入れ条件、検証観点、未確定点を補足し、実装順序と横断リスクを明確にする。

## スコープ

- `tasks/todo/20260517-1241-*.md` の 12 件を更新する。
- 横断ロードマップ task を追加する。
- 作業レポートを追加する。

## 含まない

- 各 task の実装。
- API / Web / infra runtime の変更。
- coverage test の追加。

## 実行計画

1. 既存 12 task の内容を確認する。
2. 各 task に優先度、依存関係、分割 PR、設計メモ、未確定点を追記する。
3. folder 実装ロードマップを追加し、着手順と依存を整理する。
4. `git diff --check` で Markdown 差分を検証する。
5. 作業レポート、commit、push、PR、受け入れ条件コメントまで進める。

## ドキュメント保守計画

- 今回は task / report の整備のみで、README、OpenAPI、Web inventory、infra inventory は変更しない。
- 後続実装 task では各 task のドキュメント保守計画に従って API docs / Web inventory / infra inventory を更新する。

## 受け入れ条件

- [x] 12 件すべての folder todo task に昇華メタ情報が入る。
- [x] 各 task に依存関係、実装メモ、分割 PR 案、追加確認観点が入る。
- [x] 横断ロードマップで推奨着手順と依存が分かる。
- [x] 作業完了レポートが `reports/working/` に作成される。
- [x] `git diff --check` が pass する。

## 検証計画

- `git diff --check`
- 12 task と横断ロードマップの目視確認

## PR レビュー観点

- task が実装済み範囲を未実装扱いしていないこと。
- ACL / RAG scope / tenant / audit の確認観点が落ちていないこと。
- 後続 PR の分割が現実的な粒度であること。

## リスク

- 静的確認ベースの task refinement であり、後続実装時に code inspection により追加の前提修正が必要になる可能性がある。
