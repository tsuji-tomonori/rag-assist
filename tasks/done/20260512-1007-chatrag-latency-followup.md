# ChatRAG latency follow-up

状態: done

## 背景

PR #269 merge 後にローカル `chatrag-bench-v1` sample benchmark を実行し、正答系 metric はすべて 1.0 になった。一方で raw trace では Turn 2 の expanded queries が 8 本に増え、computed facts が 0 件でも `extract_policy_computations` が実行されていた。ユーザーの性能改善案 C / E がまだ残っている。

## 目的

ChatRAG sample の正答率を維持したまま、short follow-up の query expansion と不要な policy computation を抑制する。

## タスク種別

修正

## なぜなぜ分析サマリ

- confirmed: PR #269 merge 後の `origin/main` は `5d9b3a9f`。
- confirmed: ローカル sample benchmark は `turnAnswerCorrectRate=1`、`conversationSuccessRate=1`、`historyDependentAccuracy=1`、`retrievalRecallAtK=1`。
- confirmed: Turn 2 trace では expanded queries が 8 本、`extract_policy_computations` が computed facts 0 件で実行されていた。
- inferred: short follow-up では carried entity / previous citation / signal term 由来の query expansion が過剰で、hybrid search の queryCount と latency を増やす。
- inferred: policy computation intent が不要な質問でも抽出 node を常時通すため、不要な LLM 呼び出し余地が残る。
- root_cause: 正答率修正後も、query expansion と policy computation の実行条件が answerable simple / follow-up case に対して広すぎる。
- remediation: short follow-up の expanded queries を小さく制限し、tool intent が計算不要なら `extract_policy_computations` を skip する。

## スコープ

- API RAG agent の query expansion / computation extraction 制御
- ChatRAG regression test
- 詳細設計と作業レポート

## 実装計画

1. `generate_clues` / conversation query expansion の経路を確認する。
2. short follow-up では expanded queries を 2〜3 本へ制限する。
3. `toolIntent` が arithmetic / temporal / aggregation / task deadline を不要と判定している場合は `extract_policy_computations` を skip する。
4. ChatRAG regression で query count と `extract_policy_computations` skip を確認する。
5. API test / typecheck / sample benchmark を実行する。

## ドキュメント保守方針

RAG workflow の step 条件が変わるため、`DES_DLD_001.md` または関連詳細設計の最小更新を行う。

## 受け入れ条件

- [x] `chatrag-bench-v1` sample benchmark が 1.0 系 metric を維持する。
- [x] short follow-up の expanded queries が過剰に 8 本へ増えない。
- [x] computation intent が不要な質問で `extract_policy_computations` を skip する。
- [x] 後段の answerability / sufficient context / citation validation / support verification は維持される。
- [x] 変更範囲に見合う検証が pass する、または未実施理由を記録する。
- [x] 作業レポートを `reports/working/` に保存する。
- [x] PR 作成後に受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿する。

## PR

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/271
- 受け入れ条件確認コメント: https://github.com/tsuji-tomonori/rag-assist/pull/271#issuecomment-4427411069
- セルフレビューコメント: https://github.com/tsuji-tomonori/rag-assist/pull/271#issuecomment-4427412119

## 検証結果

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/agent/nodes/node-units.test.ts src/agent/graph.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `git diff --check`: pass
- `pre-commit run --files ...`: pass
- local API + `chatrag-bench-v1` sample benchmark: pass
  - `turnAnswerCorrectRate=1`
  - `conversationSuccessRate=1`
  - `historyDependentAccuracy=1`
  - `retrievalRecallAtK=1`
  - `extract_policy_computations` 実行回数: 0
  - retrieval query count: turn1=1, turn2=3

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/agent/nodes/node-units.test.ts src/agent/graph.test.ts`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- local API + sample `chatrag-bench-v1` conversation benchmark
- `git diff --check`
- `pre-commit run --files ...`

## リスク

- computation skip 条件が広すぎると policy threshold QA の computed facts を落とす恐れがあるため、tool intent の既存判定に限定する。
- query expansion 制限が強すぎると multi-hop / complex 質問の recall を落とす恐れがあるため、short follow-up に限定する。
