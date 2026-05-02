# 作業完了レポート

保存先: `reports/working/20260502-1500-benchmark-runner-auth.md`

## 1. 受けた指示

- 本番 API を叩く CodeBuild benchmark runner の `API_AUTH_TOKEN` secret 注入を、管理画面の実行者が意識せず「ボタン一つ」で動くようにしたい。
- 方針を検討し、別ブランチで実施する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 最新 main から別ブランチを作成する | 高 | 対応 |
| R2 | 管理画面から token 入力なしで benchmark を実行できる構成にする | 高 | 対応 |
| R3 | 既存の HTTP API + Cognito JWT authorizer 経路を維持する | 高 | 対応 |
| R4 | runner 用認証情報の運用手順を更新する | 中 | 対応 |
| R5 | Infra と認証境界のテストを更新する | 高 | 対応 |

## 3. 検討・判断したこと

- 管理者の token を Step Functions / CodeBuild に引き回す案は、token 有効期限と権限過大のリスクがあるため採用しなかった。
- API Gateway の JWT authorizer を迂回する専用 public endpoint は、本番 API を叩く性能評価の前提と認証境界を崩すため採用しなかった。
- CDK が runner 用 Secrets Manager secret を作成し、CodeBuild が起動時に `BENCHMARK_RUNNER` service user を作成または修復して Cognito id token を取得する方式を採用した。
- 既存の `benchmarkRunnerAuthSecretId` context は、外部管理 secret を使いたい場合の override として残した。

## 4. 実施した作業

- `codex/benchmark-runner-auth` worktree/branch を最新 `origin/main` から作成した。
- CDK に `BenchmarkRunnerAuthSecret` を追加し、既定で `benchmark-runner@memorag.local` とランダム password を生成するようにした。
- CodeBuild runner に `COGNITO_USER_POOL_ID`、`COGNITO_APP_CLIENT_ID`、`BENCHMARK_AUTH_SECRET_ID`、`BENCHMARK_RUNNER_GROUP` を渡すようにした。
- `infra/scripts/resolve-benchmark-auth-token.mjs` を追加し、CodeBuild pre_build で service user の作成、恒久 password 設定、group 付与、id token 取得を行うようにした。
- CodeBuild role に generated secret の read 権限と、対象 User Pool への runner user 管理権限を付与した。
- README と Operations の benchmark 認証説明を、自動 token 取得方式に更新した。
- Infra test と snapshot を更新した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | TypeScript | managed secret と CodeBuild runner 認証設定 | token 手動注入不要化 |
| `memorag-bedrock-mvp/infra/scripts/resolve-benchmark-auth-token.mjs` | Node.js script | service user self-heal と id token 取得 | 1 click 実行の裏側処理 |
| `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts` | Test | secret/env/IAM の静的確認 | 回帰防止 |
| `memorag-bedrock-mvp/README.md` | Markdown | benchmark runner 認証の説明更新 | docs maintenance |
| `memorag-bedrock-mvp/docs/OPERATIONS.md` | Markdown | 運用手順更新 | docs maintenance |

## 6. 指示への fit 評価

| 評価軸 | 評価 | 理由 |
|---|---|---|
| 指示網羅性 | 4.7 / 5 | token 入力なしの benchmark 実行方針を実装し、別ブランチ化した。 |
| 制約遵守 | 4.8 / 5 | 既存 JWT authorizer を維持し、docs/test/security 観点も反映した。 |
| 成果物品質 | 4.5 / 5 | Infra test と lint は通したが、実 AWS CodeBuild ジョブは未実行。 |
| 説明責任 | 4.8 / 5 | 採用しなかった案と権限境界を記録した。 |

総合 fit: 4.7 / 5.0

## 7. 検証

- `npm install --prefix memorag-bedrock-mvp`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run lint -- --max-warnings=0`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: snapshot 差分検出のため fail
- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass
- `node --check memorag-bedrock-mvp/infra/scripts/resolve-benchmark-auth-token.mjs`: pass
- `git diff --check`: pass

## 8. 未対応・制約・リスク

- 実 AWS 環境での CodeBuild 実行、Cognito user 作成、id token 取得、`/benchmark/query` 疎通は未実施。
- CodeBuild role は対象 User Pool に対して runner user の作成・password 設定・group 付与権限を持つ。権限は User Pool に scoped しているが、GitHub source branch の保護と CodeBuild 実行権限の管理が前提になる。
- 外部管理 secret を使う場合は、引き続き `benchmarkRunnerAuthSecretId` context で明示指定できる。
