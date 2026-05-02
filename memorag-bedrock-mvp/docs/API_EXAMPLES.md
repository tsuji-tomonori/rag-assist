# API Examples

ローカル開発で `AUTH_ENABLED=false` の場合、以下の `Authorization` header は省略できる。本番または社内検証環境では Cognito ID token を指定する。

```bash
TOKEN='<cognito-id-token>'
AUTH_HEADER=(-H "Authorization: Bearer $TOKEN")
```

## Upload text

文書登録は `RAG_GROUP_MANAGER` または `SYSTEM_ADMIN` 相当の権限を持つ token で実行する。

```bash
curl -s http://localhost:8787/documents \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
    "fileName":"handbook.md",
    "text":"経費精算は申請から30日以内に行う必要があります。",
    "memoryModelId":"amazon.nova-lite-v1:0",
    "embeddingModelId":"amazon.titan-embed-text-v2:0"
  }' | jq
```

## Upload file as base64

```bash
BASE64=$(base64 -w0 ./handbook.md)
curl -s http://localhost:8787/documents \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d "{\"fileName\":\"handbook.md\",\"contentBase64\":\"$BASE64\",\"mimeType\":\"text/markdown\"}" | jq
```

## Chat

```bash
curl -s http://localhost:8787/chat \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
    "question":"経費精算の期限は？",
    "modelId":"amazon.nova-lite-v1:0",
    "topK":6,
    "minScore":0.20,
    "includeDebug":true
  }' | jq
```

## List debug traces

```bash
curl -s http://localhost:8787/debug-runs "${AUTH_HEADER[@]}" | jq
```

## Get a debug trace

```bash
curl -s http://localhost:8787/debug-runs/run_20260101_120000Z_abc12345 "${AUTH_HEADER[@]}" | jq
```

## Create a debug trace JSON download URL

```bash
curl -s -X POST http://localhost:8787/debug-runs/run_20260101_120000Z_abc12345/download \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq
```

## Delete document

文書削除は `RAG_GROUP_MANAGER` または `SYSTEM_ADMIN` 相当の権限を持つ token で実行する。

```bash
curl -s -X DELETE http://localhost:8787/documents/<documentId> "${AUTH_HEADER[@]}" | jq
```

## Create human follow-up question

```bash
curl -s http://localhost:8787/questions \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
    "title":"資料にない内容を担当者へ確認したい",
    "question":"今日山田さんが何を食べたか確認してください。",
    "requesterName":"山田 太郎",
    "requesterDepartment":"総務部",
    "assigneeDepartment":"総務部",
    "category":"その他の質問",
    "priority":"normal",
    "sourceQuestion":"今日山田さんは何を食べましたか？",
    "chatAnswer":"資料からは回答できません。"
  }' | jq
```

## List human follow-up questions

`GET /questions` は `ANSWER_EDITOR` または `SYSTEM_ADMIN` 相当の権限を持つ token で実行する。

```bash
curl -s http://localhost:8787/questions "${AUTH_HEADER[@]}" | jq
```

## Answer human follow-up question

```bash
curl -s http://localhost:8787/questions/<questionId>/answer \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
    "answerTitle":"山田さんの昼食についての回答",
    "answerBody":"山田さんは本日、社内食堂でカレーを食べました。",
    "responderName":"佐藤 花子",
    "responderDepartment":"総務部",
    "notifyRequester":true
  }' | jq
```

## Save conversation history

```bash
curl -s http://localhost:8787/conversation-history \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
    "schemaVersion":1,
    "id":"conversation-20260502-001",
    "title":"経費精算の確認",
    "updatedAt":"2026-05-02T00:00:00.000Z",
    "messages":[
      {
        "role":"user",
        "text":"経費精算の期限は？",
        "createdAt":"2026-05-02T00:00:00.000Z"
      }
    ]
  }' | jq
```

## List conversation history

```bash
curl -s http://localhost:8787/conversation-history "${AUTH_HEADER[@]}" | jq
```

## Benchmark query

`POST /benchmark/query` は `benchmark:run` 権限を持つ token で実行する。管理画面からの非同期実行は `POST /benchmark-runs` を使う。

```bash
curl -s http://localhost:8787/benchmark/query \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
    "id":"case-001",
    "question":"経費精算の期限は？",
    "modelId":"amazon.nova-lite-v1:0",
    "includeDebug":true
  }' | jq
```

## Benchmark runs

```bash
curl -s http://localhost:8787/benchmark-suites "${AUTH_HEADER[@]}" | jq

curl -s http://localhost:8787/benchmark-runs \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
    "suiteId":"standard-agent-v1",
    "mode":"agent",
    "runner":"codebuild",
    "modelId":"amazon.nova-lite-v1:0",
    "embeddingModelId":"amazon.titan-embed-text-v2:0",
    "topK":6,
    "memoryTopK":4,
    "minScore":0.2,
    "concurrency":1
  }' | jq

curl -s http://localhost:8787/benchmark-runs "${AUTH_HEADER[@]}" | jq

curl -s -X POST http://localhost:8787/benchmark-runs/bench_20260502_000000Z_abc12345/download \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{"artifact":"report"}' | jq
```
