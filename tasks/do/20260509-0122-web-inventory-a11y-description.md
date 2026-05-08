# Web UI インベントリの a11y 説明表現修正

## 背景

生成 Markdown が `ok/warning/missing` の監査結果を前面に出しており、初見の人が「このボタンやコンポーネントが何をするものか」を読む仕様書としては分かりづらい。

## 目的

抽出した accessible name / description / state を、監査結果ではなく UI の日本語説明として Markdown に表示する。

## スコープ

- `tools/web-inventory/generate-web-inventory.mjs` の Markdown 出力表現。
- `docs/generated/` の再生成。
- 作業レポート。

## 受け入れ条件

- [x] Markdown で `a11y ok/warning/missing` を主列として出さない。
- [x] ボタン、フォーム、入力項目、全量表に「操作説明」「状態・補足」など、UI の意味が分かる列を出す。
- [x] `web-accessibility.md` が監査表ではなく、支援技術向け説明を使った UI 説明一覧として読める。
- [x] 静的解析の限界は補足として残す。
- [x] 生成物 check と関連検証を実行する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run docs:web-inventory`
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `git diff --check`

## 状態

ready_for_pr_comment
