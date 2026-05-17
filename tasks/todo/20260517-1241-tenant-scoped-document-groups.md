# DocumentGroup tenantId の実 tenant 化

状態: todo
タスク種別: 機能追加

## 背景

PR #321 で `tenantId` は `DocumentGroup` と path namespace に入ったが、service 層には default tenant 前提が残っている。将来の multi-tenant 運用では、tenantId を固定値ではなく認証 context / claims / request context から解決し、folder path uniqueness、ACL、RAG scope を tenant 境界で分離する必要がある。

## 目的

DocumentGroup の tenantId を実 tenant context に接続し、folder create / update / list / search / upload scope が tenant 境界を越えないようにする。

## 対象範囲

- Auth user / request context
- `MemoragService` の tenant 解決
- DocumentGroup create / list / update / move
- document upload / list / RAG retrieval scope
- path lock key / GSI partition key
- API tests、security access-control tests

## 含まない

- billing tenant 管理。
- tenant 作成 / invite UI 全体。

## 実行計画

1. current user / auth context に tenant 情報が存在するか確認する。
2. tenant 情報がない場合、tenant model と claim source を設計する task を先に切る。
3. `defaultTenantId` 依存箇所を棚卸しする。
4. service method が actor context から tenantId を解決するようにする。
5. Local auth / test fixture の tenant を整備する。
6. cross-tenant group / document access が拒否されることをテストする。
7. path lock / GSI partition key が tenant ごとに分離されることを確認する。

## ドキュメント保守計画

- tenant model の durable docs を更新する。
- API response schema が変わらない場合でも、運用上の tenant 解決方針を PR 本文に明記する。
- Security access-control policy test を更新する。

## 受け入れ条件

- `DocumentGroup` の tenantId が固定 default ではなく actor / request context から解決される。
- folder create / list / update / move は同一 tenant 内に限定される。
- document upload / list / RAG search scope が tenant 境界を越えない。
- path lock key と `AdminCanonicalPathIndex` partition key が tenant ごとに分離される。
- Local auth / test fixture で複数 tenant のケースを検証できる。
- tenant 情報が欠落した request は fail closed するか、local mode の明示 fallback に限定される。

## 検証計画

- `npm run test -w @memorag-mvp/api -- access-control document-group`
- `npm run test -w @memorag-mvp/api -- security`
- `npm run typecheck -w @memorag-mvp/api`
- `npm run docs:openapi:check`
- `git diff --check`

## PR レビュー観点

- default tenant fallback が production path に残っていないこと。
- tenant ID を client request body から無条件に信用していないこと。
- RAG retrieval と document list の tenant filter が同じ境界を使うこと。

## リスク

- 既存データの tenantId 補完と migration が未完了だと、tenant strict 化で既存 folder が見えなくなる可能性がある。
