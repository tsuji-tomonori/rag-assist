# MemoRAG MVP API 設計

- ファイル: `memorag-bedrock-mvp/docs/3_設計_DES/41_API_API/DES_API_001.md`
- 種別: `DES_API`
- 作成日: 2026-05-01
- 状態: Draft

## 何を書く場所か

外部から見える API contract、主な request/response、認可、エラー方針を定義する。

## API サーフェス

| API | 用途 | 関連要求 |
| --- | --- | --- |
| `GET /health` | ヘルスチェック | `NFR-001` |
| `GET /openapi.json` | API 仕様参照 | `FR-013` |
| `GET /me` | ログインユーザーと有効 permission 取得 | `NFR-011` |
| `POST /admin/users` | 管理対象ユーザー作成 | `FR-027`, `NFR-011` |
| `GET /admin/users` | 管理対象ユーザー一覧 | `FR-027`, `NFR-011` |
| `POST /admin/users/{userId}/roles` | ロール付与 | `FR-027`, `NFR-011` |
| `POST /admin/users/{userId}/suspend` | ユーザー停止 | `FR-027`, `NFR-011` |
| `POST /admin/users/{userId}/unsuspend` | ユーザー再開 | `FR-027`, `NFR-011` |
| `DELETE /admin/users/{userId}` | ユーザー削除 | `FR-027`, `NFR-011` |
| `GET /admin/audit-log` | 管理操作履歴 | `FR-027`, `NFR-011` |
| `GET /admin/roles` | ロール一覧 | `FR-027`, `NFR-011` |
| `GET /admin/aliases` | 検索 alias 一覧 | `FR-023`, `NFR-012` |
| `POST /admin/aliases` | alias draft 作成 | `FR-023`, `NFR-012` |
| `POST /admin/aliases/{aliasId}/update` | alias draft 更新 | `FR-023`, `NFR-012` |
| `POST /admin/aliases/{aliasId}/review` | alias review | `FR-023`, `NFR-012` |
| `POST /admin/aliases/{aliasId}/disable` | alias disable | `FR-023`, `NFR-012` |
| `POST /admin/aliases/publish` | alias publish | `FR-023`, `NFR-012` |
| `GET /admin/aliases/audit-log` | alias 操作履歴 | `FR-023`, `NFR-012` |
| `GET /admin/usage` | 全ユーザー利用状況 | `FR-027`, `NFR-011` |
| `GET /admin/costs` | コスト監査 | `FR-027`, `NFR-011` |
| `GET /documents` | 登録文書一覧 | `FR-001`, `FR-007` |
| `POST /documents` | 文書登録 | `FR-001`, `FR-002` |
| `POST /documents/{documentId}/reindex` | 互換用の即時再インデックス | `FR-001`, `FR-002` |
| `GET /documents/reindex-migrations` | blue-green 再インデックス移行一覧 | `FR-001`, `FR-002` |
| `POST /documents/{documentId}/reindex/stage` | 再インデックス staged document 作成 | `FR-001`, `FR-002` |
| `POST /documents/reindex-migrations/{migrationId}/cutover` | staged document への切替 | `FR-001`, `FR-002` |
| `POST /documents/reindex-migrations/{migrationId}/rollback` | cutover 後の active document 復元 | `FR-001`, `FR-002` |
| `DELETE /documents/{documentId}` | 文書削除 | `FR-007`, `FR-008` |
| `POST /chat` | 質問応答 | `FR-003`, `FR-004`, `FR-005`, `FR-026`, `FR-029` |
| `POST /chat-runs` | 非同期質問応答 run 作成 | `FR-003`, `FR-004`, `FR-005`, `FR-026`, `FR-029` |
| `GET /chat-runs/{runId}/events` | 質問応答 run の SSE 進捗・最終回答 streaming | `FR-003`, `FR-004`, `FR-005`, `FR-026`, `FR-029`, `NFR-005` |
| `POST /search` | hybrid lexical/vector search | `FR-023`, `NFR-012` |
| `POST /questions` | 回答不能時の担当者問い合わせ作成 | `FR-021`, `NFR-011` |
| `GET /questions` | 担当者向け問い合わせ一覧 | `FR-021`, `NFR-011` |
| `GET /questions/{questionId}` | 担当者問い合わせ詳細 | `FR-021`, `NFR-011` |
| `POST /questions/{questionId}/answer` | 担当者回答登録 | `FR-021`, `NFR-011` |
| `POST /questions/{questionId}/resolve` | 問い合わせ解決済み化 | `FR-021`, `NFR-011` |
| `GET /conversation-history` | 自分の会話履歴一覧 | `FR-022`, `NFR-005` |
| `POST /conversation-history` | 会話履歴 item 保存とお気に入り状態更新 | `FR-022`, `FR-028`, `NFR-005` |
| `DELETE /conversation-history/{id}` | 自分の会話履歴削除 | `FR-022`, `NFR-005` |
| `GET /debug-runs` | debug trace 一覧 | `FR-010`, `NFR-010` |
| `GET /debug-runs/{runId}` | debug trace 詳細 | `FR-010`, `NFR-010` |
| `POST /debug-runs/{runId}/download` | debug trace JSON ダウンロード URL 生成 | `FR-010`, `NFR-010` |
| `POST /benchmark/query` | 評価実行 | `FR-012`, `FR-019`, `NFR-010` |
| `POST /benchmark/search` | search benchmark 評価実行 | `FR-012`, `FR-019`, `NFR-010`, `NFR-012` |
| `GET /benchmark-suites` | 非同期 benchmark suite 一覧 | `FR-019`, `NFR-010` |
| `POST /benchmark-runs` | 非同期 benchmark run 起動 | `FR-019`, `NFR-010` |
| `GET /benchmark-runs` | benchmark run 履歴一覧 | `FR-010`, `FR-019`, `NFR-010` |
| `GET /benchmark-runs/{runId}` | benchmark run 詳細 | `FR-010`, `FR-019`, `NFR-010` |
| `POST /benchmark-runs/{runId}/cancel` | benchmark run cancel | `FR-019`, `NFR-010` |
| `POST /benchmark-runs/{runId}/download` | benchmark report / summary / results / CodeBuild logs download URL 生成 | `FR-011`, `FR-019`, `NFR-010` |

