# Web 機能詳細: agents

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。
>
> 読み方: `confirmed` はコードから直接確認できた情報、`inferred` は fallback や構造から推定した情報、`unknown` は静的解析だけでは断定できない情報です。


## 概要

静的解析では説明未定義です。

## 関連画面

関連画面は静的解析では見つかりませんでした。

## コンポーネント

| コンポーネント | 説明 | 役割 | ファイル | export | 使用 JSX 要素 |
| --- | --- | --- | --- | --- | --- |
| AsyncAgentWorkspace | AsyncAgentWorkspace は agents 領域の 画面または画面内 UI コンポーネント です。単独画面ではなく、他の UI から利用されます。 | 画面または画面内 UI コンポーネント | apps/web/src/features/agents/components/AsyncAgentWorkspace.tsx | AsyncAgentWorkspace | Icon, LoadingStatus, article, button, code, div, h2, h3, header, p, section, small, span, strong |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | 操作説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AsyncAgentWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/agents/components/AsyncAgentWorkspace.tsx:33 | confirmed |
| AsyncAgentWorkspace | button | 非同期エージェント情報を更新 | 「非同期エージェント情報を更新」を実行するボタン。 | 状態: disabled=loading | onClick=onRefresh | apps/web/src/features/agents/components/AsyncAgentWorkspace.tsx:47 | confirmed |
| AsyncAgentWorkspace | button | `${run.agentRunId}の詳細` | 「`${run.agentRunId}の詳細`」を実行するボタン。 | 状態: aria-current=selectedRun?.agentRunId === run.agentRunId ? "true" : undefined | onClick=() => setSelectedRunId(run.agentRunId) | apps/web/src/features/agents/components/AsyncAgentWorkspace.tsx:84 | confirmed |
| AsyncAgentWorkspace | button | キャンセル | 「キャンセル」を実行するボタン。 | 状態: disabled=!canCancel \|\| !["queued", "preparing_workspace", "running", "waiting_for_approval"].inclu… | onClick=() => void onCancel(selectedRun.agentRunId) | apps/web/src/features/agents/components/AsyncAgentWorkspace.tsx:116 | confirmed |

## フォーム

フォームは静的解析では見つかりませんでした。

## 入力項目

入力項目は静的解析では見つかりませんでした。

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AsyncAgentWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/agents/components/AsyncAgentWorkspace.tsx:33 | confirmed |
| AsyncAgentWorkspace | button | 非同期エージェント情報を更新 | 「非同期エージェント情報を更新」を実行するボタン。 | 状態: disabled=loading | onClick=onRefresh | apps/web/src/features/agents/components/AsyncAgentWorkspace.tsx:47 | confirmed |
| AsyncAgentWorkspace | button | `${run.agentRunId}の詳細` | 「`${run.agentRunId}の詳細`」を実行するボタン。 | 状態: aria-current=selectedRun?.agentRunId === run.agentRunId ? "true" : undefined | onClick=() => setSelectedRunId(run.agentRunId) | apps/web/src/features/agents/components/AsyncAgentWorkspace.tsx:84 | confirmed |
| AsyncAgentWorkspace | button | キャンセル | 「キャンセル」を実行するボタン。 | 状態: disabled=!canCancel \|\| !["queued", "preparing_workspace", "running", "waiting_for_approval"].inclu… | onClick=() => void onCancel(selectedRun.agentRunId) | apps/web/src/features/agents/components/AsyncAgentWorkspace.tsx:116 | confirmed |
