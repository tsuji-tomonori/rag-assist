# Web 機能詳細: アプリケーション枠

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。
>
> 読み方: `confirmed` はコードから直接確認できた情報、`inferred` は fallback や構造から推定した情報、`unknown` は静的解析だけでは断定できない情報です。


## 概要

ログイン後の共通フレーム、ナビゲーション、トップバー、個人設定を扱う領域です。

## 関連画面

| 表示名 | view | 画面コンポーネント | 権限条件 | 説明 |
| --- | --- | --- | --- | --- |
| 個人設定 | profile | PersonalSettingsView | - | 個人設定。送信ショートカットやサインアウトなど個人単位の設定を扱います。 |

## コンポーネント

| コンポーネント | 役割 | ファイル | export | 使用 JSX 要素 |
| --- | --- | --- | --- | --- |
| App | UI 構成要素 | apps/web/src/App.tsx | App | AppShell, LoginPage |
| AppRoutes | アプリケーション共通制御 | apps/web/src/app/AppRoutes.tsx | AppRoutes | AdminWorkspace, AssigneeWorkspace, BenchmarkWorkspace, ChatView, DocumentWorkspace, HistoryWorkspace, PersonalSettingsView |
| AppShell | アプリケーション共通制御 | apps/web/src/app/AppShell.tsx | AppShell | AppRoutes, LoadingStatus, RailNav, TopBar, div, main, section |
| PersonalSettingsView | 画面または画面内 UI コンポーネント | apps/web/src/app/components/PersonalSettingsView.tsx | PersonalSettingsView | button, dd, div, dl, dt, footer, h2, header, label, option, section, select, span |
| RailNav | 画面または画面内 UI コンポーネント | apps/web/src/app/components/RailNav.tsx | RailNav | Icon, a, aside, button, nav, span |
| TopBar | 画面または画面内 UI コンポーネント | apps/web/src/app/components/TopBar.tsx | TopBar | Icon, button, div, h1, header, i, input, label, option, select, span, strong |
| main.tsx | React mount entry | apps/web/src/main.tsx | - | App, React.StrictMode |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- |
| PersonalSettingsView | button | チャットへ戻る | onClick=onBack | apps/web/src/app/components/PersonalSettingsView.tsx:25 | confirmed |
| PersonalSettingsView | button | サインアウト | onClick=onSignOut | apps/web/src/app/components/PersonalSettingsView.tsx:48 | confirmed |
| RailNav | a | ホーム | - | apps/web/src/app/components/RailNav.tsx:24 | confirmed |
| RailNav | button | チャット | onClick=() => onChangeView("chat") | apps/web/src/app/components/RailNav.tsx:28 | confirmed |
| RailNav | button | 担当者対応 | onClick=() => onChangeView("assignee") | apps/web/src/app/components/RailNav.tsx:33 | confirmed |
| RailNav | button | 履歴 | onClick=() => onChangeView("history") | apps/web/src/app/components/RailNav.tsx:38 | confirmed |
| RailNav | button | 性能テスト | onClick=() => onChangeView("benchmark") | apps/web/src/app/components/RailNav.tsx:43 | confirmed |
| RailNav | button | お気に入り | onClick=() => onChangeView("favorites") | apps/web/src/app/components/RailNav.tsx:48 | confirmed |
| RailNav | button | ドキュメント | onClick=() => onChangeView("documents") | apps/web/src/app/components/RailNav.tsx:53 | confirmed |
| RailNav | button | 管理者設定 | onClick=() => onChangeView("admin") | apps/web/src/app/components/RailNav.tsx:59 | confirmed |
| RailNav | button | 個人設定 | onClick=() => onChangeView("profile") | apps/web/src/app/components/RailNav.tsx:65 | confirmed |
| TopBar | button | 新しい会話 | onClick=onNewConversation | apps/web/src/app/components/TopBar.tsx:108 | confirmed |

## フォーム

フォームは静的解析では見つかりませんでした。

## 入力項目

