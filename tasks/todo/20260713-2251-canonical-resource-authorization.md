# canonical resource authorization と role guard の実装

- 状態: todo
- タスク種別: セキュリティ実装
- 作成日: 2026-07-13
- 関連要件・gap: `FR-057`, `FR-059`, `FR-076`, `FR-079`, `FR-080`, `FR-086`, `GAP-RD-003`, `GAP-RD-004`, `GAP-RD-022`

## 背景

legacy helper と `FolderPermissionService` が併存し、principal namespace と backend/infra/Web の role catalog が一致しない。`SYSTEM_ADMIN` の通常資源 bypass、role revoke/self/last-admin guard にも不足がある。

## 目的と範囲

認証文脈、route permission、resource/owner decision を一つの canonical authorization service と型付き principal/role catalog に統合する。break-glass は `OQ-RD-007` で承認されるまで通常 bypass として実装しない。

## 受け入れ条件

- [ ] protected route が canonical service を通り、legacy bypass が残らない。
- [ ] principal ID namespace と role catalog が API、infra、Web、store で一致する。
- [ ] self revoke、last admin、unauthorized role mutation を拒否し、監査する。
- [ ] deny、not-found masking、concurrent mutation を含む否定試験を追加する。

## 検証・文書

- API route/store/security policy test、Web permission test、CDK assertion を実行する。
- `ARC_ADR_004` と authorization/data/API design を実装に同期する。

## リスク

principal 種別、direct `full`、break-glass は `OQ-RD-003`, `OQ-RD-007`, `OQ-RD-011` の決定後に確定する。
