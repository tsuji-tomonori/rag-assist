# REQ-AUI-009: 真実を保つ query state と競合制御

## 要件

管理クライアントとAPIは、loading、success-empty、success-data、error、forbidden、stale、conflict を別状態として保持しなければならない。

## 要求属性

- 識別子: `REQ-AUI-009`
- 説明: runtime schema、error envelope、as-of/version、scoped retry、idempotency/optimistic concurrency を共通化する
- 根拠:現行 loader は失敗をconsoleに捨て、0/empty/null/未提供へ畳み込む
- 源泉: `FACT-AUI-004`–`008`, `FACT-AUI-053`, `FACT-AUI-058`, `FACT-AUI-063`–`066`
- Actor / trigger: admin query/mutation の開始・完了・失敗・再試行・競合
- 種類: functional / reliability / usability
- 依存関係: shared Web query state、API schemas、store version/idempotency
- 衝突: current null/array defaults、raw response text、unversioned JSON ledgers
- 受け入れ基準: `AC-AUI-106`–`116`
- 優先度: P0
- 安定性: state taxonomy と no-false-zero は stable
- Confidence: confirmed
- 所有者: Web / API Platform
- 変更履歴: 2026-07-13 proposed

## 受け入れ条件

- `AC-AUI-106`:初期失敗を0/emptyで表示しない。
- `AC-AUI-110`: schema不適合を「未提供」に変換しない。
- `AC-AUI-111`: allowlist済みerror code/message/requestIdだけを表示する。
- `AC-AUI-114`: panel単位のretryで他の成功dataを破棄しない。
- `AC-AUI-115`:旧versionの後着更新をconflictにする。

## 妥当性確認

- 必要性:料金0を含む誤認の共通原因を除く
- 十分性: query、mutation、runtime contract、freshness、retry、concurrencyを含む
- 理解容易性:利用者向け状態と開発者向けerror/requestIdを分離する
- 実現可能性: discriminated unionとETag/versionで実装可能
- 検証可能性: reducer/component/contract/concurrency testで各状態遷移を判定する

## トレース

- Task: `TASK-AUI-009`
- E2E: `E2E-AUI-002`, `E2E-AUI-006`, `E2E-AUI-008`, `E2E-AUI-011`
- Gap: `GAP-AUI-019`–`023`, `GAP-AUI-028`
- Specification: `SPEC-AUI-009`
