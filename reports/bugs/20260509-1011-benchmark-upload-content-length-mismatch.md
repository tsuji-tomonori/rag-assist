## 障害レポート

**保存先:** `reports/bugs/20260509-1011-benchmark-upload-content-length-mismatch.md`
**概要:** CodeBuild の `mmrag-docqa-v1` benchmark runner が PDF corpus の upload session 転送中に `UND_ERR_REQ_CONTENT_LENGTH_MISMATCH` で失敗した。Node.js 22 / undici が request body の実 byte length と `Content-Length` header の不一致を検出して fetch を中断した。
**重大度:** `S1_high`
**状態:** `resolved`
**影響:** benchmark BUILD phase が失敗し、結果 artifact は runner failed の空結果になった。MMRAG-DocQA corpus の評価実行が完了しない。
**原因仮説:** upload session response の `headers` を benchmark runner がそのまま転送 request に引き継ぐため、API または署名 URL 発行側が古い/上限値由来の `Content-Length` を返した場合、実際に送る PDF content byte length と不一致になる。Node.js 22 の undici はこの不一致を `RequestContentLengthMismatchError` として即時失敗させる。
**現在の対応:** benchmark runner 側で upload session headers を組み立てる際、`Content-Length` など fetch が body から決定すべき header を除外し、body は読み込んだ file content と同じ byte length の `Uint8Array` として渡す修正を入れた。
**次のアクション:** 修正 PR merge 後、必要に応じて同じ `mmrag-docqa-v1` suite の CodeBuild benchmark を再実行する。

## なぜなぜ分析

1. なぜ CodeBuild の BUILD phase が失敗したか。
   - benchmark runner の `uploadDocumentFromUploadSession` が PDF upload 中に `TypeError: fetch failed` を投げたため。
2. なぜ fetch が失敗したか。
   - undici が `RequestContentLengthMismatchError` を投げ、request body length と `Content-Length` header が一致しなかったため。
3. なぜ body length と `Content-Length` header が一致しなかったか。
   - upload session response の headers を runner が無条件で転送 request に流用しており、実際の PDF byte length ではない `Content-Length` が含まれる可能性を排除していなかったため。
4. なぜその可能性が見落とされたか。
   - S3 署名 URL 発行側には `Content-Length` を返さない test があったが、client 側で外部から返った upload headers を安全に正規化する test がなかったため。
5. なぜ再発し得るか。
   - upload session headers は API 境界を越える contract であり、将来の API 実装、local upload fallback、proxy、古い deployment が request body size header を返すと、runner 側だけでは防げないため。

## 再発防止

- benchmark runner 側で `Content-Length` を信頼せず、fetch/undici に body から計算させる。
- upload session 転送の header 正規化を unit test で固定する。
- 実 CodeBuild の再実行が必要な場合は、修正 PR merge 後に同じ `mmrag-docqa-v1` suite で確認する。

```json failure_report
{
  "schema_version": "1.0.0",
  "report_id": "FR-20260509-101100-BMCL",
  "created_at": "2026-05-09T10:11:00+09:00",
  "incident_type": "runtime_error",
  "failure_mode": "command_failed",
  "severity": "S1_high",
  "status": "resolved",
  "summary": "CodeBuild benchmark runner failed during PDF upload session transfer with UND_ERR_REQ_CONTENT_LENGTH_MISMATCH.",
  "user_request": "CodeBuild failure log をもとに障害レポートを作成し、なぜなぜ分析をして修正する。",
  "expected": "mmrag-docqa-v1 benchmark corpus PDFs are uploaded and benchmark runner proceeds beyond corpus seeding.",
  "actual": "Node.js 22.22.0 undici aborted fetch in benchmark/corpus.ts uploadDocumentFromUploadSession with RequestContentLengthMismatchError.",
  "impact": "The benchmark BUILD phase failed and only fallback empty runner artifacts were uploaded.",
  "evidence": [
    "CodeBuild log: TypeError: fetch failed at benchmark/corpus.ts:313:26",
    "Cause: RequestContentLengthMismatchError: Request body length does not match content-length header",
    "Command failed: npm run start -w @memorag-mvp/benchmark",
    "The failure occurred after MMRAG-DocQA dataset and PDF corpus preparation, before benchmark artifacts were produced."
  ],
  "suspected_root_cause": "Benchmark runner forwarded upload session headers directly to fetch; if a stale or max-size Content-Length header is present, it can differ from the actual PDF Buffer byte length and trigger undici's mismatch guard.",
  "actions_taken": [
    {
      "owner": "codex",
      "action": "Created this failure report with five-whys analysis.",
      "status": "done"
    },
    {
      "owner": "codex",
      "action": "Plan to normalize upload session headers and add regression coverage.",
      "status": "done"
    },
    {
      "owner": "codex",
      "action": "Normalized upload session transfer headers in benchmark/corpus.ts and added stale Content-Length regression coverage.",
      "status": "done"
    }
  ],
  "corrective_actions": [
    {
      "owner": "codex",
      "action": "Drop Content-Length from upload session transfer headers in benchmark runner.",
      "due": "2026-05-09",
      "status": "done"
    },
    {
      "owner": "codex",
      "action": "Add benchmark unit test for stale Content-Length headers.",
      "due": "2026-05-09",
      "status": "done"
    }
  ],
  "open_questions": [
    "Whether the failing CodeBuild deployment was running an API version that returned Content-Length in upload session headers is not directly visible from the provided log."
  ],
  "confidence": "medium",
  "tags": [
    "benchmark",
    "codebuild",
    "mmrag-docqa",
    "upload-session",
    "undici",
    "content-length"
  ],
  "environment": {
    "runner": "AWS CodeBuild On-demand",
    "node": "v22.22.0",
    "npm": "11.7.0",
    "suite": "mmrag-docqa-v1"
  },
  "affected_artifacts": [
    "memorag-bedrock-mvp/benchmark/corpus.ts",
    "memorag-bedrock-mvp/benchmark/corpus.test.ts"
  ],
  "reproduction": {
    "steps": [
      "Return an upload session with a Content-Length header that differs from the PDF file byte length.",
      "Run seedBenchmarkCorpus for a PDF file.",
      "Observe Node.js 22 fetch failing before upload completes."
    ]
  },
  "validation": {
    "passed": [
      "npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark",
      "npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark",
      "git diff --check"
    ],
    "notes": [
      "Initial test/typecheck attempt failed because worktree dependencies were not installed; npm ci was run and the same checks then passed.",
      "Real CodeBuild rerun was not performed in this local fix."
    ]
  },
  "timeline": [
    {
      "time": "2026-05-08T13:53:10+09:00",
      "event": "CodeBuild BUILD phase started benchmark runner."
    },
    {
      "time": "2026-05-08T13:53:12+09:00",
      "event": "fetch failed with UND_ERR_REQ_CONTENT_LENGTH_MISMATCH."
    },
    {
      "time": "2026-05-09T10:11:00+09:00",
      "event": "Failure report and fix task started."
    }
  ],
  "prevention": [
    "Normalize upload session headers at the benchmark client boundary.",
    "Keep regression coverage for stale Content-Length headers."
  ],
  "related_reports": [
    "reports/bugs/20260507-2029-mmrag-textract-timeout.md"
  ],
  "redactions": []
}
```
