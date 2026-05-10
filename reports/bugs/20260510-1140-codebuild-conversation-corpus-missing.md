## 障害レポート

**保存先:** `reports/bugs/20260510-1140-codebuild-conversation-corpus-missing.md`
**概要:** CodeBuild の `mtrag-v1` benchmark runner が `benchmark/corpus/mtrag-v1` を `scandir` できず、BUILD phase で失敗した。
**重大度:** `S1_high`
**状態:** `resolved_local`
**影響:** `mtrag-v1` の conversation benchmark が開始前の corpus seed で停止し、実測結果 artifact は生成されず、post_build の fallback artifact だけが S3 に保存された。
**原因仮説:** CodeBuild runner は `suites.codebuild.json` で `BENCHMARK_CORPUS_DIR=benchmark/corpus/mtrag-v1` を期待していたが、CodeBuild source checkout にその corpus directory が存在することを保証していなかった。CDK deploy は conversation dataset だけを `BenchmarkBucket` に配置し、対応する conversation corpus を runner 入力として配置・取得していなかった。
**現在の対応:** `mtrag-v1` / `chatrag-bench-v1` の conversation corpus を CDK deploy で `BenchmarkBucket` の `corpus/conversation/` に配置し、CodeBuild prepare 時に runner 用一時 directory へ `aws s3 cp --recursive` で取得する修正を入れた。
**次のアクション:** PR merge と CDK deploy 後、実 AWS CodeBuild で `mtrag-v1` と `chatrag-bench-v1` を再実行し、corpus 取得と seed が通ることを確認する。

## なぜなぜ分析

| Why | 質問 | 回答 | 根拠 |
|---:|---|---|---|
| 1 | なぜ BUILD phase が失敗したか | `seedBenchmarkCorpus()` が `benchmark/corpus/mtrag-v1` を `readdir` し、`ENOENT` で例外終了したため。 | CodeBuild log の `Error: ENOENT: no such file or directory, scandir 'benchmark/corpus/mtrag-v1'` |
| 2 | なぜ `benchmark/corpus/mtrag-v1` が存在しなかったか | CodeBuild runner が source checkout 内の固定 corpus path を期待していた一方、実行環境ではその directory が存在しなかったため。 | `suites.codebuild.json` の旧 `corpus.dir` と CodeBuild log |
| 3 | なぜ CodeBuild 入力準備で corpus が保証されなかったか | CodeBuild prepare は `DATASET_S3_URI` から conversation JSONL を取得するだけで、conversation corpus を S3 から取得する仕組みがなかったため。 | `codebuild-suite.ts` の旧 `copyCodeBuildInputDataset()` |
| 4 | なぜ dataset と corpus の配置がずれたか | CDK は `datasets/conversation/` に JSONL を配置していたが、対応する `corpus/conversation/` を配置していなかったため。 | `infra/lib/memorag-mvp-stack.ts` の旧 `DeployConversationBenchmarkDatasets` |
| 5 | なぜテストで検出できなかったか | manifest 解決テストは standard / dynamic prepare の corpus 設定を見ていたが、conversation suite が CodeBuild bucket から corpus を取得できることを検証していなかったため。 | 追加前の `codebuild-suite.test.ts` |

## 修正内容

