# Multi-turn benchmark P4 answer calibration 作業レポート

## 受けた指示

- P1/P2/P3 のマージ後、全量完了状況を確認し、改善が残っていれば対応する。

## 要件整理

- 残タスクは P4 の answer / refusal calibration。
- benchmark profile では短答・根拠限定の回答を優先し、会話履歴だけを根拠にした補足を禁止する。
- unanswerable turn の refusal precision / recall と unsupported sentence rate を turn dependency 別に追跡できるようにする。

## 検討・判断

- API contract は変更せず、benchmark runner / corpus 由来の内部状態から answer policy を切り替える方針にした。
- unsupported sentence は既存の support verifier repair path を維持しつつ、benchmark summary に `unsupportedSentenceRate` を追加して regression を見える化した。
- dataset 固有の row id / expected answer による分岐は入れず、`source`、`docType`、`benchmarkSuiteId` の benchmark metadata で policy を選択した。

## 実施作業

- `buildFinalAnswerPrompt` に `benchmark_grounded_short` style option を追加した。
- `generate_answer` node で benchmark search filter / selected chunk metadata に基づき benchmark answer style を適用した。
- benchmark prompt test を追加し、短答・資料外補完禁止・会話履歴由来補足禁止・unanswerable refusal 文言を検証した。
- benchmark summary と Markdown report の turn dependency metrics に `refusalPrecision`、`refusalRecall`、`unsupportedSentenceRate` を追加した。
- multi-turn runner test に unanswerable follow-up turn を追加し、refusal precision / recall の集計を検証した。
- task md の受け入れ条件と検証結果を更新した。

## 成果物

- `memorag-bedrock-mvp/apps/api/src/agent/nodes/generate-answer.ts`
- `memorag-bedrock-mvp/apps/api/src/rag/prompts.ts`
- `memorag-bedrock-mvp/apps/api/src/rag/prompts.test.ts`
- `memorag-bedrock-mvp/benchmark/run.ts`
- `memorag-bedrock-mvp/benchmark/run.test.ts`
- `tasks/do/20260510-1519-multiturn-p4-answer-calibration.md`

## fit 評価

- P4 の受け入れ条件は満たした。
- P1/P2/P3 は既に main にマージ済みで、今回 P4 を追加実装したことで multi-turn benchmark 改善タスクは全量完了扱いにできる状態になった。

## 検証

- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm exec -w @memorag-mvp/api -- tsx --test src/rag/prompts.test.ts`: pass
- `npm run typecheck -w @memorag-mvp/benchmark`: pass
- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`: pass
- `npm test -w @memorag-mvp/benchmark -- run.test.ts`: pass
- `npm run docs:openapi:check`: pass
- `npm run build -w @memorag-mvp/api`: pass
- `npm run build -w @memorag-mvp/benchmark`: pass
- `npm test -w @memorag-mvp/api`: pass
- `git diff --check`: pass

## 未対応・制約・リスク

- 実 leaderboard / 最新仕様の外部確認は実施していない。
- citation が expected page 周辺にない場合の追加検索は、P2 の page-aware retrieval と既存 search loop を活かす前提で、P4 では answer policy と metrics に絞った。
- CI 実行は PR 作成後に確認する。
