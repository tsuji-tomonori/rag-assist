# REQ-AUI-006: authoritative account lifecycle

## 要件

システムは、account lifecycle の確定状態を identity provider、session/token enforcement、管理 read model の間で一致させなければならない。

## 要求属性

- 識別子: `REQ-AUI-006`
- 説明: create/suspend/restore/delete を state machine として実行し、途中失敗を reconciliation する
- 根拠:現行 lifecycle は ledger のみで、停止済み user の access を強制しない
- 源泉: `FACT-AUI-044`–`050`; `FR-079`, `FR-080`
- Actor / trigger: user lifecycle command、protected request、directory sync
- 種類: functional / security / identity lifecycle
- 依存関係: identity adapter、session revocation、retention/delete policy、audit
- 衝突: current ledger-only lifecycle、JWT claim-only status、deleted actor reactivation
- 受け入れ基準: `AC-AUI-069`–`081`
- 優先度: P0
- 安定性: enforcement 原則は stable、delete/expiry値は open_question
- Confidence: confirmed
- 所有者: Identity / Security / Platform
- 変更履歴: 2026-07-13 proposed

## 受け入れ条件

- `AC-AUI-070`: identity create 失敗時に架空の active user を作らない。
- `AC-AUI-072`: suspend 後の既存 access を失効上限内に拒否する。
- `AC-AUI-074`: deleted actor load で active に戻さない。
- `AC-AUI-077`:最後の管理者を停止・削除しない。
- `AC-AUI-079`: identity/ledger 不一致を可視化・修復する。

## 妥当性確認

- 必要性:画面文言と実際のsecurity boundaryの不一致を解消する
- 十分性: createからdelete、request-time enforcement、reconciliationを含む
- 一貫性: source of truth と projection の方向を明示する
- 実現可能性: Cognito adapter と state machine/fault injection で段階実装できる
- 検証可能性: sandbox/live identity integration と保護route testを必須にする

## トレース

- Task: `TASK-AUI-006`
- E2E: `E2E-AUI-007`, `E2E-AUI-008`
- Gap: `GAP-AUI-015`, `GAP-AUI-016`, `GAP-AUI-017`
- Specification: `SPEC-AUI-006`
