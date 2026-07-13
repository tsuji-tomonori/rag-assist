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

- [Requirements](docs/1_要求_REQ/README.md): 要件、実装 gap、todo trace の入口
- [Architecture and docs structure](docs/2_アーキテクチャ_ARC/README.md): アーキテクチャ索引と `docs/` 配置規則
- [API design](docs/3_設計_DES/41_API_API/DES_API_001.md): API 契約と生成 OpenAPI の位置づけ
- [Monitoring and verification](docs/4_運用_OPS/21_監視_MONITORING/OPS_MONITORING_001.md): 現行の観測点、初動、docs check
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

実行定義は [memorag-deploy.yml](.github/workflows/memorag-deploy.yml) と `Taskfile.yml`、デプロイ後の確認は [監視・検証ランブック](docs/4_運用_OPS/21_監視_MONITORING/OPS_MONITORING_001.md) を正とします。

```bash
npm install
npm run build -w @memorag-mvp/web
npm run build -w @memorag-mvp/infra
npm run cdk -w @memorag-mvp/infra -- bootstrap
npm run cdk -w @memorag-mvp/infra -- deploy
```

## Ingest / reindex publication invariants

- 通常 RAG へ公開できるのは、authoritative admission が approved で、抽出・chunk・派生 record の整合性検証を通過した artifact だけです。unknown、partial、quarantined の入力は staging に留まり、vector を公開しません。
- reindex は tenant、actor、source/version、purpose で一意な run / artifact を使います。各 attempt は lease generation と fencing token を持ち、期限切れ worker の commit は拒否されます。
- source、block ledger、memory ledger、vector、manifest は attempt 固有 namespace に staging し、全件を再読込・検証してから generation 固有の published namespace へ昇格します。
- 読み取り経路は durable active pointer を正として current artifact だけを採用します。pointer の conditional write が cutover の単一 winner を決めるため、再試行・並行実行・rollback・reconcile 中も旧版と新版を同時に根拠へ混在させません。
