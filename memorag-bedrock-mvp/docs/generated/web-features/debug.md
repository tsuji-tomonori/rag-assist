# Web 機能詳細: デバッグ

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。
>
> 読み方: `confirmed` はコードから直接確認できた情報、`inferred` は fallback や構造から推定した情報、`unknown` は静的解析だけでは断定できない情報です。


## 概要

RAG 実行 trace、検索根拠、support verification、step detail を調査する領域です。

## 関連画面

関連画面は静的解析では見つかりませんでした。

## コンポーネント

| コンポーネント | 説明 | 役割 | ファイル | export | 使用 JSX 要素 |
| --- | --- | --- | --- | --- | --- |
| DebugPanel | DebugPanel は デバッグ 領域の 画面または画面内 UI コンポーネント です。単独画面ではなく、他の UI から利用されます。 | 画面または画面内 UI コンポーネント | apps/web/src/features/debug/components/DebugPanel.tsx | DebugPanel | AnswerSupportPanel, ContextAssemblyPanel, DebugFlowNodeButton, DebugNodeDetailPanel, DebugRunSummaryView, EvidenceDebugTable, FactCoverageTable, Icon, article, aside, button, dd, div, dl, dt, em, footer, h2, h3, header, input, label, p, pre, section, span, strong, table, tbody, td, th, thead, tr |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | 操作説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DebugPanel | button | 保存JSON | 「保存JSON」を実行するボタン。 | 状態: disabled=!activeTrace \|\| pending \|\| Boolean(replayEnvelope) | onClick=() => void downloadDebugTrace(activeTrace) | apps/web/src/features/debug/components/DebugPanel.tsx:95 | confirmed |
| DebugPanel | button | 可視化JSON | 「可視化JSON」を実行するボタン。 | 状態: disabled=!envelope \|\| pending | onClick=() => downloadDebugReplayEnvelope(envelope) | apps/web/src/features/debug/components/DebugPanel.tsx:99 | confirmed |
| DebugPanel | button | 解除 | 「解除」を実行するボタン。 | - | onClick=clearReplay | apps/web/src/features/debug/components/DebugPanel.tsx:109 | confirmed |
| DebugPanel | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-expanded=allExpanded | onClick=onToggleAll | apps/web/src/features/debug/components/DebugPanel.tsx:114 | unknown |
| DebugPanel | button | デバッグパネルを拡大表示 | 「デバッグパネルを拡大表示」を実行するボタン。 | - | - | apps/web/src/features/debug/components/DebugPanel.tsx:116 | confirmed |
| DebugPanel | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-expanded=expanded | onClick=() => onToggleStep(step.id) | apps/web/src/features/debug/components/DebugPanel.tsx:154 | unknown |
| DebugFlowNodeButton | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-pressed=selected | onClick=onSelect | apps/web/src/features/debug/components/DebugPanel.tsx:234 | unknown |

## フォーム

フォームは静的解析では見つかりませんでした。

## 入力項目

| コンポーネント | 要素 | ラベル | 入力項目の説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DebugPanel | input | JSONをアップロード | 「JSONをアップロード」を入力または選択する項目。 | - | onChange=(event) => void onUploadDebugJson(event) | apps/web/src/features/debug/components/DebugPanel.tsx:106 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DebugPanel | button | 保存JSON | 「保存JSON」を実行するボタン。 | 状態: disabled=!activeTrace \|\| pending \|\| Boolean(replayEnvelope) | onClick=() => void downloadDebugTrace(activeTrace) | apps/web/src/features/debug/components/DebugPanel.tsx:95 | confirmed |
| DebugPanel | button | 可視化JSON | 「可視化JSON」を実行するボタン。 | 状態: disabled=!envelope \|\| pending | onClick=() => downloadDebugReplayEnvelope(envelope) | apps/web/src/features/debug/components/DebugPanel.tsx:99 | confirmed |
| DebugPanel | label | JSONをアップロード | 「JSONをアップロード」に紐づく入力ラベル。 | - | - | apps/web/src/features/debug/components/DebugPanel.tsx:103 | confirmed |
| DebugPanel | input | JSONをアップロード | 「JSONをアップロード」を入力または選択する項目。 | - | onChange=(event) => void onUploadDebugJson(event) | apps/web/src/features/debug/components/DebugPanel.tsx:106 | confirmed |
| DebugPanel | button | 解除 | 「解除」を実行するボタン。 | - | onClick=clearReplay | apps/web/src/features/debug/components/DebugPanel.tsx:109 | confirmed |
| DebugPanel | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-expanded=allExpanded | onClick=onToggleAll | apps/web/src/features/debug/components/DebugPanel.tsx:114 | unknown |
| DebugPanel | button | デバッグパネルを拡大表示 | 「デバッグパネルを拡大表示」を実行するボタン。 | - | - | apps/web/src/features/debug/components/DebugPanel.tsx:116 | confirmed |
| DebugPanel | DebugFlowNodeButton | 未推定 | DebugFlowNodeButton 要素。静的解析では具体的な操作名を推定できません。 | - | onSelect=() => setSelectedNodeId(node.id) | apps/web/src/features/debug/components/DebugPanel.tsx:128 | unknown |
| DebugPanel | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-expanded=expanded | onClick=() => onToggleStep(step.id) | apps/web/src/features/debug/components/DebugPanel.tsx:154 | unknown |
| DebugFlowNodeButton | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-pressed=selected | onClick=onSelect | apps/web/src/features/debug/components/DebugPanel.tsx:234 | unknown |
