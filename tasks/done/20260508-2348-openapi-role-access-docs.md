# OpenAPI role access docs

## 背景

自動生成される API Markdown に、API ごとの実行可能 role、拒否される role、拒否時の status/body が不足している。現状の Markdown 生成器で推測するのではなく、Hono + zod-openapi の route 定義側に認可情報を持たせる必要がある。

## 目的

OpenAPI を source of truth として API ごとの認可仕様を生成ドキュメントへ出力し、Markdown の response セクションを一覧先出しの構成にする。

## スコープ

- `memorag-bedrock-mvp/apps/api/src/routes/` の OpenAPI route 定義
- `memorag-bedrock-mvp/apps/api/src/authorization.ts`
- OpenAPI 生成・品質検証・アクセス制御静的テスト
- `memorag-bedrock-mvp/docs/generated/openapi.md` と API 別 Markdown
- 関連する設計ドキュメント

## 作業計画

1. route 定義に付ける authorization metadata helper を追加する。
2. 各 protected route に必要 permission、許可/拒否 role、条件付き制約、401/403 response を明記する。
3. Markdown 生成器で Authorization セクションと response 一覧表を出力する。
4. OpenAPI 品質検証と access-control policy test で metadata の欠落・ズレを検出する。
5. 生成 docs と durable docs を更新する。
6. docs/openapi/API test/typecheck/diff check を実行する。
7. レポート、commit、push、PR、受け入れ条件コメントまで完了する。

## ドキュメント保守計画

- 自動生成 docs は `npm run docs:openapi` で再生成する。
- `memorag-bedrock-mvp/docs/3_設計_DES/41_API_API/DES_API_001.md` の OpenAPI 生成ドキュメント説明を更新する。
- README や運用手順への影響は、変更内容確認後に必要性を判断する。

## 受け入れ条件

- [x] OpenAPI route 定義側に API ごとの認可 metadata があり、Markdown 生成器で role/permission を推測しない。
- [x] 生成される API 詳細 Markdown に、実行可能 role、拒否される role、条件付き拒否、拒否時 status/body が記載される。
- [x] 生成される API 詳細 Markdown の `Responses` は、先に response 一覧表を表示し、その後に各 response 詳細を表示する。
- [x] protected API の 401/403 response が OpenAPI 上に明示され、エラー body schema/example が分かる。
- [x] OpenAPI 品質検証またはテストで、protected API の authorization metadata 欠落や policy とのズレを検出できる。
- [x] `npm --prefix memorag-bedrock-mvp run docs:openapi`、`npm --prefix memorag-bedrock-mvp run docs:openapi:check`、API test、API typecheck が pass する。
- [x] セキュリティ観点として、認証境界・route-level permission・所有者/条件付き制約の説明が作業レポートまたは PR コメントに残る。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run docs:openapi`
- `npm --prefix memorag-bedrock-mvp run docs:openapi:check`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `git diff --check`

## PR レビュー観点

- OpenAPI metadata と handler の `requirePermission` / `hasPermission` がズレていないか。
- 401/403 の説明が runtime と乖離していないか。
- 生成器が script 側推測ではなく OpenAPI extension の整形に留まっているか。
- RAG の根拠性・認可境界を弱めていないか。

## リスク

- 既存 route が多く、個別 metadata の付け忘れが起きやすい。
- 所有者条件や benchmark seed 例外は単純な role allow/deny に収まらないため、条件注記を併記する必要がある。

## 状態

done
