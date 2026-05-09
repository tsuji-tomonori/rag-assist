# Web 機能詳細: 共通

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。
>
> 読み方: `confirmed` はコードから直接確認できた情報、`inferred` は fallback や構造から推定した情報、`unknown` は静的解析だけでは断定できない情報です。


## 概要

複数領域で再利用される表示部品です。単独の画面ではなく、他の画面から使われます。

## 関連画面

関連画面は静的解析では見つかりませんでした。

## コンポーネント

| コンポーネント | 説明 | 役割 | ファイル | export | 使用 JSX 要素 |
| --- | --- | --- | --- | --- | --- |
| Icon | Icon は 共通 領域の 画面または画面内 UI コンポーネント です。単独画面ではなく、他の UI から利用されます。 | 画面または画面内 UI コンポーネント | apps/web/src/shared/components/Icon.tsx | Icon | path, svg |
| LoadingSpinner | LoadingSpinner は 共通 領域の 画面または画面内 UI コンポーネント です。単独画面ではなく、他の UI から利用されます。 | 画面または画面内 UI コンポーネント | apps/web/src/shared/components/LoadingSpinner.tsx | LoadingSpinner, LoadingStatus | LoadingSpinner, div, span |

## 主なボタン・リンク

ボタン・リンクは静的解析では見つかりませんでした。

## フォーム

フォームは静的解析では見つかりませんでした。

## 入力項目

入力項目は静的解析では見つかりませんでした。

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Icon | svg | 未推定 | svg 要素。静的解析では具体的な操作名を推定できません。 | - | - | apps/web/src/shared/components/Icon.tsx:27 | unknown |
