# Web UI 静的解析インベントリ生成

## 背景

Web の現在のコードから、画面一覧、機能一覧、コンポーネント一覧、ボタン・リンクなどの UI 操作要素を把握できる仕様書を CI で自動生成したい。

## 目的

`memorag-bedrock-mvp/apps/web` の React/TypeScript コードを静的解析し、日本語で読める Markdown と機械可読 JSON のインベントリを生成できるようにする。

## スコープ

- Web app の route / screen / component / interaction の静的解析ツールを追加する。
- 生成物を `docs/generated/` 配下に出力する。
- CI または検証コマンドから生成・差分確認できる script を追加する。
- 解析結果に推定・動的・未確定の区別を含める。

## 対象外

- 実行時ログイン状態ごとの Playwright DOM snapshot 収集。
- AI による自然言語仕様生成。
- 既存画面挙動の変更。

## 実装計画

1. Web app の package/script、ルーティング、コンポーネント配置を調査する。
2. TypeScript AST ベースのインベントリ生成ツールを追加する。
3. Markdown / JSON 生成物を作成する。
4. npm script と CI workflow を追加または既存 workflow に組み込む。
5. 変更範囲に応じた検証を実行し、必要に応じて修正する。

## ドキュメント保守計画

- 自動生成される仕様書は `docs/generated/` に置く。
- 手動メンテナンス対象でないこと、生成コマンド、静的解析の限界を Markdown 内に明記する。
- README または関連 docs への追記が必要か確認する。

## 受け入れ条件

- [ ] Web 画面一覧を route path、画面コンポーネント、推定ラベル付きで生成できる。
- [ ] Web コンポーネント一覧をファイル、export、使用 JSX 要素付きで生成できる。
- [ ] ボタン、リンク、フォーム、クリック/送信ハンドラなど主要 UI 操作要素を抽出できる。
- [ ] 日本語 Markdown と JSON の両方を生成できる。
- [ ] CI または package script で生成結果の最新性を確認できる。
- [ ] 実行した検証と未実施の制約を report / PR に明記する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run docs:web-inventory`
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`
- Web workspace の関連テストまたは typecheck
- `git diff --check`

## PR レビュー観点

- 静的解析が実装コードに dataset 固有分岐や benchmark 固有値を持ち込んでいないこと。
- 生成ドキュメントが自動生成物として明示されていること。
- Web の実挙動を変えていないこと。
- 静的解析で断定できない情報を推定として扱っていること。

## リスク

- 条件付きレンダリングや権限別 UI は静的解析だけでは完全に断定できない。
- 独自 UI コンポーネント経由の button/link は命名規則に依存する場合がある。
- 生成物が大きくなり CI 差分が読みづらくなる可能性がある。

## 状態

in_progress
