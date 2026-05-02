# 作業完了レポート

保存先: `reports/working/20260502-1354-benchmark-runs-admin.md`

## 1. 受けた指示

- 管理画面から既存 benchmark を非同期ジョブとして起動できるようにする。
- 管理画面はジョブ起動、履歴表示、結果ダウンロードに限定する。
- 実行本体は Step Functions + CodeBuild runner に逃がす。
- DynamoDB に run 状態、S3 に dataset と成果物を保存する。
- 専用 benchmark 権限を追加し、`/benchmark/query` も runner から認証付きで呼べるようにする。
- worktree を作成し、commit と main 向け PR 作成まで行う。

## 2. 要件整理

| 要件ID | 指示・要件 | 対応状況 |
|---|---|---|
| R1 | 作業用 worktree を作成する | 対応 |
| R2 | `POST /benchmark-runs` などの run 管理 API を追加する | 対応 |
| R3 | Step Functions + CodeBuild runner の CDK resource を追加する | 対応 |
| R4 | DynamoDB と S3 に run 状態と成果物を分離保存する | 対応 |
| R5 | 管理画面に性能テスト view を追加する | 対応 |
| R6 | benchmark runner に `Authorization` header を追加する | 対応 |
| R7 | 専用 RBAC と静的 access-control test を更新する | 対応 |
| R8 | docs と運用手順を更新する | 対応 |

## 3. 検討・判断したこと

- Phase 1 は `mode=agent`、`runner=codebuild` のみ対応し、Search 評価と負荷テストは後続拡張に残した。
- UI から任意 API URL は渡さず、API Lambda の環境変数 `BENCHMARK_TARGET_API_BASE_URL` で解決する形にした。
- CodeBuild runner の認証は `API_AUTH_TOKEN` を直接使えるようにし、CDK では Secrets Manager secret から `idToken` / `token` または Cognito username/password を扱える buildspec を追加した。
- `BENCHMARK_RUNNER` は `/benchmark/query` 実行のみ許可し、管理画面の履歴や download は `SYSTEM_ADMIN` / `RAG_GROUP_MANAGER` 側に分離した。
- Step Functions は run 状態を `running`、`succeeded`、`failed` に更新し、成果物キーは S3 path として run record に保持する構成にした。

## 4. 実施した作業

- API に benchmark run store、local/DynamoDB 実装、schema、service method、OpenAPI route を追加した。
- `benchmark:read`、`benchmark:run`、`benchmark:cancel`、`benchmark:download` と `BENCHMARK_RUNNER` role を追加した。
- CDK に `BenchmarkBucket`、`BenchmarkRunsTable`、dataset deployment、`BenchmarkProject`、`BenchmarkStateMachine`、IAM grant、Lambda 環境変数を追加した。
- Web UI に「性能テスト」nav、起動フォーム、履歴テーブル、download/cancel 操作を追加した。
- benchmark CLI の fetch に `API_AUTH_TOKEN` 由来の `Authorization: Bearer` header を追加した。
- README、API examples、API design、operations、GitHub Actions user creation、Cognito user作成 script を更新した。
- API/Web/Infra の typecheck、test、lint、build、benchmark sample を実行した。

## 5. 成果物

| 成果物 | 内容 |
|---|---|
| `memorag-bedrock-mvp/apps/api/src/app.ts` | benchmark run 管理 endpoint と `/benchmark/query` 専用権限化 |
| `memorag-bedrock-mvp/apps/api/src/adapters/*benchmark-run-store.ts` | local/DynamoDB run store |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | S3/DynamoDB/Step Functions/CodeBuild resource |
| `memorag-bedrock-mvp/apps/web/src/App.tsx` | 性能テスト view |
| `memorag-bedrock-mvp/benchmark/run.ts` | bearer token 対応 |
| `memorag-bedrock-mvp/docs/*` と `README.md` | 新 API、権限、運用手順 |

## 6. 指示へのfit評価

総合fit: 4.6 / 5.0（約92%）

理由: Phase 1 の「管理画面から非同期 benchmark run を起動し、履歴と report download を扱う」中核は実装し、Step Functions + CodeBuild + S3 + DynamoDB + RBAC も接続した。一方で Search 評価、負荷テスト、summary metric の DynamoDB への自動転記は後続 Phase として未実装のため満点ではない。

## 7. 検証

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`
- `npm --prefix memorag-bedrock-mvp run lint`
- `npm --prefix memorag-bedrock-mvp run build --workspaces --if-present`
- `API_BASE_URL=http://127.0.0.1:18994 ... npm run start -w @memorag-mvp/benchmark`
- `git diff --check`

`task docs:check:changed` はこの worktree の `Taskfile.yaml` に定義されていなかったため未実行。

## 8. 未対応・制約・リスク

- Search API 評価と負荷テストは Phase 2 / Phase 3 として未実装。
- Step Functions は現時点で CodeBuild 成功後の主要 metric 転記までは行わず、S3 の `summary.json` を成果物として保持する。
- CodeBuild の GitHub source は既定で `tsuji-tomonori/rag-assist` の `main` を参照する。別 repo/branch で運用する場合は CDK context `benchmarkSourceOwner`、`benchmarkSourceRepo`、`benchmarkSourceBranch` を指定する必要がある。
- 本番 runner 認証には Secrets Manager secret と Cognito service user の作成が別途必要。
