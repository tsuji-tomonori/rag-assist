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
| `POST /questions` | 回答不能時の担当者問い合わせ登録 | `FR-021` |
| `GET /questions` | 担当者向け問い合わせ一覧 | `FR-021`, `NFR-011` |
| `GET /questions/{questionId}` | 問い合わせ詳細 | `FR-021` |
| `POST /questions/{questionId}/answer` | 担当者回答の保存 | `FR-021`, `NFR-011` |
| `POST /questions/{questionId}/resolve` | 問い合わせ解決 | `FR-021`, `NFR-011` |
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

`POST /questions` は通常利用者のエスカレーション導線で使う。`GET /questions`、回答、解決は担当者導線で使い、`answer:edit` 権限を要求する。

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

## 認可方針

- local 開発では検証容易性を優先し、設定により認可を緩和できる。
- `AUTH_ENABLED=false` の API は local 開発用 user として `SYSTEM_ADMIN` 相当を設定する。
- `GET /conversation-history`、`POST /conversation-history`、`DELETE /conversation-history/{id}` は認証済み userId に紐づく自分の履歴のみを対象とする。
- `GET /questions`、`POST /questions/{questionId}/answer`、`POST /questions/{questionId}/resolve` は `answer:edit` を要求する。
- `GET /debug-runs` と `POST /benchmark/query` は `chat:admin:read_all` を要求する。
- `GET /debug-runs/{runId}` と `POST /debug-runs/{runId}/download` は現行実装では認証 middleware の対象であり、一覧取得は管理者権限で制御する。
- 権限外文書を回答、citation、debug trace の外部応答に含めない。

### Cognito group と主な権限

| Cognito group | 主な権限 | 主な用途 |
| --- | --- | --- |
| `CHAT_USER` | `chat:create`, `chat:read:own`, `chat:delete:own`, `rag:doc:read` | 通常チャット、本人の会話履歴、問い合わせ登録 |
| `ANSWER_EDITOR` | `answer:edit`, `answer:publish` | 担当者問い合わせの一覧、回答、解決 |
| `RAG_GROUP_MANAGER` | `rag:doc:write:group`, `rag:doc:delete:group`, `rag:index:rebuild:group` | 文書登録、文書削除、再インデックス運用 |
| `USER_ADMIN` | `user:read`, `user:suspend`, `user:unsuspend`, `user:delete` | ユーザー管理の将来拡張 |
| `ACCESS_ADMIN` | `access:role:create`, `access:role:update`, `access:role:assign`, `access:policy:read` | 権限管理の将来拡張 |
| `COST_AUDITOR` | `cost:read:all` | 費用監査の将来拡張 |
| `SYSTEM_ADMIN` | 全権限 | 管理者検証、debug trace、benchmark |

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
