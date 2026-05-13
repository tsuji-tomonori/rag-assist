# Debug Trace JSON Schema

- ファイル: `docs/3_設計_DES/41_API_API/DES_API_002.md`
- 種別: `DES_API`
- 作成日: 2026-05-02
- 状態: Draft

## 何を書く場所か

`GET /debug-runs/{runId}` と `POST /debug-runs/{runId}/download` が返す debug trace JSON の v1 contract、互換性、テスト対応を定義する。

## API 概要

| API | 返す内容 | JSON contract |
| --- | --- | --- |
| `GET /debug-runs/{runId}` | persisted debug trace object | `DebugTraceV1` |
| `POST /debug-runs/{runId}/download` | signed URL response | URL 先の object body が `DebugTraceV1` |

`POST /debug-runs/{runId}/download` の URL 先は `Content-Type: application/json; charset=utf-8`、ファイル名は `debug-trace-<sanitized-run-id>.json` とする。

## バージョニング

- 現行 schema version は `1` とする。
- debug trace producer は top-level の最初の property として `schemaVersion` を出力する。
- JSON object の property order は仕様上 semantic ではないが、人間の確認と差分確認を容易にするため、保存・ダウンロード時の serialized JSON では `schemaVersion` を冒頭に置く。
- `schemaVersion` がない既存 persisted trace を読む場合、API は v1 として `schemaVersion: 1` を補完する。
- 将来 schema を変更する場合は `schemaVersion` を増やし、読み取り側で version ごとの変換または分岐を追加する。

