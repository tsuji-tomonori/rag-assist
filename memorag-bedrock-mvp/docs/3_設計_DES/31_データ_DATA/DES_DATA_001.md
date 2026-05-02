# MemoRAG MVP データ設計

- ファイル: `memorag-bedrock-mvp/docs/3_設計_DES/31_データ_DATA/DES_DATA_001.md`
- 種別: `DES_DATA`
- 作成日: 2026-05-01
- 状態: Draft

## 何を書く場所か

RAG workflow、文書管理、検索、引用、評価、debug trace で扱う主要データを定義する。

## データモデル

### Document

| 項目 | 内容 |
| --- | --- |
| `documentId` | 文書識別子 |
| `fileName` | 登録時のファイル名 |
| `sourceUri` | S3 またはローカル保存先 |
| `createdAt` | 登録日時 |
| `metadata` | 任意メタデータ |

### EvidenceChunk

| 項目 | 内容 |
| --- | --- |
| `chunkId` | chunk 識別子 |
| `documentId` | 親文書 |
| `text` | 根拠候補本文 |
| `sectionPath` | 見出し階層 |
| `tokenCount` | token 概算 |
| `embeddingId` | vector record 識別子 |

### MemoryRecord

| 項目 | 内容 |
| --- | --- |
| `memoryId` | memory record 識別子 |
| `documentId` | 親文書 |
| `level` | `chunk` / `section` / `document` / `concept` |
| `summary` | 検索補助用の要約または概念 |
| `sourceChunkIds` | 原典 raw chunk への参照 |

### RetrievalResult

| 項目 | 内容 |
| --- | --- |
| `queryId` | 質問実行識別子 |
| `chunkId` | evidence chunk |
| `rank` | 統合後順位 |
| `vectorScore` | vector search score |
| `lexicalScore` | lexical search score |
| `rrfScore` | rank fusion score |
| `sourceQuery` | 検索に使った clue または query |

### GeneratedAnswer

| 項目 | 内容 |
| --- | --- |
| `queryId` | 質問実行識別子 |
| `answer` | 回答本文 |
| `answerability` | `ANSWERABLE` / `PARTIAL` / `UNANSWERABLE` |
| `citations` | citation 配列 |
| `modelId` | 回答生成モデル |
| `promptVersion` | prompt template version |

### ConversationHistoryItem

| 項目 | 内容 |
| --- | --- |
| `schemaVersion` | 会話履歴 item のスキーマバージョン。現行は `1` |
| `id` | 会話識別子 |
| `title` | 履歴一覧に表示する会話タイトル |
| `updatedAt` | 最終更新日時 |
| `messages` | user/assistant message の配列 |

### ConversationMessage

| 項目 | 内容 |
| --- | --- |
| `role` | `user` または `assistant` |
| `text` | 表示する発話本文 |
| `createdAt` | 発話作成日時 |
| `sourceQuestion` | assistant message が回答した元質問 |
| `result` | 回答結果、citation、debug trace への参照情報 |
| `questionTicket` | 担当者質問に紐づく場合の ticket snapshot |

### HumanQuestion

| 項目 | 内容 |
| --- | --- |
| `questionId` | 問い合わせ識別子 |
| `title` | 問い合わせ一覧に表示するタイトル |
| `question` | 担当者へ確認したい質問本文 |
| `requesterName` | 依頼者名 |
| `requesterDepartment` | 依頼者部署 |
| `assigneeDepartment` | 担当部署 |
| `category` | 問い合わせ分類 |
| `priority` | `normal` / `high` / `urgent` |
| `status` | `open` / `answered` / `resolved` |
| `sourceQuestion` | RAG に入力した元質問 |
| `chatAnswer` | エスカレーション元の RAG 回答または回答不能理由 |
| `chatRunId` | 関連 debug trace の runId |
| `answerTitle` | 担当者回答タイトル |
| `answerBody` | 担当者回答本文 |
| `responderName` | 回答者名 |
| `responderDepartment` | 回答者部署 |
| `internalMemo` | 担当者向け内部メモ |
| `notifyRequester` | 依頼者通知の希望フラグ |
| `createdAt` / `updatedAt` | 作成・更新日時 |
| `answeredAt` / `resolvedAt` | 回答・解決日時 |

### RolePermission

| 項目 | 内容 |
| --- | --- |
| `role` | Cognito group 名。例: `CHAT_USER`, `ANSWER_EDITOR`, `SYSTEM_ADMIN` |
| `permissions` | API 側で評価する permission の配列 |
| `source` | Cognito ID token の `cognito:groups` |
| `enforcedBy` | API の `requirePermission` |

### EvaluationResult

| 項目 | 内容 |
| --- | --- |
| `id` | 評価ケース識別子。benchmark dataset の `id` に対応 |
| `queryId` | 実行識別子 |
| `factCoverage` | 期待 fact の網羅率 |
| `faithfulness` | 根拠忠実性 |
| `contextRelevance` | 検索文脈の関連度 |
| `refusalCorrectness` | 不回答判定の正しさ |

### UsageMeter

| 項目 | 内容 |
| --- | --- |
| `schemaVersion` | `1`。将来 schema 変更時の判別用 |
| `periodStart` | 集計期間の開始 |
| `periodEnd` | 集計期間の終了 |
| `service` | `bedrock` / `s3_vectors` / `dynamodb` / `lambda` / `s3` など |
| `component` | `chat`, `ingest`, `debug_trace`, `conversation_history`, `benchmark` など |
| `unit` | `input_token`, `output_token`, `embedding_token`, `logical_gb_month`, `read_request_unit`, `write_request_unit`, `gb_second`, `request` など |
| `quantity` | 集計済み利用量 |
| `source` | `debug_trace`, `manifest`, `cloudwatch_metric`, `dynamodb_table_metric`, `manual_estimate` など |