- `memorag-bedrock-mvp/benchmark/suites.codebuild.json` に `mtrag-v1` / `chatrag-bench-v1` の `corpus.source = "codebuild-bucket"`、runner 用 directory、S3 prefix を追加した。
- `memorag-bedrock-mvp/benchmark/codebuild-suite.ts` に CodeBuild bucket corpus の取得処理を追加した。
- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` に `corpus/conversation/` への `BucketDeployment` を追加した。
- `memorag-bedrock-mvp/benchmark/codebuild-suite.test.ts` と `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts` で manifest 解決と CDK 配置を検証した。
- README、`docs/OPERATIONS.md`、`docs/GITHUB_ACTIONS_DEPLOY.md` に CodeBuild conversation corpus の配置方式を反映した。

## 検証

- `npm ci`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: fail -> snapshot 更新後 pass、通常モード再実行 pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: pass
- `git diff --check`: pass
- `pre-commit run --files <changed-files>`: pass

## 未検証・残リスク

- 実 AWS CodeBuild の `mtrag-v1` / `chatrag-bench-v1` 再実行は未実施。CDK deploy 後の実環境確認が必要。
- `npm ci` で既存の `npm audit` 警告 3 件が表示されたが、今回の corpus 入力準備修正とは別件として未対応。

```json failure_report
{
  "schema_version": "1.0.0",
  "report_id": "FR-20260510-114000-CBCORPUS",
  "created_at": "2026-05-10T11:40:00+09:00",
  "incident_type": "runtime_error",
  "failure_mode": "missing_input_directory",
  "severity": "S1_high",
  "status": "resolved_local",
  "summary": "CodeBuild conversation benchmark failed because benchmark/corpus/mtrag-v1 was missing before corpus seeding.",
  "user_request": "CodeBuild failure log をもとに修正し、障害レポートを作成する。",
  "expected": "mtrag-v1 CodeBuild benchmark prepares dataset and corpus, seeds benchmark documents, and then runs conversation turns.",
  "actual": "Node.js failed with ENOENT while scanning benchmark/corpus/mtrag-v1 in seedBenchmarkCorpus.",
  "impact": {
    "user": "mtrag-v1 benchmark run failed before producing real benchmark results.",
    "artifacts": [
      "benchmark/.runner-results.jsonl",
      "benchmark/.runner-summary.json",
      "benchmark/.runner-report.md"
    ],
    "scope": "memorag-bedrock-mvp CodeBuild benchmark runner"
  },
  "evidence": [
    "CodeBuild log: Error: ENOENT: no such file or directory, scandir 'benchmark/corpus/mtrag-v1'",
    "Stack: seedBenchmarkCorpus -> listCorpusFiles -> readdir",
    "Command failed: npm run codebuild:run -w @memorag-mvp/benchmark",
    "post_build uploaded fallback empty results, summary errorRate=1, and failed report"
  ],
  "suspected_root_cause": "Conversation suites depended on a corpus directory in the CodeBuild source checkout, while CDK only deployed conversation datasets to the benchmark bucket and the runner had no step to fetch matching corpus files.",
  "actions_taken": [
    {
      "owner": "codex",
      "action": "Added codebuild-bucket corpus source entries for mtrag-v1 and chatrag-bench-v1.",
      "status": "done"
    },
    {
      "owner": "codex",
      "action": "Added runner prepare logic to copy conversation corpus from BenchmarkBucket into .runner-* corpus directories.",
      "status": "done"
    },
    {
      "owner": "codex",
      "action": "Added CDK BucketDeployment for corpus/conversation and updated infra snapshot.",
      "status": "done"
    },
    {
      "owner": "codex",
      "action": "Updated README and operations docs to describe the CodeBuild corpus placement.",
      "status": "done"
    }
  ],
  "corrective_actions": [
    {
      "owner": "codex",
      "action": "Keep manifest tests covering both mtrag-v1 and chatrag-bench-v1 corpus source resolution.",
      "due": "2026-05-10",
      "status": "done"
    },
    {
      "owner": "operator",
      "action": "After merge and CDK deploy, rerun mtrag-v1 and chatrag-bench-v1 in AWS CodeBuild.",
      "due": "post_deploy",
      "status": "pending"
    }
  ],
  "open_questions": [
    "Whether the failing CodeBuild source revision omitted the committed sample corpus directory, or the source checkout was otherwise pruned, was not directly verifiable from the provided log."
  ],
  "confidence": "high",
  "tags": [
    "benchmark",
    "codebuild",
    "mtrag-v1",
    "chatrag-bench-v1",
    "conversation-rag",
    "corpus"
  ],
  "environment": {
    "runner": "AWS CodeBuild On-demand",
    "node": "v22.22.0",
    "npm": "11.7.0",
    "suite": "mtrag-v1",
    "build_phase": "BUILD"
  },
  "affected_artifacts": [
    "memorag-bedrock-mvp/benchmark/codebuild-suite.ts",
    "memorag-bedrock-mvp/benchmark/suites.codebuild.json",
    "memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts",
    "memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts",
    "memorag-bedrock-mvp/infra/test/__snapshots__/memorag-mvp-stack.snapshot.json",
    "memorag-bedrock-mvp/README.md",
    "memorag-bedrock-mvp/docs/OPERATIONS.md",
    "memorag-bedrock-mvp/docs/GITHUB_ACTIONS_DEPLOY.md"
  ],
  "reproduction": {
    "steps": [
      "Run CodeBuild suite mtrag-v1 with BENCHMARK_CORPUS_DIR pointing to benchmark/corpus/mtrag-v1.",
      "Ensure that directory is absent from the CodeBuild source checkout.",
      "Run npm run codebuild:run -w @memorag-mvp/benchmark.",
      "Observe ENOENT from listCorpusFiles."
    ],
    "result": "BUILD phase fails before benchmark conversation turns run."
  },
  "validation": {
    "passed": [
      "npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark",
      "npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra",
      "npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark",
      "npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra",
      "git diff --check",
      "pre-commit run --files <changed-files>"
    ],
    "notes": [
      "Infra test initially failed only because the CDK snapshot needed to be updated for the added BucketDeployment.",
      "Real AWS CodeBuild rerun was not performed in this local fix."
    ]
  },
  "timeline": [
    {
      "time": "2026-05-10T01:47:03Z",
      "event": "CodeBuild run started."
    },
    {
      "time": "2026-05-10T01:48:36Z",
      "event": "BUILD phase started npm run codebuild:run."
    },
    {
      "time": "2026-05-10T01:48:38Z",
      "event": "Runner failed with ENOENT for benchmark/corpus/mtrag-v1."
    },
    {
      "time": "2026-05-10T01:48:37Z",
      "event": "post_build created fallback artifacts and uploaded them to S3."
    },
    {
      "time": "2026-05-10T11:05:00+09:00",
      "event": "Local fix and work report were completed."
    },
    {
      "time": "2026-05-10T11:40:00+09:00",
      "event": "Failure report was added."
    }
  ],
  "prevention": [
    "Treat dataset and corpus as paired benchmark suite inputs.",
    "Keep CodeBuild suite manifest tests for conversation corpus source resolution.",
    "Document deploy-time corpus placement and runner-time corpus fetch behavior."
  ],
  "related_reports": [
    "reports/working/20260510-1105-codebuild-conversation-corpus.md"
  ],
  "redactions": []
}
```
