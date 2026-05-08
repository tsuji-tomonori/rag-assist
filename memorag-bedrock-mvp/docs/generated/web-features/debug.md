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

| コンポーネント | 役割 | ファイル | export | 使用 JSX 要素 |
| --- | --- | --- | --- | --- |
| DebugPanel | 画面または画面内 UI コンポーネント | apps/web/src/features/debug/components/DebugPanel.tsx | DebugPanel | AnswerSupportPanel, ContextAssemblyPanel, DebugFlowNodeButton, DebugNodeDetailPanel, DebugRunSummaryView, EvidenceDebugTable, FactCoverageTable, Icon, article, aside, button, dd, div, dl, dt, em, footer, h2, h3, header, input, label, p, pre, section, span, strong, table, tbody, td, th, thead, tr |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | アクセシブル名 | 状態 | a11y | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DebugPanel | button | 保存済みJSONをダウンロード | 保存JSON (visible-text) | disabled=!activeTrace \|\| pending \|\| Boolean(replayEnvelope) | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => void downloadDebugTrace(activeTrace) | apps/web/src/features/debug/components/DebugPanel.tsx:95 | confirmed |
| DebugPanel | button | 可視化JSONをダウンロード | 可視化JSON (visible-text) | disabled=!envelope \|\| pending | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => downloadDebugReplayEnvelope(envelope) | apps/web/src/features/debug/components/DebugPanel.tsx:99 | confirmed |
| DebugPanel | button | アップロード表示を解除 | 解除 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=clearReplay | apps/web/src/features/debug/components/DebugPanel.tsx:109 | confirmed |
| DebugPanel | button | allExpanded ? "すべて閉じる" : "すべて展開" | allExpanded ? "すべて閉じる" : "すべて展開" (visible-text) | aria-expanded=allExpanded | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onToggleAll | apps/web/src/features/debug/components/DebugPanel.tsx:114 | confirmed |
| DebugPanel | button | デバッグパネルを拡大表示 | デバッグパネルを拡大表示 (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/debug/components/DebugPanel.tsx:116 | confirmed |
| DebugPanel | button | pending ? <span className="loading-spinner" aria-hidden="true" /> : <Icon name=… | pending ? <span className="loading-spinner" aria-hidden="true" /> : <Icon name=… / step.label / formatLatency(step.late… (visible-text) | aria-expanded=expanded | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => onToggleStep(step.id) | apps/web/src/features/debug/components/DebugPanel.tsx:154 | confirmed |
| DebugFlowNodeButton | button | formatGraphGroup(node.group) / node.label / node.iteration ? `#${node.iteration… | formatGraphGroup(node.group) / node.label / node.iteration ? `#${node.iteration}` : formatLatency(node.latencyMs) / nod… (visible-text) | aria-pressed=selected | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onSelect | apps/web/src/features/debug/components/DebugPanel.tsx:234 | confirmed |

## フォーム

フォームは静的解析では見つかりませんでした。

## 入力項目

| コンポーネント | 要素 | ラベル | アクセシブル名 | 説明参照 | 状態 | a11y | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DebugPanel | input | JSONをアップロード | JSONをアップロード (label) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => void onUploadDebugJson(event) | apps/web/src/features/debug/components/DebugPanel.tsx:106 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | アクセシブル名 | 状態 | a11y | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DebugPanel | button | 保存済みJSONをダウンロード | 保存JSON (visible-text) | disabled=!activeTrace \|\| pending \|\| Boolean(replayEnvelope) | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => void downloadDebugTrace(activeTrace) | apps/web/src/features/debug/components/DebugPanel.tsx:95 | confirmed |
| DebugPanel | button | 可視化JSONをダウンロード | 可視化JSON (visible-text) | disabled=!envelope \|\| pending | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => downloadDebugReplayEnvelope(envelope) | apps/web/src/features/debug/components/DebugPanel.tsx:99 | confirmed |
| DebugPanel | label | JSONをアップロード | JSONをアップロード (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/debug/components/DebugPanel.tsx:103 | confirmed |
| DebugPanel | input | JSONをアップロード | JSONをアップロード (label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => void onUploadDebugJson(event) | apps/web/src/features/debug/components/DebugPanel.tsx:106 | confirmed |
| DebugPanel | button | アップロード表示を解除 | 解除 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=clearReplay | apps/web/src/features/debug/components/DebugPanel.tsx:109 | confirmed |
| DebugPanel | button | allExpanded ? "すべて閉じる" : "すべて展開" | allExpanded ? "すべて閉じる" : "すべて展開" (visible-text) | aria-expanded=allExpanded | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onToggleAll | apps/web/src/features/debug/components/DebugPanel.tsx:114 | confirmed |
| DebugPanel | button | デバッグパネルを拡大表示 | デバッグパネルを拡大表示 (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/debug/components/DebugPanel.tsx:116 | confirmed |
| DebugPanel | DebugFlowNodeButton | 未推定 | 未推定 (missing) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onSelect=() => setSelectedNodeId(node.id) | apps/web/src/features/debug/components/DebugPanel.tsx:128 | unknown |
| DebugPanel | button | pending ? <span className="loading-spinner" aria-hidden="true" /> : <Icon name=… | pending ? <span className="loading-spinner" aria-hidden="true" /> : <Icon name=… / step.label / formatLatency(step.late… (visible-text) | aria-expanded=expanded | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => onToggleStep(step.id) | apps/web/src/features/debug/components/DebugPanel.tsx:154 | confirmed |
| DebugFlowNodeButton | button | formatGraphGroup(node.group) / node.label / node.iteration ? `#${node.iteration… | formatGraphGroup(node.group) / node.label / node.iteration ? `#${node.iteration}` : formatLatency(node.latencyMs) / nod… (visible-text) | aria-pressed=selected | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onSelect | apps/web/src/features/debug/components/DebugPanel.tsx:234 | confirmed |
