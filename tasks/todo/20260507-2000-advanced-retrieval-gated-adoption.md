# 高度検索技術の評価駆動導入 gate

保存先: `tasks/todo/20260507-2000-advanced-retrieval-gated-adoption.md`

## 状態

- todo

## 背景

rag-assist は BM25、CJK n-gram、prefix、fuzzy、alias expansion、semantic search、RRF、ACL guard を持つ設計であり、最初から OpenSearch、GraphRAG、ColBERT、reranker、visual retrieval へ移行する必要は薄い。高度検索は魅力的だが、導入条件を benchmark で明確にしないと運用負荷、cost、latency、評価不能性だけが増える。

## 目的

GraphRAG、RAPTOR、visual retrieval、cross-encoder reranker、HyDE、OpenSearch / FTS 系 index を、症状と評価指標に基づいて導入判断する gate を定義する。

## 対象範囲

- retrieval evaluator profile
- benchmark / search benchmark report
- hybrid retrieval config
- query expansion / rerank / GraphRAG / visual retrieval の candidate design
- architecture / ADR / operations docs

## 方針

- 現行 hybrid retrieval を baseline とし、ablation で `vector`、`BM25`、`CJK n-gram`、`alias`、`RRF`、`query rewrite`、`reranker`、`structured chunking` の寄与を測る。
- 症状別に導入候補を分ける。
- exact keyword、規程番号、品番、略語で落ちる場合は alias / glossary / tokenizer を優先する。
- 意味的言い換えで落ちる場合は embedding model、query expansion、HyDE を検討する。
- Recall@20 に正解があるが順位が悪い場合は cross-encoder / LLM rerank を検討する。
- 表やスキャン PDF で根拠が存在しない場合は検索ではなく ingestion を直す。
- 複数文書統合で落ちる場合のみ memory card、RAPTOR、GraphRAG を検討する。
- latency / index size / ops cost が gate を超える場合は導入しない。

## 必要情報

- 関連 task: `tasks/todo/20260507-2000-rag-baseline-evaluation-set.md`
- 関連 task: `tasks/todo/20260507-2000-document-block-ingestion-v2.md`
- 既存 task: `tasks/todo/20260506-1203-adaptive-retrieval-calibration.md`
- 既存 task: `tasks/todo/20260506-1203-rag-policy-profile.md`
- 既存 ADR: 初期はサーバレス RAG を採用し、OpenSearch 等は初期検証では運用負荷が増えるため避ける判断。

## 実行計画

1. 現行 hybrid retrieval の benchmark 指標を baseline として保存する。
2. failure taxonomy を exact keyword、semantic paraphrase、ranking、missing evidence、multi-doc reasoning、latency / scale に分類する。
3. ablation runner または suite config を追加する。
4. 各高度検索候補の導入条件、成功条件、rollback 条件、cost / latency budget を docs に定義する。
5. 候補技術ごとに spike task または ADR を作成する条件を明文化する。
6. benchmark gate を満たした候補のみ実装 task 化する。

## ドキュメントメンテナンス計画

- 要求仕様: retrieval quality、latency、cost、回答不能制御、権限境界に関係する `FR-*`、`SQ-*`、`NFR-*`、`TC-*` を確認する。
- architecture / ADR: GraphRAG、RAPTOR、reranker、visual retrieval、OpenSearch / FTS を採用または非採用にする場合は ADR を追加または更新する。
- operations: new index / service / model provider を導入する場合は cost、IAM、rollback、monitoring、failure mode を追記する。
- benchmark docs: ablation 比較の実行方法、report の読み方、導入判定を追記する。
- PR 本文: 追加技術の導入根拠、baseline 比較、未実施検証を明記する。

## 受け入れ条件

- 高度検索候補ごとの導入条件が benchmark 指標で定義されている。
- hybrid retrieval baseline と ablation 結果を比較できる。
- `structured chunking` で解くべき失敗と retrieval technology で解くべき失敗が分類されている。
- Recall@20、MRR、citation support、refusal、latency、cost の少なくとも該当指標で採否を判断できる。
- GraphRAG / RAPTOR / visual retrieval / reranker / HyDE / OpenSearch 等を、評価なしに先行導入しないルールが docs または task に残る。
- ACL guard と answerability / citation validation を弱めないことが gate に含まれる。

## 検証計画

- search benchmark suite
- `task benchmark:search:sample`
- `task benchmark:sample`
- retrieval / rerank / query expansion tests
- ADR / docs 変更時: docs check
- `git diff --check`

## PRレビュー観点

- `blocking`: 高度検索導入が ACL guard、answerability gate、citation validation、support verification を bypass していないこと。
- `blocking`: benchmark evidence なしに OpenSearch、GraphRAG、visual retrieval などの運用負荷が高い技術を default path に入れていないこと。
- `should fix`: ablation 結果と導入判断が PR 本文に残っていること。
- `should fix`: latency、cost、index size、rollback の運用影響が docs にあること。
- `question`: failure taxonomy 上、対象問題は ingestion で直すべきではないか。

## 未決事項・リスク

- 決定事項: 高度検索は Phase 4 とし、Phase 0 から Phase 3 の評価・ingestion・assistant・HITL が先行する。
- 決定事項: 現行 hybrid retrieval を baseline とし、追加機能は ablation で効果を確認する。
- 実装時確認: 実 corpus の規模、query 分布、AWS cost、外部 model 利用制約。
- リスク: 高度検索の導入により debug trace と benchmark の説明可能性が下がる可能性がある。
