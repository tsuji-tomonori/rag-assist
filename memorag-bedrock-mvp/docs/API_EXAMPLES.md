# API Examples

ローカル開発で `AUTH_ENABLED=false` の場合、以下の `Authorization` header は省略できる。本番または社内検証環境では Cognito ID token を指定する。

```bash
TOKEN='<cognito-id-token>'
AUTH_HEADER=(-H "Authorization: Bearer $TOKEN")
```

## Upload text

文書登録は `RAG_GROUP_MANAGER` または `SYSTEM_ADMIN` 相当の権限を持つ token で実行する。`POST /documents` は小さなテキスト互換用の同期 API であり、ファイルアップロード用途では非推奨。ファイルは `POST /documents/uploads` で upload session を作成し、S3 またはローカル upload URL に転送してから `POST /document-ingest-runs` で非同期取り込みを開始する。同期 API と upload ingest API のレスポンスは文書 summary のみで、full manifest、chunk metadata、vector key は返さない。

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

## Upload file through S3 handoff

```bash
UPLOAD_JSON="$(
  curl -s http://localhost:8787/documents/uploads \
    "${AUTH_HEADER[@]}" \
    -H 'Content-Type: application/json' \
    -d '{"fileName":"handbook.pdf","mimeType":"application/pdf"}'
)"

UPLOAD_URL="$(echo "$UPLOAD_JSON" | jq -r '.uploadUrl')"
UPLOAD_ID="$(echo "$UPLOAD_JSON" | jq -r '.uploadId')"
UPLOAD_METHOD="$(echo "$UPLOAD_JSON" | jq -r '.method')"

curl -s -X "$UPLOAD_METHOD" "$UPLOAD_URL" \
  -H 'Content-Type: application/pdf' \
  --data-binary @./handbook.pdf

INGEST_RUN_ID="$(
  curl -s "http://localhost:8787/document-ingest-runs" \
    "${AUTH_HEADER[@]}" \
    -H 'Content-Type: application/json' \
    -d "{
      \"uploadId\":\"${UPLOAD_ID}\",
      \"fileName\":\"handbook.pdf\",
      \"mimeType\":\"application/pdf\",
      \"memoryModelId\":\"amazon.nova-lite-v1:0\",
      \"embeddingModelId\":\"amazon.titan-embed-text-v2:0\"
    }" | jq -r '.runId'
)"

curl -s "http://localhost:8787/document-ingest-runs/${INGEST_RUN_ID}" \
  "${AUTH_HEADER[@]}" | jq

curl -N "http://localhost:8787/document-ingest-runs/${INGEST_RUN_ID}/events" \
  "${AUTH_HEADER[@]}"
```

大きな PDF、OCR fallback、embedding で 60 秒を超える可能性があるため、UI と通常運用では `POST /document-ingest-runs` を使う。既存 `POST /documents/uploads/{uploadId}/ingest` は後方互換の同期 API として残すが、大容量ファイル用途では非推奨。返却は文書 summary のみで、ファイル本体や full manifest は返さない。

```bash
curl -s "http://localhost:8787/documents/uploads/${UPLOAD_ID}/ingest" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
    "fileName":"handbook.pdf",
    "mimeType":"application/pdf",
    "memoryModelId":"amazon.nova-lite-v1:0",
    "embeddingModelId":"amazon.titan-embed-text-v2:0"
  }' | jq
```

本番では `uploadUrl` は documents bucket への S3 presigned PUT URL になる。ローカルの file store では同じ contract の API upload URL を返すため、UI と curl 手順は同じ形で確認できる。`requiresAuth=true` の local upload URL を使う場合だけ、転送リクエストにも `Authorization` header を付ける。

## Chat

非同期 streaming chat は `POST /chat-runs` で run を開始し、返却された `eventsPath` を SSE として読みます。

