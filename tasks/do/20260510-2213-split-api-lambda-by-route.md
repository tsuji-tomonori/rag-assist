# API route 別 Lambda 分離

- 状態: ready_for_pr
- タスク種別: 機能追加
- branch: `codex/split-api-lambda-by-route`
- base: `origin/main`

## 背景

現在の API Gateway は通常 API と重い同期 API を同じ `ApiFunction` に向けている。重い処理に合わせて API Lambda 全体を高 memory にすると、軽い API も高単価 Lambda で処理されるためコスト効率が悪い。

ユーザー要望は「API のソースはそのまま」で、処理が重い API とそうでない API の Lambda を分けること。

## 目的

同じ `lambda-dist/api` / `index.handler` を使いながら、CDK / API Gateway の route integration だけで lightweight API と heavyweight API を分離する。

## 作業範囲

- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts`
- `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts`
- `memorag-bedrock-mvp/infra/test/__snapshots__/memorag-mvp-stack.snapshot.json`
- 必要な運用 docs

## 対象外

- `apps/api/src` 配下の API handler / route 実装変更
- API contract / OpenAPI response schema の変更
- production deploy / smoke 実行

## 方針

- `ApiFunction` は軽量 API 用として低 memory のまま維持する。
- `HeavyApiFunction` を同じ code asset / handler で追加し、高 memory / 同 timeout にする。
- catch-all `/{proxy+}` は軽量 API に向ける。
- 重い route は明示 resource として heavy integration に向ける。
- `chat-runs/{runId}/events` の streaming 専用 Lambda は既存どおり維持する。

## heavy route 初期分類

- `POST /chat`: 同期 RAG / Bedrock 呼び出し。
- `POST /search`: hybrid search / vector query。
- `POST /benchmark/query`: benchmark の同期 RAG。
- `POST /benchmark/search`: benchmark の同期 search。
- `POST /documents`: 後方互換の同期 ingest。
- `POST /documents/uploads/{uploadId}/content`: local upload body 受け取り。
- `POST /documents/uploads/{uploadId}/ingest`: upload object の同期 ingest。
- `POST /documents/{documentId}/reindex`: 同期 reindex。
- `POST /documents/{documentId}/reindex/stage`: reindex staging。
- `POST /documents/reindex-migrations/{migrationId}/cutover`: cutover。
- `POST /documents/reindex-migrations/{migrationId}/rollback`: rollback。

## 受け入れ条件

- [x] API source (`memorag-bedrock-mvp/apps/api/src`) を変更しない。
- [x] 同じ `lambda-dist/api` / `index.handler` を使う lightweight API Lambda と heavyweight API Lambda が CDK で定義される。
- [x] catch-all route は lightweight API Lambda に向く。
- [x] heavy route は API Gateway の明示 route として heavyweight API Lambda に向く。
- [x] `chat-runs/{runId}/events` の response streaming integration は既存専用 Lambda のまま維持される。
- [x] CDK assertion / snapshot test で route 振り分けが検証される。
- [x] 運用 docs に route 分離とコスト影響を記録する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/infra`
- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/infra`
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/infra`
- `npm --prefix memorag-bedrock-mvp run lint`
- `git diff --check`

## ドキュメント保守計画

API source の挙動や OpenAPI は変えないため API docs は原則更新しない。運用者向けに `docs/OPERATIONS.md` へ lightweight/heavyweight Lambda の route 分離、cost/cold start 影響、初期 heavy route 一覧を追記する。

## PR レビュー観点

- API source が変更されていないこと。
- heavy route が catch-all より具体的な API Gateway resource に定義されていること。
- streaming events route が誤って normal Lambda に戻っていないこと。
- IAM / env / state machine env の付与漏れがないこと。
- コスト影響と未実施の real deploy / smoke が明記されていること。

## リスク

- 同じ source を 2 Lambda に載せるため cold start は別々に発生する。
- 初期実装では同一 API source を維持するため IAM は既存 API Lambda と同等に揃える。route 単位の最小権限分離は後続改善。
- API Gateway の route specificity に依存するため、CDK assertion で対象 route の integration を確認する必要がある。

## 検証結果

- pass: `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/infra`
- pass: `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/infra`
- pass: `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/infra`
- pass: `npm --prefix memorag-bedrock-mvp run lint`
- pass: `git diff --check`
- not run: production deploy / smoke。インフラ定義変更のため、PR merge 後の対象環境 deploy で確認する。
