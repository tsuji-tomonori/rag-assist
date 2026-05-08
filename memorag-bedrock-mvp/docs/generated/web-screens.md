# Web 画面一覧

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。
>
> 読み方: `confirmed` はコードから直接確認できた情報、`inferred` は fallback や構造から推定した情報、`unknown` は静的解析だけでは断定できない情報です。


## 画面サマリ

| 表示名 | view | route | 機能 | 画面コンポーネント | 権限条件 | 主要操作 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| チャット | chat | / (client-state) | [チャット](web-features/chat.md) | ChatView | - | 自分で入力、質問、資料を添付、送信、解決した、追加で質問する ほか 23 件 | confirmed |
| 担当者対応 | assignee | / (client-state) | [担当者対応](web-features/questions.md) | AssigneeWorkspace | canAnswerQuestions | チャットへ戻る、ステータス / すべて、statusFilter、all、検索、タイトル・名前・部署で検索 ほか 13 件 | confirmed |
| 履歴 | history | / (client-state) | [履歴](web-features/history.md) | HistoryWorkspace | - | チャットへ戻る、履歴を検索、履歴の並び順、newest、oldest、messages ほか 2 件 | inferred |
| お気に入り | favorites | / (client-state) | [履歴](web-features/history.md) | HistoryWorkspace | - | チャットへ戻る、履歴を検索、履歴の並び順、newest、oldest、messages ほか 2 件 | inferred |
| 性能テスト | benchmark | / (client-state) | [性能テスト](web-features/benchmark.md) | BenchmarkWorkspace | canReadBenchmarkRuns | チャットへ戻る、テスト種別、suiteId、データセット、モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku、modelId ほか 5 件 | confirmed |
| 管理者設定 | admin | / (client-state) | [管理](web-features/admin.md) | AdminWorkspace | canSeeAdminSettings | チャットへ戻る、ドキュメント管理 / 件、担当者対応 / 件が対応待ち、デバッグ / 評価 / 件の実行履歴、性能テスト / 件の実行履歴、更新 ほか 24 件 | confirmed |
| ドキュメント | documents | / (client-state) | [ドキュメント](web-features/documents.md) | DocumentWorkspace | canManageDocuments | 管理者設定へ戻る、フォルダを検索、フォルダを絞り込み、すべてのドキュメント、社内規定、新規フォルダ ほか 27 件 | confirmed |
| 個人設定 | profile | / (client-state) | [アプリケーション枠](web-features/app.md) | PersonalSettingsView | - | チャットへ戻る、送信キー / Enterで送信 / Ctrl+Enterで送信、submitShortcut、enter、ctrlEnter、サインアウト ほか 20 件 | confirmed |

## 画面ごとの説明

### チャット

- view: `chat`
- 機能領域: [チャット](web-features/chat.md)
- 画面コンポーネント: `ChatView`
- route: `/` (client-state)
- 権限条件: なし
- 画面の意味: チャット。利用者が質問し、RAG 回答、引用、確認質問、担当者への問い合わせ導線を確認します。
- 主要操作: 自分で入力、質問、資料を添付、送信、解決した、追加で質問する、担当者へ質問、件名、title、質問内容 ほか 19 件

### 担当者対応

- view: `assignee`
- 機能領域: [担当者対応](web-features/questions.md)
- 画面コンポーネント: `AssigneeWorkspace`
- route: `/` (client-state)
- 権限条件: `canAnswerQuestions`
- 画面の意味: 担当者対応。問い合わせ一覧から質問を選び、回答本文や参考資料を作成します。
- 主要操作: チャットへ戻る、ステータス / すべて、statusFilter、all、検索、タイトル・名前・部署で検索、/ / （ / ）、回答作成 / 回答タイトル / 回答内容 / 参照資料 / 関連リンク / 内部メモ / 質問者へ通知する / 下書き保存 / 回答を送信、回答タイトル、answerTitle ほか 9 件

### 履歴

- view: `history`
- 機能領域: [履歴](web-features/history.md)
- 画面コンポーネント: `HistoryWorkspace`
- route: `/` (client-state)
- 権限条件: なし
- 画面の意味: 履歴。過去の会話を検索、並び替え、再表示、削除します。
- 主要操作: チャットへ戻る、履歴を検索、履歴の並び順、newest、oldest、messages、お気に入りのみ、削除

### お気に入り

- view: `favorites`
- 機能領域: [履歴](web-features/history.md)
- 画面コンポーネント: `HistoryWorkspace`
- route: `/` (client-state)
- 権限条件: なし
- 画面の意味: お気に入り。会話履歴のうち favorite のものに絞って確認します。
- 主要操作: チャットへ戻る、履歴を検索、履歴の並び順、newest、oldest、messages、お気に入りのみ、削除

### 性能テスト

- view: `benchmark`
- 機能領域: [性能テスト](web-features/benchmark.md)
- 画面コンポーネント: `BenchmarkWorkspace`
- route: `/` (client-state)
- 権限条件: `canReadBenchmarkRuns`
- 画面の意味: 性能テスト。benchmark suite を選択し、run 起動、キャンセル、結果 download を行います。
- 主要操作: チャットへ戻る、テスト種別、suiteId、データセット、モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku、modelId、並列数、concurrency、性能テストを実行、更新 ほか 1 件

### 管理者設定

- view: `admin`
- 機能領域: [管理](web-features/admin.md)
- 画面コンポーネント: `AdminWorkspace`
- route: `/` (client-state)
- 権限条件: `canSeeAdminSettings`
- 画面の意味: 管理者設定。文書管理、担当者対応、debug / benchmark、ユーザー管理、alias 管理などの入口になります。
- 主要操作: チャットへ戻る、ドキュメント管理 / 件、担当者対応 / 件が対応待ち、デバッグ / 評価 / 件の実行履歴、性能テスト / 件の実行履歴、更新、公開、用語 / 展開語 / 部署 scope / 追加、用語、pto ほか 20 件

### ドキュメント

- view: `documents`
- 機能領域: [ドキュメント](web-features/documents.md)
- 画面コンポーネント: `DocumentWorkspace`
- route: `/` (client-state)
- 権限条件: `canManageDocuments`
- 画面の意味: ドキュメント。ファイル upload、フォルダ作成、共有、reindex 切替を行います。
- 主要操作: 管理者設定へ戻る、フォルダを検索、フォルダを絞り込み、すべてのドキュメント、社内規定、新規フォルダ、共有設定、名前を変更、移動、前のページ ほか 23 件

### 個人設定

- view: `profile`
- 機能領域: [アプリケーション枠](web-features/app.md)
- 画面コンポーネント: `PersonalSettingsView`
- route: `/` (client-state)
- 権限条件: なし
- 画面の意味: 個人設定。送信ショートカットやサインアウトなど個人単位の設定を扱います。
- 主要操作: チャットへ戻る、送信キー / Enterで送信 / Ctrl+Enterで送信、submitShortcut、enter、ctrlEnter、サインアウト、ホーム、チャット、担当者対応、履歴 ほか 16 件
