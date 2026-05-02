# ADR-0001: Guard 付きサーバレス RAG パイプラインを採用する

- ファイル: `memorag-bedrock-mvp/docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_001.md`
- 種別: `ARC_ADR`
- 作成日: 2026-05-01
- 状態: Accepted

## Context

MemoRAG MVP は、文書登録から質問応答までを小規模検証しやすい構成で提供する必要がある。

同時に、RAG システムとして最も重要な品質は、根拠が不足する質問に推測で答えないことである。

OpenSearch 互換の検索基盤、Athena 直検索の通常 API 化、常時稼働サーバを初期から導入すると、MVP の焦点が回答品質と評価から運用基盤へ移る。

## Decision

初期構成は React UI、Hono API on Lambda、Amazon Bedrock、S3 Documents、S3 Vectors を中心としたサーバレス RAG とする。

検索パイプラインは memory/evidence search、RRF、answerability gate、citation validation を持つ guard 付き構成とする。

Athena は通常のオンライン全文検索 API ではなく、S3 上の chunk、postings、query log、benchmark data の分析、軽量 lexical index 生成、低頻度 fallback 検索に限定して使う。

benchmark/debug 系 API は、本番または社内検証環境では認可対象とする。

## Options

| 選択肢 | 評価 |
| --- | --- |
| Lambda + S3 Vectors + Bedrock | MVP の固定費と運用負荷を抑えつつ、RAG 品質評価へ集中できる。 |
| Lambda + S3 Vectors + Athena 補助分析 | 通常検索の低レイテンシを守りつつ、検索ログ分析、zero-hit 調査、index 生成を低コストに実行できる。 |
| ECS / RDS / OpenSearch | 汎用性は高いが、初期検証では運用負荷と設計面が増える。 |
| Athena 直検索を通常 API にする | 小規模 PoC では安いが、scan 型のため query 数とデータ量が増えると latency と cost が不安定になる。 |
| 単純 vector search のみ | 実装は軽いが、略語、仕様番号、エラーコード、根拠不足判定への対応が弱い。 |
| LLM に直接文書全体を渡す | 実装は単純だが、コスト、トークン制限、根拠管理、権限制御が難しい。 |

## Consequences

### Positive

- サーバレス構成により小規模検証の固定費を抑えられる。
- guard を分けることで、回答率より根拠性と不回答品質を優先できる。
- debug trace と benchmark を同一 API 面で扱い、評価と調査を接続できる。
- S3 Documents と S3 Vectors の責務を分け、source と検索 index を独立に管理できる。
- Athena を補助基盤にすることで、S3 data lake 上の検索ログと評価データを SQL で分析できる。
- Athena batch で lightweight lexical index の term stats や artifact を生成できる。

### Negative

- S3 Vectors と軽量 lexical retrieval に依存するため、高度な全文検索機能は制限される。
- Athena fallback を使う場合は scan 量、query result bucket、workgroup quota、ACL guard を追加管理する必要がある。
- answerability gate と citation validation の追加により、レイテンシと Bedrock コストが増える。
- debug trace の情報量が増えるため、認可、保持期間、マスキング方針を継続管理する必要がある。

## Related Requirements

- `FR-003`: 利用者は質問を入力して回答を受け取れること。
- `FR-004`: 回答には、根拠として使った文書箇所を表示できること。
- `FR-005`: 根拠が不足する場合は、回答できない旨を明示すること。
- `FR-014`: 回答生成前に answerability を判定すること。
- `FR-015`: 回答生成後に citation support を検証すること。
- `FR-018`: 複数検索結果を RRF で統合すること。
- `NFR-010`: benchmark/debug 系 API を認可対象とすること。
- `TC-001`: 初期検索基盤の技術境界。
- `TC-002`: Athena の検索基盤内での責務境界。
- `SQ-001`: RAG 品質の継続測定条件。

## Follow-up

- LLM judge のモデル選定を、回答生成モデルと分けるか評価する。
- RRF と answerability gate の計測値を benchmark summary に含める。
- Athena batch で生成する lexical index artifact の形式と更新頻度を決める。
- debug trace の本番保持期間とマスキング方針を運用文書へ反映する。
