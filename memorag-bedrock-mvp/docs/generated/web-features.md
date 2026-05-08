# Web 機能一覧

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。
>
> 読み方: `confirmed` はコードから直接確認できた情報、`inferred` は fallback や構造から推定した情報、`unknown` は静的解析だけでは断定できない情報です。


## 機能別ファイル

| 機能 | feature | 概要 | 関連画面 | コンポーネント数 | UI 操作要素数 | 詳細 |
| --- | --- | --- | --- | --- | --- | --- |
| 管理 | admin | 管理者向けのユーザー、ロール、利用状況、コスト、alias review / publish を扱う領域です。 | admin | 1 | 37 | [admin.md](web-features/admin.md) |
| アプリケーション枠 | app | ログイン後の共通フレーム、ナビゲーション、トップバー、個人設定を扱う領域です。 | profile | 7 | 38 | [app.md](web-features/app.md) |
| 認証 | auth | ログイン、サインアップ、確認コード、新規パスワード設定などの認証画面を扱う領域です。 | - | 2 | 25 | [auth.md](web-features/auth.md) |
| 性能テスト | benchmark | ベンチマーク suite の選択、run 起動、履歴、成果物ダウンロードを扱う領域です。 | benchmark | 1 | 18 | [benchmark.md](web-features/benchmark.md) |
| チャット | chat | RAG 質問、回答表示、引用、追加確認、担当者エスカレーション、チャット入力を扱う領域です。 | chat | 10 | 45 | [chat.md](web-features/chat.md) |
| デバッグ | debug | RAG 実行 trace、検索根拠、support verification、step detail を調査する領域です。 | - | 1 | 13 | [debug.md](web-features/debug.md) |
| ドキュメント | documents | ドキュメント upload、document group、共有、blue-green reindex 操作を扱う領域です。 | documents | 1 | 44 | [documents.md](web-features/documents.md) |
| 履歴 | history | 会話履歴、検索、並び替え、お気に入り、履歴削除を扱う領域です。 | history, favorites | 1 | 11 | [history.md](web-features/history.md) |
| 担当者対応 | questions | 担当者が問い合わせを確認し、回答作成、下書き保存、回答送信を行う領域です。 | assignee | 1 | 21 | [questions.md](web-features/questions.md) |
| 共通 | shared | 複数領域で再利用される表示部品です。単独の画面ではなく、他の画面から使われます。 | - | 2 | 0 | [shared.md](web-features/shared.md) |