注: `GET /admin/costs` は運用者向けの概算コスト監査 summary を返す。請求確定用の料金算出 API は現行 MVP では未提供であり、`DES_DATA_001` の `UsageMeter`、`PricingCatalogEntry`、`CostEstimate` を使う将来拡張として扱う。

## `POST /chat`

後方互換用の同期 JSON API。新しい UI は、長時間 RAG 処理の進捗を表示するため `POST /chat-runs` と `GET /chat-runs/{runId}/events` を使用する。

### Request

```json
{
  "question": "障害時の再インデックス手順は?",
  "modelId": "amazon.nova-lite-v1:0",
  "includeDebug": true
}
```

### Response

```json
{
  "responseType": "answer",
  "answer": "根拠に基づく回答または回答不能理由",
  "isAnswerable": true,
  "citations": [
    {
      "documentId": "doc-001",
      "fileName": "operations.md",
      "chunkId": "chunk-003",
      "score": 0.92,
      "text": "再インデックスは管理者が承認後に実行します。"
    }
  ],
  "retrieved": []
}
```

`responseType` は後方互換のため optional field として扱う。通常回答は `answer`、資料から回答できない場合は `refusal`、回答前に対象確認が必要な場合は `clarification` を返す。`clarification` の場合は `isAnswerable=false`、`needsClarification=true`、`clarification.options[].grounding` に文書または memory/evidence 由来の根拠を入れ、`citations` と `retrieved` は空配列にする。

## `POST /chat-runs`

### Request

`POST /chat` と同じ request body を受け付ける。`strictGrounded`、`useMemory`、`maxIterations` も同期 API と同じ意味で保存し、worker 実行時に `runQaAgent()` へ渡す。`includeDebug=true` の場合は `chat:admin:read_all` も必要。

