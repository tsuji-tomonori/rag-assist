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
| `GET /documents` | 登録文書一覧 | `FR-001`, `FR-007` |
| `POST /documents` | 文書登録 | `FR-001`, `FR-002` |
| `DELETE /documents/{documentId}` | 文書削除 | `FR-007`, `FR-008` |
| `POST /chat` | 質問応答 | `FR-003`, `FR-004`, `FR-005` |
| `POST /search` | hybrid lexical/vector search | `FR-023`, `NFR-012` |
| `POST /admin/aliases` | draft alias 作成 | `FR-023`, `NFR-011` |
| `GET /admin/aliases` | alias 一覧 | `FR-023`, `NFR-011` |
| `GET /admin/aliases/audit-log` | alias audit log 一覧 | `FR-023`, `NFR-011`, `NFR-012` |
| `PATCH /admin/aliases/{aliasId}` | draft alias 更新 | `FR-023`, `NFR-011` |
| `POST /admin/aliases/{aliasId}/review` | draft alias の approve/reject | `FR-023`, `NFR-011` |
| `POST /admin/aliases/{aliasId}/disable` | active alias 無効化 | `FR-023`, `NFR-011` |
| `POST /questions` | 回答不能時の担当者問い合わせ作成 | `FR-021`, `NFR-011` |
| `GET /questions` | 担当者向け問い合わせ一覧 | `FR-021`, `NFR-011` |
| `GET /questions/{questionId}` | 担当者問い合わせ詳細 | `FR-021`, `NFR-011` |
| `POST /questions/{questionId}/answer` | 担当者回答登録 | `FR-021`, `NFR-011` |
| `POST /questions/{questionId}/resolve` | 問い合わせ解決済み化 | `FR-021`, `NFR-011` |
| `GET /conversation-history` | 自分の会話履歴一覧 | `FR-022`, `NFR-005` |
| `POST /conversation-history` | 会話履歴 item 保存 | `FR-022`, `NFR-005` |
| `DELETE /conversation-history/{id}` | 自分の会話履歴削除 | `FR-022`, `NFR-005` |
| `GET /debug-runs` | debug trace 一覧 | `FR-010`, `NFR-010` |
| `GET /debug-runs/{runId}` | debug trace 詳細 | `FR-010`, `NFR-010` |
| `POST /debug-runs/{runId}/download` | debug trace JSON ダウンロード URL 生成 | `FR-010`, `NFR-010` |
| `POST /benchmark/query` | 評価実行 | `FR-012`, `FR-019`, `NFR-010` |

注: 料金算出 API は現行 MVP では未提供とする。料金算出は `DES_DATA_001` の `UsageMeter`、`PricingCatalogEntry`、`CostEstimate` を使う将来拡張として扱う。

## `POST /chat`

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

### 料金算出との関係

- `debug.steps[].tokenCount` は UI/trace 表示用の概算であり、Bedrock 請求額の正確な算出には使わない。
- `debug.steps[].modelId` は Bedrock 単価参照時の候補キーとして扱う。
- 請求精度が必要な場合は、Bedrock の usage metadata、CloudWatch metrics、Cost and Usage Report などの実測系データを `UsageMeter` に取り込む。

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

## `/admin/aliases`

alias 管理 API は `RAG_GROUP_MANAGER` または `SYSTEM_ADMIN` 相当の権限を要求する。検索 index への反映は行わず、object store 上の alias 定義と audit log を管理する。

### Permission

| API | Permission |
| --- | --- |
| `POST /admin/aliases` | `rag:alias:write:group` |
| `GET /admin/aliases` | `rag:alias:read` |
| `GET /admin/aliases/audit-log` | `rag:alias:read` |
| `PATCH /admin/aliases/{aliasId}` | `rag:alias:write:group` |
| `POST /admin/aliases/{aliasId}/review` | `rag:alias:review:group` |
| `POST /admin/aliases/{aliasId}/disable` | `rag:alias:disable:group` |

### `POST /admin/aliases` Request

```json
{
  "from": "pto",
  "to": ["paid time off", "vacation"],
  "type": "oneWay",
  "weight": 1,
  "scope": {
    "tenantId": "tenant-a",
    "source": "notion",
    "docType": "policy",
    "aclGroups": ["HR_POLICY_READER"]
  },
  "source": "manual",
  "reason": "Employees search PTO, documents use vacation."
}
```

### Alias response

```json
{
  "schemaVersion": 1,
  "aliasId": "alias-001",
  "from": "pto",
  "to": ["paid time off", "vacation"],
  "type": "oneWay",
  "weight": 1,
  "scope": {
    "tenantId": "tenant-a",
    "source": "notion",
    "docType": "policy",
    "aclGroups": ["HR_POLICY_READER"]
  },
  "status": "draft",
  "source": "manual",
  "reason": "Employees search PTO, documents use vacation.",
  "createdBy": "user-123",
  "updatedBy": "user-123",
  "version": "alias-draft-20260502-010000000Z",
  "createdAt": "2026-05-02T01:00:00.000Z",
  "updatedAt": "2026-05-02T01:00:00.000Z"
}
```

