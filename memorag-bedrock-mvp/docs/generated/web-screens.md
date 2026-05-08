# Web 画面一覧

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。

## 画面

| 表示名 | view | route | 画面コンポーネント | 権限条件 | 確度 |
| --- | --- | --- | --- | --- | --- |
| チャット | chat | / (client-state) | ChatView | - | confirmed |
| 担当者対応 | assignee | / (client-state) | AssigneeWorkspace | canAnswerQuestions | confirmed |
| 履歴 | history | / (client-state) | HistoryWorkspace | - | inferred |
| お気に入り | favorites | / (client-state) | HistoryWorkspace | - | inferred |
| 性能テスト | benchmark | / (client-state) | BenchmarkWorkspace | canReadBenchmarkRuns | confirmed |
| 管理者設定 | admin | / (client-state) | AdminWorkspace | canSeeAdminSettings | confirmed |
| ドキュメント | documents | / (client-state) | DocumentWorkspace | canManageDocuments | confirmed |
| 個人設定 | profile | / (client-state) | PersonalSettingsView | - | confirmed |
