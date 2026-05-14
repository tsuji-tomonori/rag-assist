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
| DebugPanel | DebugPanel は デバッグ 領域の 画面または画面内 UI コンポーネント です。単独画面ではなく、他の UI から利用されます。 | 画面または画面内 UI コンポーネント | apps/web/src/features/debug/components/DebugPanel.tsx | DebugPanel | DebugExpandedDialog, DebugPanelBody, DebugPanelFooter, DebugPanelHeader, aside, p |
| DebugExpandedDialog | DebugExpandedDialog は デバッグ 領域の 画面または画面内 UI コンポーネント です。単独画面ではなく、他の UI から利用されます。 | 画面または画面内 UI コンポーネント | apps/web/src/features/debug/components/panel/DebugExpandedDialog.tsx | DebugExpandedDialog | Icon, button, div, h2, header, section, span |
| DebugPanelBody | DebugPanelBody は デバッグ 領域の 画面または画面内 UI コンポーネント です。単独画面ではなく、他の UI から利用されます。 | 画面または画面内 UI コンポーネント | apps/web/src/features/debug/components/panel/DebugPanelBody.tsx | DebugPanelBody | AnswerSupportPanel, ContextAssemblyPanel, DebugDiagnosticsGrid, DebugFlowNodeButton, DebugNodeDetailPanel, DebugRunSummaryView, DebugStepList, EvidenceDebugTable, FactCoverageTable, Icon, article, button, dd, div, dl, dt, em, h3, p, pre, section, span, strong, table, tbody, td, th, thead, tr |
| DebugPanelFooter | DebugPanelFooter は デバッグ 領域の 画面または画面内 UI コンポーネント です。単独画面ではなく、他の UI から利用されます。 | 画面または画面内 UI コンポーネント | apps/web/src/features/debug/components/panel/DebugPanelFooter.tsx | DebugPanelFooter | Icon, footer, span, strong |
| DebugPanelHeader | DebugPanelHeader は デバッグ 領域の 画面または画面内 UI コンポーネント です。単独画面ではなく、他の UI から利用されます。 | 画面または画面内 UI コンポーネント | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx | DebugPanelHeader | Icon, button, div, h2, header, input, label, span |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | 操作説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DebugExpandedDialog | button | 拡大デバッグパネルを閉じる | 「拡大デバッグパネルを閉じる」を実行するボタン。 | - | onClick=onClose | apps/web/src/features/debug/components/panel/DebugExpandedDialog.tsx:32 | confirmed |
| DebugFlowNodeButton | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-pressed=selected | onClick=onSelect | apps/web/src/features/debug/components/panel/DebugPanelBody.tsx:143 | unknown |
| DebugStepList | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-expanded=expandedStep | onClick=() => onToggleStep(step.id) | apps/web/src/features/debug/components/panel/DebugPanelBody.tsx:216 | unknown |
| DebugPanelHeader | button | 保存JSON | 「保存JSON」を実行するボタン。 | 状態: disabled=!activeTrace \|\| pending \|\| Boolean(replayEnvelope) | onClick=() => void downloadDebugTrace(activeTrace) | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:39 | confirmed |
| DebugPanelHeader | button | 可視化JSON | 「可視化JSON」を実行するボタン。 | 状態: disabled=!envelope \|\| pending | onClick=() => downloadDebugReplayEnvelope(envelope) | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:43 | confirmed |
| DebugPanelHeader | button | 解除 | 「解除」を実行するボタン。 | - | onClick=onClearReplay | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:53 | confirmed |
| DebugPanelHeader | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-expanded=allExpanded | onClick=onToggleAll | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:58 | unknown |
| DebugPanelHeader | button | デバッグパネルを拡大表示 | 「デバッグパネルを拡大表示」を実行するボタン。 | - | onClick=onExpand | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:60 | confirmed |

## フォーム

フォームは静的解析では見つかりませんでした。

## 入力項目

| コンポーネント | 要素 | ラベル | 入力項目の説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DebugPanelHeader | input | JSONをアップロード | 「JSONをアップロード」を入力または選択する項目。 | - | onChange=(event) => void onUploadDebugJson(event) | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:50 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DebugExpandedDialog | button | 拡大デバッグパネルを閉じる | 「拡大デバッグパネルを閉じる」を実行するボタン。 | - | onClick=onClose | apps/web/src/features/debug/components/panel/DebugExpandedDialog.tsx:32 | confirmed |
| DebugPanelBody | DebugFlowNodeButton | 未推定 | DebugFlowNodeButton 要素。静的解析では具体的な操作名を推定できません。 | - | onSelect=() => onSelectNode(node.id) | apps/web/src/features/debug/components/panel/DebugPanelBody.tsx:50 | unknown |
| DebugFlowNodeButton | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-pressed=selected | onClick=onSelect | apps/web/src/features/debug/components/panel/DebugPanelBody.tsx:143 | unknown |
| DebugStepList | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-expanded=expandedStep | onClick=() => onToggleStep(step.id) | apps/web/src/features/debug/components/panel/DebugPanelBody.tsx:216 | unknown |
| DebugPanelHeader | button | 保存JSON | 「保存JSON」を実行するボタン。 | 状態: disabled=!activeTrace \|\| pending \|\| Boolean(replayEnvelope) | onClick=() => void downloadDebugTrace(activeTrace) | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:39 | confirmed |
| DebugPanelHeader | button | 可視化JSON | 「可視化JSON」を実行するボタン。 | 状態: disabled=!envelope \|\| pending | onClick=() => downloadDebugReplayEnvelope(envelope) | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:43 | confirmed |
| DebugPanelHeader | label | JSONをアップロード | 「JSONをアップロード」に紐づく入力ラベル。 | - | - | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:47 | confirmed |
| DebugPanelHeader | input | JSONをアップロード | 「JSONをアップロード」を入力または選択する項目。 | - | onChange=(event) => void onUploadDebugJson(event) | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:50 | confirmed |
| DebugPanelHeader | button | 解除 | 「解除」を実行するボタン。 | - | onClick=onClearReplay | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:53 | confirmed |
| DebugPanelHeader | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-expanded=allExpanded | onClick=onToggleAll | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:58 | unknown |
| DebugPanelHeader | button | デバッグパネルを拡大表示 | 「デバッグパネルを拡大表示」を実行するボタン。 | - | onClick=onExpand | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:60 | confirmed |
