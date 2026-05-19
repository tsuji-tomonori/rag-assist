# Web inventory check 修正

状態: done
タスク種別: 修正

## 背景

PR #329 の CI で `npm run docs:web-inventory:check` が失敗した。ユーザーから CI 結果が共有され、Web generated inventory check のみ failure であることが示された。

## なぜなぜ分析サマリ

- confirmed: CI では `npm run docs:web-inventory:check` のみ失敗していた。
- confirmed: ローカル再現でも `docs/generated/web-overview.md`、`docs/generated/web-features.md`、`docs/generated/web-components.md`、`docs/generated/web-accessibility.md`、`docs/generated/web-ui-inventory.json`、`docs/generated/web-features/rag.md` が最新ではないと出た。
- inferred: PR #329 で `apps/web/src/features/rag/` を追加したが、自動生成される web inventory を更新していなかった。
- root cause: Web feature の追加に対し、`docs/generated/` の web inventory 生成物が追随していなかった。
- remediation: `tools/web-inventory/generate-web-inventory.mjs` に RAG feature の label/description を追加し、`npm run docs:web-inventory` で generated docs を更新した。

## 目的

CI の `docs:web-inventory:check` を pass させ、生成 inventory に新規 RAG feature を反映する。

## スコープ

- `tools/web-inventory/generate-web-inventory.mjs`
- `docs/generated/web-*`
- 作業レポート

## 受け入れ条件

- [x] `npm run docs:web-inventory:check` が pass する。
- [x] generated web inventory に `apps/web/src/features/rag/` の追加が反映される。
- [x] RAG feature が未定義説明のままにならない。
- [x] 差分チェックと lint が pass する。
- [x] CI 修正の作業レポートを保存する。

## 実施内容

- `npm run docs:web-inventory:check` で失敗を再現した。
- `npm run docs:web-inventory` で generated inventory を更新した。
- `tools/web-inventory/generate-web-inventory.mjs` に `rag` の label と description を追加した。
- 再生成後に `npm run docs:web-inventory:check`、`npm run lint`、`git diff --check` を実行した。

## 検証結果

- `npm run docs:web-inventory:check`: pass
- `npm run lint`: pass
- `git diff --check`: pass

## リスク・制約

- 実 UI の runtime 動作確認は未実施。今回の変更は generated docs と inventory generator の metadata 更新であり、UI 挙動を変更していないため。
