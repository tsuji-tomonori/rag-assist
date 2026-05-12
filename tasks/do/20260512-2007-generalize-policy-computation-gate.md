# Generalize policy computation gate

状態: in_progress

## 背景

PR #272 merge 後、ユーザーから「ルールベースはやめて。汎化させて」と指示があった。現在の `graph.ts` は `hasPolicyComputationCue` / `isDocumentThresholdComparisonQuestion` に日本語・金額・可否語の regex rule を持っており、policy computation 実行判定がドメイン語彙に寄っている。

## 目的

RAG workflow の policy computation 実行判定から固定語彙・金額特化 regex を外し、既存の汎用 intent / requirement / selected evidence 情報に基づく条件へ移行する。

## タスク種別

修正

## なぜなぜ分析サマリ

- confirmed: `graph.ts` に `hasPolicyComputationCue` と `isDocumentThresholdComparisonQuestion` があり、金額単位や日本語可否語の regex に依存している。
- confirmed: `extract_policy_computations` 自体は LLM 構造化抽出と schema / quote validation を行う設計で、抽出後の安全性は後段 validation が担う。
- inferred: 実行前 gate に固定語彙を置くと、非金額・非日本語・別業務の threshold / eligibility / policy comparison を拾いにくい。
- inferred: 一方で通常 RAG 質問へ常時実行すると PR #271 の latency 改善が戻る。
- root_cause: latency 改善の early gate を短期的に regex で実装したため、policy computation の適用判断が抽出器より手前で過度にドメイン特化した。
- remediation: tool intent と search plan required facts、質問シグナル、選択済み evidence の構造的特徴に基づく汎用 gate に置き換える。

## スコープ

- `memorag-bedrock-mvp/apps/api/src/agent/graph.ts`
- 必要な regression test
- 関連設計 docs / task / work report

## 実装計画

1. [x] 既存 tests と helper の利用箇所を確認する。
2. [x] `hasPolicyComputationCue` / `isDocumentThresholdComparisonQuestion` の固定語彙 regex を廃止する。
3. [x] `toolIntent`、`searchPlan.requiredFacts`、質問と selected chunk の比較可能な値 signal から抽出要否を判定する。
4. [x] ChatRAG の通常 follow-up では skip され、policy threshold 系では抽出される regression を確認する。
5. [x] API typecheck / test / pre-commit を実行する。

## ドキュメント保守方針

`DES_DLD_001.md` の policy computation 抽出条件が「金額・閾値・可否」表現に寄っている場合は、固定語彙ではなく構造的 signal / intent に基づく説明へ更新する。

## 受け入れ条件

- [x] `graph.ts` から fixed vocabulary / money-specific policy computation gate を除去する。
- [x] ChatRAG follow-up では `extract_policy_computations` skip が維持される。
- [x] policy threshold / decision 系 question では `extract_policy_computations` が維持される。
- [x] 実装に benchmark expected phrase / dataset 固有分岐を入れない。
- [x] 関連 docs を更新する、または不要理由を記録する。
- [x] 変更範囲に見合う検証が pass する、または未実施理由を記録する。
- [x] 作業レポートを `reports/working/` に保存する。
- [ ] PR 作成後に受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `git diff --check`
- `pre-commit run --files ...`

## 検証結果

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass。211 tests pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass。
- `git diff --check`: pass。
- `pre-commit run --files memorag-bedrock-mvp/apps/api/src/agent/graph.ts 'memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_001.md' tasks/do/20260512-2007-generalize-policy-computation-gate.md`: pass。
- 初回の test/typecheck は `tsx` / `tsc` が未インストールで失敗したため、`npm ci` を実行して依存を導入後に再実行した。
- `npm ci`: pass。ただし既存依存について `npm audit` が 1 moderate / 2 high を報告した。今回の変更とは別件として記録する。

## リスク

- 汎用 gate が広すぎると latency が戻る。
- 汎用 gate が狭すぎると policy threshold / decision の computed facts を落とす。
