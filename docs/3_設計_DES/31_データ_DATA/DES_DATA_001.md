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
| `tenantId` | テナント識別子。未設定の既存データは読み込み時に `default` として補完する |
| `adminPrincipalType` / `adminPrincipalId` | canonical path の一意性を管理する主体。個人管理は `user`、グループ管理は `group` |
| `name` | UI に表示する資料グループ名 |
| `normalizedName` | 一意性判定用に正規化した名称 |
| `canonicalPath` / `normalizedCanonicalPath` | 管理者単位の正式パスと正規化パス |
| `adminPathPk` / `parentPathPk` | DynamoDB GSI で管理者配下 path lookup と親配下 lookup に使う派生 key |
| `description` | 任意説明 |
| `ownerUserId` | グループ所有者 |
| `visibility` | `private` または `org` |
| `sharedUserIds` | 参照を許可する userId または email |
| `sharedGroups` | 参照を許可する Cognito group |
| `managerUserIds` | 共有設定とグループ文書追加を管理できる userId |
| `createdAt` / `updatedAt` | 作成・更新日時 |

`DocumentGroup` は local 開発では `document-groups.json`、AWS 環境では DynamoDB `DocumentGroupsTable` に永続化する。DynamoDB では `AdminCanonicalPathIndex` を `adminPathPk + normalizedCanonicalPath` で定義し、path lookup と duplicate detection に使う。一意性の最終保証は GSI ではなく、同一 table の `documentGroupPathLock` item と transaction write で行う。既存データの補完確認は `npm run document-groups:canonical-path:dry-run` で dry-run report を作成してから適用方針を判断する。グループ文書は `Document.metadata.groupIds` で所属を保持し、検索前に `DocumentGroup` の共有設定と文書 metadata の ACL を両方確認する。

### SearchScope

| 項目 | 内容 |
| --- | --- |
| `mode` | `all`、`groups`、`documents`、`temporary` |
| `groupIds` | `mode=groups` の対象資料グループ |
| `documentIds` | `mode=documents` の対象文書 |
| `includeTemporary` | チャット内一時添付を通常スコープへ合成するか |
| `temporaryScopeId` | 旧 client との互換用 single scope ID。authoritative context に存在する場合だけ有効 |
| `temporaryScopeIds` | server が `sessionDocumentContext` から正規化した最大20件の active scope ID |

`SearchScope` は `/chat`、`/chat-runs`、`/search` の検索境界として扱う。通常の group/document scope は維持し、一時 scope は認証 actor の tenant+user partition にある B1 `sessionDocumentContext` の active reference と current manifest authorization の積集合だけを合成する。`temporaryScopeId` / `temporaryScopeIds` を client が送信しても authoritative context にない ID は除外し、removed/revoked/expired reference は復活させない。非同期 run は正規化済み scope と conversation ID を保存し、worker protected-read 後に context を再読して再正規化する。

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

管理 API の governance record は artifact 用 `AliasDefinition` を拡張し、`status=draft|approved|disabled`、record-level `version`、`updatedAt`、任意の `publishedVersion` を持つ。scope の `tenantId` は認証済み actor から server が確定し、request 値で上書きしない。update/review/transition/disable は `expectedVersion` と reason、publish は ledger store version と reason を用いる。

### AliasAuditLogItem / AliasListPage

| 項目 | 内容 |
| --- | --- |
| `tenantId` | actor から確定した監査 partition。別 tenant の list には含めない |
| `action` | `create` / `update` / `review` / `transition` / `disable` / `publish` |
| `result` | `success` / `denied` / `conflict` / `failed` |
| `actorUserId` / `reason` | 実行主体と非空の実行理由。legacy event は理由不明を明示する |
| `beforeStatus` / `afterStatus` | 状態遷移前後。状態変更のない拒否・競合では同値になり得る |
| `aliasVersion` | 対象 record の opaque version。publish 全体 event では未設定になり得る |
| `total` / `nextCursor` / `truncated` | filter 後総数、安定順序の opaque cursor、後続 page の有無 |
| `source` / `asOf` | read model の出所と取得時点 |

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
| `schemaVersion` | 会話履歴 item のスキーマバージョン。現行は `3`、v1/v2は読み取り互換 |
| `id` | 会話識別子 |
| `title` | 履歴一覧に表示する会話タイトル |
| `updatedAt` | 最終更新日時 |
| `isFavorite` | 利用者が後で参照するためのお気に入り状態。未指定時は `false` |
| `messages` | user/assistant message の配列 |
| `sessionDocumentContext` | tenant+user partitionと会話IDに束縛した一時 evidence context |

`sessionDocumentContext` は `schemaVersion=1`、会話 item の `id` と一致する `sessionId`、最大20件の `temporaryEvidence`、`updatedAt` で構成する。各 reference は `temporaryScopeId`、`documentId`、`status`（`active` / `expired` / `removed` / `revoked`）、`expiresAt`、`updatedAt` を持つ。active reference の所有者・tenant・chat scope・expiry は manifest を authoritative source として保存時に再検証する。terminal status は履歴を再保存しても client 入力だけで active へ戻さない。

### ConversationMessage

