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
| AppRoutes | AppRoutes は アプリケーション枠 領域の アプリケーション共通制御 です。関連画面: 個人設定。 | アプリケーション共通制御 | apps/web/src/app/AppRoutes.tsx | AppRoutes | AdminWorkspace, AssigneeWorkspace, AsyncAgentWorkspace, BenchmarkWorkspace, ChatView, DocumentWorkspace, HistoryWorkspace, PersonalSettingsView |
| AppShell | AppShell は アプリケーション枠 領域の アプリケーション共通制御 です。関連画面: 個人設定。 | アプリケーション共通制御 | apps/web/src/app/AppShell.tsx | AppShell | AppRoutes, LoadingStatus, RailNav, TopBar, div, main, section |
| PersonalSettingsView | PersonalSettingsView は アプリケーション枠 領域の 画面または画面内 UI コンポーネント です。関連画面: 個人設定。 | 画面または画面内 UI コンポーネント | apps/web/src/app/components/PersonalSettingsView.tsx | PersonalSettingsView | button, dd, div, dl, dt, footer, h2, header, label, option, section, select, span |
| RailNav | RailNav は アプリケーション枠 領域の 画面または画面内 UI コンポーネント です。関連画面: 個人設定。 | 画面または画面内 UI コンポーネント | apps/web/src/app/components/RailNav.tsx | RailNav | Icon, a, aside, button, nav, span |
| TopBar | TopBar は アプリケーション枠 領域の 画面または画面内 UI コンポーネント です。関連画面: 個人設定。 | 画面または画面内 UI コンポーネント | apps/web/src/app/components/TopBar.tsx | TopBar | Icon, button, h1, header, i, input, label, span |
| main.tsx | main.tsx は アプリケーション枠 領域の React mount entry です。関連画面: 個人設定。 | React mount entry | apps/web/src/main.tsx | - | App, React.StrictMode |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | 操作説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PersonalSettingsView | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/app/components/PersonalSettingsView.tsx:25 | confirmed |
| PersonalSettingsView | button | サインアウト | 「サインアウト」を実行するボタン。 | - | onClick=onSignOut | apps/web/src/app/components/PersonalSettingsView.tsx:48 | confirmed |
| RailNav | a | ホーム | 「ホーム」へ移動するリンク。 | - | - | apps/web/src/app/components/RailNav.tsx:26 | confirmed |
| RailNav | button | チャット | 「チャット」を実行するボタン。 | 状態: aria-current=activeView === "chat" ? "page" : undefined | onClick=() => onChangeView("chat") | apps/web/src/app/components/RailNav.tsx:30 | confirmed |
| RailNav | button | 担当者対応 | 「担当者対応」を実行するボタン。 | 状態: aria-current=activeView === "assignee" ? "page" : undefined | onClick=() => onChangeView("assignee") | apps/web/src/app/components/RailNav.tsx:35 | confirmed |
| RailNav | button | 履歴 | 「履歴」を実行するボタン。 | 状態: aria-current=activeView === "history" ? "page" : undefined | onClick=() => onChangeView("history") | apps/web/src/app/components/RailNav.tsx:40 | confirmed |
| RailNav | button | 性能テスト | 「性能テスト」を実行するボタン。 | 状態: aria-current=activeView === "benchmark" ? "page" : undefined | onClick=() => onChangeView("benchmark") | apps/web/src/app/components/RailNav.tsx:45 | confirmed |
| RailNav | button | エージェント | 「エージェント」を実行するボタン。 | 状態: aria-current=activeView === "agents" ? "page" : undefined | onClick=() => onChangeView("agents") | apps/web/src/app/components/RailNav.tsx:51 | confirmed |
| RailNav | button | お気に入り | 「お気に入り」を実行するボタン。 | 状態: aria-current=activeView === "favorites" ? "page" : undefined | onClick=() => onChangeView("favorites") | apps/web/src/app/components/RailNav.tsx:56 | confirmed |
| RailNav | button | ドキュメント | 「ドキュメント」を実行するボタン。 | 状態: aria-current=activeView === "documents" ? "page" : undefined | onClick=() => onChangeView("documents") | apps/web/src/app/components/RailNav.tsx:61 | confirmed |
| RailNav | button | 管理者設定 | 「管理者設定」を実行するボタン。 | 状態: aria-current=activeView === "admin" ? "page" : undefined | onClick=() => onChangeView("admin") | apps/web/src/app/components/RailNav.tsx:67 | confirmed |
| RailNav | button | 個人設定 | 「個人設定」を実行するボタン。 | 状態: aria-current=activeView === "profile" ? "page" : undefined | onClick=() => onChangeView("profile") | apps/web/src/app/components/RailNav.tsx:73 | confirmed |
| TopBar | button | 新しい会話 | 「新しい会話」を実行するボタン。 | - | onClick=onNewConversation | apps/web/src/app/components/TopBar.tsx:24 | confirmed |

## フォーム

フォームは静的解析では見つかりませんでした。

## 入力項目

