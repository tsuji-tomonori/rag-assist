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
- score 判断は absolute score ではなく、backend 差分に強い relative rank、gap、overlap、coverage を主指標にする。
- adaptive strategy の default 化は行わず、v1 は明示 opt-in とする。
- default 候補にする条件は、少なくとも回答可能 20 件、不回答 10 件以上を含む benchmark suite で、answerable accuracy、refusal precision、unsupported rate、citation hit rate、retrieval recall、p95 latency の劣化が許容閾値内であることとする。
- calibration は benchmark dataset で比較し、regression threshold と rollback 方針を明示する。

## 必要情報

- 前提タスク: `reports/tasks/20260506-1203-rag-policy-profile.md`
- 関連 benchmark:
  - `memorag-bedrock-mvp/benchmark/datasets/search.sample.jsonl`
  - `memorag-bedrock-mvp/benchmark/search-run.ts`
- 現在の ranking logic は `hybrid-search.ts` の `rrfFuse` と `cheapRerank` にある。
- 関連要求・設計:
  - `FR-016`, `FR-017`, `FR-018`, `FR-019`, `FR-026`
  - `SQ-001`, `NFR-012`, `TC-001`
  - `ASR-RETRIEVAL-001`, `ASR-EVAL-001`, `ASR-SEC-*`

## 実行計画

1. 現在の retrieval parameter と ranking bonus を profile に集約する。
2. search diagnostics に score distribution と overlap 指標を追加する。
3. adaptive topK / threshold の候補ロジックを profile option として実装する。
4. benchmark summary に profile と diagnostics を出す。
5. search benchmark dataset で既存 profile と adaptive profile を比較する。
6. regression threshold を満たす profile のみ default 候補にする。
7. false answer、false refusal、unsupported citation、latency の悪化を比較する。
8. docs に calibration 手順と rollback 方針を記載する。

## 受け入れ条件

- retrieval parameter が profile で管理されている。
- search diagnostics で adaptive 判断に必要な score / overlap 情報を確認できる。
- adaptive strategy は明示有効化でき、default 互換を壊さない。
- benchmark で existing profile と adaptive profile を比較できる。
- calibration 結果と採用判断が report または docs に残る。
- default 化しない場合でも、opt-in profile の有効化方法と rollback 方法が docs / PR 本文に書かれている。
- diagnostics に alias / ACL metadata / internal project code が含まれない。
- retrieval 変更が通常 `/chat` と benchmark path の両方で同じ RAG 経路に反映されている。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/api -- src/search/hybrid-search.test.ts`
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/api`
- benchmark metrics / dataset を変更する場合:
  - `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`
  - `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/benchmark`
- `task benchmark:sample`
- `git diff --check`

## PRレビュー観点

- semver は、明示 opt-in の adaptive profile 追加なら `minor`、既存 default の内部 diagnostics 追加だけなら `patch` を推奨する。
- PR 本文に改善したい metric、dataset 規模、比較結果、未確認 benchmark、rollback 方針を書く。
- lexical / semantic / RRF の変更が recall と precision の両面で評価されているか確認する。
- retrieval score threshold の変更が benchmark で検証され、false refusal / false answer の両方を見ているか確認する。
- debug trace と benchmark summary に score / overlap / decision reason があり、原因調査できるか確認する。
- diagnostics が alias 定義、ACL metadata、許可 user list、内部 project code を漏らしていないか確認する。

## 未決事項・リスク

- 未決事項なし。
- 決定事項: v1 の adaptive strategy は明示 opt-in とし、default は既存互換のままにする。
- 決定事項: score 判断は absolute score ではなく relative rank、top gap、lexical / semantic overlap、coverage を主に使う。
- 決定事項: default 候補化は、回答可能 20 件、不回答 10 件以上を含む benchmark suite で主要 metric と p95 latency の劣化が許容閾値内である場合に限定する。
- リスク: dataset が基準未満の場合は default 化せず、結果は参考値として扱う。
