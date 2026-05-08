# GitHub Actions Deploy

このMVPはGitHub ActionsからAWS CDK deployできる。AWS認証はGitHub OIDCを使う。

## Workflow

- `.github/workflows/memorag-deploy.yml`
- `main` branchへのpush、または手動実行で起動する。
- 手動実行: `Actions` -> `Deploy MemoRAG MVP` -> `Run workflow`

入力:

| 入力 | 既定値 | 用途 |
| --- | --- | --- |
| `environment` | `dev` | GitHub Environment名。workflow側で `dev` のみ選択可能（固定choice）とし、承認ルールや環境別secretを使う。 |
| `aws-region` | `us-east-1` | CDK deploy先リージョン。 |
| `bootstrap` | `false` | 初回のみCDK bootstrapを同時実行する。 |
| `default-model-id` | `amazon.nova-lite-v1:0` | 回答生成に使うBedrock model ID。 |
| `embedding-model-id` | `amazon.titan-embed-text-v2:0` | 埋め込みに使うBedrock model ID。 |
| `embedding-dimensions` | `1024` | S3 Vectors index dimension。 |

## Cognitoユーザー作成Workflow

- `.github/workflows/memorag-create-cognito-user.yml`
- 手動実行のみで起動する。
- 手動実行: `Actions` -> `Create MemoRAG Cognito User` -> `Run workflow`
- AWS認証は deploy workflow と同じ `AWS_DEPLOY_ROLE_ARN` を使う。
- 新規ユーザーには Cognito の招待メールを送る。パスワードを GitHub Actions の入力値として扱わない。

入力:

| 入力 | 既定値 | 用途 |
| --- | --- | --- |
| `environment` | `dev` | GitHub Environment名。OIDC trust policyと承認ルールに使う。 |
| `aws-region` | `us-east-1` | Cognito User Poolがあるリージョン。 |
| `stack-name` | `MemoRagMvpStack` | `CognitoUserPoolId` outputを取得するCloudFormation stack名。 |
| `user-pool-id` | 空 | 明示的なCognito User Pool ID。指定時はstack output取得を省略する。 |
| `email` | なし | Cognito userのemail。usernameにも使う。 |
| `display-name` | 空 | Cognito `name` 属性。 |
| `primary-role` | `一般利用者` | 最初に付与するCognito group。日本語名で選択する。 |
| `additional-roles` | 空 | 追加で付与するCognito group。複数指定は日本語名またはCognito group名をカンマ区切りで入力する。 |

ロールは複数付与できる。workflowは主ロールと追加ロールを `infra/scripts/create-cognito-user.sh` の `--role` に複数渡し、スクリプト側で日本語名を Cognito group 名へ正規化する。GitHub Actions から `SYSTEM_ADMIN` / `システム管理者` を付与できるため、環境承認と実行権限を管理者操作の証跡として扱う。

主な role:

| role | 用途 |
| --- | --- |
| `CHAT_USER` | 通常チャット、本人の会話履歴、担当者問い合わせ登録 |
| `ANSWER_EDITOR` | 担当者問い合わせの一覧、回答、解決 |
| `RAG_GROUP_MANAGER` | 文書登録、文書削除、再インデックス運用、benchmark run 起動 |
| `BENCHMARK_OPERATOR` | 管理画面からの性能テスト run 起動、suite/run 履歴参照 |
| `BENCHMARK_RUNNER` | CodeBuild runner から隔離された benchmark corpus を seed し、`/benchmark/query` と `/benchmark/search` を実行 |
| `USER_ADMIN` | Cognito User Pool の全ユーザー参照、管理台帳上のユーザー作成、停止、再開、削除、利用状況確認 |
| `ACCESS_ADMIN` | ロール定義参照、ロール付与、管理操作履歴参照 |
| `COST_AUDITOR` | 概算コスト監査 |
| `SYSTEM_ADMIN` | debug trace、benchmark cancel/download、管理者検証、Phase 2 管理操作 |

ログイン画面からの self sign-up はメール確認後に `CHAT_USER` のみを自動付与する。担当者、管理、監査、`SYSTEM_ADMIN` などの上位権限は、管理ユーザーがこの workflow または AWS 管理手順で後から付与する。

事前条件:

- CDK deploy済みであること。
- `CHAT_USER` などの Cognito group が CDK stackにより作成済みであること。
- `AWS_DEPLOY_ROLE_ARN` のIAM権限に `cloudformation:DescribeStacks` と Cognito IDP の管理操作が含まれること。

## Benchmark Run Workflow

- `.github/workflows/memorag-benchmark-run.yml`
- 手動実行のみで起動する。
- 手動実行: `Actions` -> `Run MemoRAG Benchmark` -> `Run workflow`
- AWS認証は deploy workflow と同じ `AWS_DEPLOY_ROLE_ARN` を使う。
- CodeBuild を直接起動せず、API の `POST /benchmark-runs` を呼び、Step Functions + CodeBuild runner の既存経路で benchmark run を作成する。

