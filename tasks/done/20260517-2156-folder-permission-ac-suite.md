# フォルダ権限 AC 受け入れテスト補強

状態: done
タスク種別: 機能追加

## 背景

フォルダ権限基盤として `FolderPolicy`、`UserGroup`、`GroupMembership`、`FolderPermissionService` は `main` に導入済みである。一方、ユーザーから提示された完全化計画では、AC-FOLDER-001〜010 を受け入れ条件として判定できるテストケース一覧に落とし、Local / DynamoDB / permission service / search の回帰を明確にすることが求められている。

## 目的

既存基盤の上に、仕様 AC-FOLDER-001〜010 を追跡しやすい API/service/store/search テストゲートを補強する。特に、path 一意性の AC 対応と、共有解除後に再インデックスなしで RAG 検索対象から外れる AC-FOLDER-010 の回帰テストを強化する。

## 対象範囲

- 既存 `FolderPermissionService` unit test の AC 対応ケース補強。
- Local / DynamoDB document group store の path lock テストを AC-FOLDER-001〜004 に紐づく形へ補強。
- Search / RAG 側で、最新 folder permission service による共有解除後の即時除外を検証するテスト追加。
- 必要に応じたテスト helper の整理。

## 含まない

- 新規 API route、UI、migration/backfill、本番 audit API の実装。
- 既存 `/document-groups` handler の全面差し替え。
- AC-FOLDER 以外の大規模 E2E suite 全量実装。

## 実装計画

1. 既存テストと search permission flow を確認する。
2. AC-FOLDER-001〜004 の path uniqueness / rename/move rejection を Local / DynamoDB store tests に追加または明示化する。
3. AC-FOLDER-005〜009 の permission service tests に不足ケースがあれば追加する。
4. AC-FOLDER-010 として、folder policy / group membership 変更後に再インデックスなしで検索から除外されるテストを追加する。
5. 変更範囲に対応する API tests と `git diff --check` を実行する。

## ドキュメント保守計画

今回の主成果はテスト補強であり、公開 API や仕様本文は変更しない予定。既存 ADR / spec と差分が出る場合のみ docs を更新する。作業完了レポートには、docs 更新不要の判断理由を記録する。

## 受け入れ条件

- [x] AC-FOLDER-001: 同じ管理者の同一 canonical path 作成拒否を Local store test で確認する。
- [x] AC-FOLDER-002: 同じ管理者でも異なる full path は作成可能であることを Local store test で確認する。
- [x] AC-FOLDER-003: 異なる管理者の同一 canonical path は作成可能であることを Local store test で確認する。
- [x] AC-FOLDER-004: rename / move 後の path 重複拒否と DynamoDB transaction lock を test で確認する。
- [x] AC-FOLDER-005: 個人管理フォルダの管理者本人が `full` になる permission service test が通る。
- [x] AC-FOLDER-006: グループ管理フォルダの membership min 計算 test が通る。
- [x] AC-FOLDER-007: 子 folder の親 policy 継承 test が通る。
- [x] AC-FOLDER-008: 子 explicit policy の完全上書き test が通る。
- [x] AC-FOLDER-009: `full` 権限者 0 人 policy の保存拒否 test が通る。
- [x] AC-FOLDER-010: 共有解除または group membership 削除後、再インデックスなしで検索対象から除外される test が通る。
- [x] 変更範囲に対する API test と `git diff --check` が通る。

## 実施結果

- `apps/api/src/search/hybrid-search.ts` の lexical / vector manifest 再確認で `FolderPermissionService` を使用するように変更した。
- `apps/api/src/search/hybrid-search.test.ts` に、group membership 削除後に再インデックスなしで検索対象から外れる AC-FOLDER-010 回帰テストを追加した。
- `apps/api/src/adapters/local-document-group-store.test.ts` に、同一管理者の重複拒否、同一管理者の異なる full path 許可、異なる管理者の同一 path 許可を明示する test expectation を追加した。
- PR #327 を作成し、受け入れ条件確認コメントとセルフレビューコメントを投稿した。
- PR レビュー指摘を受け、folder-scoped manifest の `ownerUserId` bypass を禁止し、owner 権限喪失と semantic-only hit 除外の回帰テストを追加した。

## 検証結果

- `npm ci`: pass。依存関係未インストールのため実行。`npm audit` は既存依存の 1 moderate / 3 high を報告したが、今回の変更範囲外。
- `npm run test -w @memorag-mvp/api -- --test-name-pattern "folder|document group|search"`: pass。277 tests。
- `npm run typecheck -w @memorag-mvp/api`: pass。
- `git diff --check`: pass。
- 追加対応後 `npm run test -w @memorag-mvp/api -- --test-name-pattern "folder policy documents|service search denies group-scoped|folder|document group|search"`: pass。277 tests。
- 追加対応後 `npm run typecheck -w @memorag-mvp/api`: pass。
- 追加対応後 `git diff --check`: pass。

## 検証計画

- `npm run test -w @memorag-mvp/api -- --test-name-pattern "folder|search|hybrid|document group"`
- 必要に応じて `npm run test -w @memorag-mvp/api`
- `git diff --check`

## PR レビュー観点

- テストが仕様 AC と対応しており、未実装部分を実装済みとして扱っていないこと。
- 検索除外テストが vector metadata ではなく最新 manifest / folder permission を再確認する経路を検証していること。
- 権限外 document / folder の情報をテスト期待値に不用意に漏らしていないこと。

## リスク

- 現時点では API / UI / migration の完全化は後続 PR 範囲である。
- AC-FOLDER-010 は既存 search service の責務範囲内で検証し、chat citation/debug 全体の E2E は後続 suite で扱う。
