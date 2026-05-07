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

`task benchmark:sample` は上記の標準 corpus 指定を含む。`task benchmark:search:sample` も `BENCHMARK_SUITE_ID=search-standard-v1` と同じ標準 corpus seed を指定する。`smoke-agent-v1`、`standard-agent-v1`、`clarification-smoke-v1`、`search-standard-v1` では、同じ `BENCHMARK_CORPUS_SUITE_ID` の benchmark seed 文書を削除してから `handbook.md` を `/documents` に再 seed し、active chunk が作成されてから評価 query / search を実行する。削除または再 seed に失敗した場合、古い corpus で測定を継続せず runner は失敗する。`mmrag-docqa-v1` をローカルで試す場合は `DATASET=benchmark/dataset.mmrag-docqa.sample.jsonl`、`BENCHMARK_SUITE_ID=mmrag-docqa-v1`、`BENCHMARK_CORPUS_DIR=benchmark/corpus/mmrag-docqa-v1`、`BENCHMARK_CORPUS_SUITE_ID=mmrag-docqa-v1` を指定する。seed 文書は `aclGroups: ["BENCHMARK_RUNNER"]` と `docType: "benchmark-corpus"` で隔離し、通常利用者の文書一覧にも表示しない。corpus seed の削除・アップロード時間は runner setup であり、summary の latency 指標は `/benchmark/query` または `/benchmark/search` の初回 API call を対象にする。同じ corpus を複数 suite で共有する場合は `BENCHMARK_CORPUS_SUITE_ID` で seed 判定用の corpus identity を固定する。`<file>.metadata.json` の `searchAliases` は seed metadata に含まれ、search benchmark の alias case で使う。

検索ベンチマーク runner は、`BENCHMARK_CORPUS_DIR` が指定されている場合に agent benchmark と同じ isolated corpus を seed してから `/benchmark/search` を実行する。`task benchmark:search:sample` は標準 corpus と `BENCHMARK_CORPUS_SUITE_ID=standard-agent-v1` を指定する。初期化やレポート描画の fatal error でも `OUTPUT`、`SUMMARY`、`REPORT` の各 artifact を作成してから同じエラーで終了する。CodeBuild の `post_build` では、Build phase の失敗原因を保ったまま部分結果と runner error を S3 にアップロードできる。

adaptive retrieval を opt-in で確認する場合:

```bash
RAG_ADAPTIVE_RETRIEVAL=true \
API_BASE_URL=http://localhost:8787 \
DATASET=benchmark/datasets/search.sample.jsonl \
OUTPUT=.local-data/search-adaptive-results.jsonl \
SUMMARY=.local-data/search-adaptive-summary.json \
REPORT=.local-data/search-adaptive-report.md \
BENCHMARK_SUITE_ID=search-standard-v1 \
BENCHMARK_CORPUS_DIR=benchmark/corpus/standard-agent-v1 \
BENCHMARK_CORPUS_SUITE_ID=standard-agent-v1 \
npm run start:search -w @memorag-mvp/benchmark
```

`diagnostics.profileId`、`diagnostics.scoreDistribution`、`diagnostics.lexicalSemanticOverlap`、`diagnostics.adaptiveDecision` を確認し、default profile と比較する。`adaptiveDecision.effectiveMinScore` は RRF + rerank の combined score 用で、`MIN_RETRIEVAL_SCORE` とは別の `RAG_ADAPTIVE_MIN_COMBINED_SCORE` で下限を制御する。default 化は、回答可能 20 件以上、不回答 10 件以上を含む benchmark suite で answerable accuracy、refusal precision、unsupported rate、citation hit rate、retrieval recall、p95 latency の劣化が許容閾値内に収まる場合だけ検討する。

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

Allganize RAG-Evaluation-Dataset-JA:

```bash
ALLGANIZE_RAG_LIMIT=10 \
task benchmark:allganize:ja
```

この task は Hugging Face の `allganize/RAG-Evaluation-Dataset-JA` から `rag_evaluation_result.csv` と `documents.csv` を取得し、`.local-data/allganize-rag-evaluation-ja/dataset.jsonl` と `.local-data/allganize-rag-evaluation-ja/corpus/` を作成してから agent benchmark を実行する。source PDF URL が移動または削除されている場合は NDL WARP の最新アーカイブも試行する。`ALLGANIZE_RAG_DOMAIN=finance` などで domain を絞り込み、`ALLGANIZE_RAG_EXPECTED_MODE=strict-contains` で `target_answer` の完全包含判定を有効化できる。既定では `target_answer` は `referenceAnswer` として results に保持し、既存 runner の file/page/citation/retrieval 指標を中心に確認する。

evaluator profile を明示する場合:

```bash
EVALUATOR_PROFILE=default@1 \
BASELINE_SUMMARY=.local-data/benchmark-summary.json \
ALLOW_EVALUATOR_PROFILE_MISMATCH=0 \
npm run start -w @memorag-mvp/benchmark
```

summary JSON と Markdown report には `evaluatorProfile` が出力される。baseline と current の profile id / version が異なる場合は既定で失敗し、参考比較として扱う場合だけ `ALLOW_EVALUATOR_PROFILE_MISMATCH=1` を指定する。未知の evaluator profile と suite-level と異なる row-level `evaluatorProfile` は、誤った `recall@K` 集計を避けるため失敗する。

## 確認観点

- `/health` が `ok: true` を返す。
- `/documents` が `documentId`、`chunkCount`、`memoryCardCount` を返す。
- `/chat` が回答本文と `citations`、`retrieved` を返す。
- `/questions` が `questionId` と `status: "open"` を返す。
- `/conversation-history` が `schemaVersion: 1` と `isFavorite` を含む履歴 item を保存できる。
- `/openapi.json` がJSONとして取得できる。
- benchmark CLIが `.local-data/benchmark-results.jsonl`、`.local-data/benchmark-summary.json`、`.local-data/benchmark-report.md` を作成する。
- benchmark summary が回答可能問題、不回答問題、fact slot 付き問題、確認質問問題の評価に必要な集計項目を出力する。
- benchmark summary / report に `evaluatorProfile` が出力され、profile mismatch が成功扱いされない。
- `/chat` の debug trace に `ragProfile`、structured required facts、typed claim conflict summary が出力され、raw prompt や ACL metadata が通常応答に露出しない。
- SWEBOK 要求分類の補正は `domainPolicy: "swebok-requirements"` などの document metadata または内部 policy 選択時だけ有効で、default policy では汎用分類質問へ固定語彙を注入しない。
- benchmark Markdown report の `Dataset Coverage` で dataset 内の期待値分母を確認でき、`Metrics` の `status=not_applicable` と評価済みの `0.0%` / `0` を区別できる。
- 回答可能な通常QAだけの dataset では、clarification / refusal / post-clarification / fact slot / page / LLM judge label-rate 系が `not_applicable` になり、通常QAの主要指標は `answerable_accuracy`、`over_clarification_rate`、retrieval / citation / latency 系として読める。
