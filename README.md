# rag-assist

社内QAチャットボットMVPと、開発補助用のagents/skillsを管理するリポジトリです。

## 構成

- `memorag-bedrock-mvp/`: MemoRAG風RAG + Amazon Bedrock + S3 Vectors + React UI のMVP本体
- `.github/workflows/memorag-deploy.yml`: 親リポジトリからMVPをAWSへCDKデプロイするGitHub Actions workflow
- `agents/`: Codex/PM用途のagent設定
- `skills/`: 要件定義、設計レビュー、ドキュメント生成などのローカルskill定義

MVPの詳細は [memorag-bedrock-mvp/README.md](memorag-bedrock-mvp/README.md) を参照してください。

## ローカル操作

依存関係のインストール:

```bash
task memorag:install
```

型チェックとビルド:

```bash
task memorag:verify
```

ローカルAPI/UI起動:

```bash
task memorag:dev:api
task memorag:dev:web
```

CDKテスト:

```bash
task memorag:cdk:test
```

CDK synth YAML出力:

```bash
task memorag:cdk:synth:yaml
```

## GitHub Actionsデプロイ

GitHub ActionsからAWSへデプロイするには、GitHub側とAWS側の設定が必要です。

### GitHub側

1. `Settings > Environments` で `dev` を作成する。
2. Repository secret または Environment secret に `AWS_DEPLOY_ROLE_ARN` を設定する。値はCloudFormation Outputsの `GitHubActionsDeployRoleArn` を使う。
3. `Settings > Actions > General` でActionsを有効化する。
4. `Actions > Deploy MemoRAG MVP > Run workflow` から手動実行する。

workflow input:

- `environment`: 既定 `dev`
- `aws-region`: 既定 `ap-northeast-1`
- `bootstrap`: 初回だけ `true`
- `default-model-id`: 既定 `amazon.nova-lite-v1:0`
- `embedding-model-id`: 既定 `amazon.titan-embed-text-v2:0`
- `embedding-dimensions`: 既定 `1024`

### AWS側

GitHub OIDC providerとAssumeRole用IAM Roleを作成します。Role ARNをGitHub secret `AWS_DEPLOY_ROLE_ARN` に設定してください。

CloudFormationテンプレートを用意しています。リポジトリルート、つまり `~/project/rag-assist` から実行する場合は次のパスを使います。

```bash
aws cloudformation deploy \
  --stack-name memorag-github-actions-oidc-role \
  --template-file memorag-bedrock-mvp/infra/bootstrap/github-actions-oidc-role.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    GitHubOwner=<OWNER> \
    GitHubRepository=<REPOSITORY> \
    GitHubEnvironment=dev
```

CloudFormation Outputsのうち、GitHub EnvironmentまたはRepository secretに設定するのは `GitHubActionsDeployRoleArn` です。この値を secret `AWS_DEPLOY_ROLE_ARN` に設定してください。

`GitHubOidcProviderArn` はAWS側のOIDC provider ARN確認用です。GitHub secretには設定しません。

`memorag-bedrock-mvp` ディレクトリに移動してから実行する場合は、`--template-file infra/bootstrap/github-actions-oidc-role.yaml` を指定してください。

Trust policy例:

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

初回デプロイ時はworkflow input `bootstrap=true` でCDK bootstrapを実行します。2回目以降は `false` で構いません。

## 検証済みコマンド

- `task memorag:verify`
- `task memorag:cdk:test`
- `task memorag:cdk:synth:yaml`
