# 作業完了レポート

保存先: `reports/working/20260508-2317-web-inventory-generator.md`

## 1. 受けた指示

- 主な依頼: Web の現在のコードから静的解析ツールを作成し、画面一覧、機能一覧、コンポーネント一覧、ボタンなどの全量把握を CI で自動生成できる仕様書にする。
- 成果物: 静的解析ツール、生成 Markdown / JSON、npm script、CI 最新性チェック、関連 README 追記。
- 形式・条件: できるだけ日本語で読めること。仕様書として扱えること。計画後に実装まで進めること。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | Web 画面一覧を生成する | 高 | 対応 |
| R2 | 機能一覧を生成する | 高 | 対応 |
| R3 | コンポーネント一覧を生成する | 高 | 対応 |
| R4 | ボタン、リンク、フォームなど主要 UI 操作要素を抽出する | 高 | 対応 |
| R5 | 日本語で読める仕様書を生成する | 高 | 対応 |
| R6 | CI で自動生成結果を確認する | 高 | 対応 |
| R7 | 実施していない検証を実施済み扱いしない | 高 | 対応 |

## 3. 検討・判断したこと

- 依存追加を避け、既存 devDependency の `typescript` Compiler API で AST 静的解析を行う構成にした。
- URL ルーティングではなく `AppView` と `AppRoutes` による client-state view 切替だったため、画面一覧の route は `/ (client-state)` と表記した。
- 表示ラベルは JSX text、`aria-label`、`title`、`placeholder` を優先し、断定できないものは `未推定` とした。
- 静的解析だけでは条件付き表示や権限別表示を完全断定できないため、生成物に `certainty` を含めた。
- CI では生成結果を直接更新せず、`docs:web-inventory:check` で stale な生成物を検出する運用にした。

## 4. 実施作業

- `tools/web-inventory/generate-web-inventory.mjs` を追加し、Web app の TS/TSX を AST 解析するようにした。
- `docs/generated/web-screens.md`、`web-features.md`、`web-components.md`、`web-ui-inventory.json` を生成した。
- `package.json` に `docs:web-inventory` と `docs:web-inventory:check` を追加した。
- `.github/workflows/memorag-ci.yml` に generated web inventory check を追加し、CI コメント対象にも含めた。
- `eslint.config.mjs` で `tools/` 配下の Node スクリプトに Node globals を適用するようにした。
- `README.md` に生成物と更新・確認コマンドを追記した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/tools/web-inventory/generate-web-inventory.mjs` | Node script | Web UI 静的解析と Markdown / JSON 生成 | 自動生成ツール |
| `memorag-bedrock-mvp/docs/generated/web-screens.md` | Markdown | 画面一覧 | 仕様書 |
| `memorag-bedrock-mvp/docs/generated/web-features.md` | Markdown | 機能サマリと UI 操作要素一覧 | 仕様書 |
| `memorag-bedrock-mvp/docs/generated/web-components.md` | Markdown | コンポーネント一覧 | 仕様書 |
| `memorag-bedrock-mvp/docs/generated/web-ui-inventory.json` | JSON | 機械可読インベントリ | CI / 将来連携 |
| `.github/workflows/memorag-ci.yml` | YAML | 生成物の最新性チェック | CI 自動確認 |
| `memorag-bedrock-mvp/README.md` | Markdown | 生成コマンド説明 | 保守ドキュメント |

## 6. 実行した検証

- `npm ci`: pass。worktree 側に `node_modules` がなく `typescript` import が失敗したため実行。
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory`: pass。
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`: pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass。
- `npm exec -- eslint tools/web-inventory/generate-web-inventory.mjs --max-warnings=0`: pass。
- `npm --prefix memorag-bedrock-mvp run lint`: pass。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass。27 files / 167 tests passed。
- `git diff --check`: pass。

## 7. 未対応・制約・リスク

- Playwright による実行時 DOM snapshot 補完は対象外。静的解析では権限別、feature flag、実行時データ依存 UI の表示有無は完全断定できない。
- カスタムコンポーネント経由の操作要素は handler props と命名規則から推定するため、`certainty: unknown` が残る。
- `npm audit` は 1 moderate vulnerability を報告したが、本タスクの依存追加はなく、脆弱性対応はスコープ外。

## 8. Fit 評価

総合fit: 4.6 / 5.0（約92%）

理由: 主要な要件である画面・機能・コンポーネント・UI 操作要素の自動生成、CI 最新性チェック、日本語 Markdown 生成は満たした。静的解析のみでは実行時条件を完全に断定できないため、その限界を `certainty` とレポートで明示した。
