---
name: local-performance-benchmark-runner
description: Use when running MemoRAG performance benchmark locally from Codex or another agent, checking benchmark outputs, or handling a local keypass/token without writing secret values into repository files, logs, PR text, reports, or final answers.
---

# Local Performance Benchmark Runner

Use this skill to run MemoRAG benchmark commands from a local Codex workspace and verify the generated results. Never write keypass, token, password, or Cognito credential values into files, command output, reports, PR text, or final answers.

## Preconditions

- Work from a dedicated worktree.
- Install dependencies in `memorag-bedrock-mvp` if `node_modules` is missing:

```bash
npm install
```

- For local mock execution, start the API with local vector store and a benchmark-capable local user:

```bash
/usr/bin/env PORT=18787 MOCK_BEDROCK=true USE_LOCAL_VECTOR_STORE=true LOCAL_DATA_DIR=.local-data LOCAL_AUTH_GROUPS=BENCHMARK_RUNNER LOCAL_AUTH_USER_ID=benchmark-runner npm run start -w @memorag-mvp/api
```

- Confirm readiness without secrets:

```bash
curl -i http://127.0.0.1:18787/health
```

## Running Agent Benchmark

From `memorag-bedrock-mvp`:

```bash
API_BASE_URL=http://localhost:18787 task benchmark:sample
```

Expected outputs:

- `.local-data/benchmark-results.jsonl`
- `.local-data/benchmark-summary.json`
- `.local-data/benchmark-report.md`

## Checking Results

Use the summary JSON for machine-readable status:

```bash
node -e "const fs=require('fs'); const s=JSON.parse(fs.readFileSync('.local-data/benchmark-summary.json','utf8')); console.log(JSON.stringify({total:s.total,succeeded:s.succeeded,failedHttp:s.failedHttp,metrics:s.metrics}, null, 2))"
```

Use the Markdown report for reviewer-readable details:

```bash
sed -n '1,90p' .local-data/benchmark-report.md
```

A successful local sample run should have `failedHttp: 0`, a nonzero row count, and generated JSONL / JSON / Markdown artifacts.

## Remote Or Authenticated API Notes

If targeting a deployed API, set `API_BASE_URL` to the deployed API URL and pass an ID token through `API_AUTH_TOKEN`. Do not store the token in shell history, task files, reports, or skill files.

If the supplied keypass file is a bearer token, read it directly into the environment without printing it:

```bash
API_AUTH_TOKEN="$(tr -d '\r\n' < /path/to/keypass.txt)" API_BASE_URL=https://example.execute-api.region.amazonaws.com/prod/ task benchmark:sample
```

If the keypass file contains username/password instead of an ID token, first obtain a Cognito ID token using the deployed app's Cognito region and app client ID, then pass only the resulting ID token as `API_AUTH_TOKEN`. Do not persist the password or token. If Cognito config or AWS credentials are unavailable, report the remote authenticated run as blocked instead of claiming success.

Before running a full remote benchmark, a non-mutating status check can confirm whether a candidate token is accepted:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer ${API_AUTH_TOKEN}" "${API_BASE_URL%/}/health"
```

`200` indicates the token is accepted for `/health`; `401` means the token is absent, expired, or not an ID token accepted by the API.

## Validation And Reporting

Record only:

- command names
- output file paths
- aggregate metrics such as total rows, HTTP failures, and latency
- whether local, remote, sandbox, or escalated execution was used

Do not record:

- keypass contents
- bearer tokens
- passwords
- full Authorization headers
- Cognito challenge/session values