```bash
RUN_ID="$(
  curl -s http://localhost:8787/chat-runs \
    "${AUTH_HEADER[@]}" \
    -H 'Content-Type: application/json' \
    -d '{
      "question":"経費精算の期限は？",
      "modelId":"amazon.nova-lite-v1:0",
      "topK":6,
      "minScore":0.20,
      "includeDebug":true
    }' | jq -r '.runId'
)"

curl -N "http://localhost:8787/chat-runs/${RUN_ID}/events" \
  "${AUTH_HEADER[@]}"
```

`includeDebug=true` の SSE `final` event は full debug trace ではなく `debugRunId` を返します。trace 本体は `GET /debug-runs/{runId}` で取得します。

`POST /chat` は後方互換用の同期 JSON API として利用できます。

`POST /chat` は通常回答、回答不能、確認質問を `responseType` で区別する。確認質問は登録済み文書、memory card、検索候補に grounding を持つ option だけを返し、option 選択後は `resolvedQuery` を次の `/chat` の `question` として送る。

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

確認質問の response 例:

```json
{
  "responseType": "clarification",
  "answer": "どの申請種別の期限を確認しますか？",
  "isAnswerable": false,
  "needsClarification": true,
  "clarification": {
    "needsClarification": true,
    "reason": "multiple_candidate_intents",
    "question": "どの申請種別の期限を確認しますか？",
    "options": [
      {
        "id": "opt-1",
        "label": "経費精算",
        "resolvedQuery": "経費精算の申請期限は？",
        "source": "memory",
        "grounding": [{ "documentId": "doc-1", "fileName": "expense-policy.txt" }]
      }
    ],
    "missingSlots": ["申請種別"],
    "confidence": 0.82,
    "ambiguityScore": 0.78
  },
  "citations": [],
  "retrieved": []
}
```

選択肢を選んだ後は、選択した `resolvedQuery` を次の `question` として送り、追跡用に `clarificationContext` を付与できる。
自由入力で確認質問に回答する場合も `originalQuestion` と `selectedValue` を送ると、API は元質問と補足を合わせて検索・回答する。

```json
{
  "question": "経費精算の申請期限は？",
  "clarificationContext": {
    "originalQuestion": "申請期限は？",
    "selectedOptionId": "opt-1",
    "selectedValue": "経費精算"
  }
}
```

自由入力 follow-up の例:

```json
{
  "question": "育児休業",
  "clarificationContext": {
    "originalQuestion": "8/1から育休を取る場合、いつまでに申請する必要がある?",
    "selectedValue": "育児休業"
  }
}
```

## Search

`POST /search` の `metadata` は通常利用者向け allowlist response であり、alias 定義、ACL group、許可 user list、内部 project code は返さない。

