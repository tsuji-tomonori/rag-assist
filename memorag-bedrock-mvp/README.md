# MemoRAG Bedrock QA Chatbot MVP

社内資料だけを根拠に回答するQAチャットボットのMVPです。初期構築費用を抑えるため、AWS側は **API Gateway + Lambda + Amazon Bedrock + Amazon S3 + Amazon S3 Vectors + S3/CloudFront UI** のサーバレス構成にしています。ローカルではBedrockを呼ばず、モック埋め込みとファイルベースのベクトルストアで動作確認できます。

## UI方針

作成するUIは **1つ** です。資料アップロード、モデルID指定、チャット、引用チャンク表示を同じ画面にまとめています。ベンチマークや自動評価はUIではなくAPIから呼び出す前提です。

## アーキテクチャ

```mermaid
flowchart LR
  User[社内ユーザー] --> CF[CloudFront]
  CF --> WebS3[S3 Static Web UI]
  WebS3 --> ApiGw[API Gateway HTTP API]
  Bench[RAG Benchmark Runner] --> ApiGw
  ApiGw --> Lambda[Lambda TypeScript / Hono]

  subgraph MemoRAG[MemoRAG Pipeline]
    Lambda --> Ingest[Ingest: extract / chunk / memory cards]
    Lambda --> Chat[Chat: LangGraph fixed workflow]
  end

  Ingest --> BedrockEmbed[Bedrock InvokeModel\nTitan Embeddings]
  Chat --> BedrockLLM[Bedrock Converse\nmodelId is API parameter]
  Ingest --> DocBucket[S3 Document Bucket]
  Ingest --> MemoryIndex[S3 Vectors memory-index]
  Ingest --> EvidenceIndex[S3 Vectors evidence-index]
  Chat --> MemoryIndex
  Chat --> EvidenceIndex
  Lambda --> Logs[CloudWatch Logs]
```

## MemoRAGとしての実装範囲

MVPでは、論文実装そのものではなく、MemoRAGの「グローバルメモリを作り、質問時に手がかりを生成して検索を改善する」構造を軽量に実装しています。

1. アップロード資料からチャンクを作成する。
2. 資料全体の `memory card`（要約、キーワード、想定質問、制約）を生成してベクトル化する。
3. 質問時はまず memory card を検索し、検索用の clues を生成する。
4. 元の質問と clues でチャンクを再検索する。
5. `answerability_gate` で根拠不足を判定し、不十分なら回答生成前に `資料からは回答できません。` を返す。
6. 取得チャンクだけをコンテキストとして最終回答を生成し、引用IDを検証する。

実行制御は `@langchain/langgraph` のState/Node/Edgeで固定しています。LLMに検索tool選択を任せず、`analyze_input -> normalize_query -> retrieve_memory -> generate_clues -> embed_queries -> search_evidence -> rerank_chunks -> answerability_gate -> generate_answer/finalize_refusal` の順で進みます。

## API概要

Hono + `@hono/zod-openapi` でOpenAPIを生成します。

- `GET /health`
- `GET /openapi.json`
- `GET /documents`
- `POST /documents` 資料アップロード
- `DELETE /documents/{documentId}` 資料削除
- `POST /chat` チャット回答
- `POST /questions` 担当者への問い合わせ作成
- `GET /questions` 担当者問い合わせ一覧
- `GET /questions/{questionId}` 担当者問い合わせ詳細
- `POST /questions/{questionId}/answer` 担当者回答登録
- `POST /questions/{questionId}/resolve` 問い合わせ解決済み化
- `GET /debug-runs` persisted debug trace一覧
- `GET /debug-runs/{runId}` persisted debug trace取得
- `POST /debug-runs/{runId}/download` persisted debug trace Markdown download URL作成
- `POST /benchmark/query` ベンチマーク用。`/chat` と同じRAG処理をAPIから呼び出し、retrieval情報も返します。

Phase 1 の管理画面は RAG 運用管理に限定し、文書管理、問い合わせ対応、debug/評価を対象にします。ユーザー作成、ロール付与、コスト監査、全ユーザー利用状況一覧は Phase 1 では提供しません。

## ドキュメント

- [Requirements](docs/REQUIREMENTS.md): MVPの目的、機能要件、非機能要件、受け入れ条件。
- [Architecture Notes](docs/ARCHITECTURE.md): AWS構成、MemoRAG runtime、no-answer制御。
- [API Examples](docs/API_EXAMPLES.md): curlでのアップロード、チャット、benchmark query例。
- [Operations](docs/OPERATIONS.md): ローカル運用、環境変数、AWSデプロイ前チェック。
- [Local Verification](docs/LOCAL_VERIFICATION.md): ローカル検証手順と確認観点。
- [GitHub Actions Deploy](docs/GITHUB_ACTIONS_DEPLOY.md): OIDCを使ったGitHub ActionsからのCDK deploy手順。