### Response

```json
{
  "runId": "chat_20260504T000000Z_abc12345",
  "status": "queued",
  "eventsPath": "/chat-runs/chat_20260504T000000Z_abc12345/events"
}
```

## `GET /chat-runs/{runId}/events`

REST API response streaming の SSE endpoint。`Authorization` header を付けた `fetch` stream で購読する。

### Events

```text
id: 1
event: status
data: {"stage":"queued","message":"リクエストを受け付けました"}

id: 2
event: final
data: {"answer":"...", "isAnswerable":true, "citations":[], "debugRunId":"run_..."}
```

接続が長時間無通信にならないよう `heartbeat` event を送る。`final` または `error` event で stream を終了する。
すべての実レスポンスには CORS header を含める。認可エラーや未検出エラーでもブラウザ側が status/body を読めるよう、plain text の 400/403/404/500 応答にも同じ CORS header を付与し、API Gateway authorizer 由来の 4xx/5xx も GatewayResponse で CORS header を返す。
stream handler の deadline に達した場合は `timeout` event を送って stream を閉じる。クライアントは最後に受け取った `id` を `Last-Event-ID` として再接続し、network disconnect 時も同じ `Last-Event-ID` で retry して、`final` または `error` を受け取るまで購読を継続する。
worker Lambda や Step Functions task が timeout/failure になった場合は failure marker が `ChatRunsTable` を `failed` に更新し、`ChatRunEventsTable` に `error` event を追加する。
local 開発では Hono の `GET /chat-runs/{runId}/events` が同じ `ChatRunEventsTable` adapter を polling し、AWS deploy では専用 Lambda response streaming integration が同じ SSE contract を返す。
`includeDebug=true` の final event と ChatRun item は DynamoDB item size を抑えるため full debug trace を保持せず、`debugRunId` だけを返す。UI は必要に応じて `GET /debug-runs/{runId}` で full trace を取得する。

### 料金算出との関係

- `debug.steps[].tokenCount` は UI/trace 表示用の概算であり、Bedrock 請求額の正確な算出には使わない。
- `debug.steps[].modelId` は Bedrock 単価参照時の候補キーとして扱う。
- 請求精度が必要な場合は、Bedrock の usage metadata、CloudWatch metrics、Cost and Usage Report などの実測系データを `UsageMeter` に取り込む。

### 検索経路

- `POST /chat` の agent `search_evidence` は `POST /search` と同じ hybrid retriever を使用する。
- 検索 step の debug output には `retrievalDiagnostics` を含めてよい。
- `retrievalDiagnostics` は件数と opaque version を扱い、alias 本文や ACL metadata は含めない。

## `POST /search`

### Request

```json
{
  "query": "PTO approval",
  "topK": 10,
  "filters": {
    "tenantId": "tenant-a",
    "source": "notion",
    "docType": "policy"
  }
}
```

### Response

```json
{
  "query": "PTO approval",
  "results": [
    {
      "id": "doc-001-chunk-0000",
      "documentId": "doc-001",
      "fileName": "policy.md",
      "chunkId": "chunk-0000",
      "text": "Vacation requests require manager approval.",
      "score": 0.12,
      "rrfScore": 0.02,
      "matchedTerms": ["approval"],
      "sources": ["lexical", "semantic"],
      "metadata": {
        "tenantId": "tenant-a",
        "source": "notion",
        "docType": "policy",
        "department": "hr"
      }
    }
  ],
  "diagnostics": {
    "indexVersion": "lexical:5af1c001",
    "aliasVersion": "alias:51e90a22",
    "lexicalCount": 18,
    "semanticCount": 20,
    "fusedCount": 31,
    "latencyMs": 123
  }
}
```

### Metadata と alias の非漏えい方針

- `results[].metadata` は allowlist 方式で、現行は `tenantId`、`source`、`docType`、`department` のみ返す。
- `aliases`、`searchAliases`、`aclGroups`、`allowedUsers`、`privateToUserId`、内部 project code は通常 response に返さない。
- `diagnostics.indexVersion` と `diagnostics.aliasVersion` は opaque value とし、document ID や alias 本文を含めない。

