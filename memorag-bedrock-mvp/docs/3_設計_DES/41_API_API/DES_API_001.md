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
| `GET /conversation-history` | 自分の会話履歴一覧 | `FR-010`, `NFR-005` |
| `POST /conversation-history` | 会話履歴 item 保存 | `FR-010`, `NFR-005` |
| `DELETE /conversation-history/{id}` | 自分の会話履歴削除 | `FR-010`, `NFR-005` |
| `GET /debug-runs` | debug trace 一覧 | `FR-010`, `NFR-010` |
| `GET /debug-runs/{runId}` | debug trace 詳細 | `FR-010`, `NFR-010` |
| `POST /benchmark/query` | 評価実行 | `FR-012`, `FR-019`, `NFR-010` |

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
- `GET /conversation-history`、`POST /conversation-history`、`DELETE /conversation-history/{id}` は認証済み userId に紐づく自分の履歴のみを対象とする。
- 本番または社内検証環境では `GET /debug-runs`、`GET /debug-runs/{runId}`、`POST /benchmark/query` を認可対象とする。
- 権限外文書を回答、citation、debug trace の外部応答に含めない。

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
