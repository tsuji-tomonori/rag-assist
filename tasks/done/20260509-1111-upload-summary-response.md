# Upload summary response 化

## 背景

ファイルアップロード時に Lambda runtime が成功レスポンス送信で `413 RequestEntityTooLarge` を返した。アップロード本文ではなく、取り込み完了後に API が巨大な manifest を返している可能性が高い。

## 目的

ファイルアップロードと取り込み API が巨大な文書内容・full manifest・vector key 群を返さず、受付結果または summary のみを返すようにする。`POST /documents` は大容量ファイル用途では非推奨であることを明記する。

## 範囲

- `memorag-bedrock-mvp` API の document upload / ingest response contract
- Web の document upload client type
- OpenAPI / durable docs の該当説明
- API / Web の targeted test

## 計画

1. 既存 API と UI の upload / ingest 経路を確認する。
2. 外部返却用の文書 summary schema / type を使い、同期 ingest 系の返却を summary に縮小する。
3. `POST /documents` の非推奨方針を OpenAPI / docs に明記する。
4. UI の upload client type とテストを summary response に合わせる。
5. API / Web の targeted test と diff check を実行する。

## ドキュメント保守方針

API contract が変わるため、OpenAPI description と関連 docs を更新する。`memorag-bedrock-mvp/docs` の既存 API 例または OpenAPI 補足に最小限追記する。

## 受け入れ条件

- [x] ファイルアップロード完了/取り込み API が full `DocumentManifest` をレスポンスに含めず、summary または run status のみ返す。
- [x] `POST /documents` が大容量ファイルアップロード用途では非推奨であり、署名付き upload session + ingest run を使うべきことが API docs に明記される。
- [x] UI の通常ファイルアップロードは `/documents/uploads` と `/document-ingest-runs` を使い、`POST /documents` に base64 file payload を送らないことがテストで確認される。
- [x] 認証・認可境界、uploadId scope、benchmark seed / chatAttachment の条件付き permission を弱めない。
- [x] 変更範囲に見合う API / Web test が pass する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`
- `npm --prefix memorag-bedrock-mvp run docs:openapi:check`
- `git diff --check`

## 検証結果

- `npm ci`: pass。初回 `docs:openapi` が `tsx` 不在で失敗したため、この worktree に依存を展開した。
- `npm --prefix memorag-bedrock-mvp run docs:openapi`: 初回 fail -> import 修正後 pass。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass。
- `npm --prefix memorag-bedrock-mvp run docs:openapi:check`: pass。
- `git diff --check`: pass。

## PR レビュー観点

- full manifest / chunks / vectorKeys / raw content が upload response に混入していないか。
- OpenAPI と TypeScript 型が response contract と同期しているか。
- 既存の benchmark seed / chatAttachment ingest 権限が維持されているか。

## リスク

- `POST /documents` の response schema 変更は legacy client に影響する可能性がある。
- 同期 ingest endpoint を利用するテストや benchmark runner の期待値更新が必要になる可能性がある。

## 状態

done
