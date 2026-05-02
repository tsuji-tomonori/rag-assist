# GitHub Actions Deploy

このMVPはGitHub ActionsからAWS CDK deployできる。AWS認証はGitHub OIDCを使う。

## Workflow

- `.github/workflows/memorag-deploy.yml`
- `main` branchへのpush、または手動実行で起動する。
- 手動実行: `Actions` -> `Deploy MemoRAG MVP` -> `Run workflow`

入力:

| 入力 | 既定値 | 用途 |
| --- | --- | --- |
| `environment` | `dev` | GitHub Environment名。承認ルールや環境別secretを使う。 |
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

ロールは複数付与できる。workflowは主ロールと追加ロールを `infra/scripts/create-cognito-user.sh` の `--role` に複数渡し、スクリプト側で日本語名を Cognito group 名へ正規化する。

主な role:

| role | 用途 |
| --- | --- |
| `CHAT_USER` | 通常チャット、本人の会話履歴、担当者問い合わせ登録 |
| `ANSWER_EDITOR` | 担当者問い合わせの一覧、回答、解決 |
| `RAG_GROUP_MANAGER` | 文書登録、文書削除、再インデックス運用、benchmark run 起動 |
| `BENCHMARK_RUNNER` | CodeBuild runner から `/benchmark/query` を実行 |
| `USER_ADMIN` | ユーザー管理の将来拡張 |
| `ACCESS_ADMIN` | 権限管理の将来拡張 |
| `COST_AUDITOR` | 費用監査の将来拡張 |
| `SYSTEM_ADMIN` | debug trace、benchmark cancel/download、管理者検証 |

事前条件:

- CDK deploy済みであること。
- `CHAT_USER` などの Cognito group が CDK stackにより作成済みであること。
- `AWS_DEPLOY_ROLE_ARN` のIAM権限に `cloudformation:DescribeStacks` と Cognito IDP の管理操作が含まれること。

## 必要なGitHub Secret

RepositoryまたはEnvironment secretに次を設定する。

| Secret | 内容 |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | CloudFormation Outputsの `GitHubActionsDeployRoleArn`。GitHub Actions OIDCからAssumeRoleするAWS IAM Role ARN。 |

## AWS IAM Role

GitHub OIDC providerをAWSアカウントに作成し、deploy用Roleのtrust policyで対象repoとbranch/environmentを制限する。

CloudFormationで作成する場合は、`memorag-bedrock-mvp` ディレクトリから実行する。

```bash
aws cloudformation deploy \
  --stack-name memorag-github-actions-oidc-role \
  --template-file infra/bootstrap/github-actions-oidc-role.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    GitHubEnvironment=dev
```

既にGitHub OIDC providerがあるアカウントでは `ExistingGitHubOidcProviderArn` を指定する。

```bash
aws cloudformation deploy \
  --stack-name memorag-github-actions-oidc-role \
  --template-file infra/bootstrap/github-actions-oidc-role.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    GitHubEnvironment=dev \
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
          "token.actions.githubusercontent.com:sub": "repo:tsuji-tomonori/rag-assist:environment:dev"
        }
      }
    }
  ]
}
```

権限はCDK bootstrap/deployに必要な範囲を付与する。MVP検証ではAdministratorAccess相当でも動くが、本番ではCDK bootstrap rolesとCloudFormation実行roleへ権限を集約する。

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
task cdk:deploy:ci CDK_CONTEXT_ARGS='--context defaultModelId=amazon.nova-lite-v1:0 --context embeddingModelId=amazon.titan-embed-text-v2:0 --context embeddingDimensions=1024'
```
