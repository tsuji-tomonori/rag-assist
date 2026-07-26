# Web 画面一覧

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。
>
> 読み方: `confirmed` はコードから直接確認できた情報、`inferred` は fallback や構造から推定した情報、`unknown` は静的解析だけでは断定できない情報です。


## 画面サマリ

| 表示名 | view | route | 機能 | 画面コンポーネント | 権限条件 | persona / job | REQ / AC | verification | 実装状態 | 主要操作 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| チャット | chat | / (query-state) | [チャット](web-features/chat.md) | ChatView | - | standard-user, answer-editor, operator, system-admin<br>JOB-UI-CHAT: 質問し、回答・回答不能・根拠・確認質問・人手対応への状態を追う | FR-003: AC-FR003-002, AC-FR003-003, AC-FR003-004<br>FR-004: AC-FR004-002, AC-FR004-003<br>FR-005: AC-FR005-002, AC-FR005-003<br>FR-021: AC-FR021-006, AC-FR021-007<br>FR-029: AC-FR029-001<br>FR-042: AC-FR042-001, AC-FR042-004<br>FR-043: AC-FR043-001, AC-FR043-003, AC-FR043-004<br>FR-094: AC-FR094-002, AC-FR094-004<br>FR-095: AC-FR095-001, AC-FR095-003, AC-FR095-004<br>FR-096: AC-FR096-003, AC-FR096-004 | E2E-VIEW-CHAT-001 (implemented) | implemented | 自分で入力、質問入力、質問、ファイルをアップロード、資料を添付、モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku ほか 24 件 | confirmed |
| 担当者対応 | assignee | /?view=assignee (query-state) | [担当者対応](web-features/questions.md) | AssigneeWorkspace | canAnswerQuestions | answer-editor, system-admin<br>JOB-UI-ASSIGNEE: 許可された問い合わせを検索・選択し、回答または下書きを安全に更新する | FR-031: AC-FR031-001, AC-FR031-002, AC-FR031-005, AC-FR031-006<br>FR-032: AC-FR032-004<br>FR-033: AC-FR033-003, AC-FR033-005, AC-FR033-007, AC-FR033-008<br>FR-094: AC-FR094-003<br>FR-095: AC-FR095-004<br>FR-096: AC-FR096-003, AC-FR096-004<br>FR-097: AC-FR097-001<br>FR-098: AC-FR098-001 | E2E-VIEW-ASSIGNEE-001 (implemented) | implemented | チャットへ戻る、ステータス / すべて、statusFilter、all、検索、タイトル・名前・部署で検索 ほか 12 件 | confirmed |
| 履歴 | history | /?view=history (query-state) | [履歴](web-features/history.md) | HistoryWorkspace | - | standard-user, answer-editor, operator, system-admin<br>JOB-UI-HISTORY: 自分の会話を検索・選択・再開・削除する | FR-034: AC-FR034-002, AC-FR034-003, AC-FR034-006<br>FR-035: AC-FR035-001, AC-FR035-002, AC-FR035-003, AC-FR035-006, AC-FR035-007<br>FR-036: AC-FR036-001, AC-FR036-002, AC-FR036-004<br>FR-044: AC-FR044-001, AC-FR044-004<br>FR-094: AC-FR094-002<br>FR-095: AC-FR095-002, AC-FR095-003<br>FR-096: AC-FR096-001, AC-FR096-003 | E2E-VIEW-HISTORY-001 (implemented) | implemented | チャットへ戻る、履歴を検索、履歴の並び順、newest、oldest、messages ほか 2 件 | inferred |
| お気に入り | favorites | /?view=favorites (query-state) | [履歴](web-features/history.md) | HistoryWorkspace | - | standard-user, answer-editor, operator, system-admin<br>JOB-UI-FAVORITES: 自分のお気に入り会話を確認し、再開または解除する | FR-094: AC-FR094-002<br>FR-095: AC-FR095-002 | E2E-VIEW-FAVORITES-001 (implemented) | partial | チャットへ戻る、履歴を検索、履歴の並び順、newest、oldest、messages ほか 2 件 | inferred |
| 性能テスト | benchmark | /?view=benchmark (query-state) | [性能テスト](web-features/benchmark.md) | BenchmarkWorkspace | canReadBenchmarkRuns | operator, system-admin<br>JOB-UI-BENCHMARK: benchmark run を開始・監視・停止し、成果物を確認する | FR-094: AC-FR094-003<br>FR-095: AC-FR095-001, AC-FR095-005<br>FR-096: AC-FR096-002, AC-FR096-004 | E2E-VIEW-BENCHMARK-001 (implemented) | partial | チャットへ戻る、テスト種別、テスト設定を取得できません、データセット、モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku、modelId ほか 4 件 | confirmed |
| 管理者設定 | admin | /?view=admin (query-state) | [管理](web-features/admin.md) | AdminWorkspace | canSeeAdminSettings | system-admin<br>JOB-UI-ADMIN: 管理対象の source/as-of/context を確認して許可された governance 操作を行う | FR-094: AC-FR094-003<br>FR-095: AC-FR095-004, AC-FR095-005<br>FR-096: AC-FR096-005<br>FR-097: AC-FR097-001, AC-FR097-002<br>FR-098: AC-FR098-003 | E2E-VIEW-ADMIN-001 (implemented)<br>E2E-UI-ADMIN-001 (implemented) | partial | チャットへ戻る、管理操作履歴を絞り込む、対象・実行者を検索、query、操作 / すべて、action ほか 75 件 | confirmed |
| ドキュメント | documents | /documents (path-query-state) | [ドキュメント](web-features/documents.md) | DocumentWorkspace | canReadDocuments | operator, system-admin<br>JOB-UI-DOCUMENTS: 許可された文書を発見・登録・共有・移動し、取り込みと索引状態を追う | FR-094: AC-FR094-002, AC-FR094-003<br>FR-095: AC-FR095-004, AC-FR095-005<br>FR-096: AC-FR096-001, AC-FR096-002<br>FR-097: AC-FR097-001, AC-FR097-002, AC-FR097-003, AC-FR097-004, AC-FR097-005<br>FR-098: AC-FR098-001, AC-FR098-002, AC-FR098-003, AC-FR098-004, AC-FR098-005 | E2E-VIEW-DOCUMENTS-001 (implemented) | implemented | 前の画面へ戻る、フォルダ設定を閉じる、ファイル名: / 現在の権限: / 継承: / 共有先種別 / ユーザー / グループ / 共有先識別子（管理者向け） / 権限 / 権限なし / 閲覧のみ …、削除、共有先種別 / ユーザー / グループ、documentSharePrincipalType ほか 103 件 | confirmed |
| 個人設定 | profile | /?view=profile (query-state) | [アプリケーション枠](web-features/app.md) | PersonalSettingsView | - | standard-user, answer-editor, operator, system-admin<br>JOB-UI-PROFILE: 本人の設定状態を確認・変更し、安全に sign out する | FR-094: AC-FR094-001, AC-FR094-004<br>FR-095: AC-FR095-003 | E2E-VIEW-PROFILE-001 (implemented) | partial | チャットへ戻る、送信キー / Enterで送信 / Ctrl+Enterで送信、submitShortcut、enter、ctrlEnter、サインアウト ほか 4 件 | confirmed |