| 項目 | 内容 |
| --- | --- |
| `role` | `user` または `assistant` |
| `messageId` | Web が発話ごとに付与する安定識別子。有人問い合わせとの対象紐付けに使う |
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
| `status` | `open` / `in_progress` / `waiting_requester` / `answered` / `resolved` |
| `messageId` | エスカレーション元 message の安定識別子。`requesterUserId` と組み合わせて作成冪等性を保証する |
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

管理台帳 object key は `admin/tenants/{tenantId}/admin-ledger.json` とし、actor の authoritative tenant 以外を読まない。write は object version を expected version とする条件付き更新で、競合時に sibling mutation を上書きしない。旧 `admin/admin-ledger.json` は production では設定済み `AUTH_TENANT_ID`、local では設定済み `LOCAL_AUTH_TENANT_ID` にだけ条件付きコピーし、旧 object は削除しない。

### AdminAuditLogEntry

| 項目 | 内容 |
| --- | --- |
| `auditId` | 管理操作履歴の識別子 |
| `action` | `user:create` / `role:assign` / `user:suspend` / `user:unsuspend` / `user:delete` |
| `result` / `reason` | `pending` / `success` / `denied` / `conflict` / `failed` と caller/system reason |
| `tenantId` / `targetType` | authoritative tenant と immutable target category |
| `actorUserId` / `actorEmail` | 操作した管理者 |
| `targetUserId` / `targetEmail` | 操作対象ユーザー |
| `beforeStatus` / `afterStatus` | 状態変更前後の user status |
| `beforeGroups` / `afterGroups` | role group 変更前後の配列 |
| `policyVersion` / `source` | 適用 policy version と `security_audit_outbox` / `legacy_admin_ledger` |
| `createdAt` | 操作記録日時 |

管理操作履歴 page は actor tenant の共通 security audit outbox と legacy 管理台帳 event を正規化し、安定 sort/cursor と `total`、`nextCursor`、`truncated`、`source`、`asOf` を返す。export artifact は同じ query の全 page、tenant partitioned object key、redaction policy/version、生成時刻を保持し、signed URL や secret は監査 event へ保存しない。

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

### UsageEvent

| 項目 | 内容 |
| --- | --- |
| `schemaVersion` | `1`。将来 schema 変更時の判別用 |
| `eventId` | event 固有 ID |
| `tenantId` / `idempotencyKey` | base table の複合 key。tenant 内 replay を条件付き write で一意化する |
| `periodKey` | `${occurredAt}#${eventId}`。`tenantId-periodKey-index` の sort key |
| `subjectId` / `runId` / `feature` | actor、実行、機能の帰属。欠損は UI/集計で `unknown` とする |
| `provider` / `region` / `modelId` | provider と price catalog の照合 key |
| `quantities` | `input_token` / `output_token` / cache token / `request` の整数 quantity と source |
| `source` | quantity ごとの `provider` / `tokenizer_estimate` / `missing` |
| `status` / `errorCode` | 呼び出し結果。失敗 event も消さない |
| `occurredAt` / `recordedAt` | 発生時刻と記録時刻 |

### PricingCatalogEntry

| 項目 | 内容 |
| --- | --- |
| `catalogVersion` | 承認・再現単位となる price catalog version |
| `provider` | `bedrock` など usage event と一致する provider |
| `region` | 単価を適用する AWS region |
| `modelId` | Bedrock model の場合の model ID |
| `unit` | `UsageEvent.quantities[].unit` と対応する単位 |
| `priceUsdPerUnit` | 1 unit 当たりの非負 decimal string |
| `effectiveFrom` / `effectiveTo` | half-open 有効期間 |
| `source` / `approvedBy` / `publishedAt` | 根拠、承認者、公開時刻 |

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
- Bedrock response に usage metadata がある場合は `provider` quantity、ない場合だけ tokenizer estimate、入力も得られない場合は `missing` とする。
- 請求精度が必要な場合は、Bedrock 応答の usage 情報、CloudWatch metrics、または Cost and Usage Report を正とする。
- `UsageEvent` は `schemaVersion`、price は `catalogVersion` を持ち、料金算出式の変更とは別に互換性と適用版を判別する。

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

- 現行 MVP は `UsageEvent` と `PricingCatalogEntry` から `actual` / `estimate` / `unpriced` の cost audit item を返すが、AWS Billing / Cost Explorer / Cost and Usage Report を請求の正本とする。
- production CDK は `USAGE_ACCOUNTING_MODE=shadow`、空の `USAGE_PRICING_CATALOG_JSON` を初期値とし、承認済み catalog と live reconciliation が揃うまで active cutover しない。
- base table は `tenantId` + `idempotencyKey`、期間 query は `tenantId-periodKey-index` を使用し、`Scan` と 1,000 件上限依存を禁止する。

## 保持と保護

- source と manifest は文書削除時に削除対象とする。
- debug trace は `NFR-006` に従い、調査用ログとして 1 週間保持を基本とする。
- conversation history は `tenantId + userId` の物理 partition と `sessionId` で分離し、schemaVersion により将来のスキーマ変更時に item の解釈を分岐できるようにする。個別取得・削除は同じ owner partition keyを使い、権限外IDの存在を列挙しない。
- human question は担当者対応の業務データであり、一覧・回答・解決は route ごとの permission と作成者本人境界で扱う。同じ `requesterUserId` / `messageId` の作成再送は既存 item を返し、重複 item を保存しない。
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
