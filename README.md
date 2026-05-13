# MemoRAG Bedrock QA Chatbot MVP

社内資料だけを根拠に回答する QA チャットボットの MVP です。
AWS では API Gateway、Lambda、Amazon Bedrock、Amazon S3、Amazon S3 Vectors、S3/CloudFront UI を使います。
ローカルでは Bedrock を呼ばず、モック埋め込みとファイルベースのベクトルストアで確認できます。

## 構成

- `apps/`: Hono API と React Web UI
- `packages/contract/`: API contract と共有 schema / 型
- `infra/`: AWS CDK stack、bootstrap template、運用 scripts
- `benchmark/`: RAG / search / conversation benchmark runner と dataset
- `docs/`: 要件、設計、運用、生成ドキュメント
- `agents/`, `skills/`: agent 設定と repository-local skill

## 主要ドキュメント

- [Requirements](docs/REQUIREMENTS.md): 要件仕様の索引
- [Architecture](docs/ARCHITECTURE.md): AWS 構成、MemoRAG runtime、no-answer 制御
- [API Examples](docs/API_EXAMPLES.md): curl での API 実行例
- [Operations](docs/OPERATIONS.md): ローカル運用、環境変数、AWS デプロイ前チェック
- [Local Verification](docs/LOCAL_VERIFICATION.md): ローカル検証手順
- [GitHub Actions Deploy](docs/GITHUB_ACTIONS_DEPLOY.md): GitHub Actions からの CDK deploy 手順
- [Docs Structure](docs/DOCS_STRUCTURE.md): `docs/` の構成方針
- [OpenAPI Docs](docs/generated/openapi.md): 生成済み OpenAPI Markdown
- [Web UI Inventory](docs/generated/web-overview.md): Web UI 自動生成インベントリ
- [AWS Resource Inventory](docs/generated/infra-inventory.md): CDK snapshot 由来の AWS リソースインベントリ

## ローカル起動

```bash
npm install
cp .env.example .env
npm run dev:api
npm run dev:web
```

- UI: http://localhost:5173
- API: http://localhost:8787
- OpenAPI: http://localhost:8787/openapi.json

Docker Compose を使う場合:

```bash
docker compose up --build
```

## よく使う検証

```bash
npm test --workspaces --if-present
npm run typecheck --workspaces --if-present
npm run docs:openapi:check
```

Taskfile を使う場合:

```bash
task docs:check
task memorag:verify
```

## デプロイ

詳細は [GitHub Actions Deploy](docs/GITHUB_ACTIONS_DEPLOY.md) と [Operations](docs/OPERATIONS.md) を参照してください。

```bash
npm install
npm run build -w @memorag-mvp/web
npm run build -w @memorag-mvp/infra
npm run cdk -w @memorag-mvp/infra -- bootstrap
npm run cdk -w @memorag-mvp/infra -- deploy
```
