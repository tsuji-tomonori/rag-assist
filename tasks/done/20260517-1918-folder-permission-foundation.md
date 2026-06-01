# フォルダ権限基盤の仕様化と実効権限 service 実装

状態: done
タスク種別: 機能追加

## 背景

フォルダ canonical path / GSI / path lock の基盤は実装済みだが、フォルダ権限はまだ `DocumentGroup` の `visibility`、`sharedUserIds`、`sharedGroups`、`managerUserIds` を直接見る簡易 ACL が中心である。

仕様では `Folder / FolderPolicy / UserGroup / GroupMembership / EffectiveFolderPermission` を中心に、`none / readOnly / full`、親 policy 継承、子 explicit policy の完全上書き、full 権限者 0 人禁止を要求している。

## 目的

既存 `/document-groups` 互換を保ったまま、フォルダ権限を仕様通りに完全化するための PR-1〜PR-3 相当の基盤を実装する。

## 対象範囲

- Folder 権限 ADR の追加。
- API 型 / schema / Web type の拡張。
- `FolderPolicy`、`UserGroup`、`GroupMembership` の store interface と Local / DynamoDB 実装。
- `resolveEffectiveFolderPermission` を中心とした権限計算 service。
- AC-FOLDER-005〜009 を中心にした unit test。
- 既存 canonical path / path lock の回帰を壊さないこと。

## 含まない

- 既存 `canAccessDocumentGroup` / `canManageDocumentGroup` の全面差し替え。
- RAG 検索 / citation / debug trace / async agent mount の新 service への全面移行。
- Web 共有設定 UI、group 管理 UI。
- migration / backfill apply script。
- 監査ログ API。

上記は後続 PR で扱う。今回の PR では、後続差し替えで単一 source of truth にできる権限基盤を先に固める。

## 実装計画

1. 現行の `DocumentGroup`、schema、store、権限関数を確認する。
2. Folder 権限 ADR を追加し、互換方針と継承規則を固定する。
3. `DocumentGroup` contract に `hasExplicitPolicy`、`policyId`、`status`、`createdBy`、`effectivePermission`、`policySource`、`inheritedFromFolderId` を追加する。
4. `FolderPolicy`、`FolderPolicyEntry`、`UserGroup`、`GroupMembership` 型と schema を追加する。
5. Local / DynamoDB store interface を追加する。
6. `FolderPermissionService` を追加し、個人 owner full、group membership min 計算、親 policy 継承、子 explicit override、full principal validation を実装する。
7. unit test を追加する。
8. OpenAPI docs を同期し、API test / typecheck / lint / docs check を実行する。

## ドキュメント保守計画

- `docs/2_アーキテクチャ_ARC/21_重要決定_ADR/` に Folder 権限 ADR を追加する。
- OpenAPI schema 変更がある場合は generated docs を更新する。
- UI 実装は含まないため Web inventory は変更不要の見込み。ただし Web type を変更した場合は typecheck で確認する。

## 受け入れ条件

- [x] 最新 `origin/main` から専用 worktree で作業している。
- [x] Folder 権限 ADR が追加され、legacy 互換、継承、explicit policy、group membership、SYSTEM_ADMIN の扱いが明記されている。
- [x] `DocumentGroup` に policy / status / effective permission 系 field が追加され、API schema / Web type と同期している。
- [x] `FolderPolicy`、`FolderPolicyEntry`、`UserGroup`、`GroupMembership` の型と schema が追加されている。
- [x] `FolderPolicyStore`、`UserGroupStore`、`GroupMembershipStore` の interface と Local / DynamoDB 実装が追加されている。
- [x] `FolderPermissionService` が `resolveEffectiveFolderPermission`、`resolveEffectiveFolderPermissions`、`assertFolderPermission`、`listReadableFolderIds`、`listManageableFolderIds` を提供する。
- [x] 個人管理フォルダの管理者本人は常に `full` になる。
- [x] グループ管理フォルダは `GroupMembership.permissionLevel` と folder policy permission の min で `full / readOnly` が決まる。
- [x] 子フォルダに個別 policy がなければ、直近親方向の explicit policy を継承する。
- [x] 子フォルダに個別 policy があれば、その階層以降では子 policy が完全設定として優先される。
- [x] `full` 権限者が 0 人になる policy 保存は validation で拒否できる。
- [x] 既存 canonical path / path lock の API test が退行していない。
- [x] API test、API typecheck、API lint、OpenAPI docs check、`git diff --check` が通る。
- [x] 未実装の後続範囲は PR 本文と作業レポートで明示されている。

## 完了メモ

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/325
- 受け入れ条件コメント: PR #325 に投稿済み。
- セルフレビューコメント: PR #325 に投稿済み。
- 作業レポート: `reports/working/20260517-1936-folder-permission-foundation.md`

## 検証計画

- `npm run test -w @memorag-mvp/api`
- `npm run typecheck -w @memorag-mvp/api`
- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`
- `npm run docs:openapi:check`
- `git diff --check`

## PR レビュー観点

- 旧 ACL を広げていないこと。
- 新しい権限 service が fail closed で、archived / missing folder / missing policy を安全に扱うこと。
- group nesting と cycle guard が無限再帰しないこと。
- full 権限者 0 人禁止が direct user だけでなく active group principal も扱うこと。
- 後続で RAG / document 操作を差し替えやすい interface になっていること。

## リスク

- この PR だけでは AC-FOLDER-010 の RAG 即時除外は完全には満たさない。後続の document / search / chat 差し替え PR で実装する。
- DynamoDB store は追加するが、production wiring / migration / table 設計の完成は後続 PR になる可能性がある。
- legacy `visibility=org` は既存互換を維持する必要があるため、権限 service の default policy で扱いを明確にする。