| コンポーネント | 要素 | ラベル | 入力項目の説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PersonalSettingsView | select | Enterで送信 / Ctrl+Enterで送信 | 「Enterで送信 / Ctrl+Enterで送信」を選ぶ選択項目。 | - | onChange=(event) => onSetSubmitShortcut(event.target.value as SubmitShortcut) | apps/web/src/app/components/PersonalSettingsView.tsx:37 | confirmed |
| TopBar | input | デバッグモード | 「デバッグモード」を入力または選択する項目。 | - | onChange=(event) => onDebugModeChange(event.target.checked) | apps/web/src/app/components/TopBar.tsx:20 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PersonalSettingsView | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/app/components/PersonalSettingsView.tsx:25 | confirmed |
| PersonalSettingsView | label | 送信キー / Enterで送信 / Ctrl+Enterで送信 | 「送信キー / Enterで送信 / Ctrl+Enterで送信」に紐づく入力ラベル。 | - | - | apps/web/src/app/components/PersonalSettingsView.tsx:35 | confirmed |
| PersonalSettingsView | select | Enterで送信 / Ctrl+Enterで送信 | 「Enterで送信 / Ctrl+Enterで送信」を選ぶ選択項目。 | - | onChange=(event) => onSetSubmitShortcut(event.target.value as SubmitShortcut) | apps/web/src/app/components/PersonalSettingsView.tsx:37 | confirmed |
| PersonalSettingsView | option | Enterで送信 | 「Enterで送信」を表す option 要素。 | - | - | apps/web/src/app/components/PersonalSettingsView.tsx:42 | confirmed |
| PersonalSettingsView | option | Ctrl+Enterで送信 | 「Ctrl+Enterで送信」を表す option 要素。 | - | - | apps/web/src/app/components/PersonalSettingsView.tsx:43 | confirmed |
| PersonalSettingsView | button | サインアウト | 「サインアウト」を実行するボタン。 | - | onClick=onSignOut | apps/web/src/app/components/PersonalSettingsView.tsx:48 | confirmed |
| RailNav | a | ホーム | 「ホーム」へ移動するリンク。 | - | - | apps/web/src/app/components/RailNav.tsx:26 | confirmed |
| RailNav | button | チャット | 「チャット」を実行するボタン。 | 状態: aria-current=activeView === "chat" ? "page" : undefined | onClick=() => onChangeView("chat") | apps/web/src/app/components/RailNav.tsx:30 | confirmed |
| RailNav | button | 担当者対応 | 「担当者対応」を実行するボタン。 | 状態: aria-current=activeView === "assignee" ? "page" : undefined | onClick=() => onChangeView("assignee") | apps/web/src/app/components/RailNav.tsx:35 | confirmed |
| RailNav | button | 履歴 | 「履歴」を実行するボタン。 | 状態: aria-current=activeView === "history" ? "page" : undefined | onClick=() => onChangeView("history") | apps/web/src/app/components/RailNav.tsx:40 | confirmed |
| RailNav | button | 性能テスト | 「性能テスト」を実行するボタン。 | 状態: aria-current=activeView === "benchmark" ? "page" : undefined | onClick=() => onChangeView("benchmark") | apps/web/src/app/components/RailNav.tsx:45 | confirmed |
| RailNav | button | エージェント | 「エージェント」を実行するボタン。 | 状態: aria-current=activeView === "agents" ? "page" : undefined | onClick=() => onChangeView("agents") | apps/web/src/app/components/RailNav.tsx:51 | confirmed |
| RailNav | button | お気に入り | 「お気に入り」を実行するボタン。 | 状態: aria-current=activeView === "favorites" ? "page" : undefined | onClick=() => onChangeView("favorites") | apps/web/src/app/components/RailNav.tsx:56 | confirmed |
| RailNav | button | ドキュメント | 「ドキュメント」を実行するボタン。 | 状態: aria-current=activeView === "documents" ? "page" : undefined | onClick=() => onChangeView("documents") | apps/web/src/app/components/RailNav.tsx:61 | confirmed |
| RailNav | button | 管理者設定 | 「管理者設定」を実行するボタン。 | 状態: aria-current=activeView === "admin" ? "page" : undefined | onClick=() => onChangeView("admin") | apps/web/src/app/components/RailNav.tsx:67 | confirmed |
| RailNav | button | 個人設定 | 「個人設定」を実行するボタン。 | 状態: aria-current=activeView === "profile" ? "page" : undefined | onClick=() => onChangeView("profile") | apps/web/src/app/components/RailNav.tsx:73 | confirmed |
| TopBar | label | デバッグモード | 「デバッグモード」に紐づく入力ラベル。 | - | - | apps/web/src/app/components/TopBar.tsx:18 | confirmed |
| TopBar | input | デバッグモード | 「デバッグモード」を入力または選択する項目。 | - | onChange=(event) => onDebugModeChange(event.target.checked) | apps/web/src/app/components/TopBar.tsx:20 | confirmed |
| TopBar | button | 新しい会話 | 「新しい会話」を実行するボタン。 | - | onClick=onNewConversation | apps/web/src/app/components/TopBar.tsx:24 | confirmed |
