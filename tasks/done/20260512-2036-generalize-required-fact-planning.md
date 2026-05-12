# Generalize required fact planning

状態: done

## 背景

PR #274 merge 後、policy computation 実行前 gate から固定語彙・金額特化 regex は除去した。一方、前回レポートでは `planStructuredFacts` / `question-requirements.ts` 側の requirement detection に rule-based 部分が残ることを既知リスクとして記録した。ユーザーから「次の改善があれば対応して」と依頼があったため、次の改善候補として required fact planning の汎化余地を確認する。

## 目的

RAG workflow の required fact planning が、固定の日本語質問語や金額語彙に過度に依存している場合、既存の signal term / requirement information を使って汎化し、ChatRAG / policy computation の既存 regression を維持する。

## タスク種別

修正

## なぜなぜ分析サマリ

- problem: policy computation gate は汎化されたが、その入力である `searchPlan.requiredFacts` の生成が固定語彙 rule に寄ると、非日本語・別業務の質問で amount / condition / person などの fact type が作られず、後段の汎用 gate が十分に働かない可能性が残る。
- confirmed: PR #274 の作業レポートに、`planStructuredFacts` / `question-requirements.ts` の rule-based detection はスコープ外として記録済み。
- confirmed: `extract_policy_computations` 本体は LLM 構造化抽出と deterministic validation を持つため、前段 planning の取りこぼしが false skip の主リスクになる。
- inferred: required fact planning を即 LLM planner 化すると挙動・latency・テスト範囲が大きくなる。
- root_cause: required fact planning と question requirement detection が別々の固定 regex を持ち、汎用 signal extraction と再利用されていない。
- remediation: まず重複した固定分岐を整理し、既存の `detectQuestionRequirements` と signal phrase を required fact 生成へ集約する。LLM planner 化が必要な範囲は別タスクとして明示する。

## スコープ

- `memorag-bedrock-mvp/apps/api/src/agent/graph.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/question-requirements.ts`
- 関連 tests / docs / report

## 実装計画

1. [x] 現在の required fact planning と tests を確認する。
2. [x] `planStructuredFacts` の重複 regex を減らし、既存 requirement detector / signal phrase から fact を組み立てる。
3. [x] ChatRAG follow-up と policy threshold regression を維持する。
4. [x] docs 更新要否を確認する。
5. [x] 変更範囲に見合う検証を実行する。

## ドキュメント保守方針

RAG workflow の required fact planning の説明が固定語彙前提で書かれている場合は更新する。該当 docs がなければ作業レポートで不要理由を記録する。

## 受け入れ条件

- [x] required fact planning の重複した固定 regex 分岐を削減する。
- [x] policy computation gate が `amount` / `condition` fact を必要なケースで引き続き受け取れる。
- [x] ChatRAG follow-up の required facts が低情報量 token に戻らない。
- [x] benchmark expected phrase / dataset 固有分岐を実装に入れない。
- [x] 変更範囲に見合う検証が pass する、または未実施理由を記録する。
- [x] 作業レポートを `reports/working/` に保存する。
- [x] PR 作成後に受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `git diff --check`
- `pre-commit run --files ...`

## 検証結果

- `npm ci`: pass。ただし既存依存について `npm audit` が 1 moderate / 2 high を報告した。今回の変更とは別件として記録する。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: 初回 fail。`fixed workflow search plan trace records complexity, facts, actions, and stop criteria from input` で fact count が 2 から 1 になった。
- 修正: deadline slot の検出を question requirement detector に追加し、date fact description に requirement label を使うよう調整した。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: 修正後 pass。211 tests pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass。
- `git diff --check`: pass。
- `pre-commit run --files memorag-bedrock-mvp/apps/api/src/agent/graph.ts memorag-bedrock-mvp/apps/api/src/agent/question-requirements.ts memorag-bedrock-mvp/apps/api/src/agent/nodes/node-units.test.ts 'memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_001.md' tasks/do/20260512-2036-generalize-required-fact-planning.md`: pass。
- PR: https://github.com/tsuji-tomonori/rag-assist/pull/279
- PR コメント: 受け入れ条件確認コメントとセルフレビューコメントを投稿済み。

## リスク

- requirement detector 自体を大きく変えると answerability / sufficient context の既存挙動に影響する。
- LLM planner 導入は latency と prompt validation の設計が必要で、今回の小改善には大きすぎる可能性がある。
