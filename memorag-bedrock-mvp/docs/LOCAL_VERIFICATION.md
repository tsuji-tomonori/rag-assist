# Local Verification

このMVPはローカルではAWSへ接続しない。`MOCK_BEDROCK=true` と `USE_LOCAL_VECTOR_STORE=true` を指定し、Bedrockモックと `.local-data` のファイルstoreで検証する。

## 実行手順

依存関係:

```bash
npm install
```

静的検証:

```bash
npm run typecheck --workspaces --if-present
npm run build --workspaces --if-present
```

API起動:

```bash
PORT=8787 MOCK_BEDROCK=true USE_LOCAL_VECTOR_STORE=true LOCAL_DATA_DIR=.local-data npm run start -w @memorag-mvp/api
```

別ターミナルでスモークテスト:

```bash
curl -fsS http://localhost:8787/health

curl -fsS http://localhost:8787/documents \
  -H 'Content-Type: application/json' \
  -d '{"fileName":"handbook.md","text":"経費精算は申請から30日以内に行う必要があります。"}'

curl -fsS http://localhost:8787/chat \
  -H 'Content-Type: application/json' \
  -d '{"question":"経費精算の期限は？","modelId":"amazon.nova-lite-v1:0","includeDebug":true}'

curl -fsS http://localhost:8787/openapi.json >/dev/null
```

ベンチマーク:

```bash
API_BASE_URL=http://localhost:8787 \
DATASET=benchmark/dataset.sample.jsonl \
OUTPUT=.local-data/benchmark-results.jsonl \
SUMMARY=.local-data/benchmark-summary.json \
REPORT=.local-data/benchmark-report.md \
npm run start -w @memorag-mvp/benchmark
```

## 確認観点

- `/health` が `ok: true` を返す。
- `/documents` が `documentId`、`chunkCount`、`memoryCardCount` を返す。
- `/chat` が回答本文と `citations`、`retrieved` を返す。
- `/openapi.json` がJSONとして取得できる。
- benchmark CLIが `.local-data/benchmark-results.jsonl`、`.local-data/benchmark-summary.json`、`.local-data/benchmark-report.md` を作成する。
