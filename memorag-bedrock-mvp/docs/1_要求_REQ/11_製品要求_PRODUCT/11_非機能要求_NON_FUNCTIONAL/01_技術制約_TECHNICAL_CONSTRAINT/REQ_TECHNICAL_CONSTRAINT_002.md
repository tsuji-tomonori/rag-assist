# 要件定義（1要件1ファイル）

- 要件ID: `TC-002`
- 種別: `REQ_TECHNICAL_CONSTRAINT`
- 状態: Draft
- 優先度: A

## 要件

- TC-002: Athena は通常のオンライン全文検索 API の主経路にせず、S3 上の chunk lake、検索ログ、評価データの分析、軽量 lexical index 生成、または低頻度 fallback 検索に限定して使うこと。

## 受け入れ条件（この要件専用）

- AC-TC002-001: 通常のチャット応答経路は Athena の `StartQueryExecution` 完了待ちに依存しないこと。
- AC-TC002-002: 通常検索は Lambda TypeScript 上の軽量 BM25 / n-gram / fuzzy index、S3 Vectors、RRF を組み合わせること。
- AC-TC002-003: Athena で raw chunk text に対する `LIKE` または `regexp_like` 検索を使う場合は、PoC、管理者調査、zero-hit fallback、低頻度検索のいずれかに限定すること。
- AC-TC002-004: Athena 検索を使う場合は tenant、source、date などの partition predicate、limit、workgroup、scan 量監視を設計に含めること。
- AC-TC002-005: Athena へ保存する chunk、postings、query log は Parquet または ORC などの columnar format と圧縮を優先すること。
- AC-TC002-006: postings table を作る場合は `term` を直接 partition key にせず、固定数の `term_bucket` を使うこと。
- AC-TC002-007: Lambda から Athena を呼ぶ場合はユーザー入力を SQL 文字列へ直接連結せず、`ExecutionParameters` などのパラメータ化を使うこと。

## 要件の源泉・背景

- 源泉: ユーザー提示の Athena 検索アーキテクチャ方針。
- 背景: Athena は S3 上のデータを SQL でスキャンする分析基盤であり、OpenSearch のような低レイテンシ転置 index 型検索エンジンではない。
- 背景: Athena の SQL query は scan 量に応じた従量課金であり、2026-05-02 時点の AWS 公式料金ではオンデマンド SQL query が `$5/TB scanned` と示されている。
- 背景: RAG の通常検索 API では p95 latency、同時実行、ACL、ranking の安定性が重要であり、毎回 S3 data lake を scan する方式は負荷増加時のリスクが高い。

## 要件の目的・意図

- 目的: Athena を検索基盤から排除するのではなく、適した責務に限定して低コストな評価・分析・index 生成基盤として使う。
- 意図: オンライン検索は Lambda + lightweight lexical index + S3 Vectors + RRF に寄せ、Athena は裏側の data lake analytics と fallback に寄せる。
- 区分: 技術制約。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `TC-002` |
| 説明 | Athena の検索基盤内での責務境界 |
| 根拠 | Athena は scan 型分析エンジンであり、通常の低レイテンシ全文検索 API に向かないため |
| 源泉 | ユーザー提示方針、AWS 公式ドキュメント |
| 種類 | 技術制約 |
| 依存関係 | `TC-001`, S3 document lake, S3 Vectors, Lambda runtime, query log / benchmark data |
| 衝突 | OpenSearch を導入しないまま大規模・高QPSの全文検索 UI を作る要求とは衝突し得る |
| 受け入れ基準 | `AC-TC002-001` から `AC-TC002-007` |
| 優先度 | A |
| 安定性 | Medium |
| 変更履歴 | 2026-05-02 初版 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | Athena 直検索を本番主経路にしない境界を明確化する |
| 十分性 | OK | 通常検索、fallback、batch、data format、SQL parameterization を含む |
| 理解容易性 | OK | Athena の責務を online と offline で分けている |
| 一貫性 | OK | `TC-001` の Lambda + S3 Vectors + lightweight retriever 方針と整合 |
| 標準・契約適合 | OK | AWS の Athena / S3 Vectors 利用形態と矛盾しない |
| 実現可能性 | OK | 現行の検索 API 設計を前提に、Athena は後続 batch / fallback として追加できる |
| 検証可能性 | OK | API 経路、設計書、infra、ログ処理、query 実装で確認可能 |
| ニーズ適合 | OK | 低コスト RAG と検索品質改善の両立に合う |

## 参考

- Amazon Athena pricing: https://aws.amazon.com/athena/pricing/
- Amazon Athena `StartQueryExecution`: https://docs.aws.amazon.com/athena/latest/APIReference/API_StartQueryExecution.html
- Amazon Athena data optimization: https://docs.aws.amazon.com/athena/latest/ug/performance-tuning-data-optimization-techniques.html
- Amazon Athena columnar storage: https://docs.aws.amazon.com/athena/latest/ug/columnar-storage.html
- Amazon S3 Vectors query: https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-query.html
