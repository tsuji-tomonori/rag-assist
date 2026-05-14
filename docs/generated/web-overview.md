# Web UI インベントリ概要

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。
>
> 読み方: `confirmed` はコードから直接確認できた情報、`inferred` は fallback や構造から推定した情報、`unknown` は静的解析だけでは断定できない情報です。


## この資料で分かること

- Web UI にどの画面があるか。
- 各画面がどの画面コンポーネントに対応するか。
- 機能領域ごとに、どのコンポーネントと UI 操作要素があるか。
- ボタン、リンク、フォーム、入力欄、主要 handler がどのファイルにあるか。
- アクセシブル名、説明参照、状態属性から、各操作要素が何をするものか。

## 全体サマリ

| 項目 | 件数 | 参照先 |
| --- | --- | --- |
| 画面 | 8 | [web-screens.md](web-screens.md) |
| 機能領域 | 10 | [web-features.md](web-features.md) |
| コンポーネント | 56 | [web-components.md](web-components.md) |
| UI 操作要素 | 277 | [web-features.md](web-features.md) |
| 操作説明 | 277 | [web-accessibility.md](web-accessibility.md) |

## 初めて見る人向けの導線

1. [画面一覧](web-screens.md) で、ユーザーが見る画面と権限条件を把握する。
2. [機能一覧](web-features.md) で、機能領域と関連画面の対応を見る。
3. 気になる機能の詳細ファイルを開き、ボタン、フォーム、handler、実装ファイルを確認する。
4. [操作説明一覧](web-accessibility.md) で、ボタンや入力項目が支援技術にどう説明されるかを確認する。
5. [コンポーネント一覧](web-components.md) で、画面を構成する部品と JSX 使用要素を確認する。

## 生成されるファイル

| ファイル | 用途 |
| --- | --- |
| [web-overview.md](web-overview.md) | 初見向けの入口と全体サマリ |
| [web-screens.md](web-screens.md) | 画面、view、画面コンポーネント、権限条件、主要操作 |
| [web-features.md](web-features.md) | 機能別詳細ファイルへの索引 |
| [web-features/*.md](web-features/) | 機能ごとの画面、コンポーネント、UI 操作要素 |
| [web-components.md](web-components.md) | コンポーネント、export、役割、関連画面 |
| [web-accessibility.md](web-accessibility.md) | アクセシブル名、説明参照、状態属性に基づく UI 操作説明 |
| web-ui-inventory.json | CI や将来の可視化に使える機械可読データ |
