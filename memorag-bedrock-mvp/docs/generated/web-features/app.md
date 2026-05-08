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

| コンポーネント | 説明 | 役割 | ファイル | export | 使用 JSX 要素 |
| --- | --- | --- | --- | --- | --- |
| App | App は アプリケーション枠 領域の UI 構成要素 です。関連画面: 個人設定。 | UI 構成要素 | apps/web/src/App.tsx | App | AppShell, LoginPage |
| AppRoutes | AppRoutes は アプリケーション枠 領域の アプリケーション共通制御 です。関連画面: 個人設定。 | アプリケーション共通制御 | apps/web/src/app/AppRoutes.tsx | AppRoutes | AdminWorkspace, AssigneeWorkspace, BenchmarkWorkspace, ChatView, DocumentWorkspace, HistoryWorkspace, PersonalSettingsView |
| AppShell | AppShell は アプリケーション枠 領域の アプリケーション共通制御 です。関連画面: 個人設定。 | アプリケーション共通制御 | apps/web/src/app/AppShell.tsx | AppShell | AppRoutes, LoadingStatus, RailNav, TopBar, div, main, section |
| PersonalSettingsView | PersonalSettingsView は アプリケーション枠 領域の 画面または画面内 UI コンポーネント です。関連画面: 個人設定。 | 画面または画面内 UI コンポーネント | apps/web/src/app/components/PersonalSettingsView.tsx | PersonalSettingsView | button, dd, div, dl, dt, footer, h2, header, label, option, section, select, span |
| RailNav | RailNav は アプリケーション枠 領域の 画面または画面内 UI コンポーネント です。関連画面: 個人設定。 | 画面または画面内 UI コンポーネント | apps/web/src/app/components/RailNav.tsx | RailNav | Icon, a, aside, button, nav, span |
| TopBar | TopBar は アプリケーション枠 領域の 画面または画面内 UI コンポーネント です。関連画面: 個人設定。 | 画面または画面内 UI コンポーネント | apps/web/src/app/components/TopBar.tsx | TopBar | Icon, button, div, h1, header, i, input, label, option, select, span, strong |
| main.tsx | main.tsx は アプリケーション枠 領域の React mount entry です。関連画面: 個人設定。 | React mount entry | apps/web/src/main.tsx | - | App, React.StrictMode |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | 操作説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PersonalSettingsView | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/app/components/PersonalSettingsView.tsx:25 | confirmed |
| PersonalSettingsView | button | サインアウト | 「サインアウト」を実行するボタン。 | - | onClick=onSignOut | apps/web/src/app/components/PersonalSettingsView.tsx:48 | confirmed |
| RailNav | a | ホーム | 「ホーム」へ移動するリンク。 | - | - | apps/web/src/app/components/RailNav.tsx:24 | confirmed |
| RailNav | button | チャット | 「チャット」を実行するボタン。 | 状態: aria-current=activeView === "chat" ? "page" : undefined | onClick=() => onChangeView("chat") | apps/web/src/app/components/RailNav.tsx:28 | confirmed |
| RailNav | button | 担当者対応 | 「担当者対応」を実行するボタン。 | 状態: aria-current=activeView === "assignee" ? "page" : undefined | onClick=() => onChangeView("assignee") | apps/web/src/app/components/RailNav.tsx:33 | confirmed |
| RailNav | button | 履歴 | 「履歴」を実行するボタン。 | 状態: aria-current=activeView === "history" ? "page" : undefined | onClick=() => onChangeView("history") | apps/web/src/app/components/RailNav.tsx:38 | confirmed |
| RailNav | button | 性能テスト | 「性能テスト」を実行するボタン。 | 状態: aria-current=activeView === "benchmark" ? "page" : undefined | onClick=() => onChangeView("benchmark") | apps/web/src/app/components/RailNav.tsx:43 | confirmed |
| RailNav | button | お気に入り | 「お気に入り」を実行するボタン。 | 状態: aria-current=activeView === "favorites" ? "page" : undefined | onClick=() => onChangeView("favorites") | apps/web/src/app/components/RailNav.tsx:48 | confirmed |
| RailNav | button | ドキュメント | 「ドキュメント」を実行するボタン。 | 状態: aria-current=activeView === "documents" ? "page" : undefined | onClick=() => onChangeView("documents") | apps/web/src/app/components/RailNav.tsx:53 | confirmed |
| RailNav | button | 管理者設定 | 「管理者設定」を実行するボタン。 | 状態: aria-current=activeView === "admin" ? "page" : undefined | onClick=() => onChangeView("admin") | apps/web/src/app/components/RailNav.tsx:59 | confirmed |
| RailNav | button | 個人設定 | 「個人設定」を実行するボタン。 | 状態: aria-current=activeView === "profile" ? "page" : undefined | onClick=() => onChangeView("profile") | apps/web/src/app/components/RailNav.tsx:65 | confirmed |
| TopBar | button | 新しい会話 | 「新しい会話」を実行するボタン。 | - | onClick=onNewConversation | apps/web/src/app/components/TopBar.tsx:108 | confirmed |

