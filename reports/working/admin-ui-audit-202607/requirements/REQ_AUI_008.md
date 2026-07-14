# REQ-AUI-008: 管理 mutation の共通監査

## 要件

システムは、すべての管理 mutation の success、denied、conflict、failed を、tenant-scoped で改変検知可能な共通 audit event として記録しなければならない。

## 要求属性

- 識別子: `REQ-AUI-008`
- 説明: actor/tenant/action/target/before/after/reason/result/requestId/policyVersion/time を共通化し検索・exportする
- 根拠:現行 audit は成功した user/role 5 action と直近100件に限定される
- 源泉: `FACT-AUI-054`–`058`; `FR-086`; chapter spec §14
- Actor / trigger: user/role/account/alias/設定の管理 command
- 種類: security / auditability / operations
- 依存関係: retention、redaction、integrity、専用 read/export permission
- 衝突: current schema/list truncation/read permission流用/非原子的ledger
- 受け入れ基準: `AC-AUI-094`–`105`
- 優先度: P0
- 安定性: core event fields/results は stable、retention/SIEM は open_question
- Confidence: conflict
- 所有者: Security / Compliance / Platform
- 変更履歴: 2026-07-13 proposed

## 受け入れ条件

- `AC-AUI-095`: denied/conflict/failed も実際のresultで記録する。
- `AC-AUI-096`:共通fieldから操作を追跡できる。
- `AC-AUI-097`: secret/raw prompt/権限外resourceを記録・返却しない。
- `AC-AUI-098`: state changeと必須auditの片方だけを成功扱いにしない。
- `AC-AUI-100`:100件固定で無言に切り捨てない。

## 妥当性確認

- 必要性:強権限操作と拒否・競合の説明責任に不可欠
- 十分性: schema、result、query、export、permission、redaction、retentionを含む
- 一貫性: `FR-086` の共通監査契約を管理全領域へ適用する
- 標準・契約適合: append-only/immutable または同等の改変検知を採用する
- 検証可能性:各mutationのcontract testとredaction/tenant/export testで判定する

## トレース

- Task: `TASK-AUI-008`
- E2E: `E2E-AUI-010`
- Gap: `GAP-AUI-007`, `GAP-AUI-026`, `GAP-AUI-027`, `GAP-AUI-028`
- Specification: `SPEC-AUI-008`
