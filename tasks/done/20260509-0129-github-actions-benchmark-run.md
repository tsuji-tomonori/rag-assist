# GitHub Actions から benchmark run を起動する workflow 追加

保存先: `tasks/done/20260509-0129-github-actions-benchmark-run.md`

状態: done

## 背景

GitHub Actions から既存 API の `POST /benchmark-runs` を呼び、Step Functions + CodeBuild の既存経路で性能テストを起動できるようにしたい。CodeBuild を直接起動するより、管理画面の run 履歴、DynamoDB run record、成果物、CodeBuild logs の管理と整合させる方針を採る。

## 目的

手動実行できる GitHub Actions workflow を追加し、AWS OIDC で必要値を取得して Cognito ID token を発行し、`POST /benchmark-runs` を実行できる状態にする。

## 対象範囲

- `.github/workflows/`
- `memorag-bedrock-mvp/docs/` または関連運用ドキュメント
- task md / 作業レポート

## 方針

- `POST /benchmark-runs` 経由で benchmark を起動し、CodeBuild 直叩きはしない。
- GitHub Actions log に password、ID token、secret JSON、Authorization header を出さない。
- workflow は `workflow_dispatch` とし、suite / mode / model / retrieval パラメータを入力可能にする。
- `BENCHMARK_OPERATOR` または同等の run 起動権限を持つ Cognito user credential を Secrets Manager から読み、`USER_PASSWORD_AUTH` で ID token を取得する。
- 必要な AWS 値は CloudFormation Outputs または GitHub Actions secrets から解決する。

## 必要情報

- 既存 API schema: `POST /benchmark-runs`
- CloudFormation Outputs: `ApiUrl`, `CognitoUserPoolId`, `CognitoUserPoolClientId`
- GitHub Actions OIDC role: repository secret / environment secret `AWS_DEPLOY_ROLE_ARN` を想定
- Operator credential secret: GitHub Actions secret `BENCHMARK_OPERATOR_AUTH_SECRET_ID` または workflow 入力で Secret ID / ARN を指定

## 実行計画

1. `POST /benchmark-runs` schema と API route を確認する。
2. GitHub Actions workflow の入力と AWS / Cognito / API 呼び出し手順を実装する。
3. 運用ドキュメントへ workflow の使い方と secret 前提を追記する。
4. YAML / shell の静的検証、secret 混入チェック、関連 docs check を実行する。
5. 作業レポートを作成し、commit / push / PR / PR コメントまで進める。

## ドキュメントメンテナンス計画

- GitHub Actions から benchmark run を起動する運用手順を `memorag-bedrock-mvp/docs/GITHUB_ACTIONS_DEPLOY.md` または `OPERATIONS.md` に追記する。
- API contract 自体は変更しないため OpenAPI 更新は不要。
- workflow の required secrets / permissions / output を PR 本文に記載する。

## 受け入れ条件

- GitHub Actions workflow が `POST /benchmark-runs` 経由で benchmark run を起動する設計になっている。
- workflow log に password、ID token、secret JSON、Authorization header を出さない作りになっている。
- workflow_dispatch 入力で suite / mode / model / retrieval パラメータを指定できる。
- 必要な AWS / Cognito / Secrets Manager 前提がドキュメント化されている。
- YAML と変更ファイルの静的検証を実行している。
- 作業完了レポートが `reports/working/` に保存されている。

## 検証計画

- `git diff --check`
- workflow YAML の構文確認
- secret 値を echo していないことの grep 確認
- `pre-commit run --files <changed-files>`
- 可能であれば GitHub Actions workflow の手動実行または `gh workflow view` 相当の確認

## PRレビュー観点

- CodeBuild 直接起動ではなく API / Step Functions / CodeBuild の既存経路を使っていること。
- GitHub Actions から secret 値をログへ出さないこと。
- GitHub Actions OIDC role の権限が CloudFormation describe、Secrets Manager read、Cognito initiate-auth に限定可能な形で説明されていること。
- `BENCHMARK_RUNNER` と `BENCHMARK_OPERATOR` の使い分けを誤っていないこと。
- 未実行の remote benchmark を実行済みとして書いていないこと。

## 未決事項・リスク

- 実際の workflow 手動実行は AWS role / Secrets Manager secret の存在に依存する。
- GitHub Actions OIDC role が `secretsmanager:GetSecretValue` と `cognito-idp:InitiateAuth` を持たない場合、token 取得で失敗する。
- operator secret の username は benchmark run 起動権限を持つ Cognito group に属している必要がある。

## 実施結果メモ

- `.github/workflows/memorag-benchmark-run.yml` を追加し、`workflow_dispatch` から `POST /benchmark-runs` を呼ぶ経路を実装した。
- workflow は CloudFormation Outputs から `ApiUrl`、`CognitoUserPoolId`、`CognitoUserPoolClientId` を取得し、Secrets Manager secret の `idToken` / `token` または `username` / `password` から ID token を用意する。
- token、password、secret JSON は `::add-mask::` 対象にし、GitHub step summary / output には runId、status、suite、mode、API URL、CodeBuild log URL、metrics のみを書く。
- `memorag-bedrock-mvp/infra/bootstrap/github-actions-oidc-role.yaml` に `AllowedBenchmarkWorkflowRef` を追加し、benchmark workflow が OIDC role を assume できるようにした。
- `memorag-bedrock-mvp/docs/GITHUB_ACTIONS_DEPLOY.md` と `memorag-bedrock-mvp/docs/OPERATIONS.md` に運用手順、必要 secret、必要 IAM 権限、未ログ化方針を追記した。
- 実 AWS での workflow 手動実行は、対象 role / secret の存在確認と外部状態変更を伴うためこの作業内では未実施。
- PR #208 を作成し、受け入れ条件確認コメントとセルフレビューコメントを投稿した。