## `POST /conversation-history`

### Request

```json
{
  "schemaVersion": 1,
  "id": "conversation-20260502-001",
  "title": "ソフトウェア要求の分類",
  "updatedAt": "2026-05-02T00:00:00.000Z",
  "isFavorite": true,
  "messages": [
    {
      "role": "user",
      "text": "ソフトウェア要求の分類を洗い出して",
      "createdAt": "2026-05-02T00:00:00.000Z"
    }
  ]
}
```

### Response

```json
{
  "schemaVersion": 1,
  "id": "conversation-20260502-001",
  "title": "ソフトウェア要求の分類",
  "updatedAt": "2026-05-02T00:00:00.000Z",
  "isFavorite": true,
  "messages": [
    {
      "role": "user",
      "text": "ソフトウェア要求の分類を洗い出して",
      "createdAt": "2026-05-02T00:00:00.000Z"
    }
  ]
}
```

### バージョン方針

- `schemaVersion` は会話履歴 item の構造を識別する。
- `isFavorite` は未指定時 `false` として補完される。
- 現行の `schemaVersion` は `1` とする。
- API は `schemaVersion` 未指定の保存要求を v1 として補完する。
- 将来スキーマを変更する場合は、既存 item の読み取り互換性を維持するか、version ごとの変換を追加する。

## `/questions`

### `POST /questions` Request

```json
{
  "title": "山田さんの昼食について確認したい",
  "question": "今日山田さんは何を食べたか、担当者に確認してください。",
  "requesterName": "山田 太郎",
  "requesterDepartment": "総務部",
  "assigneeDepartment": "総務部",
  "category": "その他の質問",
  "priority": "normal",
  "sourceQuestion": "今日山田さんは何を食べましたか?",
  "chatAnswer": "資料からは回答できません。",
  "chatRunId": "run_20260502_010203Z_abc123"
}
```

### `POST /questions/{questionId}/answer` Request

```json
{
  "answerTitle": "山田さんの昼食についての回答",
  "answerBody": "山田さんは本日、社内食堂でカレーを食べました。",
  "responderName": "佐藤 花子",
  "responderDepartment": "総務部",
  "references": "総務部への確認結果",
  "internalMemo": "依頼者への通知前に内容確認済み",
  "notifyRequester": true
}
```

### 状態遷移

| 操作 | 状態 |
| --- | --- |
| `POST /questions` | `open` |
| `POST /questions/{questionId}/answer` | `answered` |
| `POST /questions/{questionId}/resolve` | `resolved` |

`POST /questions` は通常利用者のエスカレーション導線で使い、認証済み userId を `requesterUserId` として ticket に保持する。`GET /questions` は `answer:edit` を要求する。`GET /questions/{questionId}` は `answer:edit` を持つ担当者に全項目を返し、作成者本人には `internalMemo` を除いた詳細を返す。非担当者・非作成者には既存 ticket でも `404` を返し、存在有無を識別させない。回答登録は `answer:publish` を要求する。解決済み化は `answer:publish` を持つ担当者、または作成者本人の回答済み ticket に限り許可する。

## `POST /benchmark/query`

### Request

```json
{
  "id": "case-001",
  "question": "登録文書に基づく質問",
  "modelId": "amazon.nova-lite-v1:0",
  "includeDebug": false
}
```

### Response

```json
{
  "id": "case-001",
  "answer": "根拠に基づく回答または回答不能理由",
  "isAnswerable": true,
  "citations": [],
  "retrieved": []
}
```

## `POST /benchmark/search`

`POST /search` と同じ hybrid search contract を使う search benchmark runner 専用 API。通常利用者向けの `rag:doc:read` ではなく `benchmark:query` を要求し、CodeBuild runner の `BENCHMARK_RUNNER` service user から search mode dataset を評価する。