## フォーム

フォームは静的解析では見つかりませんでした。

## 入力項目

| コンポーネント | 要素 | ラベル | 入力項目の説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PersonalSettingsView | select | Enterで送信 / Ctrl+Enterで送信 | 「Enterで送信 / Ctrl+Enterで送信」を選ぶ選択項目。 | - | onChange=(event) => onSetSubmitShortcut(event.target.value as SubmitShortcut) | apps/web/src/app/components/PersonalSettingsView.tsx:37 | confirmed |
| TopBar | select | Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku | 「Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku」を選ぶ選択項目。 | - | onChange=(event) => onModelChange(event.target.value) | apps/web/src/app/components/TopBar.tsx:51 | confirmed |
| TopBar | select | すべての資料 | 「すべての資料」を選ぶ選択項目。 | - | onChange=(event) => onDocumentChange(event.target.value) | apps/web/src/app/components/TopBar.tsx:61 | confirmed |
| TopBar | select | 参照フォルダ | 「参照フォルダ」を選ぶ選択項目。 | - | onChange=(event) => onGroupChange(event.target.value) | apps/web/src/app/components/TopBar.tsx:69 | confirmed |
| TopBar | select | 実行ID | 「実行ID」を選ぶ選択項目。 | 状態: disabled=pendingDebugQuestion !== null \|\| (debugRuns.length === 0 && !latestTrace) | onChange=(event) => onRunChange(event.target.value) | apps/web/src/app/components/TopBar.tsx:84 | confirmed |
| TopBar | input | デバッグモード | 「デバッグモード」を入力または選択する項目。 | - | onChange=(event) => onDebugModeChange(event.target.checked) | apps/web/src/app/components/TopBar.tsx:103 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PersonalSettingsView | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/app/components/PersonalSettingsView.tsx:25 | confirmed |
| PersonalSettingsView | label | 送信キー / Enterで送信 / Ctrl+Enterで送信 | 「送信キー / Enterで送信 / Ctrl+Enterで送信」に紐づく入力ラベル。 | - | - | apps/web/src/app/components/PersonalSettingsView.tsx:35 | confirmed |
| PersonalSettingsView | select | Enterで送信 / Ctrl+Enterで送信 | 「Enterで送信 / Ctrl+Enterで送信」を選ぶ選択項目。 | - | onChange=(event) => onSetSubmitShortcut(event.target.value as SubmitShortcut) | apps/web/src/app/components/PersonalSettingsView.tsx:37 | confirmed |
| PersonalSettingsView | option | Enterで送信 | 「Enterで送信」を表す option 要素。 | - | - | apps/web/src/app/components/PersonalSettingsView.tsx:42 | confirmed |
| PersonalSettingsView | option | Ctrl+Enterで送信 | 「Ctrl+Enterで送信」を表す option 要素。 | - | - | apps/web/src/app/components/PersonalSettingsView.tsx:43 | confirmed |
| PersonalSettingsView | button | サインアウト | 「サインアウト」を実行するボタン。 | - | onClick=onSignOut | apps/web/src/app/components/PersonalSettingsView.tsx:48 | confirmed |
| RailNav | a | ホーム | 「ホーム」へ移動するリンク。 | - | - | apps/web/src/app/components/RailNav.tsx:24 | confirmed |
| RailNav | button | チャット | 「チャット」を実行するボタン。 | 状態: aria-current=activeView === "chat" ? "page" : undefined | onClick=() => onChangeView("chat") | apps/web/src/app/components/RailNav.tsx:28 | confirmed |
| RailNav | button | 担当者対応 | 「担当者対応」を実行するボタン。 | 状態: aria-current=activeView === "assignee" ? "page" : undefined | onClick=() => onChangeView("assignee") | apps/web/src/app/components/RailNav.tsx:33 | confirmed |
| RailNav | button | 履歴 | 「履歴」を実行するボタン。 | 状態: aria-current=activeView === "history" ? "page" : undefined | onClick=() => onChangeView("history") | apps/web/src/app/components/RailNav.tsx:38 | confirmed |
| RailNav | button | 性能テスト | 「性能テスト」を実行するボタン。 | 状態: aria-current=activeView === "benchmark" ? "page" : undefined | onClick=() => onChangeView("benchmark") | apps/web/src/app/components/RailNav.tsx:43 | confirmed |
| RailNav | button | お気に入り | 「お気に入り」を実行するボタン。 | 状態: aria-current=activeView === "favorites" ? "page" : undefined | onClick=() => onChangeView("favorites") | apps/web/src/app/components/RailNav.tsx:48 | confirmed |
| RailNav | button | ドキュメント | 「ドキュメント」を実行するボタン。 | 状態: aria-current=activeView === "documents" ? "page" : undefined | onClick=() => onChangeView("documents") | apps/web/src/app/components/RailNav.tsx:53 | confirmed |
| RailNav | button | 管理者設定 | 「管理者設定」を実行するボタン。 | 状態: aria-current=activeView === "admin" ? "page" : undefined | onClick=() => onChangeView("admin") | apps/web/src/app/components/RailNav.tsx:59 | confirmed |
| RailNav | button | 個人設定 | 「個人設定」を実行するボタン。 | 状態: aria-current=activeView === "profile" ? "page" : undefined | onClick=() => onChangeView("profile") | apps/web/src/app/components/RailNav.tsx:65 | confirmed |
| TopBar | label | モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku | 「モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku」に紐づく入力ラベル。 | - | - | apps/web/src/app/components/TopBar.tsx:49 | confirmed |
| TopBar | select | Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku | 「Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku」を選ぶ選択項目。 | - | onChange=(event) => onModelChange(event.target.value) | apps/web/src/app/components/TopBar.tsx:51 | confirmed |
| TopBar | option | Nova Lite v1 | 「Nova Lite v1」を表す option 要素。 | - | - | apps/web/src/app/components/TopBar.tsx:52 | confirmed |
| TopBar | option | Claude 3.5 Sonnet | 「Claude 3.5 Sonnet」を表す option 要素。 | - | - | apps/web/src/app/components/TopBar.tsx:53 | confirmed |
| TopBar | option | Claude 3 Haiku | 「Claude 3 Haiku」を表す option 要素。 | - | - | apps/web/src/app/components/TopBar.tsx:54 | confirmed |
| TopBar | label | ドキュメント | 「ドキュメント」に紐づく入力ラベル。 | - | - | apps/web/src/app/components/TopBar.tsx:59 | confirmed |
| TopBar | select | すべての資料 | 「すべての資料」を選ぶ選択項目。 | - | onChange=(event) => onDocumentChange(event.target.value) | apps/web/src/app/components/TopBar.tsx:61 | confirmed |
| TopBar | option | すべての資料 | 「すべての資料」を表す option 要素。 | - | - | apps/web/src/app/components/TopBar.tsx:62 | confirmed |
| TopBar | option | document.documentId | 「document.documentId」を表す option 要素。 | - | - | apps/web/src/app/components/TopBar.tsx:64 | confirmed |
| TopBar | select | 参照フォルダ | 「参照フォルダ」を選ぶ選択項目。 | - | onChange=(event) => onGroupChange(event.target.value) | apps/web/src/app/components/TopBar.tsx:69 | confirmed |
| TopBar | option | 全フォルダ | 「全フォルダ」を表す option 要素。 | - | - | apps/web/src/app/components/TopBar.tsx:70 | confirmed |
| TopBar | option | group.groupId | 「group.groupId」を表す option 要素。 | - | - | apps/web/src/app/components/TopBar.tsx:72 | confirmed |
| TopBar | label | 実行ID | 「実行ID」に紐づく入力ラベル。 | - | - | apps/web/src/app/components/TopBar.tsx:82 | confirmed |
| TopBar | select | 実行ID | 「実行ID」を選ぶ選択項目。 | 状態: disabled=pendingDebugQuestion !== null \|\| (debugRuns.length === 0 && !latestTrace) | onChange=(event) => onRunChange(event.target.value) | apps/web/src/app/components/TopBar.tsx:84 | confirmed |
| TopBar | option | 処理中 | 「処理中」を表す option 要素。 | - | - | apps/web/src/app/components/TopBar.tsx:89 | confirmed |
| TopBar | option | 未実行 | 「未実行」を表す option 要素。 | - | - | apps/web/src/app/components/TopBar.tsx:89 | confirmed |
| TopBar | option | 実行ID | 「実行ID」を表す option 要素。 | - | - | apps/web/src/app/components/TopBar.tsx:91 | confirmed |
| TopBar | label | デバッグモード | 「デバッグモード」に紐づく入力ラベル。 | - | - | apps/web/src/app/components/TopBar.tsx:101 | confirmed |
| TopBar | input | デバッグモード | 「デバッグモード」を入力または選択する項目。 | - | onChange=(event) => onDebugModeChange(event.target.checked) | apps/web/src/app/components/TopBar.tsx:103 | confirmed |
| TopBar | button | 新しい会話 | 「新しい会話」を実行するボタン。 | - | onClick=onNewConversation | apps/web/src/app/components/TopBar.tsx:108 | confirmed |
