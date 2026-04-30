# API Examples

## Upload text

```bash
curl -s http://localhost:8787/documents \
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
  -H 'Content-Type: application/json' \
  -d "{\"fileName\":\"handbook.md\",\"contentBase64\":\"$BASE64\",\"mimeType\":\"text/markdown\"}" | jq
```

## Chat

```bash
curl -s http://localhost:8787/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "question":"経費精算の期限は？",
    "modelId":"amazon.nova-lite-v1:0",
    "topK":6,
    "minScore":0.20,
    "includeDebug":true
  }' | jq
```

## Benchmark query

```bash
curl -s http://localhost:8787/benchmark/query \
  -H 'Content-Type: application/json' \
  -d '{
    "id":"case-001",
    "question":"経費精算の期限は？",
    "modelId":"amazon.nova-lite-v1:0",
    "includeDebug":true
  }' | jq
```
