# ADR-0002: 高度検索は評価 gate 通過後に導入する

- ファイル: `memorag-bedrock-mvp/docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_002.md`
- 種別: `ARC_ADR`
- 作成日: 2026-05-07
- 状態: Proposed

## Context

MemoRAG MVP は BM25、CJK n-gram、prefix、ASCII fuzzy、alias expansion、S3 Vectors semantic search、RRF、ACL guard、answerability gate、citation validation を持つ。

GraphRAG、RAPTOR、visual retrieval、cross-encoder reranker、HyDE、OpenSearch / FTS index は検索品質改善の候補だが、先行導入すると運用負荷、cost、latency、評価不能性が増える。

検索 miss の原因には、retrieval technology で直すべきものだけでなく、ingestion、structured chunking、alias / glossary、評価 dataset の不足で直すべきものがある。

## Decision

現行 hybrid retrieval を baseline とし、高度検索技術は benchmark と ablation の gate を満たした場合だけ導入候補にする。

default path へ追加する前に、対象 failure taxonomy、比較 baseline、成功条件、rollback 条件、latency / cost budget、ACL / answerability / citation support への影響を PR と運用 docs に残す。

評価なしに GraphRAG、RAPTOR、visual retrieval、cross-encoder reranker、HyDE、OpenSearch / FTS index を default path へ入れない。

## Options

| 選択肢 | 評価 |
| --- | --- |
| 現行 hybrid retrieval を baseline とし、ablation gate 後に導入 | 採用。説明可能性、cost、rollback 性を保ちながら品質改善を測れる。 |
| OpenSearch / reranker / GraphRAG を先行導入 | 不採用。原因分類なしでは運用負荷と latency が増え、改善根拠も不明瞭になる。 |
| retrieval 技術追加を全面禁止 | 不採用。baseline で解けない症状が実測された場合の改善余地を閉じすぎる。 |
| ingestion / structured chunking だけを優先 | 部分採用。表、スキャン PDF、missing evidence は retrieval ではなく ingestion 側の gate で扱う。 |

## Gate

| 症状 | 先に見る指標 | 優先候補 | 導入しない条件 |
| --- | --- | --- | --- |
| 規程番号、品番、略語、固有名詞で落ちる | `Recall@20`、alias candidate、token coverage | alias / glossary、tokenizer、BM25 / n-gram weight | alias scope violation または no-access leak が出る |
| 意味的言い換えで落ちる | `Recall@20`、semantic hit、query rewrite contribution | embedding model、query expansion、HyDE | refusal precision または unsupported sentence rate が悪化する |
| 正解は上位 20 件にあるが順位が悪い | `MRR@10`、citation hit、finalEvidence hit | cheap rerank 調整、cross-encoder / LLM rerank | p95 latency / model cost budget を超える |
| 表、スキャン PDF、ページ抽出で根拠がない | extraction failure、chunk failure、expected page hit | OCR、structured block ingestion、table-aware chunking | raw evidence が存在しないまま検索技術で補おうとしている |
| 複数文書統合で落ちる | multi-doc category、fact slot coverage、citation support | memory card、RAPTOR、GraphRAG | final answer が raw evidence に戻れない |
| query 量や index size で latency が悪化する | p95 latency、index size、Lambda memory、cold start | immutable index、SQLite FTS5 / EFS、OpenSearch | ACL guard、rollback、cost 監視が未定義 |

## Consequences

### Positive

- 技術導入の判断を benchmark evidence と failure taxonomy に結び付けられる。
- `structured chunking` や OCR で直すべき失敗を retrieval technology で隠しにくくなる。
- ACL guard、answerability gate、citation validation、support verification を品質 gate に含められる。

### Negative

- 高度検索の spike 前に baseline / ablation の準備が必要になる。
- latency、cost、index size の計測が不十分な環境では導入判断が遅れる。
- GraphRAG / RAPTOR のような multi-hop 技術は、raw evidence へのトレース設計が整うまで採用しづらい。

## Related Requirements

- `FR-012`: baseline evaluation set と RAG 評価指標。
- `FR-018`: 複数検索結果を RRF で統合すること。
- `FR-020`: 多抽象度メモリ生成。
- `FR-023`: 検索 alias を versioned artifact として管理すること。
- `FR-026`: 通常チャット回答経路で hybrid retriever を使用すること。
- `TC-001`: 初期検索基盤の技術境界。
- `SQ-001`: RAG 品質の継続測定条件。

## Review Conditions

- baseline dataset が answerable / unanswerable / ambiguous / table / multi-doc / ACL を含み、現行 hybrid retrieval の summary が保存されている。
- ablation で `vector`、`BM25`、`CJK n-gram`、`alias`、`RRF`、`query rewrite`、`reranker`、`structured chunking` の寄与または非該当理由を比較できる。
- no-access leak は 0 を必須 gate とし、悪化時は採用しない。
- answerability / citation support / refusal precision / unsupported sentence rate が悪化する場合は採用しない。
- p95 latency、model cost、index size、rollback 手順が運用 docs に残っている。
