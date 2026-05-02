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
| `GET /documents` | 登録文書一覧 | `FR-001`, `FR-007` |
| `POST /documents` | 文書登録 | `FR-001`, `FR-002` |
| `DELETE /documents/{documentId}` | 文書削除 | `FR-007`, `FR-008` |
| `POST /chat` | 質問応答 | `FR-003`, `FR-004`, `FR-005` |
| `POST /questions` | 担当者への問い合わせ作成 | `FR-005`, `NFR-011` |
| `GET /questions` | 担当者問い合わせ一覧 | `FR-005`, `NFR-011` |
| `GET /questions/{questionId}` | 担当者問い合わせ詳細 | `FR-005`, `NFR-011` |
| `POST /questions/{questionId}/answer` | 担当者回答登録 | `FR-005`, `NFR-011` |
| `POST /questions/{questionId}/resolve` | 問い合わせ解決済み化 | `FR-005`, `NFR-011` |
| `GET /conversation-history` | 自分の会話履歴一覧 | `FR-010`, `NFR-005` |
| `POST /conversation-history` | 会話履歴 item 保存 | `FR-010`, `NFR-005` |
| `DELETE /conversation-history/{id}` | 自分の会話履歴削除 | `FR-010`, `NFR-005` |
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
  "citations": [
    {
      "documentId": "doc-001",
      "chunkId": "chunk-003",
      "title": "運用手順書",
      "section": "再インデックス"
    }
  ],
  "metadata": {
    "queryId": "q-123",
    "answerability": "ANSWERABLE",
    "modelId": "amazon.nova-lite-v1:0",
    "latencyMs": 3200
  }
}
```

### 料金算出との関係

- `debug.steps[].tokenCount` は UI/trace 表示用の概算であり、Bedrock 請求額の正確な算出には使わない。
- `debug.steps[].modelId` は Bedrock 単価参照時の候補キーとして扱う。
- 請求精度が必要な場合は、Bedrock の usage metadata、CloudWatch metrics、Cost and Usage Report などの実測系データを `UsageMeter` に取り込む。

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

## `POST /benchmark/query`

### Request

```json
{
  "caseId": "case-001",
  "question": "登録文書に基づく質問",
  "expectedFacts": ["回答に含まれるべき fact"],
  "expectedAnswerability": "ANSWERABLE"
}
```

### Response

```json
{
  "caseId": "case-001",
  "queryId": "q-123",
  "answerability": "ANSWERABLE",
  "metrics": {
    "factCoverage": 1,
    "faithfulness": 1,
    "contextRelevance": 0.9,
    "refusalCorrectness": 1
  }
}
```

## 認可方針

- local 開発では検証容易性を優先し、設定により認可を緩和できる。
- `AUTH_ENABLED=false` の既定 local user は `SYSTEM_ADMIN` とする。
- local RBAC 検証では `LOCAL_AUTH_GROUPS` で Cognito group 相当の role を指定できる。
- `GET /conversation-history`、`POST /conversation-history`、`DELETE /conversation-history/{id}` は認証済み userId に紐づく自分の履歴のみを対象とする。
- 本番または社内検証環境では管理系 API を `requirePermission` による強制境界で保護する。
- 権限外文書を回答、citation、debug trace の外部応答に含めない。

### Phase 1 RAG 運用管理 API の権限境界

| 機能 | API | 必要 permission | 主な対象 role |
| --- | --- | --- | --- |
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
| benchmark query | `POST /benchmark/query` | `chat:admin:read_all` | `SYSTEM_ADMIN` |

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
