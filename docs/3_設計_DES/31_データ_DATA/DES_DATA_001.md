# MemoRAG MVP データ設計

- ファイル: `docs/3_設計_DES/31_データ_DATA/DES_DATA_001.md`
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

`metadata.scopeType` は `personal`、`group`、`chat`、`benchmark` のいずれかを取り、永続文書、資料グループ、一時添付、評価 corpus の境界を表す。`metadata.groupIds` は資料グループ所属、`metadata.ownerUserId` は所有者、`metadata.temporaryScopeId` はチャット内一時添付の参照 ID、`metadata.expiresAt` は一時添付などの有効期限を表す。

### DocumentGroup

| 項目 | 内容 |
| --- | --- |
| `groupId` | 資料グループ識別子 |
| `name` | UI に表示する資料グループ名 |
| `description` | 任意説明 |
| `ownerUserId` | グループ所有者 |
| `visibility` | `private` または `org` |
| `sharedUserIds` | 参照を許可する userId または email |
| `sharedGroups` | 参照を許可する Cognito group |
| `managerUserIds` | 共有設定とグループ文書追加を管理できる userId |
| `createdAt` / `updatedAt` | 作成・更新日時 |

`DocumentGroup` は `document-groups/groups.json` に永続化する。グループ文書は `Document.metadata.groupIds` で所属を保持し、検索前に `DocumentGroup` の共有設定と文書 metadata の ACL を両方確認する。

### SearchScope

| 項目 | 内容 |
| --- | --- |
| `mode` | `all`、`groups`、`documents`、`temporary` |
| `groupIds` | `mode=groups` の対象資料グループ |
| `documentIds` | `mode=documents` の対象文書 |
| `includeTemporary` | チャット内一時添付を通常スコープへ合成するか |
| `temporaryScopeId` | チャット内一時添付を識別する会話 ID |

`SearchScope` は `/chat`、`/chat-runs`、`/search` の検索境界として扱う。`mode=groups` でも `includeTemporary=true` と `temporaryScopeId` が指定された場合は、指定グループの資料と同一チャットの一時添付だけを検索対象に含める。

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
| `crossQueryRrfScore` | 複数 clue / query の result list を順位融合した score |
| `crossQueryRank` | cross-query RRF 後の順位 |
| `sourceQuery` | 検索に使った clue または query |
| `expansionSource` | `hybrid` または `context_window` |

### SearchDiagnostics

| 項目 | 内容 |
| --- | --- |
| `indexVersion` | 検索に使った lexical index の opaque version。document ID や alias 本文を含めない |
| `aliasVersion` | 検索に使った alias set の opaque version。alias がない場合は `none` |
| `queryCount` | hybrid retrieval に渡した query 数 |
| `lexicalCount` | lexical retrieval の候補件数 |
| `semanticCount` | semantic retrieval の候補件数 |
| `fusedCount` | RRF 後の候補件数 |
| `sourceCounts` | `lexical`、`semantic`、`hybrid` など retrieval source 別の候補件数 |
| `latencyMs` | 検索処理時間 |
| `profileId` / `profileVersion` | retrieval profile の識別子 |
| `topGap` | top1 と top2 の score gap |
| `lexicalSemanticOverlap` | lexical / semantic 候補 ID の overlap ratio |
| `scoreDistribution` | top、median、p90、min、max の score summary |
| `adaptiveDecision` | adaptive strategy の理由、effectiveTopK、effectiveMinScore |

### RetrievalDiagnostics

| 項目 | 内容 |
| --- | --- |
| `queryCount` | chat orchestration の `search_evidence` が実行した query 数 |
| `indexVersions` | chat orchestration search step 内で使った lexical index の opaque version 配列 |
| `aliasVersions` | chat orchestration search step 内で使った alias set の opaque version 配列 |
| `lexicalCount` | chat orchestration search step 全体の lexical 候補件数 |
| `semanticCount` | chat orchestration search step 全体の semantic 候補件数 |
| `fusedCount` | chat orchestration search step 全体の fused 候補件数 |
| `sourceCounts` | retrieval source 別の dedupe 後件数 |
| `profileId` / `profileVersion` | search step で使った retrieval profile |
| `topGap` / `lexicalSemanticOverlap` | query 群の retrieval diagnostics summary |

### AliasDefinition

