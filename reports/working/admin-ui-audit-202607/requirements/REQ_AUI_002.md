# REQ-AUI-002: 料金根拠の再現

## 要件

システムは、各 cost item を、usage と同一期間に有効な versioned pricing へ結び付け、数量・単位・単価・出典から再現可能にしなければならない。

## 要求属性

- 識別子: `REQ-AUI-002`
- 説明: provider/region/model/unit/effective range に一致する price で actual/estimated/unpriced/incomplete を区別する
- 根拠:固定単価、期間外件数、benchmark 単位不一致により現行 total は監査不能
- 源泉: `FACT-AUI-019`–`023`, `FACT-AUI-026`; chapter spec §13
- Actor / trigger: cost summary/detail/export の計算
- 種類: functional / financial integrity
- 依存関係: `REQ-AUI-001`、pricing owner、currency/rounding policy
- 衝突: current hardcoded rates、`FR-027` の概算契約、PR #339 wildcard pricing
- 受け入れ基準: `AC-AUI-013`–`024`
- 優先度: P0
- 安定性:計算の追跡可能性は stable、価格値は open_question
- Confidence: confirmed / open_question
- 所有者: FinOps / Platform
- 変更履歴: 2026-07-13 proposed

## 受け入れ条件

- `AC-AUI-013`: cost と usage の対象期間が一致する。
- `AC-AUI-014`: effective range に該当する pricing version だけを使う。
- `AC-AUI-015`:価格不明を0円として返さない。
- `AC-AUI-016`: quantity/unit/unit price/version/subtotal を追跡できる。
- `AC-AUI-019`: quantity unit と price unit の不一致を拒否する。

## 妥当性確認

- 必要性: 0以外の金額も根拠不明という現行問題を解消する
- 十分性:期間・単位・currency・precision・completeness を含める
- 一貫性: actual AWS bill ではなく推定である場合を明記する
- 標準・契約適合: decimal と versioned catalog を server-side で適用する
- 検証可能性:固定 fixture から同じ breakdown/total を再計算する

## トレース

- Task: `TASK-AUI-002`
- E2E: `E2E-AUI-001`, `E2E-AUI-002`, `E2E-AUI-003`
- Gap: `GAP-AUI-002`, `GAP-AUI-004`
- Specification: `SPEC-AUI-002`
