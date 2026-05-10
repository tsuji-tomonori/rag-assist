# 文書削除時の欠損 manifest 500 修正

状態: in_progress

## 背景

2026-05-10 01:49:51 UTC の CloudWatch Logs で、`DELETE /documents/4ec3eb09-a00e-4f80-af55-0c2854ca0add` が `NoSuchKey` により 500 になった。
欠損 key は削除対象ではない `manifests/55ac50f5-752f-4abd-b122-9c7fb1dfc131.json` だった。
対象 S3 bucket `memoragmvpstack-documentsbucket9ec9deb9-hswy0rwuzmaw` は versioning 未設定で、当該 prefix に `55ac...` から始まる object は現存しない。

## 目的

- 障害レポートとなぜなぜ分析を残す。
- 削除対象と無関係な欠損 manifest が文書削除 API を 500 にしないよう修正する。
- 文書一覧でも一時的な stale/missing manifest による 500 を避ける。
- 認可境界を弱めずに、benchmark seed 削除の対象判定を対象 manifest に限定する。

## スコープ

- `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts`
- `memorag-bedrock-mvp/apps/api/src/routes/benchmark-seed.ts`
- `memorag-bedrock-mvp/apps/api/src/routes/document-routes.ts`
- 関連 API / service / security tests
- `reports/bugs/` と `reports/working/`

## 計画

1. 障害レポートを `reports/bugs/` に作成し、なぜなぜ分析を記載する。
2. `MemoRagService` に対象 manifest 読み取り用の public method を追加し、`listDocuments()` は `NoSuchKey` / `ENOENT` 相当のみ skip する。
3. `authorizeDocumentDelete()` は `listDocuments()` ではなく対象 manifest だけを読む。
4. DELETE route は認可中の対象 manifest 欠損も 404 に変換できるようにする。
5. 回帰テストを追加する。
6. 関連テストと `git diff --check` を実行する。

## ドキュメント保守方針

- API contract の shape は変更しないため OpenAPI / API examples の更新は不要見込み。
- 運用上の事実と再発防止は障害レポートに記録する。

## 受け入れ条件

- [ ] `reports/bugs/` に障害レポートがあり、直接原因・根本原因・なぜなぜ分析・再発防止策が記載されている。
- [ ] benchmark seed 権限での `DELETE /documents/{documentId}` が、無関係な欠損 manifest によって 500 にならない。
- [ ] `listDocuments()` が list 直後に消えた manifest object を skip し、他の manifest を返す。
- [ ] 対象 document の manifest が欠損している場合、DELETE API は 500 ではなく 404 を返す。
- [ ] 認可境界として、通常 document を benchmark seed 権限だけで削除できない。
- [ ] 関連する API test と security access-control test が通る。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `git diff --check`

## PR レビュー観点

- `benchmark:seed_corpus` の削除対象が benchmark seed manifest に限定されていること。
- 欠損 manifest の skip が `NoSuchKey` / `ENOENT` 相当に限定され、JSON 破損や権限エラーを隠していないこと。
- 未実施の検証を実施済みとして書いていないこと。

## リスク

- S3 versioning 未設定のため、削除主体の特定は CloudTrail data event / S3 access log がない限り困難。
- `listDocuments()` の欠損 skip は同時削除 race の影響緩和であり、根本的な監査性は S3 versioning / data event の運用設定に依存する。