| 項目 | 内容 |
| --- | --- |
| `schemaVersion` | alias artifact schema version |
| `aliasId` | alias 識別子 |
| `from` | query 側の語句 |
| `to` | expansion 先語句 |
| `type` | `oneWay` / `equivalent` / `typo` / `placeholder` |
| `weight` | lexical expansion の重み |
| `scope` | `tenantId`、`source`、`docType`、`aclGroups`、`allowedUsers` などの適用境界 |
| `status` | `draft` / `active` / `disabled` / `rejected` |
| `source` | `manual` / `analytics` / `llmSuggestion` などの生成源 |
| `reason` | alias を追加する理由 |
| `createdBy` / `reviewedBy` | 作成者と reviewer |
| `version` | alias set version |
| `createdAt` / `reviewedAt` | 作成・review 日時 |

### IndexManifest

| 項目 | 内容 |
| --- | --- |
| `schemaVersion` | manifest schema version |
| `tenantId` / `source` / `docType` | index scope |
| `corpusVersion` | index が対象にした corpus version |
| `aliasVersion` | compile 済み alias version |
| `indexVersion` | lexical index version |
| `aliasObjectKey` | alias artifact の object key |
| `lexicalIndexObjectKey` | lexical index artifact の object key |
| `createdAt` / `createdBy` | manifest 作成情報 |

### GeneratedAnswer

| 項目 | 内容 |
| --- | --- |
| `queryId` | 質問実行識別子 |
| `answer` | 回答本文 |
| `answerability` | `ANSWERABLE` / `PARTIAL` / `UNANSWERABLE` |
| `citations` | citation 配列 |
| `modelId` | 回答生成モデル |
| `promptVersion` | prompt template version |

### PipelineVersions

| 項目 | 内容 |
| --- | --- |
| `chatOrchestrationWorkflowVersion` | chat RAG state machine の canonical version。値は互換性のため現行 `qa-agent-v2` を維持する |
| `agentWorkflowVersion` | 旧 field。`chatOrchestrationWorkflowVersion` と同じ値を返す互換 field |
| `chunkerVersion` | chunking 実装の version |
| `sourceExtractorVersion` | source text 抽出実装の version |
| `memoryPromptVersion` | memory card prompt の version |
| `promptVersion` | final answer / judge 系 prompt set の version |
| `indexVersion` | hybrid lexical/vector retrieval runtime の version |
| `embeddingModelId` | embedding model ID |
| `embeddingDimensions` | embedding vector dimensions |

`DocumentManifest` は取り込み時点の `PipelineVersions` と、互換性のための top-level `embeddingModelId`、`embeddingDimensions`、`chunkerVersion`、`sourceExtractorVersion`、`memoryPromptVersion`、`indexVersion` を保持する。`structuredBlocksObjectKey` は構造抽出済み block ledger、`memoryCardsObjectKey` は cutover / rollback 時に再生成せず再利用する memory card ledger を指す。`DebugTrace` は実行時点の `PipelineVersions` を保持し、reindex / prompt 変更 / benchmark 差分分析の再現性に使う。

### DocumentStatistics

| 項目 | 内容 |
| --- | --- |
| `chunkCount` | document から生成された chunk 件数 |
| `sectionCount` | section metadata から推定した section 件数 |
| `tableCount` / `listCount` / `codeCount` / `figureCount` | chunk kind 別件数 |
| `averageChunkChars` | chunk 1 件あたり平均文字数 |
| `headingDensity` | heading / section metadata を持つ chunk 比率 |

`DocumentStatistics` は manifest の optional field として保存する。既存 manifest に存在しない場合も ingestion / chat は runtime fallback で継続する。memory card 件数や context snippet selection はこの構造情報を使うが、v1 の dynamic budget は既存 default 上限を超えない。

### RAGProfile

| 項目 | 内容 |
| --- | --- |
| `id` / `version` | RAG profile 全体の識別子 |
| `retrievalProfileId` / `retrievalProfileVersion` | retrieval parameter set の識別子 |
| `answerPolicyId` / `answerPolicyVersion` | answer / domain policy の識別子 |

`AnswerPolicy` は分類向け anchor / invalid answer pattern / search clue anchor に加え、policy computation の `comparatorTextMappings` と `effectTextMappings` を保持する。資料内金額閾値条件の grounding では、この mapping により quote 由来の比較表現・効果表現を enum と照合する。

`DebugTrace.ragProfile` と benchmark artifact に profile id / version を保存する。通常 `/chat` input では profile を選択しない。

### RequiredFact / Claim / ConflictCandidate

