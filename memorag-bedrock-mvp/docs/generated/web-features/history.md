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

| コンポーネント | 説明 | 役割 | ファイル | export | 使用 JSX 要素 |
| --- | --- | --- | --- | --- | --- |
| HistoryWorkspace | HistoryWorkspace は 履歴 領域の 画面または画面内 UI コンポーネント です。関連画面: 履歴、お気に入り。 | 画面または画面内 UI コンポーネント | apps/web/src/features/history/components/HistoryWorkspace.tsx | HistoryWorkspace | ConfirmDialog, HistorySearchSummary, Icon, button, div, h2, h3, header, input, label, option, section, select, small, span, strong |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | 操作説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HistoryWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/history/components/HistoryWorkspace.tsx:53 | confirmed |
| HistoryWorkspace | button | item.isFavorite ? `${item.title}をお気に入りから外す` : `${item.title}をお気に入りに追加` | 「item.isFavorite ? `${item.title}をお気に入りから外す` : `${item.title}をお気に入りに追加`」を実行するボタン。 | - | onClick=() => onToggleFavorite(item) | apps/web/src/features/history/components/HistoryWorkspace.tsx:93 | confirmed |
| HistoryWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | onClick=() => onSelect(item) | apps/web/src/features/history/components/HistoryWorkspace.tsx:102 | unknown |
| HistoryWorkspace | button | 削除 | 「削除」を実行するボタン。 | - | onClick=() => setDeleteCandidate(item) | apps/web/src/features/history/components/HistoryWorkspace.tsx:110 | confirmed |

## フォーム

フォームは静的解析では見つかりませんでした。

## 入力項目

| コンポーネント | 要素 | ラベル | 入力項目の説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HistoryWorkspace | input | 履歴を検索 | 「履歴を検索」を入力または選択する項目。 | - | onChange=(event) => setQuery(event.target.value) | apps/web/src/features/history/components/HistoryWorkspace.tsx:67 | confirmed |
| HistoryWorkspace | select | 履歴の並び順 | 「履歴の並び順」を選ぶ選択項目。 | - | onChange=(event) => setSortOrder(event.target.value as "newest" \| "oldest" \| "messages") | apps/web/src/features/history/components/HistoryWorkspace.tsx:74 | confirmed |
| HistoryWorkspace | input | お気に入りのみ | 「お気に入りのみ」を入力または選択する項目。 | - | onChange=(event) => setFavoritesOnly(event.target.checked) | apps/web/src/features/history/components/HistoryWorkspace.tsx:80 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HistoryWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/history/components/HistoryWorkspace.tsx:53 | confirmed |
| HistoryWorkspace | input | 履歴を検索 | 「履歴を検索」を入力または選択する項目。 | - | onChange=(event) => setQuery(event.target.value) | apps/web/src/features/history/components/HistoryWorkspace.tsx:67 | confirmed |
| HistoryWorkspace | select | 履歴の並び順 | 「履歴の並び順」を選ぶ選択項目。 | - | onChange=(event) => setSortOrder(event.target.value as "newest" \| "oldest" \| "messages") | apps/web/src/features/history/components/HistoryWorkspace.tsx:74 | confirmed |
| HistoryWorkspace | option | 新しい順 | 「新しい順」を表す option 要素。 | - | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:75 | confirmed |
| HistoryWorkspace | option | 古い順 | 「古い順」を表す option 要素。 | - | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:76 | confirmed |
| HistoryWorkspace | option | メッセージ数順 | 「メッセージ数順」を表す option 要素。 | - | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:77 | confirmed |
| HistoryWorkspace | label | お気に入りのみ | 「お気に入りのみ」に紐づく入力ラベル。 | - | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:79 | confirmed |
| HistoryWorkspace | input | お気に入りのみ | 「お気に入りのみ」を入力または選択する項目。 | - | onChange=(event) => setFavoritesOnly(event.target.checked) | apps/web/src/features/history/components/HistoryWorkspace.tsx:80 | confirmed |
| HistoryWorkspace | button | item.isFavorite ? `${item.title}をお気に入りから外す` : `${item.title}をお気に入りに追加` | 「item.isFavorite ? `${item.title}をお気に入りから外す` : `${item.title}をお気に入りに追加`」を実行するボタン。 | - | onClick=() => onToggleFavorite(item) | apps/web/src/features/history/components/HistoryWorkspace.tsx:93 | confirmed |
| HistoryWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | onClick=() => onSelect(item) | apps/web/src/features/history/components/HistoryWorkspace.tsx:102 | unknown |
| HistoryWorkspace | button | 削除 | 「削除」を実行するボタン。 | - | onClick=() => setDeleteCandidate(item) | apps/web/src/features/history/components/HistoryWorkspace.tsx:110 | confirmed |
