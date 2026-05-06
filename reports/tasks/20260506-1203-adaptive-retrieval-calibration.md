# Adaptive Retrieval Calibration

保存先: `reports/tasks/20260506-1203-adaptive-retrieval-calibration.md`

## 背景

検索では `MIN_RETRIEVAL_SCORE=0.20`、`topK=10`、`lexicalTopK=80`、`semanticTopK=80`、RRF `k=60`、weights `[1, 0.9]`、BM25 `k1=1.2` / `b=0.75` などが固定されている。embedding model、corpus size、query type、lexical / semantic overlap により最適値は変わる。

## 目的

固定 threshold / topK から、score 分布と query / corpus 特性に応じた adaptive retrieval strategy へ移行する。

## 対象範囲

- `memorag-bedrock-mvp/apps/api/src/search/hybrid-search.ts`
- `memorag-bedrock-mvp/apps/api/src/config.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/graph.ts`
- `memorag-bedrock-mvp/benchmark/search-run.ts`
- `memorag-bedrock-mvp/benchmark/metrics/retrieval.ts`
- search tests / benchmark datasets

## 方針

- まず固定値を `RetrievalProfile` へ移す。
- 次に score distribution、top1-topN gap、lexical / semantic overlap、query complexity を diagnostics として記録する。
- adaptive strategy は profile option として導入し、default は既存互換にする。
- calibration は benchmark dataset で比較し、regression threshold を明示する。

## 必要情報

- 前提タスク: `reports/tasks/20260506-1203-rag-policy-profile.md`
- 関連 benchmark:
  - `memorag-bedrock-mvp/benchmark/datasets/search.sample.jsonl`
  - `memorag-bedrock-mvp/benchmark/search-run.ts`
- 現在の ranking logic は `hybrid-search.ts` の `rrfFuse` と `cheapRerank` にある。

## 実行計画

1. 現在の retrieval parameter と ranking bonus を profile に集約する。
2. search diagnostics に score distribution と overlap 指標を追加する。
3. adaptive topK / threshold の候補ロジックを profile option として実装する。
4. benchmark summary に profile と diagnostics を出す。
5. search benchmark dataset で既存 profile と adaptive profile を比較する。
6. regression threshold を満たす profile のみ default 候補にする。
7. docs に calibration 手順と rollback 方針を記載する。

## 受け入れ条件

- retrieval parameter が profile で管理されている。
- search diagnostics で adaptive 判断に必要な score / overlap 情報を確認できる。
- adaptive strategy は明示有効化でき、default 互換を壊さない。
- benchmark で existing profile と adaptive profile を比較できる。
- calibration 結果と採用判断が report または docs に残る。

## 検証計画

- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`
- `npm --prefix memorag-bedrock-mvp/apps/api test -- src/search/hybrid-search.test.ts`
- `task benchmark:sample`
- `git diff --check`

## 未決事項・リスク

- benchmark dataset が小さい場合、adaptive logic の採用判断が不安定になる。
- score 分布は vector backend により意味が変わる可能性がある。
- default 変更は false refusal / false answer の両方へ影響するため段階 rollout が必要。
