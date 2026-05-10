# 本番 UI のモックデータ表示監査

状態: do

## 背景

PR #233 では、担当者問い合わせ・担当者回答で固定の架空ユーザー名や部署が本番経路に混ざる問題を修正した。今回も同じ観点で、他の本番 UI/API 表示にモックデータ、固定件数、固定容量、架空ユーザー、架空グループなどが残っていないかを調査し、見つかった場合は修正する。

## 目的

本番経路で表示される値を、API レスポンス、props、永続化状態、設定、または明示的な empty/loading/error/unavailable state に由来するものへ限定する。

## スコープ

- `memorag-bedrock-mvp/apps/web/src` の本番 UI、hooks、API 整形。
- 必要に応じて `memorag-bedrock-mvp/apps/api/src` のレスポンス既定値。
- テスト、fixture、OpenAPI example、placeholder 文言は本番表示に混ざらない範囲で許容する。

## 計画

1. PR #233 の変更意図を確認し、同種の固定値パターンを検索する。
2. 本番 UI コンポーネントで、固定の人物名・部署・フォルダ・容量・件数・日付・コスト・メトリクスが実データのように表示される箇所を特定する。
3. 該当箇所を、実データ由来の表示または honest empty/unavailable state に修正する。
4. 再発防止のテストを追加または更新する。
5. 変更範囲に応じた検証を実行する。

## ドキュメントメンテナンス計画

ユーザー可視 UI の表示ルール修正に留まる場合、恒久 docs の更新要否を確認する。既存 docs と矛盾しない場合は、作業レポートと PR 本文に「恒久 docs 更新不要」と理由を記載する。

## 受け入れ条件

- [ ] PR #233 と同種の本番モック表示候補を検索・確認している。
- [ ] 本番 UI/API 表示に残るモックデータが見つかった場合、実データ由来または明示的な empty/unavailable 表示へ修正している。
- [ ] 該当修正に対するテストを追加または更新している。
- [ ] `git diff --check` と変更範囲に見合う web 検証を実行し、結果を記録している。
- [ ] 作業レポートを `reports/working/` に残している。
- [ ] PR 作成後、受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿している。

## 検証計画

- `git diff --check`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- 必要に応じて追加の API または docs check。

## PR レビュー観点

- 本番経路に固定の業務データ、架空ユーザー、固定容量、固定件数、固定日付が残っていないこと。
- empty/loading/error/permission/unavailable state が利用者に誤解を与えないこと。
- テスト fixture や placeholder と本番 fallback が分離されていること。
- RAG の根拠性・認可境界・benchmark 固有値の実装混入が悪化していないこと。

## リスク

- 検索語に依存するため、文脈上モック表示に見えるが検索に引っかからない固定値を見落とす可能性がある。主要 UI コンポーネントは検索結果だけでなく目視確認も行う。