## 画面ごとの説明

### チャット

- view: `chat`
- 機能領域: [チャット](web-features/chat.md)
- 画面コンポーネント: `ChatView`
- route: `/` (query-state)
- URL pattern: `/`, `/?view=chat`
- 権限条件: なし
- persona: `standard-user`, `answer-editor`, `operator`, `system-admin`
- job: `JOB-UI-CHAT` 質問し、回答・回答不能・根拠・確認質問・人手対応への状態を追う
- 要件・AC: `FR-003` (`AC-FR003-002`, `AC-FR003-003`, `AC-FR003-004`) / `FR-004` (`AC-FR004-002`, `AC-FR004-003`) / `FR-005` (`AC-FR005-002`, `AC-FR005-003`) / `FR-021` (`AC-FR021-006`, `AC-FR021-007`) / `FR-029` (`AC-FR029-001`) / `FR-042` (`AC-FR042-001`, `AC-FR042-004`) / `FR-043` (`AC-FR043-001`, `AC-FR043-003`, `AC-FR043-004`) / `FR-094` (`AC-FR094-002`, `AC-FR094-004`) / `FR-095` (`AC-FR095-001`, `AC-FR095-003`, `AC-FR095-004`) / `FR-096` (`AC-FR096-003`, `AC-FR096-004`)
- verification: `E2E-VIEW-CHAT-001` (implemented)
- 実装状態: `implemented`
- 未完了 task: `tasks/do/20260714-issue-345-cross-screen-a11y-responsive.md`, `tasks/todo/20260714-issue-345-manual-a11y-evidence.md`
- 画面の意味: チャット。利用者が質問し、RAG 回答、引用、確認質問、担当者への問い合わせ導線を確認します。
- 主要操作: 自分で入力、質問入力、質問、ファイルをアップロード、資料を添付、モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku、モデルを選択、対象文書を解除、質問を送信、解決した ほか 20 件