## DebugTraceV1 Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.local/schemas/memorag/debug-trace-v1.schema.json",
  "title": "DebugTraceV1",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion",
    "runId",
    "question",
    "modelId",
    "embeddingModelId",
    "clueModelId",
    "topK",
    "memoryTopK",
    "minScore",
    "startedAt",
    "completedAt",
    "totalLatencyMs",
    "status",
    "answerPreview",
    "isAnswerable",
    "citations",
    "retrieved",
    "steps"
  ],
  "properties": {
    "schemaVersion": { "const": 1 },
    "runId": { "type": "string", "minLength": 1 },
    "question": { "type": "string" },
    "modelId": { "type": "string" },
    "embeddingModelId": { "type": "string" },
    "clueModelId": { "type": "string" },
    "topK": { "type": "integer", "minimum": 1, "maximum": 20 },
    "memoryTopK": { "type": "integer", "minimum": 1, "maximum": 10 },
    "minScore": { "type": "number", "minimum": -1, "maximum": 1 },
    "startedAt": { "type": "string", "format": "date-time" },
    "completedAt": { "type": "string", "format": "date-time" },
    "totalLatencyMs": { "type": "number", "minimum": 0 },
    "status": { "$ref": "#/$defs/debugStepStatus" },
    "answerPreview": { "type": "string" },
    "isAnswerable": { "type": "boolean" },
    "citations": {
      "type": "array",
      "items": { "$ref": "#/$defs/citation" }
    },
    "retrieved": {
      "type": "array",
      "items": { "$ref": "#/$defs/citation" }
    },
    "finalEvidence": {
      "type": "array",
      "items": { "$ref": "#/$defs/citation" }
    },
    "steps": {
      "type": "array",
      "items": { "$ref": "#/$defs/debugStep" }
    }
  },
  "$defs": {
    "debugStepStatus": {
      "type": "string",
      "enum": ["success", "warning", "error"]
    },
    "citation": {
      "type": "object",
      "additionalProperties": false,
      "required": ["documentId", "fileName", "score", "text"],
      "properties": {
        "documentId": { "type": "string" },
        "fileName": { "type": "string" },
        "chunkId": { "type": "string" },
        "score": { "type": "number" },
        "text": { "type": "string" }
      }
    },
    "debugStep": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "label",
        "status",
        "latencyMs",
        "summary",
        "startedAt",
        "completedAt"
      ],
      "properties": {
        "id": { "type": "integer", "minimum": 1 },
        "label": { "type": "string" },
        "status": { "$ref": "#/$defs/debugStepStatus" },
        "latencyMs": { "type": "number", "minimum": 0 },
        "modelId": { "type": "string" },
        "summary": { "type": "string" },
        "detail": { "type": "string" },
        "output": {
          "type": "object",
          "description": "The structured node update emitted by this chronological step.",
          "additionalProperties": true
        },
        "hitCount": { "type": "number", "minimum": 0 },
        "tokenCount": { "type": "number", "minimum": 0 },
        "startedAt": { "type": "string", "format": "date-time" },
        "completedAt": { "type": "string", "format": "date-time" }
      }
    }
  }
}
```

## 出力規則

- `steps` は agent node の実行順に並べる。
- 各 `steps[].output` は、その step が返した構造化 update を JSON object として保持する。
- 検索系 step の `output` には `retrievedChunks`、`selectedChunks`、`actionHistory`、`retrievalDiagnostics` などを含めてよい。
- `retrievalDiagnostics` は query 数、index/alias version、lexical/semantic/fused 件数、source 件数などの検索診断情報を保持する。
- 回答生成後の step の `output` には `rawAnswer`、`answer`、`citations` などを含めてよい。
- 回答不能で終了した場合も、最後の step の `output.answer` は `資料からは回答できません。` とする。
- `detail` は UI 表示用の text summary であり、機械的な取り込みでは `output` を正とする。

## 具体例

### 回答可能ケース

```json
{
  "schemaVersion": 1,
  "runId": "run_answerable",
  "question": "期限はいつですか？",
  "modelId": "amazon.nova-lite-v1:0",
  "embeddingModelId": "amazon.titan-embed-text-v2:0",
  "clueModelId": "amazon.nova-lite-v1:0",
  "topK": 6,
  "memoryTopK": 4,
  "minScore": 0.2,
  "startedAt": "2026-05-02T00:00:00.000Z",
  "completedAt": "2026-05-02T00:00:01.000Z",
  "totalLatencyMs": 1000,
  "status": "success",
  "answerPreview": "期限は翌月5営業日までです。",
  "isAnswerable": true,
  "citations": [
    {
      "documentId": "doc-1",
      "fileName": "policy.txt",
      "chunkId": "chunk-0001",
      "score": 0.91,
      "text": "申請期限は翌月5営業日までです。"
    }
  ],
  "retrieved": [
    {
      "documentId": "doc-1",
      "fileName": "policy.txt",
      "chunkId": "chunk-0001",
      "score": 0.91,
      "text": "申請期限は翌月5営業日までです。"
    }
  ],
  "steps": [
    {
      "id": 1,
      "label": "retrieve_memory",
      "status": "success",
      "latencyMs": 12,
      "modelId": "amazon.titan-embed-text-v2:0",
      "summary": "memory hits=1",
      "output": {
        "memoryCards": [
          {
            "key": "doc-1-memory-0000",
            "score": 0.8,
            "metadata": {
              "kind": "memory",
              "documentId": "doc-1",
              "fileName": "policy.txt",
              "memoryId": "memory-0000",
              "text": "Summary: 申請期限",
              "createdAt": "2026-05-01T00:00:00.000Z"
            }
          }
        ]
      },
      "hitCount": 1,
      "startedAt": "2026-05-02T00:00:00.000Z",
      "completedAt": "2026-05-02T00:00:00.012Z"
    },
    {
      "id": 2,
      "label": "finalize_response",
      "status": "success",
      "latencyMs": 3,
      "summary": "finalized",
      "detail": "期限は翌月5営業日までです。",
      "output": {
        "answer": "期限は翌月5営業日までです。"
      },
      "tokenCount": 10,
      "startedAt": "2026-05-02T00:00:00.997Z",
      "completedAt": "2026-05-02T00:00:01.000Z"
    }
  ]
}
```

### 回答不能ケース

```json
{
  "schemaVersion": 1,
  "runId": "run_refusal",
  "question": "資料にない制度は？",
  "modelId": "amazon.nova-lite-v1:0",
  "embeddingModelId": "amazon.titan-embed-text-v2:0",
  "clueModelId": "amazon.nova-lite-v1:0",
  "topK": 6,
  "memoryTopK": 4,
  "minScore": 0.2,
  "startedAt": "2026-05-02T00:00:00.000Z",
  "completedAt": "2026-05-02T00:00:00.200Z",
  "totalLatencyMs": 200,
  "status": "warning",
  "answerPreview": "資料からは回答できません。",
  "isAnswerable": false,
  "citations": [],
  "retrieved": [],
  "steps": [
    {
      "id": 1,
      "label": "answerability_gate",
      "status": "warning",
      "latencyMs": 8,
      "summary": "answerable=false, reason=no_relevant_chunks",
      "detail": "reason=no_relevant_chunks\nconfidence=0",
      "output": {
        "answerability": {
          "isAnswerable": false,
          "reason": "no_relevant_chunks",
          "confidence": 0
        },
        "answer": "資料からは回答できません。",
        "citations": []
      },
      "startedAt": "2026-05-02T00:00:00.100Z",
      "completedAt": "2026-05-02T00:00:00.108Z"
    }
  ]
}
```

## 要件とテスト対応

| 要件ID | 要件 | 既存テスト充足 | 追加テスト |
| --- | --- | --- | --- |
| DBG-JSON-001 | debug trace download は Markdown ではなく JSON を出力する | metadata と UI 拡張子のみ確認済み | `debug trace JSON for answerable runs matches the v1 schema example` |
| DBG-JSON-002 | top-level の冒頭に `schemaVersion` を出す | `schemaVersion` の存在のみ確認済み | 固定 JSON 文字列一致で冒頭出力を確認 |
| DBG-JSON-003 | `steps` は実行順で時系列に並ぶ | fixed trace steps test で順序確認済み | 既存テストを維持 |
| DBG-JSON-004 | 最後に出力した内容まで trace に含める | answerable の最終 answer のみ部分確認済み | `finalize_response` と `finalize_refusal` の `output` 完全一致を追加 |
| DBG-JSON-005 | 回答可能 JSON 例が schema v1 と一致する | 未充足 | 回答可能ケースの固定 JSON 文字列一致を追加 |
| DBG-JSON-006 | 回答不能 JSON 例が schema v1 と一致する | 未充足 | 回答不能ケースの固定 JSON object 一致を追加 |
| DBG-JSON-007 | Web UI は JSON download として扱う | `JSONでダウンロード` の UI テストで確認済み | 既存テストを維持 |

## 関連実装

- `apps/api/src/types.ts`
- `apps/api/src/schemas.ts`
- `apps/api/src/agent/trace.ts`
- `apps/api/src/rag/memorag-service.ts`
- `apps/web/src/App.tsx`

## 関連テスト

- `apps/api/src/agent/graph.test.ts`
- `apps/api/src/rag/memorag-service.test.ts`
- `apps/web/src/App.test.tsx`
