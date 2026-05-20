# folderId metadata の scoped search 整合修正

状態: done

## 背景

PR 327 のレビューで、フォルダ権限判定は `folderId/folderIds` を認識する一方、`scope: { mode: "groups" }` の検索スコープ判定が `groupId/groupIds` だけを見ており、`folderId/folderIds` のみを持つ manifest が認可後に除外される不整合が指摘された。

## 目的

検索認可とスコープ判定でフォルダ ID metadata の扱いを揃え、lexical / semantic-only の両経路で `folderId/folderIds` manifest が指定フォルダ scope に従って検索されるようにする。

## タスク種別

修正

## なぜなぜ分析サマリ

- 問題文: `folderId/folderIds` のみを持つ folder-scoped manifest が、ユーザーに `readOnly/full` 権限があっても `scope.mode === "groups"` の指定検索で結果から除外される。
- 確認済み事実:
  - `canAccessManifest` は `metadata.folderIds ?? metadata.folderId ?? metadata.groupIds ?? metadata.groupId` を見て `FolderPermissionService` で認可している。
  - `manifestMatchesScope` は `metadata.groupIds ?? metadata.groupId` のみを scope 比較に使っている。
  - 既存回帰テストは `groupIds: ["folder-secret"]` を使っており、`folderId/folderIds` のみの manifest を検出していない。
- 推定原因:
  - フォルダ権限化の際、認可判定だけが新 metadata key に追随し、検索 scope 判定の正規化 helper が共有されていなかった。
- 根本原因:
  - 同じ「folder scope id」を表す metadata key の解釈が検索経路内で重複実装され、認可と scope filter の仕様が分岐した。
- 影響範囲:
  - `searchRag` の lexical index 構築後 filter と vector hit filter。
  - `scope.mode === "groups"` を folder-scoped search として使う呼び出し。
- 対策:
  - `folderScopeIds` helper を追加して `folderIds/folderId/groupIds/groupId` の正規化を共有する。
  - lexical scoped search の include/exclude と semantic-only の folderId 回帰テストを追加する。
- 未確認事項:
  - PR branch の最新リモートとの差分は、ネットワーク制限により `git ls-remote` では確認できなかった。ローカルに存在する PR 327 worktree を対象に修正する。

## 作業範囲

- `apps/api/src/search/hybrid-search.ts`
- `apps/api/src/search/hybrid-search.test.ts`
- 作業レポート
- PR 327 への追加 commit / push / コメント

## 実装計画

1. `folderScopeIds` を追加し、`canAccessManifest` と `manifestMatchesScope` で共有する。
2. `folderId/folderIds` のみを持つ manifest に対する scoped search 回帰テストを追加する。
3. semantic-only 経路で `folderId` manifest が scope match するテストを追加する。
4. 対象 API テストと `git diff --check` を実行する。
5. 作業レポート、commit、push、PR コメントを実施する。

## ドキュメント保守方針

実装の外部 API や運用手順は変えず、既存の検索認可仕様に実装を揃える修正のため、README / docs の更新は不要と判断する。判断理由は作業レポートと PR コメントに残す。

## 受け入れ条件

- `folderId` または `folderIds` のみを持つ manifest が、要求 scope の `groupIds` と一致する場合に folder-scoped search で返る。
- `folderId` の manifest が、要求 scope 外の場合に folder-scoped search で返らない。
- semantic-only search でも `folderId` metadata の manifest が要求 folder scope と一致する場合に返る。
- `canAccessManifest` と `manifestMatchesScope` が同じ folder scope id 正規化を使う。
- 対象テストが成功し、未実施検証は理由を記録する。

## 検証計画

- `npm run test -w @memorag-mvp/api -- --test-name-pattern "folder-scoped search|semantic-only search includes folderId|folder policy documents"`
- `git diff --check`

## PR レビュー観点

- docs と実装の同期: 外部仕様変更なし。テストと PR コメントで実装整合を説明する。
- 変更範囲に見合うテスト: 指摘された lexical include/exclude と semantic-only 経路を単体テストで追加する。
- RAG の根拠性・認可境界: folder permission による認可境界を弱めず、scope filter の取りこぼしのみ修正する。
- benchmark 期待語句・QA sample 固有値・dataset 固有分岐を実装へ入れない。

## リスク

- `scope.mode === "groups"` が legacy group scope と folder scope を兼ねているため、既存の `groupId/groupIds` 挙動を維持する必要がある。
