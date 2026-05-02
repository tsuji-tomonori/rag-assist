# Operations

## ローカル運用

初回セットアップ:

```bash
npm install
cp .env.example .env
```

ローカルAPI:

```bash
task dev:api
```

ローカルUI:

```bash
task dev:web
```

Docker Compose:

```bash
task docker:up
task docker:down
```

## 検証

静的検証:

```bash
task verify
```

起動済みAPIへのスモークテスト:

```bash
task smoke:api
```

サンプルベンチマーク:

```bash
task benchmark:sample
```

## 主要環境変数

| 変数 | 用途 | ローカル既定値 |
| --- | --- | --- |
| `PORT` | API listen port | `8787` |
| `MOCK_BEDROCK` | Bedrockモック利用 | `false` |
| `USE_LOCAL_VECTOR_STORE` | ファイルベースstore利用 | production以外は`true` |
| `USE_LOCAL_QUESTION_STORE` | 担当者問い合わせのローカルstore利用 | production以外は`true` |
| `USE_LOCAL_CONVERSATION_HISTORY_STORE` | 会話履歴のローカルstore利用 | production以外は`true` |
| `LOCAL_DATA_DIR` | ローカル保存先 | `.local-data` |
| `AUTH_ENABLED` | Cognito JWT認証をAPIで有効化 | `false` |
| `COGNITO_REGION` | Cognito User Pool リージョン | 未設定 |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID | 未設定 |
| `COGNITO_APP_CLIENT_ID` | Cognito App Client ID | 未設定 |
| `QUESTION_TABLE_NAME` | 担当者問い合わせ DynamoDB table | `memorag-human-questions` |
| `CONVERSATION_HISTORY_TABLE_NAME` | 会話履歴 DynamoDB table | `memorag-conversation-history` |
| `DEFAULT_MODEL_ID` | 回答生成モデル | `amazon.nova-lite-v1:0` |
| `DEFAULT_MEMORY_MODEL_ID` | memory card/clue生成モデル | `DEFAULT_MODEL_ID` |
| `EMBEDDING_MODEL_ID` | 埋め込みモデル | `amazon.titan-embed-text-v2:0` |
| `EMBEDDING_DIMENSIONS` | vector次元数 | `1024` |
| `MIN_RETRIEVAL_SCORE` | no-answer判定閾値 | `0.20` |
| `DEBUG_DOWNLOAD_BUCKET_NAME` | debug trace JSON download用S3 bucket | 未設定 |
| `DEBUG_DOWNLOAD_EXPIRES_IN_SECONDS` | debug trace download URL有効期限 | `900` |

## ロール運用

CDK stack は Cognito group として `CHAT_USER`、`ANSWER_EDITOR`、`RAG_GROUP_MANAGER`、`USER_ADMIN`、`ACCESS_ADMIN`、`COST_AUDITOR`、`SYSTEM_ADMIN` を作成する。

| group | 運用上の用途 |
| --- | --- |
| `CHAT_USER` | 通常チャット、本人の会話履歴、担当者問い合わせ登録 |
| `ANSWER_EDITOR` | 担当者問い合わせの一覧、回答、解決 |
| `RAG_GROUP_MANAGER` | 文書登録、文書削除、再インデックス運用 |
| `SYSTEM_ADMIN` | debug trace、benchmark、管理者検証 |

通常利用者に `ANSWER_EDITOR` や `SYSTEM_ADMIN` を付与しない。担当者には `ANSWER_EDITOR` を付与する。debug trace と benchmark を確認する管理者には `SYSTEM_ADMIN` を付与する。

ログイン画面から self sign-up したユーザーは、メール確認後に Cognito post-confirmation trigger で `CHAT_USER` のみを自動付与する。担当者、管理、監査、`SYSTEM_ADMIN` などの上位権限は、管理ユーザーが対象者と必要性を確認し、`.github/workflows/memorag-create-cognito-user.yml` または AWS 管理手順で後から付与する。

## AWSデプロイ前チェック

- Bedrockの利用モデルを対象リージョンで有効化する。
- `EMBEDDING_DIMENSIONS` とS3 Vectors indexのdimensionを一致させる。
- 文書データに社外秘や個人情報が含まれる場合、S3 bucket policy、KMS、ログ出力方針を本番基準に更新する。
- MVPのCDKはRAG動作検証用なので、SSO、WAF、詳細監査ログは本番化時に追加する。

## GitHub Actionsデプロイ

`.github/workflows/deploy.yml` から手動デプロイできる。AWS認証はOIDC前提で、GitHub secret `AWS_DEPLOY_ROLE_ARN` にAssumeRole先のARNを設定する。

詳細は [GitHub Actions Deploy](GITHUB_ACTIONS_DEPLOY.md) を参照する。

## 障害時の初動

- APIが応答しない場合は `/health`、Lambda logs、API Gateway logsの順に確認する。
- 回答が空になる場合は `/chat` の `includeDebug=true` でmemory/chunk検索結果とscoreを確認する。
- 文書が検索されない場合はdocument manifest、vector metadata、embedding dimensionの不一致を確認する。
- 担当者問い合わせ送信後に 403 が出る場合は、通常利用者で `GET /questions` や `GET /debug-runs` が発火していないか確認する。
- 担当者対応ビューが表示されない場合は、対象ユーザーに `ANSWER_EDITOR` group が付与され、ID token の `cognito:groups` に反映されているか確認する。
- AWS実行時にBedrockエラーが出る場合はリージョン、モデル有効化、IAMの `bedrock:InvokeModel` と `bedrock:Converse` を確認する。

## ベンチマークレポート

`task benchmark:sample` は行ごとの結果JSONL、集計JSON、Markdownレポートを生成する。社内データセットではJSONLの各行に `answerable`、`expectedContains`、`expectedFiles`、必要に応じて `expectedPages` と fact slot 系の期待値を指定すると、回答可能問題の正答率、回答不能問題の拒否率、unsupported answer rate、citation/file/page hit rate、fact slot coverage、p95 latencyを確認できる。
