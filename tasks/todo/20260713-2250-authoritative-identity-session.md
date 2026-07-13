# authoritative identity と再認可の実装

- 状態: todo
- タスク種別: セキュリティ実装
- 作成日: 2026-07-13
- 関連要件・gap: `FR-058`, `FR-090`, `SQ-006`, `GAP-RD-001`, `GAP-RD-011`

## 背景

管理台帳の suspend/delete と Cognito session が連動せず、queued worker も submit 時の主体 snapshot を開始・commit 前に再検証しない。現行実装を requirements baseline に適合済みとは扱えない。

## 目的と範囲

authoritative account state を定め、同期 request と長時間処理の開始・commit 前に current identity/resource authorization を復元する。Cognito 無効化、session 失効、stale job 拒否、監査を対象とする。tenant model 自体は `20260517-1241-tenant-scoped-document-groups.md` の範囲とする。

## 受け入れ条件

- [ ] suspend/delete 後の既存 session と新規 request が fail closed になる。
- [ ] queued worker が開始・commit 前に current account/tenant/resource state を再評価する。
- [ ] state 変更と拒否を、credential や本文を含めず監査できる。
- [ ] race、retry、stale snapshot の否定試験を追加する。

## 検証・文書

- API authorization/account test、worker lifecycle test、access-control policy test を実行する。
- `FR-058`, `FR-090`, `SQ-006`、関連 DES/ADR と監視手順を実装に同期する。

## リスク

authoritative source と session 失効 SLO は `OQ-RD-004` の承認が必要であり、仮値を正式要件として固定しない。
