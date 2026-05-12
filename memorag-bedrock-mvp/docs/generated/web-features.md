# Web 機能一覧

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。
>
> 読み方: `confirmed` はコードから直接確認できた情報、`inferred` は fallback や構造から推定した情報、`unknown` は静的解析だけでは断定できない情報です。


## 機能別ファイル

| 機能 | feature | 概要 | 関連画面 | コンポーネント数 | UI 操作要素数 | 主な操作説明 | 詳細 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 管理 | admin | 管理者向けのユーザー、ロール、利用状況、コスト、alias review / publish を扱う領域です。 | admin | 8 | 35 | 「チャットへ戻る」を実行するボタン。<br>「ドキュメント管理 / 件」を実行するボタン。<br>「担当者対応 / 件が対応待ち」を実行するボタン。 ほか 27 件 | [admin.md](web-features/admin.md) |
| アプリケーション枠 | app | ログイン後の共通フレーム、ナビゲーション、トップバー、個人設定を扱う領域です。 | profile | 7 | 18 | 「チャットへ戻る」を実行するボタン。<br>「送信キー / Enterで送信 / Ctrl+Enterで送信」に紐づく入力ラベル。<br>「Enterで送信 / Ctrl+Enterで送信」を選ぶ選択項目。 ほか 15 件 | [app.md](web-features/app.md) |
| 認証 | auth | ログイン、サインアップ、確認コード、新規パスワード設定などの認証画面を扱う領域です。 | - | 2 | 26 | 「title」を入力・送信するフォーム。<br>「新しいパスワード」に紐づく入力ラベル。<br>「新しいパスワード」を入力または選択する項目。 ほか 15 件 | [auth.md](web-features/auth.md) |
| 性能テスト | benchmark | ベンチマーク suite の選択、run 起動、履歴、成果物ダウンロードを扱う領域です。 | benchmark | 1 | 18 | 「チャットへ戻る」を実行するボタン。<br>「テスト種別」に紐づく入力ラベル。<br>「テスト種別」を選ぶ選択項目。 ほか 13 件 | [benchmark.md](web-features/benchmark.md) |
| チャット | chat | RAG 質問、回答表示、引用、追加確認、担当者エスカレーション、チャット入力を扱う領域です。 | chat | 16 | 41 | 「回答をコピー済み / 回答をコピー」を実行するボタン。<br>「この候補で質問する」を実行するボタン。<br>「自分で入力」を実行するボタン。 ほか 37 件 | [chat.md](web-features/chat.md) |
| デバッグ | debug | RAG 実行 trace、検索根拠、support verification、step detail を調査する領域です。 | - | 5 | 11 | 「拡大デバッグパネルを閉じる」を実行するボタン。<br>「保存JSON」を実行するボタン。<br>「可視化JSON」を実行するボタン。 ほか 4 件 | [debug.md](web-features/debug.md) |
| ドキュメント | documents | ドキュメント upload、document group、共有、blue-green reindex 操作を扱う領域です。 | documents | 6 | 88 | 「管理者設定へ戻る」を実行するボタン。<br>「文書詳細を閉じる」を実行するボタン。<br>「この資料に質問する」を実行するボタン。 ほか 71 件 | [documents.md](web-features/documents.md) |
| 履歴 | history | 会話履歴、検索、並び替え、お気に入り、履歴削除を扱う領域です。 | history, favorites | 1 | 11 | 「チャットへ戻る」を実行するボタン。<br>「履歴を検索」を入力または選択する項目。<br>「履歴の並び順」を選ぶ選択項目。 ほか 6 件 | [history.md](web-features/history.md) |
| 担当者対応 | questions | 担当者が問い合わせを確認し、回答作成、下書き保存、回答送信を行う領域です。 | assignee | 1 | 21 | 「チャットへ戻る」を実行するボタン。<br>「ステータス / すべて」に紐づく入力ラベル。<br>「すべて」を選ぶ選択項目。 ほか 17 件 | [questions.md](web-features/questions.md) |
| 共通 | shared | 複数領域で再利用される表示部品です。単独の画面ではなく、他の画面から使われます。 | - | 9 | 7 | 「キャンセル」を実行するボタン。<br>「label」を実行するボタン。 | [shared.md](web-features/shared.md) |