入力:

| 入力 | 既定値 | 用途 |
| --- | --- | --- |
| `environment` | `dev` | GitHub Environment名。OIDC trust policyと承認ルールに使う。 |
| `aws-region` | `us-east-1` | MemoRAG stack があるリージョン。 |
| `stack-name` | `MemoRagMvpStack` | `ApiUrl`、`CognitoUserPoolId`、`CognitoUserPoolClientId` outputを取得するCloudFormation stack名。 |
| `operator-auth-secret-id` | 空 | benchmark run 起動用 Cognito user credential を持つ Secrets Manager secret ID/ARN。空の場合は GitHub secret `BENCHMARK_OPERATOR_AUTH_SECRET_ID` を使う。 |
| `suite-id` | `smoke-agent-v1` | 起動する benchmark suite。 |
| `mode` | `agent` | benchmark mode。選択した suite の mode と一致している必要がある。 |
| `model-id` | `amazon.nova-lite-v1:0` | 回答生成に使うBedrock model ID。 |
| `embedding-model-id` | `amazon.titan-embed-text-v2:0` | 埋め込みに使うBedrock model ID。 |
| `top-k` | `6` | retrieval topK。 |
| `memory-top-k` | `4` | memory retrieval topK。 |
| `min-score` | `0.2` | retrieval minimum score。 |
| `concurrency` | `1` | benchmark row concurrency。 |
| `wait-for-completion` | `true` | `GET /benchmark-runs/{runId}` を polling して終端状態まで待つ。 |
| `poll-interval-seconds` | `30` | polling 間隔。 |
| `timeout-minutes` | `30` | polling timeout。`wait-for-completion=true` では 350 以下にする。全量 dataset は `wait-for-completion=false` で起動し、管理画面または run 詳細で追跡する。 |

`operator-auth-secret-id` または `BENCHMARK_OPERATOR_AUTH_SECRET_ID` が指す Secrets Manager secret は、`idToken` / `token`、または `username` / `password` を JSON で持つ。`username` / `password` を使う場合、対象 Cognito user は `BENCHMARK_OPERATOR` または `RAG_GROUP_MANAGER` など `benchmark:run` 権限を持つ group に所属している必要がある。workflow は `USER_PASSWORD_AUTH` で都度 ID token を取得し、token / password / secret JSON / Authorization header を log に出さない。

事前条件:

- CDK deploy済みであること。
- `AWS_DEPLOY_ROLE_ARN` のIAM権限に `cloudformation:DescribeStacks`、`secretsmanager:GetSecretValue`、`cognito-idp:InitiateAuth` が含まれること。
- OIDC role の trust policy が `.github/workflows/memorag-benchmark-run.yml@refs/heads/main` を許可していること。bootstrap template の `AllowedBenchmarkWorkflowRef` 既定値はこの workflow を許可する。
- `POST /benchmark-runs` が返した `runId` は管理画面の性能テスト履歴、`GET /benchmark-runs/{runId}`、CodeBuild logs で追跡する。

## 必要なGitHub Secret

RepositoryまたはEnvironment secretに次を設定する。

| Secret | 内容 |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | CloudFormation Outputsの `GitHubActionsDeployRoleArn`。GitHub Actions OIDCからAssumeRoleするAWS IAM Role ARN。 |
| `BENCHMARK_OPERATOR_AUTH_SECRET_ID` | `POST /benchmark-runs` を起動する Cognito user credential の Secrets Manager secret ID/ARN。workflow入力 `operator-auth-secret-id` で代替できる。 |

## API Gateway integration timeout quota

MemoRAG MVP の同期 API は API Gateway REST API の Lambda integration timeout を 60 秒に設定している。GitHub Actions deploy を実行する前に、入力 `aws-region` で指定するデプロイ先リージョンと対象AWSアカウントで API Gateway quota `Maximum integration timeout in milliseconds` を 60,000ms 以上へ引き上げる。

この quota が 29,000ms のままだと、`cdk deploy --require-approval never` は `AWS::ApiGateway::Method` の更新時に `Timeout should be between 50 ms and 29000 ms` で失敗する。これは WebSocket の `Idle Connection Timeout` ではなく REST API integration timeout の制約である。非同期 chat の進捗購読は `GET /chat-runs/{runId}/events` の streaming 経路を使うが、`POST /chat-runs` と通常の REST API method には REST API integration timeout が適用される。

Regional REST API で 29 秒を超える timeout を使う場合、quota 引き上げに伴って account-level throttle quota への影響が出る可能性がある。デプロイ環境ごとに Service Quotas の承認状態を確認してから workflow を実行する。

## AWS IAM Role

GitHub OIDC providerをAWSアカウントに作成し、deploy用Roleのtrust policyで対象repoとbranch/environmentを制限する。

CloudFormationで作成する場合は、`memorag-bedrock-mvp` ディレクトリから実行する。

