# Web 機能詳細: RAG

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。
>
> 読み方: `confirmed` はコードから直接確認できた情報、`inferred` は fallback や構造から推定した情報、`unknown` は静的解析だけでは断定できない情報です。


## 概要

RAG の引用、根拠 debug、回答不可状態、検索テスト、trace 表示を扱う領域です。

## 関連画面

関連画面は静的解析では見つかりませんでした。

## コンポーネント

| コンポーネント | 説明 | 役割 | ファイル | export | 使用 JSX 要素 |
| --- | --- | --- | --- | --- | --- |
| AnswerUnavailablePanel | AnswerUnavailablePanel は RAG 領域の 画面または画面内 UI コンポーネント です。単独画面ではなく、他の UI から利用されます。 | 画面または画面内 UI コンポーネント | apps/web/src/features/rag/components/AnswerUnavailablePanel.tsx | AnswerUnavailablePanel | - |
| CitationList | CitationList は RAG 領域の 画面または画面内 UI コンポーネント です。単独画面ではなく、他の UI から利用されます。 | 画面または画面内 UI コンポーネント | apps/web/src/features/rag/components/CitationList.tsx | CitationList | - |
| EvidenceDebugPanel | EvidenceDebugPanel は RAG 領域の 画面または画面内 UI コンポーネント です。単独画面ではなく、他の UI から利用されます。 | 画面または画面内 UI コンポーネント | apps/web/src/features/rag/components/EvidenceDebugPanel.tsx | EvidenceDebugPanel | - |
| RagTracePage | RagTracePage は RAG 領域の UI 構成要素 です。単独画面ではなく、他の UI から利用されます。 | UI 構成要素 | apps/web/src/features/rag/pages/RagTracePage.tsx | RagTracePage | - |
| SearchTestPage | SearchTestPage は RAG 領域の UI 構成要素 です。単独画面ではなく、他の UI から利用されます。 | UI 構成要素 | apps/web/src/features/rag/pages/SearchTestPage.tsx | SearchTestPage | - |

## 主なボタン・リンク

ボタン・リンクは静的解析では見つかりませんでした。

## フォーム

フォームは静的解析では見つかりませんでした。

## 入力項目

入力項目は静的解析では見つかりませんでした。

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