### Lifecycle errors

- draft 以外の alias を `PATCH` した場合は `400` を返す。
- draft 以外の alias を review した場合は `400` を返す。
- active 以外の alias を disable した場合は `400` を返す。
- 存在しない `aliasId` は `404` を返す。

## `POST /conversation-history`

### Request

```json
{
  "schemaVersion": 1,
  "id": "conversation-20260502-001",
  "title": "ソフトウェア要求の分類",
  "updatedAt": "2026-05-02T00:00:00.000Z",
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

`POST /questions` は通常利用者のエスカレーション導線で使う。`GET /questions` と詳細取得は `answer:edit`、回答登録と解決済み化は `answer:publish` を要求する。

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

## `POST /benchmark-runs`

管理画面から benchmark run を非同期に起動する。API Lambda は DynamoDB に run record を作成し、Step Functions execution を開始する。実行本体は CodeBuild runner が `/benchmark/query` を呼び、S3 に `results.jsonl`、`summary.json`、`report.md` を保存する。

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

## `GET /benchmark-runs`

benchmark run の履歴一覧を返す。管理画面はこの API をポーリングして `queued`、`running`、`succeeded`、`failed`、`cancelled` を表示する。

## `POST /benchmark-runs/{runId}/download`

`report`、`summary`、`results` のいずれかの成果物に対する S3 signed URL を返す。既定は `report`。

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

## 認可方針

- local 開発では検証容易性を優先し、設定により認可を緩和できる。
- `AUTH_ENABLED=false` の既定 local user は `SYSTEM_ADMIN` とする。
- local RBAC 検証では `LOCAL_AUTH_GROUPS` で Cognito group 相当の role を指定できる。
- `VITE_AUTH_MODE=local` の Web UI は local 開発用セッションとして `SYSTEM_ADMIN` 相当を扱う。
- フロントエンドは JWT payload を独自解釈せず、`GET /me` が返す `groups` と `permissions` を表示制御の入力にする。
- `GET /conversation-history`、`POST /conversation-history`、`DELETE /conversation-history/{id}` は認証済み userId に紐づく自分の履歴のみを対象とする。
- 本番または社内検証環境では管理系 API を `requirePermission` による強制境界で保護する。
- 権限外文書を回答、citation、debug trace の外部応答に含めない。

### Phase 1 RAG 運用管理 API の権限境界

| 機能 | API | 必要 permission | 主な対象 role |
| --- | --- | --- | --- |
| 自分の権限取得 | `GET /me` | 認証済み user | 全 role |
| チャット実行 | `POST /chat` | `chat:create` | `CHAT_USER`, `SYSTEM_ADMIN` |
| 文書一覧 | `GET /documents` | `rag:doc:read` | `CHAT_USER`, `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| 文書アップロード | `POST /documents` | `rag:doc:write:group` | `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| 文書削除 | `DELETE /documents/{documentId}` | `rag:doc:delete:group` | `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| 問い合わせ作成 | `POST /questions` | `chat:create` | `CHAT_USER`, `SYSTEM_ADMIN` |
| 問い合わせ一覧 | `GET /questions` | `answer:edit` | `ANSWER_EDITOR`, `SYSTEM_ADMIN` |
| 問い合わせ詳細 | `GET /questions/{questionId}` | `answer:edit` | `ANSWER_EDITOR`, `SYSTEM_ADMIN` |
| 回答登録 | `POST /questions/{questionId}/answer` | `answer:publish` | `ANSWER_EDITOR`, `SYSTEM_ADMIN` |
| 解決済み化 | `POST /questions/{questionId}/resolve` | `answer:publish` | `ANSWER_EDITOR`, `SYSTEM_ADMIN` |
| debug trace 一覧 | `GET /debug-runs` | `chat:admin:read_all` | `SYSTEM_ADMIN` |
| debug trace 詳細 | `GET /debug-runs/{runId}` | `chat:admin:read_all` | `SYSTEM_ADMIN` |
| debug JSON download | `POST /debug-runs/{runId}/download` | `chat:admin:read_all` | `SYSTEM_ADMIN` |
| benchmark query | `POST /benchmark/query` | `benchmark:run` | `BENCHMARK_RUNNER`, `SYSTEM_ADMIN` |
| benchmark suite 一覧 | `GET /benchmark-suites` | `benchmark:read` | `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| benchmark run 起動 | `POST /benchmark-runs` | `benchmark:run` | `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| benchmark run 一覧/詳細 | `GET /benchmark-runs`, `GET /benchmark-runs/{runId}` | `benchmark:read` | `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN` |
| benchmark run cancel | `POST /benchmark-runs/{runId}/cancel` | `benchmark:cancel` | `SYSTEM_ADMIN` |
| benchmark artifact download | `POST /benchmark-runs/{runId}/download` | `benchmark:download` | `SYSTEM_ADMIN` |

Phase 1 ではユーザー作成、ユーザー停止、ロール付与、ロール一覧編集、アクセス policy 編集、コスト監査、全ユーザー利用状況一覧の API/UI は提供しない。

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