| 項目 | 内容 |
| --- | --- |
| `RequiredFact.factType` | `amount`、`date`、`duration`、`count`、`status`、`version`、`condition`、`procedure`、`person`、`scope`、`classification`、`unknown` |
| `RequiredFact.subject` / `scope` | required fact の対象と適用範囲 |
| `RequiredFact.expectedValueType` | 期待する値の種類 |
| `RequiredFact.plannerSource` | `deterministic`、`sufficient_context`、`legacy_fallback` |
| `Claim.subject` / `predicate` / `value` | evidence sentence から抽出した typed claim |
| `Claim.valueType` / `unit` / `scope` / `effectiveDate` | 値の型、単位、適用範囲、有効日 |
| `ConflictCandidate` | 同一 subject / predicate / scope、または scope なし claim と明示 scope claim の間で排他的な value を持つ claim 集合 |

`RetrievalEvaluation.claims` と `conflictCandidates` は optional trace/debug 用の内部情報として扱う。公開 API の required schema は変更せず、raw prompt、ACL metadata、alias 定義は含めない。

### ConversationHistoryItem

| 項目 | 内容 |
| --- | --- |
| `schemaVersion` | 会話履歴 item のスキーマバージョン。現行は `1` |
| `id` | 会話識別子 |
| `title` | 履歴一覧に表示する会話タイトル |
| `updatedAt` | 最終更新日時 |
| `isFavorite` | 利用者が後で参照するためのお気に入り状態。未指定時は `false` |
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
| `requesterUserId` | 問い合わせ作成者の認証済み userId。本人向け詳細取得と解決済み化の所有者境界に使う |
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

### AdminLedgerUser

| 項目 | 内容 |
| --- | --- |
| `userId` | 管理対象ユーザー識別子 |
| `email` | ユーザーメールアドレス |
| `displayName` | 管理画面で表示する任意の名前 |
| `status` | `active` / `suspended` / `deleted` |
| `groups` | 付与済み Cognito group / role 名 |
| `createdAt` / `updatedAt` | 管理台帳上の作成・更新日時 |
| `lastLoginAt` | 最終ログインまたは最終確認日時 |

### AdminAuditLogEntry

| 項目 | 内容 |
| --- | --- |
| `auditId` | 管理操作履歴の識別子 |
| `action` | `user:create` / `role:assign` / `user:suspend` / `user:unsuspend` / `user:delete` |
| `actorUserId` / `actorEmail` | 操作した管理者 |
| `targetUserId` / `targetEmail` | 操作対象ユーザー |
| `beforeStatus` / `afterStatus` | 状態変更前後の user status |
| `beforeGroups` / `afterGroups` | role group 変更前後の配列 |
| `createdAt` | 操作記録日時 |

### UserUsageSummary

| 項目 | 内容 |
| --- | --- |
| `userId` / `email` | 集計対象ユーザー |
| `chatMessages` | chat 利用数の概算 |
| `conversationCount` | 会話履歴数 |
| `questionCount` | 担当者問い合わせ数 |
| `documentCount` | 文書管理対象数 |
| `benchmarkRunCount` | benchmark run 数 |
| `debugRunCount` | debug trace 参照対象数 |
| `lastActivityAt` | 最終利用日時 |

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
- alias artifact は document metadata とは分離し、scope と ACL を持つ検索制御データとして扱う。
- 通常検索 response の metadata は allowlist 方式で返却し、`aliases`、`searchAliases`、`aclGroups`、`allowedUsers`、`privateToUserId`、内部 project code は返さない。
- alias の詳細、review reason、audit log は管理者向け経路に限定し、通常 response には `aliasVersion` のみ返す。
- Web UI の Cognito group は機能表示と不要な事前取得の抑制に使い、最終的な認可判断は API 側で行う。
- cost estimate は AWS 請求明細そのものではないため、金額の表示時は `estimated` であることと単価確認日を併記する。
- benchmark/debug 系 API の参照データは `NFR-010` に従い認可対象とする。
- memory record の高抽象度要約は検索補助であり、最終回答の引用根拠には使わない。

## 関連要求

- `FR-002`, `FR-004`, `FR-010`, `FR-015`, `FR-019`, `FR-020`, `FR-021`, `FR-022`, `FR-023`, `FR-025`, `FR-026`
- `NFR-004`, `NFR-005`, `NFR-006`, `NFR-010`, `NFR-011`, `NFR-012`