### 担当者対応

- view: `assignee`
- 機能領域: [担当者対応](web-features/questions.md)
- 画面コンポーネント: `AssigneeWorkspace`
- route: `/?view=assignee` (query-state)
- URL pattern: `/?view=assignee`
- 権限条件: `canAnswerQuestions`
- persona: `answer-editor`, `system-admin`
- job: `JOB-UI-ASSIGNEE` 許可された問い合わせを検索・選択し、回答または下書きを安全に更新する
- 要件・AC: `FR-031` (`AC-FR031-001`, `AC-FR031-002`, `AC-FR031-005`, `AC-FR031-006`) / `FR-032` (`AC-FR032-004`) / `FR-033` (`AC-FR033-003`, `AC-FR033-005`, `AC-FR033-007`, `AC-FR033-008`) / `FR-094` (`AC-FR094-003`) / `FR-095` (`AC-FR095-004`) / `FR-096` (`AC-FR096-003`, `AC-FR096-004`) / `FR-097` (`AC-FR097-001`) / `FR-098` (`AC-FR098-001`)
- verification: `E2E-VIEW-ASSIGNEE-001` (implemented)
- 実装状態: `implemented`
- 未完了 task: `tasks/do/20260714-issue-345-cross-screen-a11y-responsive.md`, `tasks/todo/20260714-issue-345-manual-a11y-evidence.md`
- 画面の意味: 担当者対応。問い合わせ一覧から質問を選び、回答本文や参考資料を作成します。
- 主要操作: チャットへ戻る、ステータス / すべて、statusFilter、all、検索、タイトル・名前・部署で検索、回答作成 / 回答タイトル / 回答内容 / 参照資料 / 関連リンク / 内部メモ / 質問者へ通知する / 入力を一時保持 / 回答を送信、回答タイトル、answerTitle、回答内容 ほか 8 件

### 履歴

