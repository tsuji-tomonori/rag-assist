# Remove rule-based required fact planning

状態: in_progress

## 背景

PR #279 では `graph.ts` 側の重複 regex を `detectQuestionRequirements` へ集約したが、ユーザーから「ルールベースに見える」「汎化できるか」と指摘があった。実装を確認すると、amount / count / procedure / person / condition / classification などの slot を質問語彙 regex で増やしており、固定語彙 rule を別ファイルへ移しただけに見える余地がある。

## 目的

required fact planning で質問語彙から typed fact を作る rule-based 分岐をやめ、汎用 signal phrase に基づく primary fact を使う。policy computation の必要性判定は required fact の `amount` / `condition` type 依存から外し、質問と selected chunk の構造的 value signal で判断する。

## タスク種別

修正

## なぜなぜ分析サマリ

- problem: PR #279 の差分が「rule-based の削除」ではなく「rule-based の集約」に見え、ユーザーの要求する汎化水準に届いていない。
- confirmed: `question-requirements.ts` に amount / count / procedure / person / condition / classification slot の regex 判定が追加されている。
- confirmed: `graph.ts` の `planStructuredFacts` は `QuestionRequirement` slot を `RequiredFact.factType` へ写像している。
- confirmed: `shouldExtractPolicyComputations` は `amount` / `condition` fact type がないと構造的 value signal を見ない。
- root_cause: required fact planning と computation gate が typed fact を前提に結合しているため、slot 判定 rule を削ると computation skip が過剰になる構造だった。
- remediation: required fact planning は `buildSignalPhrase` の primary fact へ単純化し、computation gate は required fact type ではなく question/chunk の value signal compatibility を直接見る。

## スコープ

- `memorag-bedrock-mvp/apps/api/src/agent/graph.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/question-requirements.ts`
- 関連 tests / docs / report / PR コメント

## 実装計画

1. [x] PR #279 で追加した slot-based required fact planning を撤回する。
2. [x] `extractRequiredFacts` を汎用 signal phrase primary fact へ寄せる。
3. [x] policy computation gate を required fact type 依存から構造的 value signal 依存へ変更する。
4. [x] tests を汎化後の期待値へ更新し、固定語彙・dataset 固有分岐を入れない。
5. [x] docs / report / PR コメントを更新する。

## ドキュメント保守方針

required fact planning の設計説明が slot-based deterministic planner と書いている場合は、signal phrase primary fact と value signal gate の説明へ更新する。

## 受け入れ条件

- [x] required fact planning が amount / count / procedure / person / condition / classification の質問語彙 slot rule に依存しない。
- [x] policy computation gate が `amount` / `condition` fact type を必須条件にしない。
- [x] ChatRAG follow-up の required facts が低情報量 token に戻らない。
- [x] benchmark expected phrase / dataset 固有分岐を実装に入れない。
- [x] 変更範囲に見合う検証が pass する、または未実施理由を記録する。
- [x] 作業レポートを `reports/working/` に保存する。
- [ ] PR #279 に受け入れ条件確認コメントとセルフレビューコメントを追加する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `git diff --check`
- `pre-commit run --files ...`

## 検証結果

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: 初回 fail。`fixed workflow search plan trace records complexity, facts, actions, and stop criteria from input` が typed fact 2 件を期待していたため、signal phrase primary fact 1 件の期待へ更新した。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/agent/graph.test.ts src/agent/nodes/node-units.test.ts`: pass。npm script の引数処理により全 API test が実行され、211 tests pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass。
- `git diff --check`: pass。
- `rg -n "planStructuredFacts|factCandidateForRequirement|hasComputationOrientedRequirement|slot:\\s*\\\"amount\\\"|slot:\\s*\\\"count\\\"|slot:\\s*\\\"procedure\\\"|slot:\\s*\\\"person\\\"|slot:\\s*\\\"condition\\\"|slot:\\s*\\\"classification\\\"|数量・金額" ...`: no matches。
- `pre-commit run --files ...`: pass。report/task 追加後も再実行済み。

## リスク

- typed fact を減らすことで retrieval evaluator の type-specific anchor が減る可能性がある。
- answer requirement validation は別用途で rule-based 検査を残すため、今回の「required fact planning の汎化」と混同しないよう PR 本文と report に明記する。