## ローカル起動

```bash
npm install
cp .env.example .env
npm run dev:api
npm run dev:web
```

または Docker Compose:

```bash
docker compose up --build
```

- UI: http://localhost:5173
- API: http://localhost:8787
- OpenAPI: http://localhost:8787/openapi.json

ローカルでは `MOCK_BEDROCK=true` と `USE_LOCAL_VECTOR_STORE=true` によりAWSには接続しません。
ローカルUIは `VITE_AUTH_MODE=local` で起動し、Cognito の代わりにローカル開発用セッションを使います。本番デプロイでは CDK が `authMode: cognito` と Cognito 設定を `config.json` に配布します。

## AWSデプロイ

Bedrockの対象モデルを利用するリージョンで有効化してから実行してください。

```bash
npm install
npm run build -w @memorag-mvp/web
npm run build -w @memorag-mvp/infra
npm run cdk -w @memorag-mvp/infra -- bootstrap
npm run cdk -w @memorag-mvp/infra -- deploy
```

Taskfileを使う場合は `task cdk:deploy` でフロントエンドbuild、Lambda bundle、CDK deployを順に実行します。

GitHub Actionsでは `.github/workflows/memorag-ci.yml` がpull requestとmain branchへのpushで `npm run ci` を実行します。デプロイは `.github/workflows/memorag-deploy.yml` を使います。AWS側のOIDC RoleとGitHub secret `AWS_DEPLOY_ROLE_ARN` を設定してください。
デプロイ後の Cognito ユーザー追加は、`.github/workflows/memorag-create-cognito-user.yml` を手動実行して行えます。

デプロイ後、CDK Outputs にAPI URLとCloudFront URLが出ます。

### Cognitoユーザー作成

デプロイ後の Cognito User Pool にユーザーを追加するには、AWS CLI の認証情報を設定したうえで次を実行します。

```bash
infra/scripts/create-cognito-user.sh \
  --email alice@example.com \
  --password 'ExamplePassw0rd!' \
  --role CHAT_USER \
  --suppress-invite
```

`--user-pool-id` を省略した場合は、CloudFormation stack `MemoRagMvpStack` の `CognitoUserPoolId` output から取得します。管理者ユーザーを作る場合は `--role SYSTEM_ADMIN` を指定してください。
`CHAT_USER` などの Cognito group は CDK stack で作成されるため、ユーザー作成前に `npm run cdk -w @memorag-mvp/infra -- deploy` または `task cdk:deploy` を実行してください。
GitHub Actions から作成する場合は、`Actions` -> `Create MemoRAG Cognito User` -> `Run workflow` でメールアドレスとロールを入力します。

## API実行例

```bash
curl -s http://localhost:8787/documents \
  -H 'Content-Type: application/json' \
  -d '{"fileName":"handbook.md","text":"経費精算は申請から30日以内に行う必要があります。"}'

curl -s http://localhost:8787/chat \
  -H 'Content-Type: application/json' \
  -d '{"question":"経費精算の期限は？","modelId":"amazon.nova-lite-v1:0"}' | jq
```

## ベンチマーク

```bash
API_BASE_URL=http://localhost:8787 \
DATASET=benchmark/dataset.sample.jsonl \
OUTPUT=.local-data/benchmark-results.jsonl \
SUMMARY=.local-data/benchmark-summary.json \
REPORT=.local-data/benchmark-report.md \
npm run start -w @memorag-mvp/benchmark
```

`OUTPUT` には行ごとのAPI応答と評価結果、`SUMMARY` には集計JSON、`REPORT` にはMarkdownレポートが出力されます。

JSONL datasetの1行は次の形式です。`expected` だけでも動きますが、`answerable`、`expectedContains`、`expectedFiles` を指定すると正答率、拒否率、citation/file hit rateまで測定できます。

```json
{"id":"q1","question":"経費精算の期限は？","answerable":true,"expectedContains":["30日以内"],"expectedFiles":["handbook.md"]}
```

## 注意点

- MVPのPDF/DOCX抽出は `pdf-parse` と `mammoth` による簡易実装です。社内規程・契約書などの本番投入では、Textractや文書変換パイプラインを別途検討してください。
- S3 Vectorsのインデックス次元は作成後に変更できないため、`EMBEDDING_DIMENSIONS` と埋め込みモデルを先に決めてください。デフォルトはTitan Text Embeddings V2の1024次元です。
- 回答拒否は検索スコア閾値とプロンプト制約で行っています。MVP評価後、必要ならBedrock Guardrailsや別モデルによるgroundedness judgeを追加してください。
- AWS月額の初期目安は、小規模検証で `$2-5`、社内MVPで `$25-35`、活発なpilotで `$200-250` です。詳細な前提、リソース一覧、コスト制御方針は [Architecture Notes](docs/ARCHITECTURE.md) を参照してください。