- view: `history`
- 機能領域: [履歴](web-features/history.md)
- 画面コンポーネント: `HistoryWorkspace`
- route: `/?view=history` (query-state)
- URL pattern: `/?view=history`
- 権限条件: なし
- persona: `standard-user`, `answer-editor`, `operator`, `system-admin`
- job: `JOB-UI-HISTORY` 自分の会話を検索・選択・再開・削除する
- 要件・AC: `FR-034` (`AC-FR034-002`, `AC-FR034-003`, `AC-FR034-006`) / `FR-035` (`AC-FR035-001`, `AC-FR035-002`, `AC-FR035-003`, `AC-FR035-006`, `AC-FR035-007`) / `FR-036` (`AC-FR036-001`, `AC-FR036-002`, `AC-FR036-004`) / `FR-044` (`AC-FR044-001`, `AC-FR044-004`) / `FR-094` (`AC-FR094-002`) / `FR-095` (`AC-FR095-002`, `AC-FR095-003`) / `FR-096` (`AC-FR096-001`, `AC-FR096-003`)
- verification: `E2E-VIEW-HISTORY-001` (implemented)
- 実装状態: `implemented`
- 未完了 task: `tasks/do/20260714-issue-345-cross-screen-a11y-responsive.md`, `tasks/todo/20260714-issue-345-manual-a11y-evidence.md`
- 画面の意味: 履歴。過去の会話を検索、並び替え、再表示、削除します。
- 主要操作: チャットへ戻る、履歴を検索、履歴の並び順、newest、oldest、messages、お気に入りのみ、削除

### お気に入り

- view: `favorites`
- 機能領域: [履歴](web-features/history.md)
- 画面コンポーネント: `HistoryWorkspace`
- route: `/?view=favorites` (query-state)
- URL pattern: `/?view=favorites`
- 権限条件: なし
- persona: `standard-user`, `answer-editor`, `operator`, `system-admin`
- job: `JOB-UI-FAVORITES` 自分のお気に入り会話を確認し、再開または解除する
- 要件・AC: `FR-094` (`AC-FR094-002`) / `FR-095` (`AC-FR095-002`)
- verification: `E2E-VIEW-FAVORITES-001` (implemented)
- 実装状態: `partial`
- 未完了 task: `tasks/do/20260714-issue-345-cross-screen-a11y-responsive.md`, `tasks/todo/20260714-issue-345-manual-a11y-evidence.md`
- 画面の意味: お気に入り。会話履歴のうち favorite のものに絞って確認します。
- 主要操作: チャットへ戻る、履歴を検索、履歴の並び順、newest、oldest、messages、お気に入りのみ、削除

### 性能テスト

- view: `benchmark`
- 機能領域: [性能テスト](web-features/benchmark.md)
- 画面コンポーネント: `BenchmarkWorkspace`
- route: `/?view=benchmark` (query-state)
- URL pattern: `/?view=benchmark`
- 権限条件: `canReadBenchmarkRuns`
- persona: `operator`, `system-admin`
- job: `JOB-UI-BENCHMARK` benchmark run を開始・監視・停止し、成果物を確認する
- 要件・AC: `FR-094` (`AC-FR094-003`) / `FR-095` (`AC-FR095-001`, `AC-FR095-005`) / `FR-096` (`AC-FR096-002`, `AC-FR096-004`)
- verification: `E2E-VIEW-BENCHMARK-001` (implemented)
- 実装状態: `partial`
- 未完了 task: `tasks/todo/20260714-issue-345-manual-a11y-evidence.md`
- 画面の意味: 性能テスト。benchmark suite を選択し、run 起動、キャンセル、結果 download を行います。
- 主要操作: チャットへ戻る、テスト種別、テスト設定を取得できません、データセット、モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku、modelId、並列数、concurrency、性能テストを実行、更新

### 管理者設定

