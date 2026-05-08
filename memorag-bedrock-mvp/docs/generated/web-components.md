# Web コンポーネント一覧

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。
>
> 読み方: `confirmed` はコードから直接確認できた情報、`inferred` は fallback や構造から推定した情報、`unknown` は静的解析だけでは断定できない情報です。


## コンポーネントサマリ

| 機能 | 関連画面 | コンポーネント | 役割 | ファイル | export | 使用 JSX 要素 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [アプリケーション枠](web-features/app.md) | 個人設定 | App | UI 構成要素 | apps/web/src/App.tsx | App | AppShell, LoginPage | confirmed |
| [アプリケーション枠](web-features/app.md) | 個人設定 | AppRoutes | アプリケーション共通制御 | apps/web/src/app/AppRoutes.tsx | AppRoutes | AdminWorkspace, AssigneeWorkspace, BenchmarkWorkspace, ChatView, DocumentWorkspace, HistoryWorkspace, PersonalSettingsView | confirmed |
| [アプリケーション枠](web-features/app.md) | 個人設定 | AppShell | アプリケーション共通制御 | apps/web/src/app/AppShell.tsx | AppShell | AppRoutes, LoadingStatus, RailNav, TopBar, div, main, section | confirmed |
| [アプリケーション枠](web-features/app.md) | 個人設定 | PersonalSettingsView | 画面または画面内 UI コンポーネント | apps/web/src/app/components/PersonalSettingsView.tsx | PersonalSettingsView | button, dd, div, dl, dt, footer, h2, header, label, option, section, select, span | confirmed |
| [アプリケーション枠](web-features/app.md) | 個人設定 | RailNav | 画面または画面内 UI コンポーネント | apps/web/src/app/components/RailNav.tsx | RailNav | Icon, a, aside, button, nav, span | confirmed |
| [アプリケーション枠](web-features/app.md) | 個人設定 | TopBar | 画面または画面内 UI コンポーネント | apps/web/src/app/components/TopBar.tsx | TopBar | Icon, button, div, h1, header, i, input, label, option, select, span, strong | confirmed |
| [管理](web-features/admin.md) | 管理者設定 | AdminWorkspace | 画面または画面内 UI コンポーネント | apps/web/src/features/admin/components/AdminWorkspace.tsx | AdminWorkspace | AdminCreateUserForm, AliasAdminPanel, Icon, LoadingSpinner, LoadingStatus, ManagedUserRow, article, button, div, form, h2, h3, header, i, input, label, option, p, section, select, small, span, strong, time | confirmed |
| [認証](web-features/auth.md) | - | LoginHeroGraphic | 画面または画面内 UI コンポーネント | apps/web/src/features/auth/components/LoginHeroGraphic.tsx | LoginHeroGraphic | circle, defs, feDropShadow, filter, g, linearGradient, path, radialGradient, rect, stop, svg | confirmed |
| [認証](web-features/auth.md) | - | LoginPage | 画面または画面内 UI コンポーネント | apps/web/src/features/auth/components/LoginPage.tsx | LoginPage | LoadingSpinner, LoginHeroGraphic, PasswordRequirementList, button, div, form, h1, input, label, li, p, span, strong, ul | confirmed |
| [性能テスト](web-features/benchmark.md) | 性能テスト | BenchmarkWorkspace | 画面または画面内 UI コンポーネント | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx | BenchmarkWorkspace | BenchmarkMetricCard, BenchmarkMetricChips, Icon, LoadingSpinner, LoadingStatus, article, button, code, div, h2, h3, header, input, label, option, p, section, select, small, span, strong, table, tbody, td, th, thead, tr | confirmed |
| [チャット](web-features/chat.md) | チャット | AssistantAnswer | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/AssistantAnswer.tsx | AssistantAnswer | Icon, QuestionAnswerPanel, QuestionEscalationPanel, a, button, div, li, p, span, strong, ul | confirmed |
| [チャット](web-features/chat.md) | チャット | ChatComposer | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/ChatComposer.tsx | ChatComposer | Icon, LoadingSpinner, button, div, form, input, label, span, textarea | confirmed |
| [チャット](web-features/chat.md) | チャット | ChatEmptyState | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/ChatEmptyState.tsx | ChatEmptyState | Icon, button, div, h2, section, span | confirmed |
| [チャット](web-features/chat.md) | チャット | ChatView | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/ChatView.tsx | ChatView | ChatComposer, DebugPanel, MessageList, p, section | confirmed |
| [チャット](web-features/chat.md) | チャット | MessageItem | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/MessageItem.tsx | MessageItem | AssistantAnswer, Icon, UserPromptBubble, article, div, span, strong | confirmed |
| [チャット](web-features/chat.md) | チャット | MessageList | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/MessageList.tsx | MessageList | ChatEmptyState, LoadingSpinner, MessageItem, ProcessingAnswer, article, div, span, strong | confirmed |
| [チャット](web-features/chat.md) | チャット | ProcessingAnswer | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/ProcessingAnswer.tsx | ProcessingAnswer | LoadingSpinner, div, p, span | confirmed |
| [チャット](web-features/chat.md) | チャット | QuestionAnswerPanel | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/QuestionAnswerPanel.tsx | QuestionAnswerPanel | Icon, LoadingSpinner, button, dd, div, dl, dt, footer, header, p, section, span, strong | confirmed |
| [チャット](web-features/chat.md) | チャット | QuestionEscalationPanel | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx | QuestionEscalationPanel | LoadingSpinner, button, div, form, h3, input, label, option, p, section, select, span, strong, textarea | confirmed |
| [チャット](web-features/chat.md) | チャット | UserPromptBubble | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/UserPromptBubble.tsx | UserPromptBubble | Icon, button, div, p, span | confirmed |
| [デバッグ](web-features/debug.md) | - | DebugPanel | 画面または画面内 UI コンポーネント | apps/web/src/features/debug/components/DebugPanel.tsx | DebugPanel | AnswerSupportPanel, ContextAssemblyPanel, DebugFlowNodeButton, DebugNodeDetailPanel, DebugRunSummaryView, EvidenceDebugTable, FactCoverageTable, Icon, article, aside, button, dd, div, dl, dt, em, footer, h2, h3, header, input, label, p, pre, section, span, strong, table, tbody, td, th, thead, tr | confirmed |
| [ドキュメント](web-features/documents.md) | ドキュメント | DocumentWorkspace | 画面または画面内 UI コンポーネント | apps/web/src/features/documents/components/DocumentWorkspace.tsx | DocumentWorkspace | FileIcon, Icon, LoadingSpinner, LoadingStatus, article, aside, button, dd, details, div, dl, dt, footer, form, h2, h3, header, input, label, li, nav, option, progress, section, select, small, span, strong, summary, ul | confirmed |
| [履歴](web-features/history.md) | 履歴, お気に入り | HistoryWorkspace | 画面または画面内 UI コンポーネント | apps/web/src/features/history/components/HistoryWorkspace.tsx | HistoryWorkspace | HistorySearchSummary, Icon, button, div, h2, h3, header, input, label, option, section, select, small, span, strong | confirmed |
| [担当者対応](web-features/questions.md) | 担当者対応 | AssigneeWorkspace | 画面または画面内 UI コンポーネント | apps/web/src/features/questions/components/AssigneeWorkspace.tsx | AssigneeWorkspace | Icon, LoadingSpinner, LoadingStatus, aside, button, dd, div, dl, dt, form, h2, h3, h4, header, input, label, option, p, section, select, span, strong, textarea, time | confirmed |
| [アプリケーション枠](web-features/app.md) | 個人設定 | main.tsx | React mount entry | apps/web/src/main.tsx | - | App, React.StrictMode | inferred |
| [共通](web-features/shared.md) | - | Icon | 画面または画面内 UI コンポーネント | apps/web/src/shared/components/Icon.tsx | Icon | path, svg | confirmed |
| [共通](web-features/shared.md) | - | LoadingSpinner | 画面または画面内 UI コンポーネント | apps/web/src/shared/components/LoadingSpinner.tsx | LoadingSpinner, LoadingStatus | LoadingSpinner, div, span | confirmed |
