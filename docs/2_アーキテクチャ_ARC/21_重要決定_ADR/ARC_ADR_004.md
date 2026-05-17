# ADR-0004: フォルダ権限は FolderPolicy と実効権限 service に集約する

- ファイル: `docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_004.md`
- 種別: `ARC_ADR`
- 作成日: 2026-05-17
- 状態: Accepted

## Context

MemoRAG のフォルダは API 互換上 `DocumentGroup` として公開されているが、現行 ACL は `visibility`、`sharedUserIds`、`sharedGroups`、`managerUserIds` を各 group item に直接持たせる簡易モデルである。

一方、フォルダ仕様は `none / readOnly / full` の実効権限、親 policy の継承、子 explicit policy の完全上書き、グループ membership permission との min 計算、full 権限者 0 人禁止、共有解除後の RAG 即時除外を要求している。

## Decision

当面の API surface は `/document-groups` を維持し、内部モデルとして `Folder = DocumentGroup` 互換を継続する。

権限設定は `FolderPolicy` に集約し、`FolderPermissionService` を実効権限の単一 source of truth にする。既存 `sharedUserIds`、`sharedGroups`、`managerUserIds`、`visibility` は移行期間の legacy input / fallback として読み取り互換を保つ。

個人管理フォルダでは `adminPrincipalType=user` かつ `adminPrincipalId` に一致する user が常に `full` を持つ。

グループ管理フォルダでは、folder policy の permission と `GroupMembership.permissionLevel` の min を実効権限にする。複数経路がある場合は max を取る。

子フォルダに explicit policy がない場合は、親方向に最も近い explicit policy を継承する。子フォルダに explicit policy がある場合、その policy は差分ではなく完全設定として扱い、親 policy を上書きする。

`SYSTEM_ADMIN` は route-level 管理 permission を持つが、通常の文書閲覧、RAG、citation、debug trace では resource permission service を通す。break-glass 的な全閲覧を導入する場合は、別 route / reason / audit log を必須にする。

## Options

| 選択肢 | 評価 |
| --- | --- |
| 既存 `DocumentGroup` ACL をそのまま拡張する | 不採用。親継承、子 override、group membership min 計算、full 0 人禁止を各呼び出し側で再実装しやすくなる。 |
| `DocumentGroup` を即座に `Folder` API へ置換する | 不採用。既存 Web UI、OpenAPI、文書 scope、upload scope の互換影響が大きい。 |
| `FolderPolicy` と実効権限 service を先に追加する | 採用。既存 API 互換を保ちながら、後続 PR で document / search / RAG / UI を段階的に差し替えられる。 |

## Consequences

### Positive

- 権限計算の中心が `FolderPermissionService` に集約される。
- 親継承と子 explicit override の仕様を service unit test で固定できる。
- 既存 API payload を受けながら、新 policy model へ段階移行できる。
- RAG 検索時に vector metadata ではなく最新 DB permission を再確認する後続実装へ進みやすくなる。

### Negative

- 移行期間は legacy ACL と `FolderPolicy` が併存する。
- この ADR の初回実装だけでは、既存 document / search / chat 経路の全面差し替えは完了しない。
- DynamoDB では policy / group / membership item が DocumentGroupsTable に共存するため、`itemType` による識別を徹底する必要がある。

## Related Requirements

- `AC-FOLDER-005`: 個人管理フォルダでは管理者本人が常に `full`。
- `AC-FOLDER-006`: グループ管理フォルダでは membership permission に従う。
- `AC-FOLDER-007`: 子フォルダに個別 policy がなければ親 policy を継承する。
- `AC-FOLDER-008`: 子フォルダに個別 policy があれば完全設定として優先する。
- `AC-FOLDER-009`: `full` 権限者が 0 人になる policy は保存できない。
- `AC-FOLDER-010`: 共有解除後、embedding 再計算なしで RAG 検索対象から即時除外される。

## Follow-up

- `canAccessDocumentGroup` / `canManageDocumentGroup` / document 操作 / search / chat orchestration を `FolderPermissionService` に差し替える。
- folder share / inherit / archive / move / group membership API を追加する。
- 共有変更、archive、membership 変更の audit log を追加する。
- 旧 ACL から `FolderPolicy` への dry-run / duplicate report / backfill apply を追加する。
- Web UI に inherited / explicit / effective permission / 影響範囲 / 理由入力を表示する。