request body は通常 search request に加えて任意の `user` を受け取れる。`user.userId` と `user.groups` は search benchmark dataset の評価 subject として使い、ACL 付き文書の positive / negative case を dataset 行ごとの利用者文脈で評価する。`user` override は `BENCHMARK_RUNNER` service user からの呼び出し時だけ許可する。`SYSTEM_ADMIN`、`RAG_GROUP_MANAGER`、`BENCHMARK_RUNNER`、`ANSWER_EDITOR`、`USER_ADMIN`、`ACCESS_ADMIN`、`COST_AUDITOR` は dataset user の group として受け付けない。これは benchmark payload から特権 group を指定して ACL を bypass しないためである。

## `POST /benchmark-runs`

管理画面から benchmark run を非同期に起動する。API Lambda は DynamoDB に run record を作成し、Step Functions execution を開始する。実行本体は CodeBuild runner が agent mode では `/benchmark/query`、search mode では `/benchmark/search` を呼び、S3 に `results.jsonl`、`summary.json`、`report.md` を保存する。runner は `summary.json` から `metrics` を抽出し、同じ run record に保存する。CodeBuild build ID と log URL も run record に保持し、失敗 run でも調査用に参照できる。

### Request

```json
{
  "suiteId": "standard-agent-v1",
  "mode": "agent",
  "runner": "codebuild",
  "modelId": "amazon.nova-lite-v1:0",
  "embeddingModelId": "amazon.titan-embed-text-v2:0",
  "topK": 6,
  "memoryTopK": 4,
  "minScore": 0.2,
  "concurrency": 1
}
```

### Response

```json
{
  "runId": "bench_20260502T000000Z_abc12345",
  "status": "queued",
  "mode": "agent",
  "runner": "codebuild",
  "suiteId": "standard-agent-v1",
  "datasetS3Key": "datasets/agent/standard-v1.jsonl",
  "createdBy": "user-id",
  "createdAt": "2026-05-02T00:00:00.000Z",
  "updatedAt": "2026-05-02T00:00:00.000Z"
}
```

## `GET /benchmark-suites`

管理画面で選択できる非同期 benchmark suite を返す。

## `GET /benchmark-runs`

benchmark run の履歴一覧を返す。管理画面はこの API をポーリングして `queued`、`running`、`succeeded`、`failed`、`cancelled` を表示する。

## `GET /benchmark-runs/{runId}`

単一の benchmark run 詳細を返す。

## `POST /benchmark-runs/{runId}/cancel`

実行中または queued の benchmark run を取り消す。

## `POST /benchmark-runs/{runId}/download`

`report`、`summary`、`results` のいずれかの成果物に対する S3 signed URL、または `logs` に対する CodeBuild log URL を返す。既定は `report`。UI は benchmark 成果物の download を `succeeded` run に限定し、`logs` は failed run でも利用できる。

### Response

```json
{
  "url": "https://example-bucket.s3.amazonaws.com/runs/bench_20260502T000000Z_abc12345/report.md?X-Amz-Signature=...",
  "expiresInSeconds": 900,
  "objectKey": "runs/bench_20260502T000000Z_abc12345/report.md"
}
```

## 認可方針

- local 開発では検証容易性を優先し、設定により認可を緩和できる。
- `AUTH_ENABLED=false` の既定 local user は `SYSTEM_ADMIN` とする。
- local RBAC 検証では `LOCAL_AUTH_GROUPS` で Cognito group 相当の role を指定できる。
- `VITE_AUTH_MODE=local` の Web UI は local 開発用セッションとして `SYSTEM_ADMIN` 相当を扱う。
- フロントエンドは JWT payload を独自解釈せず、`GET /me` が返す `groups` と `permissions` を表示制御の入力にする。
- ログイン画面の self sign-up は Cognito `SignUp` / `ConfirmSignUp` を直接呼び、API Server にはユーザー作成 endpoint を追加しない。
- self sign-up 確認後の Cognito group 付与は post-confirmation trigger が `CHAT_USER` のみに固定して行う。
- `SYSTEM_ADMIN` などの上位 Cognito group は GitHub Actions または AWS 管理手順で管理ユーザーが後から付与する。
- `GET /conversation-history`、`POST /conversation-history`、`DELETE /conversation-history/{id}` は認証済み userId に紐づく自分の履歴のみを対象とする。
- 本番または社内検証環境では管理系 API を `requirePermission` による強制境界で保護する。
- 権限外文書を回答、citation、debug trace の外部応答に含めない。

