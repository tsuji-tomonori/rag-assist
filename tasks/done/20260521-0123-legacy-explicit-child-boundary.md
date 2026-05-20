# legacy explicit child boundary の検索認可修正

状態: done

## 背景

PR 327 の競合解消後レビューで、`FolderPermissionService` が `hasExplicitPolicy` 定義済みかつ `policyId` なしの子フォルダを legacy explicit boundary として扱わず、親 `FolderPolicy` へフォールスルーしうると指摘された。

## 目的

`document-group-permissions.ts` と同じ意味論で、`hasExplicitPolicy !== undefined || policyId` を explicit boundary として扱い、legacy explicit private child が親の folder policy を継承して検索に露出しないようにする。

## タスク種別

修正

## なぜなぜ分析サマリ

- 問題文: 親が `FolderPolicy` を持ち、子が `hasExplicitPolicy` 定義済み・`policyId` なしの legacy explicit private folder の場合、検索認可で親 policy が子へ継承される可能性がある。
- 確認済み事実:
  - `FolderPermissionService.resolveEffectiveFolderPermissionDetail` は `hasExplicitPolicy === undefined && !policyId` の子だけ親 permission を継承する特別処理を持つ。
  - `resolvePolicyContext` は `hasExplicitPolicy && policyId` の場合だけ explicit policy として扱う。
  - `document-group-permissions.ts` は `hasExplicitPolicy !== undefined || policyId` を explicit と扱う。
  - `searchRag` は manifest 再確認で `FolderPermissionService` を使う。
- 根本原因:
  - explicit boundary の判定が `FolderPermissionService` と document group permission helper で一致していない。
- 対策:
  - `FolderPermissionService` 側でも `hasExplicitPolicy !== undefined || policyId` を explicit boundary として扱う。
  - `policyId` がない explicit marker は親へ進ませず、`legacyDefaultPolicy(folder)` に落とす。
  - `hasExplicitPolicy: true` と `false` の単体テスト、検索経路の漏洩防止テストを追加する。

## 作業範囲

- `apps/api/src/folders/folder-permission-service.ts`
- `apps/api/src/folders/folder-permission-service.test.ts`
- `apps/api/src/search/hybrid-search.test.ts`
- 作業レポート、commit、push、PR コメント

## 受け入れ条件

- `hasExplicitPolicy: true` かつ `policyId` なしの legacy explicit private child が親 `FolderPolicy` を継承せず、reader permission が `none` になる。
- `hasExplicitPolicy: false` かつ `policyId` なしの legacy explicit private child も親 `FolderPolicy` を継承せず、reader permission が `none` になる。
- `searchRag` で親 `FolderPolicy` 配下の legacy explicit private child manifest が reader に返らない。
- `folderId/folderIds` scope 正規化と既存の親共有継承期待は維持される。
- 対象 API test、API typecheck、`git diff --check` が pass する。

## 検証計画

- `npm run test -w @memorag-mvp/api -- --test-name-pattern "legacy explicit|folder-scoped search|semantic-only search includes folderId|folder policy documents|document group|search"`
- `npm run typecheck -w @memorag-mvp/api`
- `git diff --check`

## ドキュメント保守方針

既存仕様 AC-FOLDER-008 と helper 意味論へ実装を揃える修正であり、新規外部仕様追加ではないため README / docs 更新は不要と判断する。判断は作業レポートに記録する。
