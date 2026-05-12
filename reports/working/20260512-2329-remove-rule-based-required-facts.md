# Remove rule-based required fact planning

## 受けた指示

PR #279 の変更がルールベースに見えるため、より汎化できるか確認し、対応する。

## 要件整理

- required fact planning で amount / count / procedure / person / condition / classification のような質問語彙 slot rule を増やさない。
- policy computation gate は `RequiredFact.factType=amount|condition` に依存しない。
- ChatRAG follow-up の低情報量 token 抑制と policy threshold regression を維持する。
- benchmark expected phrase / dataset 固有分岐を入れない。

## 検討・判断

前回差分は `graph.ts` の重複 rule を `question-requirements.ts` へ集約しており、ユーザー指摘どおり「rule-based をやめた」とは言いにくかった。required fact planning は質問語彙から typed fact を作るのではなく、低情報量 token を除いた signal phrase の primary fact 1 件へ単純化した。policy computation の実行判定は required fact type ではなく、質問と selected chunk の比較可能な値 signal の互換性で判断するようにした。

## 実施作業

- `graph.ts` から `planStructuredFacts`、`factCandidateForRequirement`、slot-to-fact mapping、`amount|condition` fact type 前提の computation gate を削除した。
- `extractRequiredFacts` を signal phrase fallback の primary fact 生成へ一本化した。
- `question-requirements.ts` から PR #279 で追加した amount / count / procedure / person / condition / classification slot を削除した。
- search plan trace test を typed fact 2 件期待から signal phrase primary fact 1 件期待へ更新した。
- `DES_DLD_001.md` を signal phrase primary fact と value signal gate の設計説明へ更新した。
- task md を追加し、検証結果を記録した。

## 成果物

- `memorag-bedrock-mvp/apps/api/src/agent/graph.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/question-requirements.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/graph.test.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/nodes/node-units.test.ts`
- `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_001.md`
- `tasks/do/20260512-2321-remove-rule-based-required-facts.md`

## 検証

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: 初回 fail。typed fact 2 件を期待する trace test を、signal phrase primary fact 1 件の期待へ修正。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/agent/graph.test.ts src/agent/nodes/node-units.test.ts`: pass。npm script の引数処理により全 API test が実行され、211 tests pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass。
- `git diff --check`: pass。
- `rg -n "planStructuredFacts|factCandidateForRequirement|hasComputationOrientedRequirement|slot:\\s*\\\"amount\\\"|slot:\\s*\\\"count\\\"|slot:\\s*\\\"procedure\\\"|slot:\\s*\\\"person\\\"|slot:\\s*\\\"condition\\\"|slot:\\s*\\\"classification\\\"|数量・金額" ...`: no matches。
- `pre-commit run --files ...`: pass。

## Fit 評価

ユーザーの「ルールベースはやめて。汎化させて」という指示に対し、required fact planning から今回追加した rule-based typed slot を取り除いた。answer requirement validation には既存の限定的な question requirement rule が残るが、これは required fact planning ではなく回答形式 validation 用の既存機構であり、今回の変更範囲外とした。

## 未対応・制約・リスク

- LLM required fact planner は導入していない。latency、schema validation、fallback、debug trace、mock 方針の設計が必要なため別タスクが適切。
- retrieval evaluator 内の typed claim anchor rule は既存の根拠評価ロジックとして残る。今回の対象は質問語彙から typed required fact を作る planning 側。
