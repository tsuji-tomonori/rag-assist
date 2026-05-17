# folder canonical path / GSI 一意性

状態: in_progress
タスク種別: 機能追加

## 背景

章別仕様 2 章では、フォルダを `tenantId + adminPrincipalType + adminPrincipalId + normalizedCanonicalPath` で管理者単位に一意化する方針になっている。現行実装の `DocumentGroup` は `ownerUserId`、共有、manager 境界を持つが、canonical path と DynamoDB 上の一意性保証はない。

## 目的

既存の document group ACL、RAG 検索範囲、文書 upload scope を維持しながら、`DocumentGroup` に canonical path と管理者単位一意性を追加する。DynamoDB では GSI による path lookup と transaction lock item による重複防止を導入する。

## スコープ

- `DocumentGroup` 型、API schema、Web type に canonical path 系フィールドを追加する。
- 既存 document group を読み込み時に後方互換で補完する。
- create / rename / move 相当の更新で同一管理者・同一 normalized canonical path の重複を拒否する。
- DynamoDB `DocumentGroupsTable` に `AdminCanonicalPathIndex` を追加する。
- DynamoDB store は transaction lock item で path 一意性を保証する。
- Local store でも同じ制約を再現する。
- 既存データ向け backfill / duplicate detection dry-run script を用意する。
- Web folder tree で canonical path を表示・検索できるようにする。

## 含まない

- 大規模 subtree move の非同期 migration 実行基盤。
- `/document-groups` API 名の `folders` への rename。
- 本番環境への migration 実行、deploy、bootstrap。
- `ParentFolderIndex` の導入。今回の API / UI は parent query を使わないため、必須の `AdminCanonicalPathIndex` に限定する。

## 計画

1. 現行 `DocumentGroup`、store、route、Web UI、infra table 定義を確認する。
2. canonical path helper と legacy 補完を service 層へ追加する。
3. store interface を lock 付き create / update と canonical path lookup に拡張する。
4. Local store と DynamoDB store に一意性制約を実装する。
5. CDK に `AdminCanonicalPathIndex` を追加し snapshot test を更新する。
6. backfill / duplicate detection dry-run script を追加する。
7. API schema、Web type、folder tree 表示・検索、OpenAPI docs を同期する。
8. API / Web / typecheck / OpenAPI / CDK / diff check を実行する。
9. 作業レポート、commit、push、PR、受け入れ条件コメント、セルフレビューコメントまで進める。

## ドキュメント保守計画

- API schema 変更に伴い generated OpenAPI docs を更新する。
- 運用者向けに backfill dry-run script の使い方を durable docs または script header に残す。
- PR 本文と作業レポートに、GSI は一意性保証ではなく lookup 用であり、最終保証は lock item + transaction であることを明記する。

## 受け入れ条件

- [ ] `DocumentGroup` に `adminPrincipalType`, `adminPrincipalId`, `canonicalPath`, `normalizedCanonicalPath`, `normalizedName` が追加される。
- [ ] `DocumentGroup` に `tenantId`, `adminPathPk`, `parentPathPk`, `schemaVersion` が追加される。
- [ ] 既存データは読み込み時に後方互換で補完される。
- [ ] 新規作成、移動、名前変更相当の更新で、同一 `tenantId + adminPrincipalType + adminPrincipalId + normalizedCanonicalPath` の重複を拒否する。
- [ ] DynamoDB table に path lookup 用 `AdminCanonicalPathIndex` が追加される。
- [ ] DynamoDB store では transaction lock item により重複が拒否される。
- [ ] Local store でも同じ制約を再現する。
- [ ] 既存データ向け backfill / duplicate detection 方針と dry-run コマンドが用意される。
- [ ] 子孫の `ancestorGroupIds` と canonical path が移動時に再計算される。
- [ ] 子孫 move 時に canonical path と lock item が整合する。
- [ ] API schema / Web type / OpenAPI docs / infra snapshot / docs が同期する。
- [ ] 既存の document group ACL、RAG 検索範囲、文書 upload scope が退行しない。
- [ ] API test、Web test、typecheck、OpenAPI check、CDK test、`git diff --check` が通る。

## 検証計画

- `npm run test -w @memorag-mvp/api`
- `npm run test -w @memorag-mvp/web`
- `npm run typecheck --workspaces --if-present`
- `npm run docs:openapi:check`
- `task cdk:test`
- `git diff --check`

## PR レビュー観点

- GSI を一意性保証と誤認していないか。
- transaction lock item の old/new lock 更新が rename / move / subtree update で整合するか。
- legacy 補完が既存 ACL と検索範囲を弱めていないか。
- GSI 追加と IAM grant が既存 Lambda の必要権限を満たしているか。
- 大規模 subtree move の上限制御と残リスクが明記されているか。

## リスク

- 既存 table への GSI 追加は deploy 時に AWS 側 backfill が走るため、production deploy 前に duplicate dry-run を確認する必要がある。
- DynamoDB transaction は 25 item 制限があるため、大きな subtree move は同期処理では扱えない。
- 既存 legacy data に同一 owner / path 重複がある場合、backfill apply は自動修正せず blocked とする。
