# Web 機能詳細: 履歴

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。
>
> 読み方: `confirmed` はコードから直接確認できた情報、`inferred` は fallback や構造から推定した情報、`unknown` は静的解析だけでは断定できない情報です。


## 概要

会話履歴、検索、並び替え、お気に入り、履歴削除を扱う領域です。

## 関連画面

| 表示名 | view | 画面コンポーネント | 権限条件 | 説明 |
| --- | --- | --- | --- | --- |
| 履歴 | history | HistoryWorkspace | - | 履歴。過去の会話を検索、並び替え、再表示、削除します。 |
| お気に入り | favorites | HistoryWorkspace | - | お気に入り。会話履歴のうち favorite のものに絞って確認します。 |

## コンポーネント

| コンポーネント | 役割 | ファイル | export | 使用 JSX 要素 |
| --- | --- | --- | --- | --- |
| HistoryWorkspace | 画面または画面内 UI コンポーネント | apps/web/src/features/history/components/HistoryWorkspace.tsx | HistoryWorkspace | HistorySearchSummary, Icon, button, div, h2, h3, header, input, label, option, section, select, small, span, strong |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- |
| HistoryWorkspace | button | チャットへ戻る | onClick=onBack | apps/web/src/features/history/components/HistoryWorkspace.tsx:51 | confirmed |
| HistoryWorkspace | button | item.isFavorite ? `${item.title}をお気に入りから外す` : `${item.title}をお気に入りに追加` | onClick=() => onToggleFavorite(item) | apps/web/src/features/history/components/HistoryWorkspace.tsx:91 | confirmed |
| HistoryWorkspace | button | 未推定 | onClick=() => onSelect(item) | apps/web/src/features/history/components/HistoryWorkspace.tsx:100 | unknown |
| HistoryWorkspace | button | 削除 | onClick=() => onDelete(item.id) | apps/web/src/features/history/components/HistoryWorkspace.tsx:108 | confirmed |

## フォーム

フォームは静的解析では見つかりませんでした。

## 入力項目

| コンポーネント | 要素 | ラベル | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- |
| HistoryWorkspace | input | 履歴を検索 | onChange=(event) => setQuery(event.target.value) | apps/web/src/features/history/components/HistoryWorkspace.tsx:65 | confirmed |
| HistoryWorkspace | select | 履歴の並び順 | onChange=(event) => setSortOrder(event.target.value as "newest" \| "oldest" \| "messages") | apps/web/src/features/history/components/HistoryWorkspace.tsx:72 | confirmed |
| HistoryWorkspace | input | 未推定 | onChange=(event) => setFavoritesOnly(event.target.checked) | apps/web/src/features/history/components/HistoryWorkspace.tsx:78 | unknown |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- |
| HistoryWorkspace | button | チャットへ戻る | onClick=onBack | apps/web/src/features/history/components/HistoryWorkspace.tsx:51 | confirmed |
| HistoryWorkspace | input | 履歴を検索 | onChange=(event) => setQuery(event.target.value) | apps/web/src/features/history/components/HistoryWorkspace.tsx:65 | confirmed |
| HistoryWorkspace | select | 履歴の並び順 | onChange=(event) => setSortOrder(event.target.value as "newest" \| "oldest" \| "messages") | apps/web/src/features/history/components/HistoryWorkspace.tsx:72 | confirmed |
| HistoryWorkspace | option | newest | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:73 | confirmed |
| HistoryWorkspace | option | oldest | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:74 | confirmed |
| HistoryWorkspace | option | messages | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:75 | confirmed |
| HistoryWorkspace | label | お気に入りのみ | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:77 | confirmed |
| HistoryWorkspace | input | 未推定 | onChange=(event) => setFavoritesOnly(event.target.checked) | apps/web/src/features/history/components/HistoryWorkspace.tsx:78 | unknown |
| HistoryWorkspace | button | item.isFavorite ? `${item.title}をお気に入りから外す` : `${item.title}をお気に入りに追加` | onClick=() => onToggleFavorite(item) | apps/web/src/features/history/components/HistoryWorkspace.tsx:91 | confirmed |
| HistoryWorkspace | button | 未推定 | onClick=() => onSelect(item) | apps/web/src/features/history/components/HistoryWorkspace.tsx:100 | unknown |
| HistoryWorkspace | button | 削除 | onClick=() => onDelete(item.id) | apps/web/src/features/history/components/HistoryWorkspace.tsx:108 | confirmed |