### PricingCatalogEntry

| 項目 | 内容 |
| --- | --- |
| `schemaVersion` | `1`。将来 schema 変更時の判別用 |
| `provider` | `aws` |
| `service` | 対象 AWS service |
| `region` | 単価を適用する AWS region |
| `modelId` | Bedrock model の場合の model ID |
| `unit` | `UsageMeter.unit` と対応する単価単位 |
| `pricingUnitQuantity` | 単価が適用される数量。例: `1000000` tokens、`1` GB-month、`1000000` requests |
| `unitPriceUsd` | 単価。設計書に固定せず、公式料金表または AWS Pricing Calculator から更新する |
| `effectiveDate` | 単価確認日または適用開始日 |
| `sourceUrl` | 参照した公式料金表 URL |

### CostEstimate

| 項目 | 内容 |
| --- | --- |
| `schemaVersion` | `1`。将来 schema 変更時の判別用 |
| `periodStart` | 算出期間の開始 |
| `periodEnd` | 算出期間の終了 |
| `service` | 対象 AWS service |
| `component` | 対象機能 |
| `currency` | `USD` を基本とする |
| `estimatedAmount` | `quantity * unitPrice` の合計 |
| `formulaVersion` | 算出式の version |
| `pricingCatalogVersion` | 単価表の version または確認日 |
| `confidence` | `actual_usage` / `estimated_usage` / `manual_estimate` |

## 料金算出モデル

### 原則

- 設計書には固定単価を埋め込まず、料金算出時点の AWS 公式料金表または AWS Pricing Calculator の単価を `PricingCatalogEntry` として保持する。
- Amazon Bedrock は model、region、tier によって単価が変わるため、`modelId` と `region` を必須の単価キーとする。
- debug trace の `tokenCount` は現状では実装上の概算であり、AWS 請求と一致する Bedrock usage metadata ではない。
- 請求精度が必要な場合は、Bedrock 応答の usage 情報、CloudWatch metrics、または Cost and Usage Report を正とする。
- `UsageMeter`、`PricingCatalogEntry`、`CostEstimate` は `schemaVersion` を持ち、料金算出式の変更とは別に item schema の互換性を判別する。

### 算出式

| 対象 | 算出式 |
| --- | --- |
| Bedrock text generation | `inputTokens / inputPricingUnitQuantity * inputTokenRate + outputTokens / outputPricingUnitQuantity * outputTokenRate` |
| Bedrock embeddings | `embeddingInputTokens / pricingUnitQuantity * embeddingTokenRate` |
| S3 Vectors storage | `logicalVectorGbMonths * storageRate` |
| S3 Vectors PUT | `logicalUploadedGb * putRate` |
| S3 Vectors query | `queryApiCount / queryApiPricingUnitQuantity * queryApiRate + processedTb * queryDataRate` |
| DynamoDB on-demand | `readRequestUnits / readPricingUnitQuantity * readRate + writeRequestUnits / writePricingUnitQuantity * writeRate + storageGbMonths * storageRate + pitrGbMonths * pitrRate` |
| Lambda | `requestCount / requestPricingUnitQuantity * requestRate + gbSeconds * durationRate` |
| S3 object storage | `storageGbMonths * storageRate + requestCount / requestPricingUnitQuantity * requestRate + dataTransferGb * transferRate` |

### 単価参照元

| Service | `sourceUrl` の参照先 |
| --- | --- |
| Amazon Bedrock | `https://aws.amazon.com/bedrock/pricing/` |
| Amazon S3 / S3 Vectors | `https://aws.amazon.com/s3/pricing/` |
| Amazon DynamoDB | `https://aws.amazon.com/dynamodb/pricing/` |
| AWS Lambda | `https://aws.amazon.com/lambda/pricing/` |

### 現行 MVP での扱い

- 現行 MVP は `CostEstimate` を API response として返さない。
- 現行 MVP の費用確認は AWS Billing / Cost Explorer / Cost and Usage Report を正とする。
- 設計上の料金算出は `NFR-009` のための将来拡張点であり、実装時は `UsageMeter` と `PricingCatalogEntry` を追加する。

## 保持と保護

- source と manifest は文書削除時に削除対象とする。
- debug trace は `NFR-006` に従い、調査用ログとして 1 週間保持を基本とする。
- conversation history は userId 単位で分離し、schemaVersion により将来のスキーマ変更時に item の解釈を分岐できるようにする。
- human question は担当者対応の業務データであり、一覧・回答・解決は `answer:edit` 権限で扱う。
- Web UI の Cognito group は機能表示と不要な事前取得の抑制に使い、最終的な認可判断は API 側で行う。
- cost estimate は AWS 請求明細そのものではないため、金額の表示時は `estimated` であることと単価確認日を併記する。
- benchmark/debug 系 API の参照データは `NFR-010` に従い認可対象とする。
- memory record の高抽象度要約は検索補助であり、最終回答の引用根拠には使わない。

## 関連要求

- `FR-002`, `FR-004`, `FR-010`, `FR-015`, `FR-019`, `FR-020`, `FR-021`, `FR-022`
- `NFR-004`, `NFR-005`, `NFR-006`, `NFR-010`, `NFR-011`
