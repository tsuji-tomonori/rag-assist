# 文書グループの resource-level 認可と階層表示を補強する

状態: do

## 背景

仕様追加後の確認で、権限共有とディレクトリ周りについて次の不足が見つかった。

- 文書 group の読み取り共有、作成、共有更新は実装済み。
- 文書 delete / reindex / stage / cutover / rollback は route-level permission に依存しており、対象文書の group full 権限確認が弱い。
- Web のフォルダツリーは group 階層データを持つが、表示がフラット寄りで `parentGroupId` / `ancestorGroupIds` を十分に反映していない。

## 目的

文書操作の API 側 resource-level 認可を補強し、フォルダ階層が UI でも分かる状態にする。

## タスク種別

修正

## なぜなぜ分析サマリ

### 問題文

文書グループ管理者向け構成で、読み取り共有とアップロード先 group の権限確認は存在する一方、文書 delete / reindex 系操作が対象文書や migration 元文書の group full 権限まで確認していない。

### confirmed

- `service.listDocuments(user)` と `getParsedDocumentPreview(user, documentId)` は `canAccessManifest` で read 権限を確認している。
- group scoped upload は `scopedMetadata()` 経由で `assertDocumentGroupsWritable()` を呼ぶ。
- `authorizeDocumentDelete()` は `rag:doc:delete:group` を持つ場合、対象 manifest の group 管理権限確認前に許可している。
- `reindexDocument()` / `stageReindexMigration()` / `cutoverReindexMigration()` / `rollbackReindexMigration()` は route-level permission はあるが、対象文書単位の full 権限確認がない。
- `DocumentFolderTree` は `filteredFolders.map()` で一覧表示しており、階層深度を UI に出していない。

### inferred

- 仕様追加の過程で「route-level permission」と「documentGroupFull resource condition」の対応が静的 policy metadata には入ったが、既存 service method へ full 権限チェックを横断適用しきれていない。
- フォルダ階層は store/service 側のデータモデルから先に実装され、UI 表現が最低限に留まっている。

### root cause

文書操作ごとの所有 group を manifest metadata から取り出し、full 権限を service 層で共通確認する helper がなく、delete/reindex/migration 操作が route permission だけで実行できる構造になっていた。

### open_question

- group に紐づかない legacy 文書の管理者範囲は仕様上明確でない。互換性を保つため、ownerUserId がある文書は owner、group がない文書は従来 permission 保持者を許可する方針で扱う。

### 対策方針

- manifest 単位の管理可否を判定する共通 helper を service 層に追加する。
- delete / reindex / stage / cutover / rollback が対象文書または migration 対象文書の full 権限を確認するようにする。
- API テストで outsider が group scoped 文書を削除・reindex できないことを固定する。
- Web フォルダツリーを parent/ancestor に基づく階層表示へ変更し、テストで確認する。

## スコープ

- `apps/api/src/rag/memorag-service.ts`
- `apps/api/src/routes/benchmark-seed.ts`
- `apps/api/src/rag/memorag-service.test.ts`
- `apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx`
- `apps/web/src/features/documents/components/DocumentWorkspace.test.tsx`
- 必要な生成 docs / task / report

## 受け入れ条件

- [ ] group scoped 文書の delete は、対象 group の manager / owner / SYSTEM_ADMIN のみ許可される。
- [ ] group scoped 文書の reindex / stage は、対象 group の full 権限を持つ caller のみ許可される。
- [ ] cutover / rollback は migration の元文書または対象文書に対する full 権限を再確認する。
- [ ] group に紐づかない legacy 文書の既存操作互換性を不必要に壊さない。
- [ ] Web フォルダツリーが parent/child 階層を表示し、階層深度が操作可能性や件数表示を壊さない。
- [ ] 関連 API / Web テストが通る。

## 検証計画

- `npm run test -w @memorag-mvp/api -- memorag-service.test.ts`
- `npm run test -w @memorag-mvp/web -- DocumentWorkspace.test.tsx`
- `npm run typecheck -w @memorag-mvp/api`
- `npm run typecheck -w @memorag-mvp/web`
- `git diff --check`

## 実施済み検証

- `npm run test -w @memorag-mvp/api -- memorag-service.test.ts`: pass
- `npm run test -w @memorag-mvp/web -- DocumentWorkspace.test.tsx`: pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run test -w @memorag-mvp/api -- memorag-service.test.ts access-control-policy.test.ts`: pass
- `npm run docs:openapi:check`: pass
- `npm run docs:web-inventory:check`: pass
- `npm run lint`: pass
- `git diff --check`: pass

## ドキュメント維持計画

API の route 自体は追加しないため OpenAPI route docs の再生成は原則不要。Web UI inventory は DOM 解析上の行番号や構造が変わる可能性があるため、必要なら `npm run docs:web-inventory` / check を実施する。

## PR レビュー観点

- route-level permission だけで任意 documentId を操作できる抜けが残っていないか。
- SYSTEM_ADMIN / owner / manager / readOnly shared user の境界が期待通りか。
- legacy 文書の互換性を壊していないか。
- フォルダ階層 UI が架空データや固定候補に依存していないか。

## リスク

- legacy 文書の owner/group metadata が不足している場合の扱いは互換性優先とするため、厳格な group full 認可の対象外になる可能性がある。