| コンポーネント | 要素 | ラベル | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- |
| PersonalSettingsView | select | submitShortcut | onChange=(event) => onSetSubmitShortcut(event.target.value as SubmitShortcut) | apps/web/src/app/components/PersonalSettingsView.tsx:37 | confirmed |
| TopBar | select | modelId | onChange=(event) => onModelChange(event.target.value) | apps/web/src/app/components/TopBar.tsx:51 | confirmed |
| TopBar | select | デバッグ表示用の文書選択 | onChange=(event) => onDocumentChange(event.target.value) | apps/web/src/app/components/TopBar.tsx:61 | confirmed |
| TopBar | select | 参照フォルダ | onChange=(event) => onGroupChange(event.target.value) | apps/web/src/app/components/TopBar.tsx:69 | confirmed |
| TopBar | select | selectedRunValue | onChange=(event) => onRunChange(event.target.value) | apps/web/src/app/components/TopBar.tsx:84 | confirmed |
| TopBar | input | 未推定 | onChange=(event) => onDebugModeChange(event.target.checked) | apps/web/src/app/components/TopBar.tsx:103 | unknown |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- |
| App | LoginPage | 未推定 | onLogin=login<br>onSignUp=signUp<br>onConfirmSignUp=confirmSignUp<br>onCompleteNewPassword=completeNewPassword | apps/web/src/App.tsx:10 | unknown |
| App | AppShell | 未推定 | onSignOut=logout | apps/web/src/App.tsx:19 | unknown |
| AppShell | RailNav | 未推定 | - | apps/web/src/app/AppShell.tsx:13 | unknown |
| PersonalSettingsView | button | チャットへ戻る | onClick=onBack | apps/web/src/app/components/PersonalSettingsView.tsx:25 | confirmed |
| PersonalSettingsView | label | 送信キー / Enterで送信 / Ctrl+Enterで送信 | - | apps/web/src/app/components/PersonalSettingsView.tsx:35 | confirmed |
| PersonalSettingsView | select | submitShortcut | onChange=(event) => onSetSubmitShortcut(event.target.value as SubmitShortcut) | apps/web/src/app/components/PersonalSettingsView.tsx:37 | confirmed |
| PersonalSettingsView | option | enter | - | apps/web/src/app/components/PersonalSettingsView.tsx:42 | confirmed |
| PersonalSettingsView | option | ctrlEnter | - | apps/web/src/app/components/PersonalSettingsView.tsx:43 | confirmed |
| PersonalSettingsView | button | サインアウト | onClick=onSignOut | apps/web/src/app/components/PersonalSettingsView.tsx:48 | confirmed |
| RailNav | a | ホーム | - | apps/web/src/app/components/RailNav.tsx:24 | confirmed |
| RailNav | button | チャット | onClick=() => onChangeView("chat") | apps/web/src/app/components/RailNav.tsx:28 | confirmed |
| RailNav | button | 担当者対応 | onClick=() => onChangeView("assignee") | apps/web/src/app/components/RailNav.tsx:33 | confirmed |
| RailNav | button | 履歴 | onClick=() => onChangeView("history") | apps/web/src/app/components/RailNav.tsx:38 | confirmed |
| RailNav | button | 性能テスト | onClick=() => onChangeView("benchmark") | apps/web/src/app/components/RailNav.tsx:43 | confirmed |
| RailNav | button | お気に入り | onClick=() => onChangeView("favorites") | apps/web/src/app/components/RailNav.tsx:48 | confirmed |
| RailNav | button | ドキュメント | onClick=() => onChangeView("documents") | apps/web/src/app/components/RailNav.tsx:53 | confirmed |
| RailNav | button | 管理者設定 | onClick=() => onChangeView("admin") | apps/web/src/app/components/RailNav.tsx:59 | confirmed |
| RailNav | button | 個人設定 | onClick=() => onChangeView("profile") | apps/web/src/app/components/RailNav.tsx:65 | confirmed |
| TopBar | label | モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku | - | apps/web/src/app/components/TopBar.tsx:49 | confirmed |
| TopBar | select | modelId | onChange=(event) => onModelChange(event.target.value) | apps/web/src/app/components/TopBar.tsx:51 | confirmed |
| TopBar | option | amazon.nova-lite-v1:0 | - | apps/web/src/app/components/TopBar.tsx:52 | confirmed |
| TopBar | option | anthropic.claude-3-5-sonnet-20240620-v1:0 | - | apps/web/src/app/components/TopBar.tsx:53 | confirmed |
| TopBar | option | anthropic.claude-3-haiku-20240307-v1:0 | - | apps/web/src/app/components/TopBar.tsx:54 | confirmed |
| TopBar | label | ドキュメント | - | apps/web/src/app/components/TopBar.tsx:59 | confirmed |
| TopBar | select | デバッグ表示用の文書選択 | onChange=(event) => onDocumentChange(event.target.value) | apps/web/src/app/components/TopBar.tsx:61 | confirmed |
| TopBar | option | all | - | apps/web/src/app/components/TopBar.tsx:62 | confirmed |
| TopBar | option | document.documentId | - | apps/web/src/app/components/TopBar.tsx:64 | confirmed |
| TopBar | select | 参照フォルダ | onChange=(event) => onGroupChange(event.target.value) | apps/web/src/app/components/TopBar.tsx:69 | confirmed |
| TopBar | option | all | - | apps/web/src/app/components/TopBar.tsx:70 | confirmed |
| TopBar | option | group.groupId | - | apps/web/src/app/components/TopBar.tsx:72 | confirmed |
| TopBar | label | 実行ID | - | apps/web/src/app/components/TopBar.tsx:82 | confirmed |
| TopBar | select | selectedRunValue | onChange=(event) => onRunChange(event.target.value) | apps/web/src/app/components/TopBar.tsx:84 | confirmed |
| TopBar | option | __processing__ | - | apps/web/src/app/components/TopBar.tsx:89 | confirmed |
| TopBar | option | 未実行 | - | apps/web/src/app/components/TopBar.tsx:89 | confirmed |
| TopBar | option | run.runId | - | apps/web/src/app/components/TopBar.tsx:91 | confirmed |
| TopBar | label | デバッグモード | - | apps/web/src/app/components/TopBar.tsx:101 | confirmed |
| TopBar | input | 未推定 | onChange=(event) => onDebugModeChange(event.target.checked) | apps/web/src/app/components/TopBar.tsx:103 | unknown |
| TopBar | button | 新しい会話 | onClick=onNewConversation | apps/web/src/app/components/TopBar.tsx:108 | confirmed |
