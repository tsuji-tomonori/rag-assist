# REQ-AUI-001: 利用実行の一意な計測

## 要件

システムは、請求・利用分析対象の各実行を、再試行しても二重計上しない一意な tenant-scoped usage record へ追跡可能にしなければならない。

## 要求属性

- 識別子: `REQ-AUI-001`
- 説明: provider quantity、attribution、measurement source、completeness を持つ usage event を集計の source of truth にする
- 根拠:現行 `AdminLedger.usage` は 0 初期化後に実行時加算されない
- 源泉: `FACT-AUI-011`–`018`, `FACT-AUI-077`–`081`; chapter spec §13
- Actor / trigger: provider 実行完了、aggregation/backfill/replay
- 種類: functional / data integrity / observability
- 依存関係: tenant attribution、retention、usage event store
- 衝突: `FR-027` の ledger summary 中心実装、PR #339 の 1,000件 Scan / tenant `default`
- 受け入れ基準: `AC-AUI-001`–`012`
- 優先度: P0
- 安定性:目的は stable、event schema/index/retention は要決定
- Confidence: confirmed
- 所有者: Platform / FinOps
- 変更履歴: 2026-07-13 proposed

## 受け入れ条件

- `AC-AUI-001`: provider quantity を返す実行ごとに一意な event が保存される。
- `AC-AUI-002`:同じ idempotency key の再送で集計が増えない。
- `AC-AUI-004`: quantity 欠測を complete zero として扱わない。
- `AC-AUI-010`:別 tenant の event を集計しない。
- `AC-AUI-011`: page/Scan 上限で event を黙って欠落させない。

## 妥当性確認

- 必要性:利用後も0という直接障害を解消する
- 十分性: chat だけでなく RAG/embedding/debug/benchmark を同じ attribution で対象化する
- 一貫性: half-open period と tenant boundary を cost/export に継承する
- 実現可能性: PR #339 の event/store を再適合候補にできる
- 検証可能性: adapter integration、idempotency、cursor、replay test で判定する

## トレース

- Task: `TASK-AUI-001`, `TASK-AUI-013`
- E2E: `E2E-AUI-001`, `E2E-AUI-002`, `E2E-AUI-016`, `E2E-AUI-017`
- Gap: `GAP-AUI-001`, `GAP-AUI-003`, `GAP-AUI-008`, `GAP-AUI-030`
- Specification: `SPEC-AUI-001`, `SPEC-AUI-013`
