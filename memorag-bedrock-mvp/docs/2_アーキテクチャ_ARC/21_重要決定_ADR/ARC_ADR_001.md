# ADR-0001: Guard 付きサーバレス RAG パイプラインを採用する

- ファイル: `memorag-bedrock-mvp/docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_001.md`
- 種別: `ARC_ADR`
- 作成日: 2026-05-01
- 状態: Accepted

## Context

MemoRAG MVP は、文書登録から質問応答までを小規模検証しやすい構成で提供する必要がある。

同時に、RAG システムとして最も重要な品質は、根拠が不足する質問に推測で答えないことである。

OpenSearch 互換の検索基盤や常時稼働サーバを初期から導入すると、MVP の焦点が回答品質と評価から運用基盤へ移る。

## Decision

初期構成は React UI、Hono API on Lambda、Amazon Bedrock、S3 Documents、S3 Vectors を中心としたサーバレス RAG とする。

検索パイプラインは memory search、軽量 lexical retrieval、S3 Vectors semantic search、RRF、answerability gate、citation validation を持つ guard 付き構成とする。

benchmark/debug 系 API は、本番または社内検証環境では認可対象とする。

## Options

| 選択肢 | 評価 |
| --- | --- |
| Lambda + 軽量 lexical retrieval + S3 Vectors + Bedrock | MVP の固定費と運用負荷を抑えつつ、全文検索と意味検索の両方を RAG 品質評価へ接続できる。 |
| ECS / RDS / OpenSearch | 汎用性は高いが、初期検証では運用負荷と設計面が増える。 |
| 単純 vector search のみ | 実装は軽いが、略語、仕様番号、エラーコード、根拠不足判定への対応が弱い。 |
| Athena 直接検索 | S3 上の文書や検索ログ分析には向くが、通常チャットの低 latency 検索 API には向きにくい。 |
| LLM に直接文書全体を渡す | 実装は単純だが、コスト、トークン制限、根拠管理、権限制御が難しい。 |

## Consequences

### Positive

- サーバレス構成により小規模検証の固定費を抑えられる。
- guard を分けることで、回答率より根拠性と不回答品質を優先できる。
- debug trace と benchmark を同一 API 面で扱い、評価と調査を接続できる。
- S3 Documents と S3 Vectors の責務を分け、source と検索 index を独立に管理できる。

### Negative

- S3 Vectors と軽量 lexical retrieval に依存するため、高度な全文検索機能は制限される。
- answerability gate と citation validation の追加により、レイテンシと Bedrock コストが増える。
- debug trace の情報量が増えるため、認可、保持期間、マスキング方針を継続管理する必要がある。

## Related Requirements

- `FR-003`: 利用者は質問を入力して回答を受け取れること。
- `FR-004`: 回答には、根拠として使った文書箇所を表示できること。
- `FR-005`: 根拠が不足する場合は、回答できない旨を明示すること。
- `FR-014`: 回答生成前に answerability を判定すること。
- `FR-015`: 回答生成後に citation support を検証すること。
- `FR-018`: 複数検索結果を RRF で統合すること。
- `FR-023`: 検索 alias を versioned artifact として管理すること。
- `FR-026`: 通常チャット回答経路で hybrid retriever を使用すること。
- `NFR-010`: benchmark/debug 系 API を認可対象とすること。
- `NFR-012`: 通常検索 response で alias/ACL metadata を漏えいしないこと。
- `TC-001`: 初期検索基盤の技術境界。
- `SQ-001`: RAG 品質の継続測定条件。

## Follow-up

- LLM judge のモデル選定を、回答生成モデルと分けるか評価する。
- RRF と answerability gate の計測値を benchmark summary に含める。
- debug trace の本番保持期間とマスキング方針を運用文書へ反映する。