- view: `admin`
- 機能領域: [管理](web-features/admin.md)
- 画面コンポーネント: `AdminWorkspace`
- route: `/?view=admin` (query-state)
- URL pattern: `/?view=admin`, `/?view=admin&section=:section&adminQuery=:query&aliasStatus=:status&auditAction=:action&sort=:sort&selected=:id`
- 権限条件: `canSeeAdminSettings`
- persona: `system-admin`
- job: `JOB-UI-ADMIN` 管理対象の source/as-of/context を確認して許可された governance 操作を行う
- 要件・AC: `FR-094` (`AC-FR094-003`) / `FR-095` (`AC-FR095-004`, `AC-FR095-005`) / `FR-096` (`AC-FR096-005`) / `FR-097` (`AC-FR097-001`, `AC-FR097-002`) / `FR-098` (`AC-FR098-003`)
- verification: `E2E-VIEW-ADMIN-001` (implemented), `E2E-UI-ADMIN-001` (implemented)
- 実装状態: `partial`
- 未完了 task: `tasks/todo/20260714-issue-345-manual-a11y-evidence.md`
- 画面の意味: 管理者設定。文書管理、担当者対応、debug / benchmark、ユーザー管理、alias 管理などの入口になります。
- 主要操作: チャットへ戻る、管理操作履歴を絞り込む、対象・実行者を検索、query、操作 / すべて、action、すべて、検索、条件を解除、現在の監査条件を export ほか 71 件

### ドキュメント

- view: `documents`
- 機能領域: [ドキュメント](web-features/documents.md)
- 画面コンポーネント: `DocumentWorkspace`
- route: `/documents` (path-query-state)
- URL pattern: `/documents`, `/documents/:documentId`, `/documents/groups/:folderId`, `/documents/reindex-migrations/:migrationId`, `/?view=documents`
- 権限条件: `canReadDocuments`
- persona: `operator`, `system-admin`
- job: `JOB-UI-DOCUMENTS` 許可された文書を発見・登録・共有・移動し、取り込みと索引状態を追う
- 要件・AC: `FR-094` (`AC-FR094-002`, `AC-FR094-003`) / `FR-095` (`AC-FR095-004`, `AC-FR095-005`) / `FR-096` (`AC-FR096-001`, `AC-FR096-002`) / `FR-097` (`AC-FR097-001`, `AC-FR097-002`, `AC-FR097-003`, `AC-FR097-004`, `AC-FR097-005`) / `FR-098` (`AC-FR098-001`, `AC-FR098-002`, `AC-FR098-003`, `AC-FR098-004`, `AC-FR098-005`)
- verification: `E2E-VIEW-DOCUMENTS-001` (implemented)
- 実装状態: `implemented`
- 未完了 task: なし
- 画面の意味: ドキュメント。ファイル upload、フォルダ作成、共有、reindex 切替を行います。
- 主要操作: 前の画面へ戻る、フォルダ設定を閉じる、ファイル名: / 現在の権限: / 継承: / 共有先種別 / ユーザー / グループ / 共有先識別子（管理者向け） / 権限 / 権限なし / 閲覧のみ …、削除、共有先種別 / ユーザー / グループ、documentSharePrincipalType、user、group、共有先識別子（管理者向け）、documentSharePrincipalId ほか 99 件

### 個人設定

- view: `profile`
- 機能領域: [アプリケーション枠](web-features/app.md)
- 画面コンポーネント: `PersonalSettingsView`
- route: `/?view=profile` (query-state)
- URL pattern: `/?view=profile`
- 権限条件: なし
- persona: `standard-user`, `answer-editor`, `operator`, `system-admin`
- job: `JOB-UI-PROFILE` 本人の設定状態を確認・変更し、安全に sign out する
- 要件・AC: `FR-094` (`AC-FR094-001`, `AC-FR094-004`) / `FR-095` (`AC-FR095-003`)
- verification: `E2E-VIEW-PROFILE-001` (implemented)
- 実装状態: `partial`
- 未完了 task: `tasks/todo/20260713-2301-user-preferences.md`
- 画面の意味: 個人設定。送信ショートカットやサインアウトなど個人単位の設定を扱います。
- 主要操作: チャットへ戻る、送信キー / Enterで送信 / Ctrl+Enterで送信、submitShortcut、enter、ctrlEnter、サインアウト、ホーム、個人設定、デバッグモード、新しい会話