### Phase 1 RAG 運用管理 API の権限境界

| 機能 | API | 必要 permission | 主な対象 role |
| --- | --- | --- | --- |
| 自分の権限取得 | `GET /me` | 認証済み user | 全 role |
| チャット実行 | `POST /chat` | `chat:create` | `CHAT_USER`, `SYSTEM_ADMIN` |
| 検索実行 | `POST /search` | `rag:doc:read` | `CHAT_USER`, `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| 非同期チャット run 作成 | `POST /chat-runs` | `chat:create` | `CHAT_USER`, `SYSTEM_ADMIN` |
| 非同期チャット event 購読 | `GET /chat-runs/{runId}/events` | `chat:read:own` + run owner または `chat:admin:read_all` | `CHAT_USER`, `SYSTEM_ADMIN` |
| 文書一覧 | `GET /documents` | `rag:doc:read`。benchmark seed 確認に限り `benchmark:seed_corpus` | `CHAT_USER`, `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN`。隔離 seed 確認のみ `BENCHMARK_RUNNER` |
| 文書アップロード | `POST /documents` | `rag:doc:write:group`。benchmark seed payload に限り `benchmark:seed_corpus` | `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN`。隔離 seed のみ `BENCHMARK_RUNNER` |
| 文書再インデックス | `POST /documents/{documentId}/reindex` | `rag:index:rebuild:group` | `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| 再インデックス移行一覧 | `GET /documents/reindex-migrations` | `rag:index:rebuild:group` | `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| 再インデックス stage | `POST /documents/{documentId}/reindex/stage` | `rag:index:rebuild:group` | `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| 再インデックス cutover | `POST /documents/reindex-migrations/{migrationId}/cutover` | `rag:index:rebuild:group` | `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| 再インデックス rollback | `POST /documents/reindex-migrations/{migrationId}/rollback` | `rag:index:rebuild:group` | `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| 文書削除 | `DELETE /documents/{documentId}` | `rag:doc:delete:group` | `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| 問い合わせ作成 | `POST /questions` | `chat:create` | `CHAT_USER`, `SYSTEM_ADMIN` |
| 問い合わせ一覧 | `GET /questions` | `answer:edit` | `ANSWER_EDITOR`, `SYSTEM_ADMIN` |
| 問い合わせ詳細 | `GET /questions/{questionId}` | `answer:edit` または作成者本人 | `CHAT_USER`, `ANSWER_EDITOR`, `SYSTEM_ADMIN` |
| 回答登録 | `POST /questions/{questionId}/answer` | `answer:publish` | `ANSWER_EDITOR`, `SYSTEM_ADMIN` |
| 解決済み化 | `POST /questions/{questionId}/resolve` | `answer:publish` または回答済み ticket の作成者本人 | `CHAT_USER`, `ANSWER_EDITOR`, `SYSTEM_ADMIN` |
| debug trace 一覧 | `GET /debug-runs` | `chat:admin:read_all` | `SYSTEM_ADMIN` |
| debug trace 詳細 | `GET /debug-runs/{runId}` | `chat:admin:read_all` | `SYSTEM_ADMIN` |
| debug JSON download | `POST /debug-runs/{runId}/download` | `chat:admin:read_all` | `SYSTEM_ADMIN` |
| benchmark query | `POST /benchmark/query` | `benchmark:query` | `BENCHMARK_RUNNER`, `SYSTEM_ADMIN` |
| benchmark search | `POST /benchmark/search` | `benchmark:query` | `BENCHMARK_RUNNER`, `SYSTEM_ADMIN` |
| benchmark suite 一覧 | `GET /benchmark-suites` | `benchmark:read` | `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| benchmark run 起動 | `POST /benchmark-runs` | `benchmark:run` | `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| benchmark run 一覧/詳細 | `GET /benchmark-runs`, `GET /benchmark-runs/{runId}` | `benchmark:read` | `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| benchmark run cancel | `POST /benchmark-runs/{runId}/cancel` | `benchmark:cancel` | `SYSTEM_ADMIN` |
| benchmark artifact download | `POST /benchmark-runs/{runId}/download` | `benchmark:download` | `SYSTEM_ADMIN` |

