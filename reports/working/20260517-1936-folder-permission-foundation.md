# フォルダ権限基盤実装 作業レポート

## 受けた指示

- 最新 `main` を pull / merge してから作業する。
- フォルダ権限を仕様通りに完全化する実行計画に沿って進める。
- 仕様上の中心は `FolderPolicy`、`UserGroup`、`GroupMembership`、`EffectiveFolderPermission`、親 policy 継承、子 explicit policy override、full 権限者 0 人禁止。

## 要件整理

| 要件ID | 要件 | 対応状況 |
|---|---|---|
| R1 | 最新 `origin/main` から専用 worktree を作る | 対応 |
| R2 | PR-1 型・schema・OpenAPI 拡張 | 対応 |
| R3 | PR-2 Store 追加 | 対応 |
| R4 | PR-3 Permission service と unit test | 対応 |
| R5 | AC-FOLDER-005〜009 の基盤を自動テストで固定 | 対応 |
| R6 | AC-FOLDER-010 の RAG 即時除外まで実装 | 未対応。後続の document / search / chat 差し替え PR 対象 |

## 検討・判断

- 全体仕様を一括で UI / API / RAG / migration / audit まで実装すると差分が大きすぎるため、ユーザー提示の PR 分割案に従い PR-1〜PR-3 を今回の完了単位にした。
- `/document-groups` API 互換は維持し、内部的に `Folder = DocumentGroup` 互換として扱う方針を ADR に固定した。
- DynamoDB の policy / group / membership item は既存 `DocumentGroupsTable` に共存させる前提にし、既存 `DocumentGroup` scan がそれらを誤って拾わないよう `itemType` filter を強化した。
- `SYSTEM_ADMIN` は route-level permission を持つが、通常の resource permission は後続で service を通す方針にした。

## 実施作業

- `tasks/do/20260517-1918-folder-permission-foundation.md` を作成。
- `ARC_ADR_004.md` を追加し、Folder 権限モデル、legacy 互換、継承規則、SYSTEM_ADMIN 方針、後続範囲を記録。
- `DocumentGroup` に `hasExplicitPolicy`、`policyId`、`status`、`createdBy`、`effectivePermission`、`policySource`、`inheritedFromFolderId` を追加。
- `FolderPolicy`、`FolderPolicyEntry`、`UserGroup`、`GroupMembership` の型と schema を追加。
- Local / DynamoDB store を追加。
- `FolderPermissionService` を追加し、以下を実装。
  - `resolveEffectiveFolderPermission`
  - `resolveEffectiveFolderPermissions`
  - `resolveEffectiveFolderPermissionDetail`
  - `assertFolderPermission`
  - `listReadableFolderIds`
  - `listManageableFolderIds`
  - `saveFolderPolicy`
  - full principal validation
- AC-FOLDER-005〜009 相当の service unit test と store test を追加。
- OpenAPI generated docs を更新。
- Web `DocumentGroup` type を同期。

## 成果物

| 成果物 | 内容 |
|---|---|
| `apps/api/src/folders/folder-permission-service.ts` | 実効フォルダ権限 service |
| `apps/api/src/folders/folder-permission-service.test.ts` | 権限計算 unit test |
| `apps/api/src/adapters/*folder-policy*` | FolderPolicy store |
| `apps/api/src/adapters/*user-group*` | UserGroup store |
| `apps/api/src/adapters/*group-membership*` | GroupMembership store |
| `docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_004.md` | Folder 権限 ADR |
| `docs/generated/openapi/*.md` | DocumentGroup response schema 同期 |

## 検証

- `npm exec -w @memorag-mvp/api -- tsx --test src/folders/folder-permission-service.test.ts src/adapters/folder-permission-stores.test.ts` pass
- `npm run test:coverage -w @memorag-mvp/api` pass
  - Statements 91.47%
  - Branches 85.05%
  - Functions 90.44%
  - Lines 91.47%
- `npm run typecheck -w @memorag-mvp/api` pass
- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0` pass
- `npm run docs:openapi:check` pass
- `npm run typecheck -w @memorag-mvp/web` pass
- `npm run test -w @memorag-mvp/web` pass
- `npm run docs:web-inventory:check` pass
- `git diff --check` pass

## 未対応・制約・リスク

- `canAccessDocumentGroup` / `canManageDocumentGroup` / document 操作 / search / chat orchestration の全面差し替えは未対応。
- AC-FOLDER-010 の「共有解除後、再インデックスなしで RAG 検索対象から即時除外」は今回の基盤だけでは未完了。
- 監査ログ、share / inherit / archive / group membership API、migration / backfill、UI は後続 PR 対象。
- DynamoDB store は初期実装として scan ベースの lookup を含む。スケール対応の GSI / query adoption は後続で扱う。

## Fit 評価

総合fit: 4.2 / 5.0（約84%）

理由: ユーザー提示計画の最初に着手すべき PR-1〜PR-3 は実装・検証できた。一方で、全体完了判定に含まれる RAG 即時除外、API 全面差し替え、UI、audit、migration までは今回の PR で扱っていないため満点ではない。
