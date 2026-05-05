# Local Verification

このMVPはローカルではAWSへ接続しない。`MOCK_BEDROCK=true`、`USE_LOCAL_VECTOR_STORE=true`、`USE_LOCAL_QUESTION_STORE=true`、`USE_LOCAL_CONVERSATION_HISTORY_STORE=true` を指定し、Bedrockモックと `.local-data` のファイルstoreで検証する。

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
PORT=8787 \
MOCK_BEDROCK=true \
USE_LOCAL_VECTOR_STORE=true \
USE_LOCAL_QUESTION_STORE=true \
USE_LOCAL_CONVERSATION_HISTORY_STORE=true \
LOCAL_DATA_DIR=.local-data \
npm run start -w @memorag-mvp/api
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

curl -fsS http://localhost:8787/questions \
  -H 'Content-Type: application/json' \
  -d '{"title":"担当者確認","question":"資料にない内容を担当者に確認してください。","requesterName":"山田 太郎","requesterDepartment":"総務部","assigneeDepartment":"総務部"}'

curl -fsS http://localhost:8787/conversation-history \
  -H 'Content-Type: application/json' \
  -d '{"schemaVersion":1,"id":"local-history-001","title":"ローカル検証","updatedAt":"2026-05-02T00:00:00.000Z","isFavorite":true,"messages":[{"role":"user","text":"経費精算の期限は？","createdAt":"2026-05-02T00:00:00.000Z"}]}'

curl -fsS http://localhost:8787/openapi.json >/dev/null
```

ベンチマーク:

```bash
API_BASE_URL=http://localhost:8787 \
DATASET=benchmark/dataset.sample.jsonl \
OUTPUT=.local-data/benchmark-results.jsonl \
SUMMARY=.local-data/benchmark-summary.json \
REPORT=.local-data/benchmark-report.md \
BENCHMARK_SUITE_ID=standard-agent-v1 \
BENCHMARK_CORPUS_DIR=benchmark/corpus/standard-agent-v1 \
BENCHMARK_CORPUS_SUITE_ID=standard-agent-v1 \
npm run start -w @memorag-mvp/benchmark
```

`task benchmark:sample` は上記の標準 corpus 指定を含む。`smoke-agent-v1`、`standard-agent-v1`、`clarification-smoke-v1` では `handbook.md` を `/documents` に seed し、active chunk が作成されてから評価 query を実行する。seed 文書は `aclGroups: ["BENCHMARK_RUNNER"]` と `docType: "benchmark-corpus"` で隔離し、通常利用者の文書一覧にも表示しない。同じ corpus を複数 suite で共有する場合は `BENCHMARK_CORPUS_SUITE_ID` で seed 判定用の corpus identity を固定する。

追加データセット:

```bash
DATASET=benchmark/dataset.unanswerable.sample.jsonl \
OUTPUT=.local-data/benchmark-unanswerable-results.jsonl \
SUMMARY=.local-data/benchmark-unanswerable-summary.json \
REPORT=.local-data/benchmark-unanswerable-report.md \
npm run start -w @memorag-mvp/benchmark

DATASET=benchmark/dataset.fact-slots.sample.jsonl \
OUTPUT=.local-data/benchmark-fact-slots-results.jsonl \
SUMMARY=.local-data/benchmark-fact-slots-summary.json \
REPORT=.local-data/benchmark-fact-slots-report.md \
npm run start -w @memorag-mvp/benchmark

DATASET=benchmark/dataset.clarification.sample.jsonl \
OUTPUT=.local-data/benchmark-clarification-results.jsonl \
SUMMARY=.local-data/benchmark-clarification-summary.json \
REPORT=.local-data/benchmark-clarification-report.md \
npm run start -w @memorag-mvp/benchmark
```

## 確認観点

- `/health` が `ok: true` を返す。
- `/documents` が `documentId`、`chunkCount`、`memoryCardCount` を返す。
- `/chat` が回答本文と `citations`、`retrieved` を返す。
- `/questions` が `questionId` と `status: "open"` を返す。
- `/conversation-history` が `schemaVersion: 1` と `isFavorite` を含む履歴 item を保存できる。
- `/openapi.json` がJSONとして取得できる。
- benchmark CLIが `.local-data/benchmark-results.jsonl`、`.local-data/benchmark-summary.json`、`.local-data/benchmark-report.md` を作成する。
- benchmark summary が回答可能問題、不回答問題、fact slot 付き問題、確認質問問題の評価に必要な集計項目を出力する。
- benchmark Markdown report の `Dataset Coverage` で dataset 内の期待値分母を確認でき、`Metrics` の `status=not_applicable` と評価済みの `0.0%` / `0` を区別できる。
- 回答可能な通常QAだけの dataset では、clarification / refusal / post-clarification / fact slot / page / LLM judge label-rate 系が `not_applicable` になり、通常QAの主要指標は `answerable_accuracy`、`over_clarification_rate`、retrieval / citation / latency 系として読める。
