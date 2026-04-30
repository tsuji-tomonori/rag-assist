# GitHub Actions Deploy

このMVPはGitHub ActionsからAWS CDK deployできる。workflowは手動実行専用で、AWS認証はGitHub OIDCを使う。

## Workflow

- `.github/workflows/deploy.yml`
- 手動実行: `Actions` -> `Deploy MemoRAG MVP` -> `Run workflow`

入力:

| 入力 | 既定値 | 用途 |
| --- | --- | --- |
| `environment` | `dev` | GitHub Environment名。承認ルールや環境別secretを使う。 |
| `aws-region` | `ap-northeast-1` | CDK deploy先リージョン。 |
| `bootstrap` | `false` | 初回のみCDK bootstrapを同時実行する。 |
| `default-model-id` | `amazon.nova-lite-v1:0` | 回答生成に使うBedrock model ID。 |
| `embedding-model-id` | `amazon.titan-embed-text-v2:0` | 埋め込みに使うBedrock model ID。 |
| `embedding-dimensions` | `1024` | S3 Vectors index dimension。 |

## 必要なGitHub Secret

RepositoryまたはEnvironment secretに次を設定する。

| Secret | 内容 |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | GitHub Actions OIDCからAssumeRoleするAWS IAM Role ARN。 |

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

Outputsの `GitHubActionsDeployRoleArn` をGitHub secret `AWS_DEPLOY_ROLE_ARN` に設定する。

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
