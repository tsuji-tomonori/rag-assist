# DynamoDB-backed store PR レビュー指摘対応レポート

## 指示

PR #332 のレビューで指摘された DynamoDB 統一、認可境界、お気に入り権限再確認、backfill、pagination の不整合を merge 前に修正する。

## 要件整理

- production runtime で LocalStore fallback に戻れないようにする。
- `SYSTEM_ADMIN` 文字列直判定で suspended / deleted account が全 ticket を読めないようにする。
- assignee 未指定 ticket が通常担当者から失われないよう default support group を設定可能にする。
- Favorite は権限 resolver 実装済み target だけ作成許可し、未実装 target は一覧で inaccessible に倒す。
- Favorite backfill は既存 item を上書きしない。
- DynamoDB Query は `LastEvaluatedKey` を最後まで追う。

## 実施作業

- `MEMORAG_ALLOW_LEGACY_LOCAL_STORE_FOR_TESTS` を `NODE_ENV=test` 限定にし、production 指定時は依存性作成を明示的に失敗させた。
- `canReadAllTickets()` を `support:ticket:read:all` permission のみで判定するよう修正した。
- `DEFAULT_SUPPORT_ASSIGNEE_GROUP_ID` を追加し、`POST /questions` 相当の作成時に assignee 未指定なら既定グループを保存するようにした。
- `/favorites` 作成は `chatSession` / `document` / `folder` のみに絞り、保存後も認証 user で visibility を再解決するようにした。
- 既存の未対応 favorite targetType は一覧で `accessible=false` として詳細を伏せるようにした。
- favorite backfill に conditional put と `skippedExisting` count を追加した。
- question / favorite / conversation-history の DynamoDB Query に pagination loop を追加した。
- OpenAPI 説明とローカル運用 docs に今回の制約・環境変数を反映した。

## 成果物

- API 実装、migration、schema、docs、generated OpenAPI
- 追加テスト:
  - `apps/api/src/adapters/dynamodb-conversation-history-store.test.ts`
  - `apps/api/src/routes/question-routes.test.ts`
- 既存テストの拡張:
  - dependencies / DynamoDB store / backfill / service / questions access

## 検証

- `npm run typecheck --workspace apps/api`: pass
- `./node_modules/.bin/tsx --test apps/api/src/dependencies.test.ts apps/api/src/adapters/dynamodb-question-store.test.ts apps/api/src/adapters/dynamodb-favorite-store.test.ts apps/api/src/adapters/dynamodb-conversation-history-store.test.ts apps/api/src/migrations/backfill-favorites.test.ts apps/api/src/routes/question-routes.test.ts apps/api/src/questions-access.test.ts apps/api/src/rag/memorag-service.test.ts`: pass, 83 tests
- `npm run docs:openapi`: pass
- `npm run docs:openapi:check`: pass
- `git diff --check`: pass

## Fit 評価

レビューで blocking とされた 4 点はすべて修正した。pagination と backfill 上書きの追加指摘もテストで固定した。未実装 favorite targetType は保存 API から一時的に外し、既存 item の一覧では inaccessible として安全側へ倒す設計にした。

## 未対応・制約・リスク

- `chatMessage`、`agentExecutionPreset`、`skill`、`agentProfile`、`benchmarkRun` の favorite 作成は resolver 実装まで API で受け付けない。
- test runtime では既存の local fixture を維持するため `MEMORAG_ALLOW_LEGACY_LOCAL_STORE_FOR_TESTS` を `NODE_ENV=test` 限定で残している。