```bash
aws cloudformation deploy \
  --stack-name memorag-github-actions-oidc-role \
  --template-file infra/bootstrap/github-actions-oidc-role.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    GitHubOwner=<OWNER> \
    GitHubRepository=<REPOSITORY> \
    GitHubEnvironment=dev \
    ManagedPolicyArns=arn:aws:iam::aws:policy/PowerUserAccess
```

既にGitHub OIDC providerがあるアカウントでは `ExistingGitHubOidcProviderArn` を指定する。

```bash
aws cloudformation deploy \
  --stack-name memorag-github-actions-oidc-role \
  --template-file infra/bootstrap/github-actions-oidc-role.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    GitHubOwner=<OWNER> \
    GitHubRepository=<REPOSITORY> \
    GitHubEnvironment=dev \
    ManagedPolicyArns=arn:aws:iam::aws:policy/PowerUserAccess \
    ExistingGitHubOidcProviderArn=arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com
```

CloudFormation Outputsのうち、GitHub EnvironmentまたはRepository secretに設定するのは `GitHubActionsDeployRoleArn`。この値を secret `AWS_DEPLOY_ROLE_ARN` に設定する。

`GitHubOidcProviderArn` はAWS側のOIDC provider ARN確認用で、GitHub secretには設定しない。

リポジトリルートから実行する場合は、`--template-file memorag-bedrock-mvp/infra/bootstrap/github-actions-oidc-role.yaml` を指定する。

例:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:<OWNER>/<REPOSITORY>:environment:dev"
        }
      }
    }
  ]
}
```

`ManagedPolicyArns` は必須。`AdministratorAccess` ではなく、CDK bootstrap/deployに必要な最小権限ポリシーを指定する。

`AllowedWorkflowRef` と `AllowedBenchmarkWorkflowRef` を使うと、OIDCトークンの `workflow_ref` claim を特定workflow/branchに固定できる。既定値では deploy workflow と benchmark run workflow を許可する。

## AWSリソースタグ戦略

CDK stackで作成する主要リソースには、費用配賦、環境識別、運用所有者追跡のために共通タグを付与する。GitHub Actionsの `environment` 入力は `deploymentEnvironment` context としてCDKに渡し、`Environment` タグへ反映する。

| タグ | 既定値 | 用途 |
| --- | --- | --- |
| `Project` | `memorag-bedrock-mvp` | プロジェクト単位の抽出 |
| `Application` | `MemoRAG` | アプリケーション単位の抽出 |
| `Environment` | `dev` | GitHub Environment / deploy環境の識別 |
| `ManagedBy` | `aws-cdk` | IaC管理元の識別 |
| `Repository` | `tsuji-tomonori/rag-assist` | 変更元リポジトリの追跡 |
| `CostCenter` | `memorag-mvp` | Cost Explorer / Cost and Usage Reportでの費用配賦 |

`CostCenter` は必要に応じて `--context costCenter=<value>` で上書きする。bootstrap用の `infra/bootstrap/github-actions-oidc-role.yaml` はCDK管理外のIAMリソースを作成するため、同じタグキーをCloudFormationテンプレート内で明示する。

## PR CIでの事前検出

`.github/workflows/memorag-ci.yml` はpull requestごとに lint、typecheck、test、build に加えて、cdk-nag有効状態で `npm run cdk -w @memorag-mvp/infra -- synth` を実行する。これにより `AwsSolutions-*` のerrorはdeploy前のCIで検出される。

Benchmark runner の CodeBuild source は、CDK コード側の既定値として `tsuji-tomonori/rag-assist` の `main` を使う。AWS CDK の `--context` は合成・デプロイ時の runtime context を渡す正式な手段だが、CLI から渡した値は文字列として扱われ、複数 stack へ広く伝播する。通常運用の固定 source は workflow から毎回注入せず、CDK コード側の定数を正とする。別リポジトリや別ブランチを benchmark source にする場合は、workflow から context を注入するのではなく、CDK コードの source 定義を変更してレビュー対象にする。

CDK synthの成果物として、CloudFormation YAMLと `AwsSolutions-*-NagReport.csv` を `memorag-ci-cdk-synth` artifact に保存する。

## 実行内容

workflowは次を順に実行する。

1. `npm ci`
2. 全workspaceのtypecheck
3. 全workspaceのbuild
4. CDK assertion/snapshot test
5. 任意のCDK bootstrap
6. cdk-nag有効状態でCloudFormation YAML synth
7. synth artifactとcdk-nag reportのアップロード
8. `cdk deploy --require-approval never`
9. CDK outputs artifactのアップロード

## ローカル相当コマンド

```bash
task cdk:test
task cdk:synth:yaml
task cdk:deploy:ci CDK_CONTEXT_ARGS='--context defaultModelId=amazon.nova-lite-v1:0 --context embeddingModelId=amazon.titan-embed-text-v2:0 --context embeddingDimensions=1024 --context deploymentEnvironment=dev'
```
