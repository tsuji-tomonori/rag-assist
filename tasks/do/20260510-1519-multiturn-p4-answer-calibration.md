# Multi-turn benchmark P4 answer / refusal calibration

状態: do

## 背景

ChatRAG / MTRAG 系では、回答が長すぎると expectedContains は通っても unsupported sentence rate が悪化しやすい。会話履歴由来の情報も、文書 evidence で再確認できた場合だけ回答に使う必要がある。

## 目的

benchmark profile 用の短答・根拠限定 answer policy と refusal calibration を追加し、unsupported sentence と誤回答を減らす。

## スコープ

- benchmark profile 用 answer style policy
- unsupported sentence 検出後の answer repair / 短縮
- citation が期待 page 周辺にない場合の追加検索
- refusal precision / recall の個別集計

## 受け入れ条件

- [x] 根拠 chunk にない補足説明を抑制する benchmark answer policy がある。
- [x] unsupported sentence が出た場合に repair path または明示的な failure metric が残る。
- [x] unanswerable turn の refusal precision / recall が集計できる。
- [x] 会話履歴だけを根拠にした回答を許さない。

## 検証計画

- answer generation / support verifier unit test
- unanswerable benchmark smoke
- `git diff --check`

## ドキュメント保守計画

- API request / response schema に public contract の破壊的変更を入れない場合、OpenAPI docs は check のみ実施する。
- benchmark summary / report に新しい metric を追加する場合は、runner test と必要に応じて local verification docs を更新する。

## PR レビュー観点

- benchmark 固有の expected answer / row id / sample 固有値で回答を短縮していないか。
- 会話履歴は query 解釈だけに使い、回答根拠としては retrieved evidence / computed fact に限定しているか。
- refusal precision / recall の分母・分子が answerable / unanswerable row に対して一貫しているか。

## 実施内容

- benchmark corpus / runner 由来の回答生成に `benchmark_grounded_short` policy を適用し、短答・根拠限定・資料外補完禁止を prompt に追加した。
- 会話履歴は解釈補助に限定し、回答根拠は `<context>` / `<computedFacts>` に限定する既存制約を benchmark policy test で明示した。
- turn dependency metrics に `refusalPrecision`、`refusalRecall`、`unsupportedSentenceRate` を追加し、Markdown report にも出力した。
- multi-turn runner test に unanswerable follow-up turn を追加し、refusal precision / recall の集計を検証した。

## 検証結果

- [x] `npm run typecheck -w @memorag-mvp/api`
- [x] `npm exec -w @memorag-mvp/api -- tsx --test src/rag/prompts.test.ts`
- [x] `npm run typecheck -w @memorag-mvp/benchmark`
- [x] `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`
- [x] `npm test -w @memorag-mvp/benchmark -- run.test.ts`
- [x] `npm run docs:openapi:check`
- [x] `npm run build -w @memorag-mvp/api`
- [x] `npm run build -w @memorag-mvp/benchmark`
- [x] `npm test -w @memorag-mvp/api`
- [x] `git diff --check`
