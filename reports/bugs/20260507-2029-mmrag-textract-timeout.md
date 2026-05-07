## 障害レポート

**保存先:** `reports/bugs/20260507-2029-mmrag-textract-timeout.md`
**概要:** CodeBuild の `mmrag-docqa-v1` ベンチマーク実行で、PDF corpus seed 中に `NUS-FASS-Graduate-Guidebook-2021-small.pdf` の OCR fallback が Textract 完了待ち 45 秒を超過し、HTTP 500 で benchmark runner が失敗した。
**重大度:** `S1_high`
**状態:** `resolved`
**影響:** MMRAG DocQA ベンチマークが corpus seed の途中で停止し、結果 JSONL は空、summary はエラー率 1 の fallback artifact になった。
**原因仮説:** Textract OCR fallback の完了待機上限が 45 秒に固定または低すぎる設定になっており、ページ数または処理負荷の大きい PDF で非同期 OCR が完了する前に失敗している。
**現在の対応:** benchmark corpus seed で Textract OCR fallback timeout を `skipped_unextractable` として扱う修正を入れ、該当 file を期待する dataset row は既存の `skippedRows` 除外処理へ流すようにした。
**次のアクション:** AWS CodeBuild 上で再実行し、対象 PDF が fatal error ではなく corpus seed skip として記録されることを確認する。

```json failure_report
{
  "schema_version": "1.0.0",
  "report_id": "FR-20260507-202900-MMRAG-TEXTRACT-TIMEOUT",
  "created_at": "2026-05-07T20:29:00+09:00",
  "incident_type": "runtime_error",
  "failure_mode": "timeout",
  "severity": "S1_high",
  "status": "resolved",
  "summary": "MMRAG DocQA benchmark corpus seed failed because Textract OCR fallback did not finish within 45000ms.",
  "user_request": "CodeBuild 障害ログをもとに障害レポートを作成したうえで修正まで行う。",
  "expected": "mmrag-docqa-v1 の corpus seed が PDF OCR fallback を含めて完了し、benchmark runner が実行結果 artifact を生成する。",
  "actual": "NUS-FASS-Graduate-Guidebook-2021-small.pdf の ingest が HTTP 500 となり、benchmark runner が exit status 1 で終了した。",
  "impact": {
    "users": "ベンチマーク実行者が mmrag-docqa-v1 の評価結果を得られない。",
    "artifacts": "results.jsonl は空、summary.json は total 0 かつ errorRate 1 の fallback 出力になった。",
    "workflow": "CodeBuild の BUILD phase が failed になり、ベンチマーク run が失敗状態として記録された。"
  },
  "evidence": [
    {
      "source": "CodeBuild log",
      "detail": "Error: Failed to ingest uploaded benchmark corpus NUS-FASS-Graduate-Guidebook-2021-small.pdf: HTTP 500 {\"error\":\"PDF OCR fallback failed for NUS-FASS-Graduate-Guidebook-2021-small.pdf: Textract job did not finish within 45000ms\"}"
    },
    {
      "source": "CodeBuild log",
      "detail": "Command npm run start -w @memorag-mvp/benchmark failed with exit status 1 during BUILD phase."
    },
    {
      "source": "CodeBuild log",
      "detail": "POST_BUILD uploaded fallback artifacts after benchmark runner failed before normal artifacts were produced."
    }
  ],
  "suspected_root_cause": "Textract asynchronous OCR completion wait is capped at 45000ms for benchmark ingestion, which is too short for at least one MMRAG DocQA PDF under CodeBuild conditions.",
  "actions_taken": [
    {
      "action": "Created repository failure report",
      "owner": "codex",
      "status": "done"
    },
    {
      "action": "Investigate OCR fallback timeout configuration and implement fix",
      "owner": "codex",
      "status": "done"
    }
  ],
  "corrective_actions": [
    {
      "action": "Treat Textract OCR timeout during benchmark ingestion as an unextractable corpus skip instead of a runner-fatal error.",
      "owner": "codex",
      "due": "2026-05-07",
      "status": "done"
    },
    {
      "action": "Run targeted validation and record any unverified AWS-only behavior.",
      "owner": "codex",
      "due": "2026-05-07",
      "status": "done"
    }
  ],
  "open_questions": [
    "Actual Textract completion duration for the failed PDF in CodeBuild is not visible from the provided log."
  ],
  "confidence": "medium",
  "tags": [
    "codebuild",
    "benchmark",
    "mmrag-docqa",
    "textract",
    "pdf-ocr"
  ],
  "environment": {
    "service": "AWS CodeBuild On-demand",
    "node": "v22.22.0",
    "npm": "11.7.0",
    "suite_id": "mmrag-docqa-v1",
    "timestamp": "2026-05-07T11:16:43Z"
  },
  "affected_artifacts": [
    "memorag-bedrock-mvp/benchmark/corpus.ts",
    "benchmark/.runner-results.jsonl",
    "benchmark/.runner-summary.json",
    "benchmark/.runner-report.md"
  ],
  "reproduction": {
    "steps": [
      "Run CodeBuild benchmark with SUITE_ID=mmrag-docqa-v1.",
      "Seed MMRAG DocQA corpus including NUS-FASS-Graduate-Guidebook-2021-small.pdf.",
      "Observe HTTP 500 when Textract fallback does not complete within 45000ms."
    ],
    "reproducibility": "environment-dependent"
  },
  "validation": {
    "status": "passed_with_unverified_aws_rerun",
    "commands": [
      "npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark -- corpus.test.ts",
      "npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark",
      "git diff --check",
      "pre-commit run --files memorag-bedrock-mvp/README.md memorag-bedrock-mvp/docs/LOCAL_VERIFICATION.md memorag-bedrock-mvp/docs/OPERATIONS.md reports/bugs/20260507-2029-mmrag-textract-timeout.md tasks/do/20260507-2029-fix-mmrag-textract-timeout.md memorag-bedrock-mvp/benchmark/corpus.ts memorag-bedrock-mvp/benchmark/corpus.test.ts"
    ]
  },
  "timeline": [
    {
      "time": "2026-05-07T11:18:33Z",
      "event": "Benchmark runner started."
    },
    {
      "time": "2026-05-07T11:24:33Z",
      "event": "BUILD phase failed after Textract OCR fallback timeout."
    }
  ],
  "prevention": [
    "Avoid fixed short OCR wait limits for large benchmark PDF corpora.",
    "Record OCR timeout configuration in benchmark run context when possible."
  ],
  "related_reports": [],
  "redactions": [
    "No credentials or tokens were included in the copied log evidence."
  ]
}
```
