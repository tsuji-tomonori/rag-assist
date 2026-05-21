# DynamoDB-backed store 統一 作業レポート

- 作成日時: 2026-05-21 09:24 JST
- 対象 task: `tasks/do/20260521-0856-dynamodb-backed-stores.md`
- ブランチ: `codex/dynamodb-backed-stores`

## 受けた指示

履歴・お気に入り・担当者対応を DynamoDB-backed store に統一し、LocalStore とフロント内状態依存を廃止する。`FavoritesTable`、担当者別 GSI、Query ベースの担当者一覧、`/favorites` API、`FavoritesWorkspace`、migration backfill、単体テスト基準を整備する。

## 要件整理

- Runtime dependency は `DynamoDbQuestionStore`、`DynamoDbConversationHistoryStore`、`DynamoDbFavoriteStore` を既定にする。
- ローカル開発は `DYNAMODB_ENDPOINT` の DynamoDB Local 前提に寄せる。
- 会話履歴保存は認証 userId を owner とし、favorite 表示は `FavoritesTable` の `chatSession#id` から付与する。
- お気に入りは対象本体ではなく shortcut として保存・削除する。
- 担当者問い合わせ一覧は `ScanCommand` ではなく assignee/requester/status GSI の `QueryCommand` で扱う。
- 通常担当者、管理者、requester の参照境界と機微フィールド返却を分離する。
- CDK / docs / OpenAPI / Web UI を同期する。

## 実施作業

- `DynamoDbFavoriteStore`、`FavoriteStore` interface、`/favorites` routes、favorite schemas/types を追加。
- `createDynamoDbClient()` を追加し、`DYNAMODB_ENDPOINT` を DynamoDB client に反映。
- `createDependencies()` から runtime の local question/history store 選択を外し、favorite store を登録。
- `MemoRagService` で履歴 list に favorite enrichment を追加し、favorite CRUD と document/folder 権限再確認を追加。
- `QuestionStore` を `listAssignedToUser`、`listRequestedByUser`、`listAllForAdmin` に分割し、DynamoDB 実装を GSI Query / merge / dedupe / updatedAt desc sort に変更。
- `GET /questions`、`GET /questions/{id}`、回答 route の担当者/requester/admin 境界を更新。
- Web に `FavoritesWorkspace`、favorite API/hook を追加し、履歴の星操作を `/favorites` に変更。
- CDK に `FavoritesTable` と `HumanQuestionsTable` の requester/assignee/status GSI、API env/grant を追加。
- `isFavorite=true` 履歴から `FavoritesTable` へ backfill する migration helper と単体テストを追加。
- `LOCAL_VERIFICATION`、`OPERATIONS`、API 設計、FR-028、OpenAPI generated docs を更新。

## 成果物

- API: `apps/api/src/adapters/dynamodb-favorite-store.ts`、`apps/api/src/routes/favorite-routes.ts`、`apps/api/src/migrations/backfill-favorites.ts`
- Web: `apps/web/src/features/favorites/`、`apps/web/src/features/history/hooks/useConversationHistory.ts`
- Infra: `infra/lib/memorag-mvp-stack.ts`、`infra/test/memorag-mvp-stack.test.ts`
- Docs: `docs/LOCAL_VERIFICATION.md`、`docs/OPERATIONS.md`、`docs/generated/openapi.md`

## 検証

- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run typecheck -w @memorag-mvp/infra`: pass
- `npm test -w @memorag-mvp/api`: pass, 316 tests
- `npm test -w @memorag-mvp/web`: pass, 259 tests
- `npm test -w @memorag-mvp/infra`: pass, 17 tests
- `npm run docs:openapi:check -w @memorag-mvp/api`: pass
- `npm run docs:infra-inventory:check`: pass
- `npm run docs:web-inventory:check`: pass
- `./node_modules/.bin/tsx --test apps/api/src/migrations/backfill-favorites.test.ts`: pass
- `git diff --check`: pass

## Fit 評価

- Runtime の LocalStore 切替廃止、DynamoDB Local endpoint、production `FAVORITES_TABLE_NAME` 必須化に対応。
- 履歴・お気に入り・担当者対応の owner/assignee 境界は store / route / UI / infra の主要単体テストで固定。
- お気に入り解除は Favorite item だけを削除し、本体削除 API は呼ばない設計にした。
- docs と generated OpenAPI は実装に同期済み。

## 未対応・制約・リスク

- Runtime integration で実 DynamoDB Local を起動する E2E は未実施。今回は unit / CDK template / OpenAPI docs check を対象にした。
- 既存 local store は test fixture と互換確認用に残しているが、通常 runtime dependency からは外した。
- `npm ci` 実行時に既存依存の audit warning が 5 件表示されたが、この task の scope 外として未対応。
