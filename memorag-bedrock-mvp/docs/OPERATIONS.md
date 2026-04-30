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
| `LOCAL_DATA_DIR` | ローカル保存先 | `.local-data` |
| `DEFAULT_MODEL_ID` | 回答生成モデル | `amazon.nova-lite-v1:0` |
| `DEFAULT_MEMORY_MODEL_ID` | memory card/clue生成モデル | `DEFAULT_MODEL_ID` |
| `EMBEDDING_MODEL_ID` | 埋め込みモデル | `amazon.titan-embed-text-v2:0` |
| `EMBEDDING_DIMENSIONS` | vector次元数 | `1024` |
| `MIN_RETRIEVAL_SCORE` | no-answer判定閾値 | `0.20` |

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
- AWS実行時にBedrockエラーが出る場合はリージョン、モデル有効化、IAMの `bedrock:InvokeModel` と `bedrock:Converse` を確認する。
