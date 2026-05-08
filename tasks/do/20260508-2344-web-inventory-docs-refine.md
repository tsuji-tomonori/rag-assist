# Web UI インベントリ Markdown 改善と競合解決

## 背景

既存 PR の Web UI インベントリ生成に対して、競合解決と、初めてプロジェクトを見る人が画面・機能・コンポーネントを理解しやすい Markdown への改善が必要になった。

## 目的

- PR branch を最新 `origin/main` に追従させ、競合を解消する。
- 生成 Markdown を人間向けの仕様・探索資料として読みやすくする。
- 機能一覧を機能別ファイルに分割し、必要な情報に辿りやすくする。

## スコープ

- `tools/web-inventory/generate-web-inventory.mjs` の出力構成・Markdown 内容を改善する。
- `docs/generated/` の Web インベントリ生成物を更新する。
- README / CI の参照が必要なら更新する。
- PR branch を `origin/main` に追従させる。

## 対象外

- Playwright による実行時 DOM snapshot 収集。
- Web UI の実行時挙動変更。
- RAG / API / infra の仕様変更。

## 実装計画

1. `origin/main` に rebase し、競合があれば解決する。
2. 生成 Markdown の情報設計を見直す。
3. 機能別 Markdown 出力を追加する。
4. 生成物を再生成する。
5. 変更範囲に応じた検証を実行する。
6. commit / push / PR コメント / セルフレビューを更新する。

## ドキュメント保守計画

- 生成物自体に、読み方、静的解析の限界、全体サマリを含める。
- README の生成物説明が新しいファイル構成と一致するか確認する。

## 受け入れ条件

- [ ] PR branch が最新 `origin/main` に追従し、GitHub 上の conflict が解消されている。
- [ ] 初見の人が Web UI の全体像、画面、主な導線、機能領域を Markdown から把握できる。
- [ ] コンポーネント一覧に、どの機能領域・画面に関係するかを読み取る情報がある。
- [ ] 機能一覧が機能別 Markdown に分割され、索引から辿れる。
- [ ] Markdown と JSON が `docs:web-inventory` で再生成でき、`docs:web-inventory:check` が pass する。
- [ ] 実行した検証と未実施の制約を report / PR に明記する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run docs:web-inventory`
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `npm exec -- eslint tools/web-inventory/generate-web-inventory.mjs --max-warnings=0`
- `npm --prefix memorag-bedrock-mvp run lint`
- `git diff --check`

## PR レビュー観点

- 生成 Markdown が初見の人にとって説明的で、静的解析の限界も明記されていること。
- 機能別ファイル分割が CI check と整合していること。
- Web の実行時挙動を変えていないこと。
- dataset 固有分岐や benchmark 期待語句を実装へ入れていないこと。

## リスク

- 生成物のファイル数が増え、PR diff が大きくなる。
- 静的解析の推定ラベルが不完全な箇所は残る。
- rebase 中の競合解決で main 側の新規変更を落とすリスクがあるため、差分確認を行う。

## 状態

in_progress