```bash
curl -s http://localhost:8787/search \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
    "query":"経費精算 承認条件",
    "topK":10,
    "filters":{
      "tenantId":"tenant-a",
      "source":"notion",
      "docType":"policy"
    }
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

## Upload Textract JSON

Textract の `Blocks` JSON を `textractJson` として渡すと、TABLE は Markdown table、LINE は text/list/figure chunk として正規化される。

```bash
curl -s -X POST http://localhost:8787/documents \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d @- <<'JSON' | jq
{
  "fileName": "policy.textract.json",
  "textractJson": "{\"Blocks\":[{\"Id\":\"line-1\",\"BlockType\":\"LINE\",\"Text\":\"1. 申請手順\",\"Page\":1}]}",
  "skipMemory": true
}
JSON
```

## Reindex document

再インデックスは `RAG_GROUP_MANAGER` または `SYSTEM_ADMIN` 相当の権限を持つ token で実行する。`POST /documents/{documentId}/reindex` は互換用の即時 stage + cutover で、通常運用では blue-green endpoint で stage、確認、cutover、rollback を分ける。

```bash
curl -s -X POST http://localhost:8787/documents/<documentId>/reindex \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
    "embeddingModelId":"amazon.titan-embed-text-v2:0"
}' | jq
```

```bash
MIGRATION_ID=$(curl -s -X POST http://localhost:8787/documents/<documentId>/reindex/stage \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{"embeddingModelId":"amazon.titan-embed-text-v2:0"}' | jq -r '.migrationId')

curl -s http://localhost:8787/documents/reindex-migrations "${AUTH_HEADER[@]}" | jq

curl -s -X POST "http://localhost:8787/documents/reindex-migrations/${MIGRATION_ID}/cutover" \
  "${AUTH_HEADER[@]}" | jq

curl -s -X POST "http://localhost:8787/documents/reindex-migrations/${MIGRATION_ID}/rollback" \
  "${AUTH_HEADER[@]}" | jq
```

## Alias management

alias 管理 API と管理 UI は `RAG_GROUP_MANAGER` または `SYSTEM_ADMIN` 相当の権限で実行する。通常の `/search` response は alias 本文や audit 情報を返さず、`diagnostics.aliasVersion` だけを返す。

```bash
ALIAS_ID=$(curl -s -X POST http://localhost:8787/admin/aliases \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
    "term":"pto",
    "expansions":["年次有給休暇","休暇申請"],
    "scope":{"tenantId":"tenant-a","docType":"policy"}
  }' | jq -r '.aliasId')

curl -s -X POST "http://localhost:8787/admin/aliases/${ALIAS_ID}/review" \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{"decision":"approve","comment":"社内用語として確認済み"}' | jq

curl -s -X POST http://localhost:8787/admin/aliases/publish \
  "${AUTH_HEADER[@]}" | jq

curl -s http://localhost:8787/admin/aliases/audit-log "${AUTH_HEADER[@]}" | jq
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

## Get own follow-up question answer

`GET /questions/<questionId>` は `ANSWER_EDITOR` に加え、問い合わせ作成者本人も実行できる。本人向けレスポンスには担当者向けの `internalMemo` を含めない。非担当者・非作成者には既存 ticket でも `404` を返す。

```bash
curl -s http://localhost:8787/questions/<questionId> "${AUTH_HEADER[@]}" | jq
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
    "isFavorite":true,
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

## Benchmark query/search

`POST /benchmark/query` と `POST /benchmark/search` は CodeBuild runner など `benchmark:query` 権限を持つ service token で実行する。管理画面からの非同期実行は `BENCHMARK_OPERATOR` または `RAG_GROUP_MANAGER` の `benchmark:run` 権限で `POST /benchmark-runs` を使う。既存の外部運用 token が `RAG_GROUP_MANAGER` で `/benchmark/query` または `/benchmark/search` を直接呼んでいる場合は、`BENCHMARK_RUNNER` service user へ移行する。`BENCHMARK_RUNNER` は benchmark seed metadata と `aclGroups: ["BENCHMARK_RUNNER"]` で隔離された seed 文書に限り、実行前セットアップのために `/documents` の list / upload / delete、`purpose=benchmarkSeed` の upload session 作成、同じ runner が開始した `document-ingest-runs` の取得を行える。

`POST /benchmark/search` は `BENCHMARK_RUNNER` service user からの呼び出しに限り search benchmark dataset の `user` を任意で受け取り、ACL 評価用の利用者文脈として `user.userId` と `user.groups` を使う。通常利用者向け `/search` は request body の `user` を受け付けず、認証 token の本人だけで検索する。

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

```bash
curl -s http://localhost:8787/benchmark/search \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{
    "query":"経費精算の期限は？",
    "topK":10,
    "user":{
      "userId":"benchmark-user-1",
      "groups":["GROUP_A"]
    }
  }' | jq
```

## Benchmark runs

```bash
curl -s http://localhost:8787/benchmark-suites "${AUTH_HEADER[@]}" | jq

curl -s -X POST http://localhost:8787/benchmark-runs \
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

curl -s -X POST http://localhost:8787/benchmark-runs/bench_20260502_000000Z_abc12345/download \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{"artifact":"summary"}' | jq

curl -s -X POST http://localhost:8787/benchmark-runs/bench_20260502_000000Z_abc12345/download \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{"artifact":"results"}' | jq

curl -s -X POST http://localhost:8787/benchmark-runs/bench_20260502_000000Z_abc12345/download \
  "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -d '{"artifact":"logs"}' | jq
```
