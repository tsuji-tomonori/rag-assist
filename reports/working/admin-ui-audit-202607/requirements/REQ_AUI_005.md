# REQ-AUI-005: 明示的 role delta の安全な反映

## 要件

システムは、承認された actor が明示した role grant/revoke だけを、server-side guard と version check が成功した対象へ反映しなければならない。

## 要求属性

- 識別子: `REQ-AUI-005`
- 説明:複数 role の before/after/delta/reason を確認し、self/cross-tenant/inactive/last-admin/stale を防ぐ
- 根拠:単一 select が全 role set を置換し、現行 guard と原子性が不足する
- 源泉: `FACT-AUI-031`–`043`, `FACT-AUI-073`; `FR-080`
- Actor / trigger: role grant/revoke command
- 種類: functional / security / integrity
- 依存関係: `REQ-AUI-004`, `REQ-AUI-008`, `REQ-AUI-009`
- 衝突: current `nextGroups=[selectedRole]` と unknown role drop/default
- 受け入れ基準: `AC-AUI-053`–`068`
- 優先度: P0
- 安定性: guard 原則は stable、strong-role approval policy は open_question
- Confidence: confirmed
- 所有者: Security / Identity / Web
- 変更履歴: 2026-07-13 proposed

## 受け入れ条件

- `AC-AUI-053`: grant 時に既存 role を保持する。
- `AC-AUI-054`:指定した role だけを revoke する。
- `AC-AUI-061`:最後の有効な管理者を失う変更を拒否する。
- `AC-AUI-062`:旧 version の変更を conflict にする。
- `AC-AUI-063`: identity failure 時に ledger を成功状態へ進めない。

## 妥当性確認

- 必要性:意図しない権限喪失・付与を防ぐP0境界である
- 十分性: actor/target/tenant/state/catalog/version/reason/result を guard する
- 一貫性: UI preguard は補助であり server guard を置換しない
- 実現可能性: delta command と directory reconciliation に分離できる
- 検証可能性: service/route fault injection、concurrency、browser review test で判定する

## トレース

- Task: `TASK-AUI-005`
- E2E: `E2E-AUI-005`, `E2E-AUI-006`
- Gap: `GAP-AUI-010`, `GAP-AUI-013`, `GAP-AUI-014`
- Specification: `SPEC-AUI-005`