Phase 1 では通常利用者の Cognito self sign-up UI を提供する。

### Phase 2 管理 API の権限境界

| 機能 | API | 必要 permission | 主な対象 role |
| --- | --- | --- | --- |
| 管理対象ユーザー作成 | `POST /admin/users` | `user:create` | `USER_ADMIN`, `SYSTEM_ADMIN` |
| 管理対象ユーザー一覧 | `GET /admin/users` | `user:read` | `USER_ADMIN`, `SYSTEM_ADMIN` |
| ユーザー停止 | `POST /admin/users/{userId}/suspend` | `user:suspend` | `USER_ADMIN`, `SYSTEM_ADMIN` |
| ユーザー再開 | `POST /admin/users/{userId}/unsuspend` | `user:unsuspend` | `USER_ADMIN`, `SYSTEM_ADMIN` |
| ユーザー削除 | `DELETE /admin/users/{userId}` | `user:delete` | `USER_ADMIN`, `SYSTEM_ADMIN` |
| 管理操作履歴 | `GET /admin/audit-log` | `access:policy:read` | `ACCESS_ADMIN`, `SYSTEM_ADMIN` |
| ロール一覧 | `GET /admin/roles` | `access:policy:read` | `ACCESS_ADMIN`, `SYSTEM_ADMIN` |
| ロール付与 | `POST /admin/users/{userId}/roles` | `access:role:assign` | `ACCESS_ADMIN`, `SYSTEM_ADMIN` |
| alias 一覧 | `GET /admin/aliases` | `rag:alias:read` | `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| alias draft 作成 | `POST /admin/aliases` | `rag:alias:write:group` | `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| alias draft 更新 | `POST /admin/aliases/{aliasId}/update` | `rag:alias:write:group` | `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| alias review | `POST /admin/aliases/{aliasId}/review` | `rag:alias:review:group` | `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| alias disable | `POST /admin/aliases/{aliasId}/disable` | `rag:alias:disable:group` | `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| alias publish | `POST /admin/aliases/publish` | `rag:alias:publish:group` | `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| alias audit log | `GET /admin/aliases/audit-log` | `rag:alias:read` | `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| 全ユーザー利用状況 | `GET /admin/usage` | `usage:read:all_users` | `USER_ADMIN`, `SYSTEM_ADMIN` |
| コスト監査 | `GET /admin/costs` | `cost:read:all` | `COST_AUDITOR`, `SYSTEM_ADMIN` |

Phase 2 初期実装のユーザー管理は管理台帳 API を正とする。管理台帳 API はユーザー作成、role group 付与、停止、再開、削除を管理操作履歴へ記録する。Cognito Admin API への実変更、承認 workflow、監査ログの保全設計は後続 adapter/運用設計で扱う。

## エラー方針

| 状態 | 条件 | 応答方針 |
| --- | --- | --- |
| `400` | request schema 不正 | 入力エラーとして返す |
| `401` / `403` | 未認証または権限不足 | debug/benchmark 実行または参照を拒否する |
| `404` | documentId または runId が存在しない | 対象なしとして返す |
| `422` | evidence 不足 | 回答不能として扱い、推測回答しない |
| `502` | Bedrock など外部依存失敗 | 外部依存失敗として返す |

## 関連文書

- `2_アーキテクチャ_ARC/01_コンテキスト_CONTEXT/ARC_CONTEXT_001.md`
- `3_設計_DES/11_詳細設計_DLD/DES_DLD_001.md`
- `3_設計_DES/31_データ_DATA/DES_DATA_001.md`
- `3_設計_DES/41_API_API/DES_API_002.md`
