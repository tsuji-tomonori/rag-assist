# DynamoDB-backed store 統一

状態: do
タスク種別: 機能追加

## 背景

本番 CDK では DynamoDB table が用意されている一方、API runtime には LocalStore へ切り替える余地が残っている。履歴・お気に入り・担当者対応を DynamoDB-backed store に統一し、所有者境界と担当者スコープを単体テストで固定する。

## 目的

- Runtime dependency から LocalStore 選択を外し、DynamoDB 実装を既定かつ固定にする。
- お気に入りを会話履歴 item の `isFavorite` から独立した `FavoritesTable` に移す。
- 担当者対応一覧を DynamoDB Query ベースにし、通常担当者が割り当て範囲外を列挙できないようにする。
- API / Web / Infra の単体テストで主要な受け入れ条件を固定する。

## スコープ

- `apps/api` の dependency 作成、config、DynamoDB store、routes、schema、route tests。
- `apps/web` の履歴お気に入り操作と Favorites workspace。
- `infra` の DynamoDB table / GSI / Lambda env / grant。
- 必要な docs / reports / tests。

## 計画

1. 現行 store、route、web hook、infra test の構成を確認する。
2. FavoritesTable と `DynamoDbFavoriteStore` / `/favorites` route を追加する。
3. Runtime dependency を DynamoDB store 固定へ変更し、`DYNAMODB_ENDPOINT` と production `FAVORITES_TABLE_NAME` 必須化を追加する。
4. ConversationHistory route を認証 userId と favoriteStore enrichment に寄せる。
5. QuestionStore の担当者 GSI Query メソッドを追加し、`GET /questions` の権限分岐を更新する。
6. Web の favorites view を Favorites API 利用へ分離し、履歴の星操作を Favorites API へ差し替える。
7. Infra/CDK に FavoritesTable と HumanQuestionsTable GSI を追加する。
8. 変更範囲に応じた単体テスト・型チェックを実行し、必要なら修正して再実行する。
9. 作業レポート、commit、push、PR、受け入れ条件コメント、セルフレビューコメントを行う。

## ドキュメント保守方針

API endpoint、環境変数、ローカル開発の DynamoDB Local 前提が変わるため、関連 docs / README / API example の有無を検索し、必要な最小文書を更新する。更新不要と判断した文書は作業レポートに理由を残す。

## 受け入れ条件

- Runtime:
  - `USE_LOCAL_QUESTION_STORE=true` でも `questionStore` は `DynamoDbQuestionStore` になる。
  - `USE_LOCAL_CONVERSATION_HISTORY_STORE=true` でも `conversationHistoryStore` は `DynamoDbConversationHistoryStore` になる。
  - `favoriteStore` は `DynamoDbFavoriteStore` として dependencies に含まれる。
  - `DYNAMODB_ENDPOINT` 指定時、DynamoDB client がその endpoint を使う。
  - `NODE_ENV=production` で `FAVORITES_TABLE_NAME` 未設定なら config 初期化が失敗する。
- 履歴:
  - `POST /conversation-history` は body の userId を無視し、認証 userId で保存する。
  - 履歴 list は `userId` partition の `QueryCommand` を使い、`ScanCommand` を呼ばない。
  - 履歴 delete は `{ userId, id }` の composite key だけで削除する。
  - 履歴 list は FavoritesTable の `chatSession#id` 有無で `isFavorite` を付与する。
- お気に入り:
  - `DynamoDbFavoriteStore` は `ownerUserId` + `targetKey` で保存・一覧・削除する。
  - 同一 target の保存は idempotent に扱う。
  - `/favorites` は許可 targetType のみ受け付け、未知 type は 400 を返す。
  - 他 owner の item を GET / DELETE できない。
  - 一覧時に document / folder 権限を再確認し、権限なしは `accessible=false` の最小情報だけ返す。
  - Web の星ボタンは `/favorites` を呼び、`/conversation-history` 保存に依存しない。
- 担当者対応:
  - `listAssignedToUser` は assignee user / group GSI を Query し、group ごとに Query して merge / dedupe / updatedAt desc sort する。
  - 通常 `answer:edit` ユーザーの `GET /questions` は自分または所属グループ割り当てだけ返す。
  - 全件一覧は `support:ticket:read:all` または管理者権限に限定する。
  - `POST /questions` は body の requester を無視し、認証 userId を requester にする。
  - requester は自分の ticket を詳細取得できるが、internal memo / sanitized diagnostics は返さない。
  - 担当外かつ requester でもないユーザーには 404 を返す。
- Infra:
  - CDK template に `FavoritesTable`、`ownerUserId` / `targetKey` key、関連 env / grant がある。
  - `HumanQuestionsTable` に `RequesterUpdatedAtIndex`、`AssigneeUserUpdatedAtIndex`、`AssigneeGroupUpdatedAtIndex`、`StatusUpdatedAtIndex` がある。
- 移行:
  - `isFavorite=true` の履歴 item から `chatSession#id` favorite を backfill する処理と idempotency テストを追加する。

## 検証計画

- `git diff --check`
- API 変更: `npm run test -w @memorag-mvp/api`
- Web 変更: `npm run test -w @memorag-mvp/web`
- Infra 変更: `task cdk:test` または package scripts を確認したうえで同等の infra test
- 必要に応じて workspace typecheck

## PR レビュー観点

- docs と実装の同期。
- route-level permission、所有者境界、担当者境界、機微フィールドの返却制御。
- `ScanCommand` 不使用がテストで固定されていること。
- 本番 UI に mock fallback / fake count を入れていないこと。
- 未実施検証を PR 本文やコメントで実施済みにしないこと。

## リスク

- 変更範囲が API / Web / Infra にまたがり大きいため、既存 API contract やテスト fixture の更新漏れが起きやすい。
- GitHub Apps / push / PR 作成は環境権限に依存する。失敗した場合は blocked として報告する。

## 実施結果メモ

- Runtime / 履歴 / お気に入り / 担当者対応 / Infra / 移行 helper の実装と単体テストを追加した。
- Docs と generated OpenAPI を更新した。
- 検証:
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `npm run typecheck -w @memorag-mvp/web`: pass
  - `npm run typecheck -w @memorag-mvp/infra`: pass
  - `npm test -w @memorag-mvp/api`: pass
  - `npm test -w @memorag-mvp/web`: pass
  - `npm test -w @memorag-mvp/infra`: pass
  - `npm run docs:openapi:check -w @memorag-mvp/api`: pass
  - `npm run docs:infra-inventory:check`: pass
  - `npm run docs:web-inventory:check`: pass
  - `./node_modules/.bin/tsx --test apps/api/src/migrations/backfill-favorites.test.ts`: pass
  - `git diff --check`: pass
- Runtime integration で実 DynamoDB Local を起動する E2E は未実施。単体テスト、CDK template test、OpenAPI docs check で検証した。
